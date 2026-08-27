const prisma = require('../../config/prisma');

function findById(approvalId) {
  return prisma.approval.findUnique({
    where: { approvalId },
    include: {
      booking: { include: { resource: true, requester: { select: { name: true, phone: true, email: true, department: { select: { departmentName: true } } } } } },
    },
  });
}

const { ROLES } = require('../../middleware/authorizeRole');

function listPendingFor({ approverUserId, roleId, departmentId }) {
  let where;
  if (roleId === ROLES.SUPER_ADMIN || roleId === 1) {
    where = { decision: null };
  } else {
    where = {
      decision: null,
      OR: [
        { approverUserId },
        // Institute/Department admins also see approvals routed to
        // their ROLE generally (e.g. if the specific approver user
        // was deactivated after the request was created).
        {
          approverRoleId: roleId,
          booking: departmentId ? { resource: { departmentId } } : undefined,
        },
      ],
    };
  }

  return prisma.approval.findMany({
    where,
    include: {
      booking: {
        include: { 
          resource: { include: { resourceType: true, department: true } }, 
          requester: { select: { name: true, phone: true, email: true, department: { select: { departmentName: true } } } } 
        },
      },
    },
    orderBy: { approvalId: 'asc' },
  });
}

async function recordDecision(tx, approvalId, { approverUserId, decision, remarks }) {
  const client = tx || prisma;
  const result = await client.approval.updateMany({
    where: { approvalId, decision: null },
    data: { approverUserId, decision, remarks, decisionAt: new Date() },
  });
  if (result.count !== 1) return null;
  return client.approval.findUnique({ where: { approvalId } });
}

module.exports = { findById, listPendingFor, recordDecision };
