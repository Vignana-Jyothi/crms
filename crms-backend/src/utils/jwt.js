const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Access token payload intentionally carries roleId + departmentId
 * (not the role name string) so authorization middleware never has
 * to trust a client-editable string, and department-scoping (e.g.
 * "CSE Department Admin can only touch CSE resources") is a single
 * numeric comparison, not a name match.
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      roleId: user.roleId,
      departmentId: user.departmentId,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.userId }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
