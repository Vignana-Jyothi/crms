const prisma = require('../../config/prisma');

// Section 42 of the architecture doc: audit logs answer "who
// changed what and when", separate from application/error logs.
// Every module that mutates state should call this. Deliberately
// fire-and-forget-ish (awaited, but never throws) so a logging
// failure never blocks the actual business operation.
async function log({ userId, action, entityType, entityId, details, tx }) {
  try {
    await (tx || prisma).auditLog.create({
      data: { userId, action, entityType, entityId: String(entityId), details },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

async function list({ action, entityType, entityId, userId, limit = 100 }) {
  return prisma.auditLog.findMany({
    where: {
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId: String(entityId) }),
      ...(userId && { userId: Number(userId) }),
    },
    orderBy: { timestamp: 'desc' },
    take: Math.min(limit, 500),
    include: { user: { select: { name: true, email: true, department: { select: { departmentName: true } } } } },
  });
}

module.exports = { log, list };
