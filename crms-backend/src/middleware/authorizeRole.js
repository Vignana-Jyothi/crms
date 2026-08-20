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

module.exports = { authorizeRole, ROLES };
