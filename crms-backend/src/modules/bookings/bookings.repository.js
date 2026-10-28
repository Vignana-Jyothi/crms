const prisma = require('../../config/prisma');

// Bookings that would block a new request for the same resource/day:
// still Pending (awaiting approval) or already Approved. Rejected
// and Cancelled bookings free up the slot.
const ACTIVE_STATUSES = ['Pending', 'Approved'];

function findOverlappingBookings(tx, { resourceId, bookingDate, startTime, endTime, excludeBookingId }) {
  return (tx || prisma).booking.findMany({
    where: {
      resourceId,
      bookingDate: new Date(bookingDate),
      status: { in: ACTIVE_STATUSES },
      ...(excludeBookingId && { bookingId: { not: excludeBookingId } }),
      // classic interval-overlap check: existing.start < new.end AND existing.end > new.start
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
}

function findTimetableConflicts(tx, { resourceId, dayOfWeek, startTime, endTime }) {
  return (tx || prisma).timetable.findMany({
    where: {
      resourceId,
      dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
}

function create(tx, data) {
  return (tx || prisma).booking.create({ data });
}

function findById(bookingId) {
  return prisma.booking.findUnique({
    where: { bookingId: Number(bookingId) },
    include: {
      resource: { include: { resourceType: true, department: true } },
      requester: { select: { userId: true, name: true, phone: true, email: true, department: { select: { departmentName: true } } } },
      approvals: {
        include: {
          approverUser: { select: { userId: true, name: true, phone: true, email: true } },
        },
        orderBy: { approvalId: 'desc' },
      },
    },
  });
}

// departmentIds: restrict to resources owned by these departments
// (an empty array matches nothing).
function list({
  requesterUserId,
  resourceId,
  status,
  departmentIds,
  blockId,
  resourceTypeId,
  dateFrom,
  dateTo,
  search,
}) {
  const where = {};
  if (requesterUserId !== undefined) where.requesterUserId = Number(requesterUserId);
  if (resourceId !== undefined) where.resourceId = resourceId;
  if (status !== undefined) where.status = status;

  const resourceWhere = {};
  if (departmentIds !== undefined) resourceWhere.departmentId = { in: departmentIds.map(Number) };
  if (blockId !== undefined) resourceWhere.blockId = Number(blockId);
  if (resourceTypeId !== undefined) resourceWhere.resourceTypeId = Number(resourceTypeId);
  if (Object.keys(resourceWhere).length > 0) where.resource = resourceWhere;

  if (dateFrom !== undefined || dateTo !== undefined) {
    where.bookingDate = {
      ...(dateFrom !== undefined && { gte: new Date(dateFrom) }),
      ...(dateTo !== undefined && { lte: new Date(dateTo) }),
    };
  }

  if (search) {
    const contains = { contains: search, mode: 'insensitive' };
    where.OR = [
      { resourceId: contains },
      { purpose: contains },
      { resource: { resourceName: contains } },
      { requester: { name: contains } },
      { requester: { email: contains } },
      { requester: { phone: contains } },
    ];
  }

  return prisma.booking.findMany({
    where,
    include: {
      resource: {
        select: {
          resourceId: true,
          resourceName: true,
          resourceTypeId: true,
          departmentId: true,
          blockId: true,
          floor: true,
          resourceType: { select: { typeName: true } },
          department: { select: { departmentName: true } },
          block: { select: { blockCode: true, blockName: true } }
        }
      },
      requester: { 
        select: { 
          userId: true,
          name: true, 
          phone: true, 
          email: true,
          department: { select: { departmentName: true } }
        } 
      },
      approvals: {
        include: {
          approverUser: { select: { userId: true, name: true, phone: true, email: true } },
        },
        orderBy: { approvalId: 'desc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { bookingId: 'desc' }],
  });
}

function updateStatus(tx, bookingId, status) {
  return (tx || prisma).booking.update({ where: { bookingId }, data: { status } });
}

async function updateStatusIfCurrent(tx, bookingId, status, currentStatuses) {
  const client = tx || prisma;
  const result = await client.booking.updateMany({
    where: {
      bookingId: Number(bookingId),
      status: { in: currentStatuses },
    },
    data: { status },
  });
  if (result.count !== 1) return null;
  return client.booking.findUnique({ where: { bookingId: Number(bookingId) } });
}

module.exports = {
  ACTIVE_STATUSES,
  findOverlappingBookings,
  findTimetableConflicts,
  create,
  findById,
  list,
  updateStatus,
  updateStatusIfCurrent,
};
