const bcrypt = require('bcrypt');
const ApiError = require('../../utils/ApiError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const repo = require('./auth.repository');
const auditService = require('../audit/audit.service');

const SALT_ROUNDS = 12;

async function login(email, password, ip) {
  const user = await repo.findByEmail(email);

  // Same error for "no such user" and "wrong password" — don't leak
  // which one it was, that's a basic account-enumeration guard.
  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status !== 'Active') {
    throw ApiError.forbidden('This account is not active');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await repo.setRefreshToken(user.userId, refreshToken);

  await auditService.log({
    userId: user.userId,
    action: 'LOGIN',
    entityType: 'user',
    entityId: String(user.userId),
    details: `Login from ${ip || 'unknown IP'}`,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role?.roleName,
      roleId: user.roleId,
      department: user.department?.departmentName || null,
      departmentId: user.departmentId,
    },
  };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await repo.findById(payload.sub);
  if (!user || user.refreshToken !== refreshToken) {
    // token was rotated/revoked elsewhere (e.g. password reset) — reject
    throw ApiError.unauthorized('Refresh token no longer valid');
  }

  const accessToken = signAccessToken(user);
  return { accessToken };
}

async function setPassword(userId, newPassword, actingUserId) {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await repo.setPasswordHash(userId, passwordHash);
  await auditService.log({
    userId: actingUserId,
    action: 'SET_PASSWORD',
    entityType: 'user',
    entityId: String(userId),
    details: actingUserId === userId ? 'User changed own password' : 'Admin reset a user password',
  });
}

module.exports = { login, refresh, setPassword };
