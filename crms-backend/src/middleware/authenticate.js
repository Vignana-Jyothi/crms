const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');

// "Who are you?" — Section 13 of the architecture doc.
// Verifies the JWT and attaches { userId, roleId, departmentId }
// to req.auth. Does NOT check permissions — that's authorizeRole.
module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      roleId: payload.roleId,
      departmentId: payload.departmentId,
    };
    next();
  } catch (err) {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};
