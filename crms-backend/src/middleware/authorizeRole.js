const ApiError = require('../utils/ApiError');

// Matches roles seeded in the roles table — see
// VNRVJIET_CRMS_schema_and_seed.sql. If you ever renumber roles,
// update this file, since role_id is what's actually inside the JWT.
const ROLES = {
  SUPER_ADMIN: 1,
  INSTITUTE_ADMIN: 2,
  DEPARTMENT_ADMIN: 3,
  REQUESTER: 4,
  VIEWER: 5,
};

// Viewer came after the first deploy, so startup adds it to databases
// that don't have it yet, at the id above.
const VIEWER_ROLE = { roleId: 5, roleName: 'Viewer', description: 'Sees free and booked rooms and timetables; cannot book' };

// Roles someone added straight to the database that CRMS never
// understood. Their people become Requesters (the Super Admin then
// gives each one a proper role) and the role itself is removed.
const RETIRED_ROLES = ['Section Head'];

async function syncRoles(prisma) {
  const requester = await prisma.role.findUnique({ where: { roleName: 'Requester' } });
  const retired = await prisma.role.findMany({ where: { roleName: { in: RETIRED_ROLES } } });
  for (const role of requester ? retired : []) {
    try {
      const [moved] = await prisma.$transaction([
        prisma.user.updateMany({ where: { roleId: role.roleId }, data: { roleId: requester.roleId } }),
        prisma.role.delete({ where: { roleId: role.roleId } }),
      ]);
      console.log(`[Roles] Removed "${role.roleName}"; ${moved.count} people are now Requesters`);
    } catch (err) {
      console.error(`[Roles] Could not remove "${role.roleName}":`, err.message);
    }
  }

  if (!(await prisma.role.findUnique({ where: { roleName: VIEWER_ROLE.roleName } }))) {
    try {
      await prisma.role.create({ data: VIEWER_ROLE });
      // An explicit id doesn't move the sequence, so move it past the new row.
      await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('roles', 'role_id'), (SELECT MAX(role_id) FROM roles))`;
      console.log('[Roles] Added the Viewer role');
    } catch (err) {
      console.error('[Roles] Could not add the Viewer role:', err.message);
    }
  }
}

let rolesLoaded = false;
async function loadRoles(prisma, retries = 5, delayMs = 2000) {
  if (rolesLoaded) return;
  for (let i = 0; i < retries; i++) {
    try {
      await syncRoles(prisma);
      const dbRoles = await prisma.role.findMany();
      for (const r of dbRoles) {
        if (r.roleName === 'Super Admin') ROLES.SUPER_ADMIN = r.roleId;
        if (r.roleName === 'Institute Admin') ROLES.INSTITUTE_ADMIN = r.roleId;
        if (r.roleName === 'Department Admin') ROLES.DEPARTMENT_ADMIN = r.roleId;
        if (r.roleName === 'Requester') ROLES.REQUESTER = r.roleId;
        if (r.roleName === 'Viewer') ROLES.VIEWER = r.roleId;
      }
      rolesLoaded = true;
      return;
    } catch (err) {
      console.warn(`[loadRoles] Database not ready (attempt ${i + 1}/${retries}). Retrying in ${delayMs}ms...`);
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

// "What are you allowed to do?" — Section 13.
// Usage: router.post('/resources', authenticate, authorizeRole(ROLES.SUPER_ADMIN), ...)
function authorizeRole(...allowedRoleIds) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoleIds.includes(req.auth.roleId)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

// Departments a Department Admin is responsible for: their primary
// department plus any extra ones assigned via managedDepartments (the
// same rule the timetable module applies in checkDepartmentAccess).
function departmentScopeOf(auth) {
  const ids = [auth?.departmentId, ...(auth?.managedDepartmentIds || [])]
    .filter((id) => id !== null && id !== undefined)
    .map(Number);
  return [...new Set(ids)];
}

module.exports = { authorizeRole, ROLES, loadRoles, departmentScopeOf };
