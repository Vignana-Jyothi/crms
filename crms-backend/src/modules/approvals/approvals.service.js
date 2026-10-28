const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const repo = require('./approvals.repository');
const bookingsRepo = require('../bookings/bookings.repository');
const auditService = require('../audit/audit.service');
const notifications = require('../notifications/notifications.service');
const { ROLES } = require('../../middleware/authorizeRole');

// Section 21: Booking Created -> Pending Approval -> read ownership
// -> route to Dept Admin or Institute Admin -> Approve/Reject ->
// booking becomes Confirmed/Rejected. The routing itself already
// happened at booking-creation time (resourcesService.resolveApprover);
// this module just enforces that only the assigned approver (or
// someone with the same admin authority) can act on it.
async function listPending(auth) {
  return repo.listPendingFor({
    approverUserId: auth.userId,
    roleId: auth.roleId,
    departmentId: auth.departmentId,
  });
}

function canDecide(approval, auth) {
  if (approval.approverUserId === auth.userId) return true;
  if (approval.approverRoleId === auth.roleId) {
    // Department Admin: only within their own department
    if (auth.roleId === ROLES.DEPARTMENT_ADMIN) {
      return approval.booking?.resource?.departmentId === auth.departmentId;
    }
    return true; // Super Admin or Institute Admin acting on an assigned approval
  }
  return false;
}

async function decide(approvalId, decision, remarks, auth) {
  const approval = await repo.findById(approvalId);
  if (!approval) throw ApiError.notFound(`Approval ${approvalId} not found`);
  if (approval.decision) {
    throw ApiError.conflict(`This request was already ${approval.decision}`);
  }
  if (!canDecide(approval, auth)) {
    throw ApiError.forbidden('You are not the approver for this request');
  }
  if (decision === 'Rejected' && (!remarks || !remarks.trim())) {
    throw ApiError.badRequest('Remarks are required when rejecting a booking request');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await repo.recordDecision(tx, approvalId, {
      approverUserId: auth.userId,
      decision, // 'Approved' | 'Rejected'
      remarks,
    });
    if (!updated) {
      throw ApiError.conflict('This request was already decided');
    }

    if (decision === 'Rejected') {
      await bookingsRepo.updateStatus(tx, approval.bookingId, 'Rejected');
    } else if (decision === 'Approved') {
      await bookingsRepo.updateStatus(tx, approval.bookingId, 'Approved');
    }

    await auditService.log({
      userId: auth.userId,
      action: `${decision.toUpperCase()}_BOOKING`,
      entityType: 'booking',
      entityId: approval.bookingId,
      details: remarks || undefined,
      tx,
    });

    // Fetch details for email
    const booking = tx.booking ? await tx.booking.findUnique({
      where: { bookingId: approval.bookingId },
      include: {
        resource: true,
        requester: true,
      },
    }) : null;

    const approverUser = tx.user ? await tx.user.findUnique({ where: { userId: auth.userId } }) : null;

    // Map requester to requesterUser for the notification service
    if (booking) {
      booking.requesterUser = booking.requester;
      notifications.notifyRequesterDecision(booking, approverUser, decision, remarks).catch(console.error);
    }

    return updated;
  });
}

module.exports = { listPending, decide };
