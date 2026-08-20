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
  const isInstituteOwned = INSTITUTE_OWNED_TYPES.has(resource.resourceType.typeName);

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

module.exports = { list, getById, create, update, resolveApprover, INSTITUTE_OWNED_TYPES };
