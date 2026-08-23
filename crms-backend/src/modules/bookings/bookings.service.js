const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const repo = require('./bookings.repository');
const resourcesService = require('../resources/resources.service');
const auditService = require('../audit/audit.service');
const { ROLES } = require('../../middleware/authorizeRole');
const notifications = require('../notifications/notifications.service');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Prisma @db.Time() columns want a Date object; the actual calendar
// date part is ignored by Postgres for a TIME column, so 1970-01-01
// is just a safe, consistent placeholder.
function toTimeValue(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

function dayOfWeekFor(dateStr) {
  // dateStr is "YYYY-MM-DD"; construct as UTC to avoid local-timezone
  // off-by-one-day surprises on the server.
  const d = new Date(`${dateStr}T00:00:00Z`);
  return DAY_NAMES[d.getUTCDay()];
}

// -----------------------------------------------------------------
// Section 19-20 of the architecture doc, step by step:
//   resource exists? active? -> timetable conflict? -> booking
//   conflict? -> determine owner -> determine approver -> create
//   booking (Pending) -> create approval request
// Wrapped in a Serializable transaction: two people submitting the
// same slot at the same instant will not both succeed — the loser
// gets a 409 Conflict and should retry, not silently create a
// double-booking. (For a stronger DB-level guarantee even under
// heavy concurrency, see the commented EXCLUDE constraint in
// prisma/migrations/000_add_auth_columns.sql.)
// -----------------------------------------------------------------
async function createBooking({ resourceId, bookingDate, startTime, endTime, purpose }, requesterUserId) {
  const startVal = toTimeValue(startTime);
  const endVal = toTimeValue(endTime);
  const dayOfWeek = dayOfWeekFor(bookingDate);

  return prisma.$transaction(
    async (tx) => {
      const resource = await tx.resource.findUnique({
        where: { resourceId },
        include: { resourceType: true },
      });
      if (!resource) throw ApiError.notFound(`Resource ${resourceId} not found`);
      if (resource.status !== 'Active') {
        throw ApiError.conflict(`Resource ${resourceId} is not currently bookable (status: ${resource.status})`);
      }

      const timetableConflicts = await repo.findTimetableConflicts(tx, {
        resourceId,
        dayOfWeek,
        startTime: startVal,
        endTime: endVal,
      });
      if (timetableConflicts.length > 0) {
        throw ApiError.conflict('This slot overlaps a scheduled class', {
          conflicts: timetableConflicts.map((t) => ({
            courseCode: t.courseCode,
            section: t.section,
            startTime: t.startTime,
            endTime: t.endTime,
          })),
        });
      }

      const bookingConflicts = await repo.findOverlappingBookings(tx, {
        resourceId,
        bookingDate,
        startTime: startVal,
        endTime: endVal,
      });
      if (bookingConflicts.length > 0) {
        throw ApiError.conflict('This slot overlaps an existing booking', {
          conflicts: bookingConflicts.map((b) => ({
            bookingId: b.bookingId,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
          })),
        });
      }

      const booking = await repo.create(tx, {
        resourceId,
        requesterUserId,
        bookingDate: new Date(bookingDate),
        startTime: startVal,
        endTime: endVal,
        purpose,
        status: 'Pending',
      });

      const approver = await resourcesService.resolveApprover(resource);
      
      // If the assigned approver IS the requester, they are booking their own resource!
      const isAutoApproved = approver && approver.userId === requesterUserId && approver.roleId !== ROLES.SUPER_ADMIN;

      if (isAutoApproved) {
        // Auto-approve Tier 1 and mark booking as Approved instantly
        await tx.booking.update({
          where: { bookingId: booking.bookingId },
          data: { status: 'Approved' }
        });
        booking.status = 'Approved';
        
        await tx.approval.create({
          data: {
            bookingId: booking.bookingId,
            approverUserId: approver.userId,
            approverRoleId: approver.roleId,
            decision: 'Approved',
            decisionAt: new Date(),
            remarks: 'Auto-approved (Requester is the Resource Owner)'
          },
        });
      } else {
        await tx.approval.create({
          data: {
            bookingId: booking.bookingId,
            approverUserId: approver?.userId ?? null,
            approverRoleId: approver?.roleId ?? null,
          },
        });
      }

      await auditService.log({
        userId: requesterUserId,
        action: 'CREATE_BOOKING',
        entityType: 'booking',
        entityId: booking.bookingId,
        details: `Requested ${resourceId} on ${bookingDate} ${startTime}-${endTime}`,
      });

      // Fetch users for notifications (tx.user check is for tests)
      const requesterUser = tx.user ? await tx.user.findUnique({ where: { userId: requesterUserId } }) : null;
      let approverUser = null;
      if (approver && approver.userId && tx.user) {
        approverUser = await tx.user.findUnique({ where: { userId: approver.userId } });
      }

      // Attach resource to booking for email template
      booking.resource = resource;

      // Send emails asynchronously
      notifications.notifyRequesterNewBooking(booking, requesterUser).catch(console.error);
      if (!isAutoApproved && approverUser) {
        notifications.notifyApproverActionRequired(booking, approverUser).catch(console.error);
      }

      return {
        ...booking,
        status: isAutoApproved ? 'Approved' : booking.status,
        approverUserId: approver?.userId ?? null
      };
    },
    { isolationLevel: 'Serializable' }
  );
}

async function getAvailability(resourceId, date) {
  const resource = await prisma.resource.findUnique({ where: { resourceId } });
  if (!resource) throw ApiError.notFound(`Resource ${resourceId} not found`);

  const dayOfWeek = dayOfWeekFor(date);
  const [timetableBlocks, bookings] = await Promise.all([
    prisma.timetable.findMany({ where: { resourceId, dayOfWeek } }),
    prisma.booking.findMany({
      where: { resourceId, bookingDate: new Date(date), status: { in: repo.ACTIVE_STATUSES } },
      include: { requester: { select: { name: true, email: true, phone: true } } }
    }),
  ]);

  return {
    resourceId,
    date,
    dayOfWeek,
    blockedByTimetable: timetableBlocks.map((t) => ({ startTime: t.startTime, endTime: t.endTime, courseCode: t.courseCode, facultyName: t.facultyName, section: t.section })),
    blockedByBookings: bookings.map((b) => ({ 
      startTime: b.startTime, 
      endTime: b.endTime, 
      status: b.status,
      purpose: b.purpose,
      requester: b.requester
    })),
  };
}

async function getById(bookingId, auth) {
  const booking = await repo.findById(bookingId);
  if (!booking) throw ApiError.notFound(`Booking ${bookingId} not found`);

  if (auth) {
    const isOwner = booking.requesterUserId === auth.userId;
    const isSuperAdmin = auth.roleId === ROLES.SUPER_ADMIN || auth.roleId === 1;
    const isInstituteAdmin = auth.roleId === ROLES.INSTITUTE_ADMIN || auth.roleId === 2;
    const isMatchingDeptAdmin =
      (auth.roleId === ROLES.DEPARTMENT_ADMIN || auth.roleId === 3) &&
      booking.resource?.departmentId === auth.departmentId;

    if (!isOwner && !isSuperAdmin && !isInstituteAdmin && !isMatchingDeptAdmin) {
      throw ApiError.forbidden('You are not authorized to view this booking');
    }
  }

  return booking;
}

async function list(filters) {
  return repo.list(filters);
}

async function cancel(bookingId, actingUserId, auth, reason = null) {
  const booking = await repo.findById(bookingId);
  if (!booking) throw ApiError.notFound(`Booking ${bookingId} not found`);

  const userId = typeof actingUserId === 'object' ? actingUserId.userId : actingUserId;
  const userAuth = auth || (typeof actingUserId === 'object' ? actingUserId : null);

  const isOwner = booking.requesterUserId === userId;
  const isAdmin = [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN].includes(userAuth?.roleId);
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Only the person who made this booking or an administrator can cancel it');
  }
  if (!['Pending', 'Approved'].includes(booking.status)) {
    throw ApiError.conflict(`Booking is already ${booking.status}, cannot cancel`);
  }

  const updated = await repo.updateStatus(null, bookingId, 'Cancelled');
  
  if (reason) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.approval.create({
      data: {
        bookingId,
        approverUserId: userId,
        approverRoleId: userAuth?.roleId,
        decision: 'Cancelled',
        decisionAt: new Date(),
        remarks: reason
      }
    });
  }
  await auditService.log({
    userId,
    action: 'CANCEL_BOOKING',
    entityType: 'booking',
    entityId: bookingId,
  });
  return updated;
}

async function getLiveStatus(dateInput, startTimeInput, endTimeInput) {
  console.log('getLiveStatus inputs:', { dateInput, startTimeInput, endTimeInput });
  let dateStr = dateInput;
  if (!dateStr) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }

  const dayOfWeek = dayOfWeekFor(dateStr);
  
  let startVal, endVal;
  
  if (startTimeInput && endTimeInput) {
    startVal = toTimeValue(startTimeInput);
    endVal = toTimeValue(endTimeInput);
  } else {
    // Default to current time point check
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    startVal = toTimeValue(`${hours}:${mins}`);
    endVal = startVal; // Point in time
  }

  const [resources, activeTimetables, activeBookings] = await Promise.all([
    prisma.resource.findMany({
      where: { status: 'Active' },
      select: { 
        resourceId: true, 
        resourceName: true, 
        resourceType: { select: { typeName: true } },
        department: { select: { branchCode: true } }, 
        block: { select: { blockCode: true } },
        allocatedBranch: true,
        allocatedSection: true,
        allocatedSemester: true,
        capacityOrAreaSqm: true
      }
    }),
    prisma.timetable.findMany({
      where: { 
        dayOfWeek, 
        startTime: { lt: endTimeInput ? endVal : new Date(startVal.getTime() + 60000) }, // End time is exclusive or +1min
        endTime: { gt: startVal }
      }
    }),
    prisma.booking.findMany({
      where: { 
        bookingDate: new Date(dateStr), 
        status: 'Approved', 
        startTime: { lt: endTimeInput ? endVal : new Date(startVal.getTime() + 60000) }, 
        endTime: { gt: startVal } 
      },
      include: { requester: { select: { name: true, email: true, phone: true } } }
    })
  ]);

  // Group overlaps by resource
  const timetableMap = {};
  for (let t of activeTimetables) {
    if (!timetableMap[t.resourceId]) timetableMap[t.resourceId] = [];
    timetableMap[t.resourceId].push(t);
  }

  const bookingMap = {};
  for (let b of activeBookings) {
    if (!bookingMap[b.resourceId]) bookingMap[b.resourceId] = [];
    bookingMap[b.resourceId].push(b);
  }

  return resources.map(r => {
    let isFree = true;
    let occupant = null;
    let occupantContact = null;
    let since = null;
    let until = null;

    if (timetableMap[r.resourceId] && timetableMap[r.resourceId].length > 0) {
      isFree = false;
      const t = timetableMap[r.resourceId][0]; // Just show the first overlapping one for simplicity
      const branch = r.allocatedBranch || r.department?.branchCode || 'Unknown Branch';
      const section = t.section || r.allocatedSection || '';
      const sectionStr = section ? ` - Sec ${section}` : '';
      let yearPrefix = '';
      const sem = r.allocatedSemester;
      if (sem) {
        if (sem === '1' || sem === '2' || sem === '2025') yearPrefix = '1st Year ';
        else if (sem === '3' || sem === '4' || sem === '2024') yearPrefix = '2nd Year ';
        else if (sem === '5' || sem === '6' || sem === '2023') yearPrefix = '3rd Year ';
        else if (sem === '7' || sem === '8' || sem === '2022') yearPrefix = '4th Year ';
        else yearPrefix = `${sem} `;
      } else {
        yearPrefix = '1st Year '; // Fallback since the OCR was for 1st years
      }
      
      let occupantStr = `Class: ${t.courseCode} (${yearPrefix}${branch}${sectionStr})`;
      if (t.facultyName) {
        occupantStr += ` • Faculty: ${t.facultyName}`;
      }
      occupant = occupantStr;
      since = t.startTime;
      until = t.endTime;
    } else if (bookingMap[r.resourceId] && bookingMap[r.resourceId].length > 0) {
      isFree = false;
      const b = bookingMap[r.resourceId][0];
      const req = b.requester;
      occupant = `Event: ${b.purpose} (${req?.name})`;
      occupantContact = {
        name: req?.name,
        email: req?.email,
        phone: req?.phone
      };
      since = b.startTime;
      until = b.endTime;
    }

    return {
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      resourceType: r.resourceType?.typeName || 'Unknown Type',
      department: r.department?.branchCode || 'Shared',
      block: r.block?.blockCode || '-',
      capacity: r.capacityOrAreaSqm ? Number(r.capacityOrAreaSqm) : null,
      isFree,
      occupant,
      occupantContact,
      since,
      until
    };
  });
}

module.exports = { createBooking, getAvailability, getById, list, cancel, dayOfWeekFor, getLiveStatus };
