const ApiError = require('../utils/ApiError');

// Matches roles seeded in the roles table — see
// VNRVJIET_CRMS_schema_and_seed.sql. If you ever renumber roles,
// update this file, since role_id is what's actually inside the JWT.
const ROLES = {
  SUPER_ADMIN: 1,
  INSTITUTE_ADMIN: 2,
  DEPARTMENT_ADMIN: 3,
  REQUESTER: 4,
};

let rolesLoaded = false;
async function loadRoles(prisma, retries = 5, delayMs = 2000) {
  if (rolesLoaded) return;
  for (let i = 0; i < retries; i++) {
    try {
      const dbRoles = await prisma.role.findMany();
      for (const r of dbRoles) {
        if (r.roleName === 'Super Admin') ROLES.SUPER_ADMIN = r.roleId;
        if (r.roleName === 'Institute Admin') ROLES.INSTITUTE_ADMIN = r.roleId;
        if (r.roleName === 'Department Admin') ROLES.DEPARTMENT_ADMIN = r.roleId;
        if (r.roleName === 'Requester') ROLES.REQUESTER = r.roleId;
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

module.exports = { authorizeRole, ROLES, loadRoles };
