const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const repo = require('./bookings.repository');
const resourcesService = require('../resources/resources.service');
const auditService = require('../audit/audit.service');
const { ROLES, departmentScopeOf } = require('../../middleware/authorizeRole');
const notifications = require('../notifications/notifications.service');
const { getCached, setCached, invalidateKeys } = require('../../config/redis');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Booking and timetable TIME columns hold campus wall-clock time (IST),
// while the server itself runs in UTC — so "now" must be shifted to IST
// before comparing it with anything stored in the database.
const IST_OFFSET_MINUTES = 330;

// A free gap shorter than this (e.g. the 5 minutes between back-to-back
// periods) isn't bookable, so it doesn't stop a room counting as full.
const MIN_FREE_GAP_MINUTES = 15;

function nowInIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MINUTES * 60000);
  return {
    dateStr: ist.toISOString().slice(0, 10),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHMM(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// Prisma returns TIME columns as Dates on 1970-01-01 with the stored
// wall-clock time in the UTC fields.
function timeValueToMinutes(timeVal) {
  const d = new Date(timeVal);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

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

  if (endVal <= startVal) {
    throw ApiError.badRequest('End time must be strictly after start time');
  }

  // YYYY-MM-DD strings compare correctly as plain strings.
  const now = nowInIST();
  if (
    bookingDate < now.dateStr ||
    (bookingDate === now.dateStr && hhmmToMinutes(startTime) < now.minutes)
  ) {
    throw ApiError.badRequest('Cannot book a time slot in the past');
  }

  if (bookingDate > addDays(now.dateStr, 15)) {
    throw ApiError.badRequest('Cannot book more than 15 days in advance');
  }

  const dayOfWeek = dayOfWeekFor(bookingDate);

  const result = await prisma.$transaction(
    async (tx) => {
      // Row lock on the resource to strictly serialize concurrent bookings on this specific room
      await tx.$queryRaw`SELECT 1 FROM resources WHERE resource_id = ${resourceId} FOR UPDATE`;

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
      
      await tx.approval.create({
        data: {
          bookingId: booking.bookingId,
          approverUserId: approver?.userId ?? null,
          approverRoleId: approver?.roleId ?? null,
        },
      });

      await auditService.log({
        userId: requesterUserId,
        action: 'CREATE_BOOKING',
        entityType: 'booking',
        entityId: booking.bookingId,
        details: `Requested ${resourceId} on ${bookingDate} ${startTime}-${endTime}`,
        tx,
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
      if (approverUser) {
        notifications.notifyApproverActionRequired(booking, approverUser).catch(console.error);
      }

      return {
        ...booking,
        status: booking.status,
        approverUserId: approver?.userId ?? null
      };
    },
    { isolationLevel: 'Serializable' }
  );

  // Awaited so the requester's immediate availability refresh can't
  // read the stale cached strip (invalidateKeys never throws).
  await invalidateKeys(`avail:${resourceId}:*`);

  return result;
}

async function getAvailability(resourceId, date) {
  const cacheKey = `avail:${resourceId}:${date}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const resource = await prisma.resource.findUnique({ where: { resourceId } });
  if (!resource) throw ApiError.notFound(`Resource ${resourceId} not found`);

  const dayOfWeek = dayOfWeekFor(date);
  const [timetableBlocks, bookings] = await Promise.all([
    prisma.timetable.findMany({ 
      where: { resourceId, dayOfWeek },
      include: { department: true } 
    }),
    prisma.booking.findMany({
      where: { resourceId, bookingDate: new Date(date), status: { in: repo.ACTIVE_STATUSES } },
      include: { requester: { select: { name: true, email: true, phone: true } } }
    }),
  ]);

  const availability = {
    resourceId,
    date,
    dayOfWeek,
    blockedByTimetable: timetableBlocks.map((t) => ({ 
      startTime: t.startTime, 
      endTime: t.endTime, 
      courseCode: t.courseCode, 
      courseName: t.courseName, 
      facultyName: t.facultyName, 
      section: t.section,
      studentYear: t.studentYear,
      program: t.program,
      branchCode: t.department?.branchCode || null
    })),
    blockedByBookings: bookings.map((b) => ({ 
      startTime: b.startTime, 
      endTime: b.endTime, 
      status: b.status,
      purpose: b.purpose,
      requester: b.requester
    })),
  };

  // Cache for 120 seconds in Redis
  await setCached(cacheKey, availability, 120);

  return availability;
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
      departmentScopeOf(auth).includes(booking.resource?.departmentId);

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

  const cancelled = await prisma.$transaction(
    async (tx) => {
      const updated = await repo.updateStatusIfCurrent(tx, bookingId, 'Cancelled', ['Pending', 'Approved']);
      if (!updated) {
        throw ApiError.conflict('Booking was already cancelled or decided');
      }

      const pendingApprovals = await tx.approval.updateMany({
        where: { bookingId: Number(bookingId), decision: null },
        data: { 
          decision: 'Cancelled', 
          remarks: reason || 'Cancelled by requester', 
          decisionAt: new Date(),
          approverUserId: userId
        }
      });

      if (pendingApprovals.count === 0 && reason) {
        // If there were no pending approvals (e.g. it was already approved), create a record to store the cancellation reason
        await tx.approval.create({
          data: {
            bookingId: Number(bookingId),
            approverUserId: userId,
            approverRoleId: userAuth?.roleId,
            decision: 'Cancelled',
            decisionAt: new Date(),
            remarks: reason,
          },
        });
      }

      await auditService.log({
        userId,
        action: 'CANCEL_BOOKING',
        entityType: 'booking',
        entityId: bookingId,
        details: reason || undefined,
        tx,
      });

      return updated;
    },
    { isolationLevel: 'Serializable' }
  );

  // Invalidate cached availability for the room
  if (booking.resourceId) {
    await invalidateKeys(`avail:${booking.resourceId}:*`);
  }

  return cancelled;
}

function classLabel(t, resource) {
  const branch = t.department?.branchCode || resource.allocatedBranch || resource.department?.branchCode || 'Unknown Branch';
  const section = t.section || resource.allocatedSection || '';
  const sectionStr = section ? ` - Sec ${section}` : '';
  let yearPrefix = '';
  if (t.studentYear) {
    if (t.studentYear == 1) yearPrefix = '1st Year ';
    else if (t.studentYear == 2) yearPrefix = '2nd Year ';
    else if (t.studentYear == 3) yearPrefix = '3rd Year ';
    else if (t.studentYear == 4) yearPrefix = '4th Year ';
    else yearPrefix = `${t.studentYear} Year `;
    if (t.program === 'MTECH') yearPrefix = `M.Tech ${yearPrefix}`;
    else if (t.program === 'MCA') yearPrefix = `MCA ${yearPrefix}`;
  }
  return `${yearPrefix}${branch}${sectionStr}`;
}

function describeOccupancy(entry, resource) {
  const startTime = minutesToHHMM(entry.start);
  const endTime = minutesToHHMM(entry.end);
  if (entry.kind === 'class') {
    const t = entry.row;
    return {
      type: 'class',
      startTime,
      endTime,
      courseCode: t.courseCode,
      courseName: t.courseName || '',
      branchStr: classLabel(t, resource),
      facultyName: t.facultyName || '',
    };
  }
  const b = entry.row;
  return {
    type: 'event',
    status: b.status,
    startTime,
    endTime,
    purpose: b.purpose,
    requesterName: b.requester?.name,
  };
}

// Gaps inside [bookableFrom, windowEnd) not covered by any entry
// (entries sorted by start), keeping only gaps long enough to book.
// bookableFrom is the window start, or "now" for the rest of today.
function freeGaps(entries, windowStart, windowEnd, bookableFrom = windowStart) {
  const minGap = Math.min(MIN_FREE_GAP_MINUTES, windowEnd - windowStart);
  const gaps = [];
  let cursor = Math.max(windowStart, bookableFrom);
  for (const e of entries) {
    if (e.start > cursor) gaps.push({ start: cursor, end: Math.min(e.start, windowEnd) });
    cursor = Math.max(cursor, e.end);
    if (cursor >= windowEnd) break;
  }
  if (cursor < windowEnd) gaps.push({ start: cursor, end: windowEnd });
  return gaps.filter((g) => g.end - g.start >= minGap);
}

// Room occupancy for one date and time window (campus time, HH:MM).
// With no times — or equal start and end — it checks a single instant,
// defaulting to right now. Each room comes back as:
//   status: 'Free' (nothing in the window), 'Partial' (some bookable
//           time left) or 'Full' (no bookable time left / busy at that instant)
//   occupantList: the classes and Pending/Approved bookings in the window
//   freeSlots: the bookable gaps left in the window (for today, only
//           the part of each gap that is still in the future)
//   inUseNow / currentOccupant: what is happening in the room right now,
//           whatever window was asked for (only when the date is today)
async function getLiveStatus(dateInput, startTimeInput, endTimeInput) {
  const now = nowInIST();
  const dateStr = dateInput || now.dateStr;
  const dayOfWeek = dayOfWeekFor(dateStr);
  const isToday = dateStr === now.dateStr;

  let windowStart = now.minutes;
  let windowEnd = now.minutes;
  if (startTimeInput && endTimeInput) {
    windowStart = hhmmToMinutes(startTimeInput);
    windowEnd = hhmmToMinutes(endTimeInput);
  }
  const isInstant = windowEnd <= windowStart;

  // Whole-day rows are fetched (not just the window) so "in use right
  // now" can be reported even when the requested window is later today.
  const [resources, classes, bookings] = await Promise.all([
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
        capacityOrAreaSqm: true,
      },
    }),
    prisma.timetable.findMany({
      where: { dayOfWeek, resourceId: { not: null } },
      include: { department: { select: { branchCode: true } } },
    }),
    prisma.booking.findMany({
      where: { bookingDate: new Date(dateStr), status: { in: repo.ACTIVE_STATUSES } },
      include: { requester: { select: { name: true, email: true, phone: true } } },
    }),
  ]);

  const entriesByResource = {};
  const addEntry = (resourceId, entry) => {
    // Skip malformed rows such as an 11:00 -> 00:00 class.
    if (entry.end <= entry.start) return;
    (entriesByResource[resourceId] ||= []).push(entry);
  };
  for (const t of classes) {
    addEntry(t.resourceId, {
      kind: 'class',
      start: timeValueToMinutes(t.startTime),
      end: timeValueToMinutes(t.endTime),
      row: t,
    });
  }
  for (const b of bookings) {
    addEntry(b.resourceId, {
      kind: 'booking',
      start: timeValueToMinutes(b.startTime),
      end: timeValueToMinutes(b.endTime),
      row: b,
    });
  }

  const inWindow = (e) =>
    isInstant
      ? e.start <= windowStart && windowStart < e.end
      : e.start < windowEnd && e.end > windowStart;

  return resources.map((r) => {
    const entries = (entriesByResource[r.resourceId] || []).sort(
      (a, b) => a.start - b.start || a.end - b.end
    );
    const windowEntries = entries.filter(inWindow);
    const gaps = isInstant
      ? []
      : freeGaps(windowEntries, windowStart, windowEnd, isToday ? now.minutes : windowStart);

    let status = 'Free';
    if (windowEntries.length > 0) status = isInstant || gaps.length === 0 ? 'Full' : 'Partial';

    // A pending request isn't someone physically using the room.
    const current = isToday
      ? entries.find(
          (e) =>
            e.start <= now.minutes &&
            now.minutes < e.end &&
            (e.kind === 'class' || e.row.status === 'Approved')
        )
      : null;

    const occupantList = windowEntries.map((e) => describeOccupancy(e, r));
    const firstBooking = windowEntries.find((e) => e.kind === 'booking')?.row;

    return {
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      resourceType: r.resourceType?.typeName || 'Unknown Type',
      department: r.department?.branchCode || 'Shared',
      block: r.block?.blockCode || '-',
      capacity: r.capacityOrAreaSqm ? Number(r.capacityOrAreaSqm) : null,
      status,
      isFree: status === 'Free',
      occupantList,
      freeSlots: gaps.map((g) => ({ startTime: minutesToHHMM(g.start), endTime: minutesToHHMM(g.end) })),
      inUseNow: Boolean(current),
      currentOccupant: current ? describeOccupancy(current, r) : null,
      occupant:
        occupantList
          .map((o) =>
            o.type === 'class'
              ? `[${o.startTime} - ${o.endTime}] Class: ${o.courseCode} (${o.branchStr})`
              : `[${o.startTime} - ${o.endTime}] Event: ${o.purpose} (${o.requesterName || 'Unknown'})`
          )
          .join(' | ') || null,
      occupantContact: firstBooking
        ? {
            name: firstBooking.requester?.name,
            email: firstBooking.requester?.email,
            phone: firstBooking.requester?.phone,
          }
        : null,
    };
  });
}

module.exports = { createBooking, getAvailability, getById, list, cancel, dayOfWeekFor, getLiveStatus };
