const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const repo = require('./resources.repository');
const auditService = require('../audit/audit.service');
const { ROLES } = require('../../middleware/authorizeRole');

// -----------------------------------------------------------------
// Section 56 of the architecture doc, implemented literally:
//   Booking -> Resource -> Owner -> Owner Type -> Approval Policy -> Approver
// NEVER branch on resource name or type name here (e.g.
// `if (resourceName === 'Seminar Hall')`). Ownership is data
// (resource.departmentId / resourceType.typeName), not a hardcoded
// list, so adding resource #322 needs zero code changes.
//
// Rule encoded below:
//   - resourceType is Seminar Hall or Auditorium -> INSTITUTE-owned,
//     approver = any active Institute Admin (role_id 2).
//   - everything else -> DEPARTMENT-owned via resource.departmentId,
//     approver = the Department Admin (role_id 3) for that department:
//     preferably one explicitly assigned it via managedDepartments
//     (e.g. csehead.dscs for CSE-DS), otherwise one whose primary
//     department it is.
//   - fallback (no matching admin found, e.g. a department has no
//     admin configured yet) -> Super Admin, so nothing silently
//     never gets approved.
// -----------------------------------------------------------------
const INSTITUTE_OWNED_TYPES = new Set(['Seminar Hall', 'Auditorium']);

async function findDepartmentAdmin(departmentId) {
  const base = { roleId: ROLES.DEPARTMENT_ADMIN, status: 'Active' };
  const orderBy = { userId: 'asc' };
  return (
    (await prisma.user.findFirst({
      where: { ...base, managedDepartments: { some: { departmentId } } },
      orderBy,
    })) ||
    (await prisma.user.findFirst({ where: { ...base, departmentId }, orderBy }))
  );
}

async function resolveApprover(resource) {
  const isInstituteOwned = !resource.departmentId || INSTITUTE_OWNED_TYPES.has(resource.resourceType.typeName);

  const approver = isInstituteOwned
    ? await prisma.user.findFirst({ where: { roleId: ROLES.INSTITUTE_ADMIN, status: 'Active' }, orderBy: { userId: 'asc' } })
    : resource.departmentId
    ? await findDepartmentAdmin(resource.departmentId)
    : null;

  if (approver) return approver;

  return prisma.user.findFirst({ where: { roleId: ROLES.SUPER_ADMIN, status: 'Active' } });
}

async function list(filters) {
  return repo.list(filters);
}

async function getById(resourceId) {
  const resource = await repo.findById(resourceId);
  if (!resource) throw ApiError.notFound(`Resource ${resourceId} not found`);
  return resource;
}

async function create(data, actingUserId) {
  const resource = await repo.create(data);
  await auditService.log({
    userId: actingUserId,
    action: 'CREATE_RESOURCE',
    entityType: 'resource',
    entityId: resource.resourceId,
    details: `Created ${resource.resourceName}`,
  });
  return resource;
}

async function update(resourceId, data, actingUserId) {
  const before = await getById(resourceId);
  const after = await repo.update(resourceId, data);
  await auditService.log({
    userId: actingUserId,
    action: 'UPDATE_RESOURCE',
    entityType: 'resource',
    entityId: resourceId,
    details: `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
  });
  return after;
}

async function aiRecommend({ query, date, startTime, endTime, capacity, blockId, departmentId, resourceTypeId }) {
  const bookingsService = require('../bookings/bookings.service');
  
  // 1. Parse natural language specifications if query is provided
  let targetCapacity = capacity ? Number(capacity) : null;
  let targetBlockId = blockId ? Number(blockId) : null;
  let targetDeptId = departmentId ? Number(departmentId) : null;
  let targetTypeId = resourceTypeId ? Number(resourceTypeId) : null;
  let targetDate = date;
  let targetStart = startTime;
  let targetEnd = endTime;

  if (query) {
    const q = query.toLowerCase();
    
    // Extract capacity: "3000+ capacity", "3000 capacity", "for 100 students", "120 people", "seats 60"
    if (!targetCapacity) {
      const capMatch = q.match(/(\d+)\s*(?:\+|plus)?\s*(?:students?|people|seats?|members?|attendees?|persons?|capacity)?/i) ||
                       q.match(/(?:for|seats?|capacity|around|about)\s*(\d+)/i);
      if (capMatch) {
        const parsedNum = parseInt(capMatch[1], 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          targetCapacity = parsedNum;
        }
      }
    }

    // Extract time hints if not explicitly provided
    if (!targetStart && !targetEnd) {
      if (q.includes('morning') || q.includes('fn')) {
        targetStart = '09:00';
        targetEnd = '12:40';
      } else if (q.includes('afternoon') || q.includes('an')) {
        targetStart = '13:30';
        targetEnd = '16:30';
      }
    }

    // Extract resource type hints
    if (!targetTypeId) {
      if (q.includes('seminar') || q.includes('auditorium')) {
        const types = await prisma.resourceType.findMany();
        const found = types.find(t => t.typeName.toLowerCase().includes('seminar') || t.typeName.toLowerCase().includes('auditorium'));
        if (found) targetTypeId = found.resourceTypeId;
      } else if (q.includes('lab') || q.includes('laboratory')) {
        const types = await prisma.resourceType.findMany();
        const found = types.find(t => t.typeName.toLowerCase().includes('lab'));
        if (found) targetTypeId = found.resourceTypeId;
      } else if (q.includes('classroom') || q.includes('class')) {
        const types = await prisma.resourceType.findMany();
        const found = types.find(t => t.typeName.toLowerCase().includes('class'));
        if (found) targetTypeId = found.resourceTypeId;
      }
    }

    // Extract block hints: e.g., "in block A", "block a", "a-block", "b block"
    if (!targetBlockId && !q.includes('all blocks') && !q.includes('any block')) {
      // Matches "block A", "block-a", "block: a", "a block", "a-block"
      const blockMatch = q.match(/\bblock\s*[:\-\s]?\s*([a-zA-Z0-9]+)\b/i) || q.match(/\b([a-zA-Z0-9]+)\s*[\-]?block\b/i);
      if (blockMatch) {
        const candidate = (blockMatch[1]).toUpperCase();
        if (candidate !== 'ALL' && candidate !== 'ANY') {
          const foundBlock = await prisma.block.findFirst({
            where: {
              OR: [
                { blockCode: candidate },
                { blockName: { contains: candidate, mode: 'insensitive' } }
              ]
            }
          });
          if (foundBlock) targetBlockId = foundBlock.blockId;
        }
      }
    }
  }

  // Fallback to today and standard slots if not specified
  if (!targetDate) {
    const now = new Date();
    targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (!targetStart) targetStart = '09:00';
  if (!targetEnd) targetEnd = '17:00';

  // 2. Fetch live authentic availability status for all active resources
  const liveStatusList = await bookingsService.getLiveStatus(targetDate, targetStart, targetEnd);

  // 3. Filter only genuinely FREE rooms (no class timetable conflicts, no approved bookings)
  const availableRooms = liveStatusList.filter(r => r.isFree);

  // 4. Enrich with full database details for accurate scoring
  // If targetBlockId was explicitly requested by user (e.g. "in block A"), strictly filter to that block!
  const whereClause = {
    resourceId: { in: availableRooms.map(r => r.resourceId) },
    status: 'Active'
  };
  if (targetBlockId) {
    whereClause.blockId = targetBlockId;
  }

  const enrichedRooms = await prisma.resource.findMany({
    where: whereClause,
    include: {
      resourceType: true,
      department: true,
      block: true
    }
  });

  // 5. Intelligent Multi-Criteria Scoring & Ranking Engine
  const scoreRoom = (room, isAlternative = false) => {
    let score = 70; // Base score for being fully available
    const reasons = ['Available with zero conflicts'];
    const tags = [];

    const roomCapacity = room.capacityOrAreaSqm ? Number(room.capacityOrAreaSqm) : 60;

    // Capacity Match Scoring
    if (targetCapacity) {
      if (roomCapacity >= targetCapacity) {
        // Room accommodates requested crowd
        const ratio = targetCapacity / roomCapacity;
        if (ratio >= 0.7) {
          score += 25;
          reasons.push(`Optimal seating size (${Math.floor(roomCapacity)} capacity for ~${targetCapacity} people)`);
          tags.push('Optimal Capacity');
        } else if (ratio >= 0.4) {
          score += 18;
          reasons.push(`Comfortably spacious (${Math.floor(roomCapacity)} seats)`);
        } else {
          score += 10;
          reasons.push(`High capacity hall (${Math.floor(roomCapacity)} seats)`);
        }
      } else {
        // Severe disqualifying penalty: If room is less than requested capacity, it cannot host the event!
        const shortage = 1 - (roomCapacity / targetCapacity);
        score -= Math.round(shortage * 60 + 20); // e.g. 116 vs 3000 -> shortage ~0.96 -> score -78
        reasons.push(`Under required capacity (${Math.floor(roomCapacity)} < ${targetCapacity})`);
      }
    } else {
      reasons.push(`Capacity: ${Math.floor(roomCapacity)} seats`);
    }

    // Resource Type Match
    if (targetTypeId) {
      if (room.resourceTypeId === targetTypeId) {
        score += 30; // Heavy boost for matching user requested type
        reasons.push(`Exact type match: ${room.resourceType.typeName}`);
        tags.push(room.resourceType.typeName);
      } else if (isAlternative) {
        tags.push(room.resourceType.typeName);
      }
    }

    // Block / Location Match
    if (targetBlockId && room.blockId === targetBlockId) {
      score += 15;
      reasons.push(`Located in Block ${room.block?.blockCode}`);
      tags.push(`Block ${room.block?.blockCode}`);
    }

    // Department match if specified
    if (targetDeptId && room.departmentId === targetDeptId) {
      score += 10;
      reasons.push(`Home department resource (${room.department?.branchCode})`);
      tags.push(room.department?.branchCode);
    }

    // Floor preference bonus (lower floors preferred for quick access)
    if (room.floor && (room.floor === '0' || room.floor === '1' || room.floor === 'G')) {
      score += 5;
      tags.push('Easy Ground Access');
    }

    // Cap score at 99 max
    const matchPercentage = Math.min(99, Math.max(0, score));

    return {
      resourceId: room.resourceId,
      resourceName: room.resourceName,
      resourceType: room.resourceType.typeName,
      department: room.department?.departmentName || 'Campus General',
      branchCode: room.department?.branchCode || 'All',
      block: room.block?.blockCode || '-',
      floor: room.floor || 'G',
      capacity: Math.floor(roomCapacity),
      matchScore: matchPercentage,
      reasons,
      tags,
      targetDate,
      targetStart,
      targetEnd
    };
  };

  let primaryRecommendations = [];
  let alternativeSuggestions = [];
  let alternativeMessage = null;

  if (targetTypeId) {
    // Separate by requested type vs other types
    const matchingTypeRooms = enrichedRooms.filter(r => r.resourceTypeId === targetTypeId);
    const otherTypeRooms = enrichedRooms.filter(r => r.resourceTypeId !== targetTypeId);

    // Score primary matching rooms and filter out poor matches under 50%
    primaryRecommendations = matchingTypeRooms
      .map(r => scoreRoom(r, false))
      .filter(r => r.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore);

    // If target capacity requested, find alternative types that actually satisfy the capacity!
    if (targetCapacity) {
      alternativeSuggestions = otherTypeRooms
        .filter(r => (r.capacityOrAreaSqm ? Number(r.capacityOrAreaSqm) : 0) >= targetCapacity)
        .map(r => scoreRoom(r, true))
        .filter(r => r.matchScore >= 50)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
    } else {
      alternativeSuggestions = otherTypeRooms
        .map(r => scoreRoom(r, true))
        .filter(r => r.matchScore >= 50)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
    }

    if (alternativeSuggestions.length > 0) {
      const distinctTypes = [...new Set(alternativeSuggestions.map(s => s.resourceType))];
      alternativeMessage = `There are also ${distinctTypes.join('s, ')}s with this capacity (${targetCapacity ? `${targetCapacity}+ seats` : 'available'}):`;
    }
  } else {
    // No specific type requested -> score all and filter out matches < 50%
    primaryRecommendations = enrichedRooms
      .map(r => scoreRoom(r, false))
      .filter(r => r.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  return {
    parsedCriteria: {
      query,
      targetCapacity,
      targetDate,
      targetStart,
      targetEnd,
      targetBlockId,
      targetTypeId
    },
    totalAvailable: enrichedRooms.length,
    recommendations: primaryRecommendations.slice(0, 8), // Top matches >= 50%
    alternativeMessage,
    alternativeSuggestions
  };
}

module.exports = { list, getById, create, update, resolveApprover, aiRecommend, INSTITUTE_OWNED_TYPES };
