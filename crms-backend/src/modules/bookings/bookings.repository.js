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

function list({ requesterUserId, resourceId, status, departmentId }) {
  return prisma.booking.findMany({
    where: {
      ...(requesterUserId && { requesterUserId: Number(requesterUserId) }),
      ...(resourceId && { resourceId }),
      ...(status && { status }),
      ...(departmentId && { resource: { departmentId: Number(departmentId) } }),
    },
    include: {
      resource: { 
        select: { 
          resourceId: true,
          resourceName: true, 
          resourceType: { select: { typeName: true } },
          department: { select: { departmentName: true } }
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
    orderBy: { createdAt: 'desc' },
  });
}

function updateStatus(tx, bookingId, status) {
  return (tx || prisma).booking.update({ where: { bookingId }, data: { status } });
}

module.exports = {
  ACTIVE_STATUSES,
  findOverlappingBookings,
  findTimetableConflicts,
  create,
  findById,
  list,
  updateStatus,
};
