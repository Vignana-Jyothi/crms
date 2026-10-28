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

// departmentIds: every department a Department Admin manages (see
// departmentScopeOf); ignored for the other roles.
function listPendingFor({ approverUserId, roleId, departmentIds = [] }) {
  let where;
  if (roleId === ROLES.SUPER_ADMIN || roleId === 1) {
    where = { decision: null, booking: { status: 'Pending' } };
  } else {
    where = {
      decision: null,
      booking: { status: 'Pending' },
      OR: [
        { approverUserId },
        // Institute/Department admins also see approvals routed to
        // their ROLE generally (e.g. if the specific approver user
        // was deactivated after the request was created).
        {
          approverRoleId: roleId,
          booking: (roleId === ROLES.DEPARTMENT_ADMIN || roleId === 3)
            ? { resource: { departmentId: { in: departmentIds } } }
            : undefined,
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
    // Newest requests first, so fresh ones aren't buried under old ones.
    orderBy: { approvalId: 'desc' },
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
