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
//     approver = the Department Admin (role_id 3) for that department.
//   - fallback (no matching admin found, e.g. a department has no
//     admin configured yet) -> Super Admin, so nothing silently
//     never gets approved.
// -----------------------------------------------------------------
const INSTITUTE_OWNED_TYPES = new Set(['Seminar Hall', 'Auditorium']);

async function resolveApprover(resource) {
  const isInstituteOwned = !resource.departmentId || INSTITUTE_OWNED_TYPES.has(resource.resourceType.typeName);

  const approver = isInstituteOwned
    ? await prisma.user.findFirst({ where: { roleId: ROLES.INSTITUTE_ADMIN, status: 'Active' } })
    : resource.departmentId
    ? await prisma.user.findFirst({
        where: { roleId: ROLES.DEPARTMENT_ADMIN, departmentId: resource.departmentId, status: 'Active' },
      })
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
    
    // Extract capacity: "for 100 students", "120 people", "seats 60", "50 cap"
    const capMatch = q.match(/(?:for|seats?|capacity|around|about)?\s*(\d{2,4})\s*(?:students?|people|seats?|members?|attendees?|persons?|capacity)?/i);
    if (capMatch && !targetCapacity) {
      const parsedNum = parseInt(capMatch[1], 10);
      if (parsedNum >= 10 && parsedNum <= 2000) {
        targetCapacity = parsedNum;
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

    // Extract block hints: "b block", "d-block", "block e"
    if (!targetBlockId) {
      const blockMatch = q.match(/(?:block\s*([a-zA-Z0-9]+)|([a-zA-Z0-9]+)\s*block)/i);
      if (blockMatch) {
        const blockCode = (blockMatch[1] || blockMatch[2]).toUpperCase();
        const foundBlock = await prisma.block.findFirst({ where: { blockCode } });
        if (foundBlock) targetBlockId = foundBlock.blockId;
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
  const enrichedRooms = await prisma.resource.findMany({
    where: {
      resourceId: { in: availableRooms.map(r => r.resourceId) },
      status: 'Active'
    },
    include: {
      resourceType: true,
      department: true,
      block: true
    }
  });

  // 5. Intelligent Multi-Criteria Scoring & Ranking Engine
  const scoredRecommendations = enrichedRooms.map(room => {
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
          // Optimal fit (not oversized, not wasted)
          score += 25;
          reasons.push(`Optimal seating size (${Math.floor(roomCapacity)} capacity for ~${targetCapacity} people)`);
          tags.push('Optimal Capacity');
        } else if (ratio >= 0.4) {
          score += 15;
          reasons.push(`Comfortably spacious (${Math.floor(roomCapacity)} seats)`);
        } else {
          score += 5; // Oversized
          reasons.push(`High capacity hall (${Math.floor(roomCapacity)} seats)`);
        }
      } else {
        // Undersized room penalty
        score -= 40;
        reasons.push(`Under required capacity (${Math.floor(roomCapacity)} < ${targetCapacity})`);
      }
    } else {
      reasons.push(`Capacity: ${Math.floor(roomCapacity)} seats`);
    }

    // Resource Type Match
    if (targetTypeId) {
      if (room.resourceTypeId === targetTypeId) {
        score += 20;
        reasons.push(`Exact type match: ${room.resourceType.typeName}`);
        tags.push(room.resourceType.typeName);
      }
    }

    // Block / Location Match
    if (targetBlockId && room.blockId === targetBlockId) {
      score += 15;
      reasons.push(`Located in preferred Block ${room.block?.blockCode}`);
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

    // Clamp score to 100
    const matchPercentage = Math.min(99, Math.max(45, score));

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
  });

  // Sort descending by match score
  scoredRecommendations.sort((a, b) => b.matchScore - a.matchScore);

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
    totalAvailable: scoredRecommendations.length,
    recommendations: scoredRecommendations.slice(0, 8) // Top 8 best matches
  };
}

module.exports = { list, getById, create, update, resolveApprover, aiRecommend, INSTITUTE_OWNED_TYPES };
