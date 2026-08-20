const prisma = require('../../config/prisma');

const findByEmail = (email) =>
  prisma.user.findUnique({ where: { email }, include: { role: true, department: true } });

const findById = (userId) =>
  prisma.user.findUnique({ where: { userId }, include: { role: true, department: true } });

const setPasswordHash = (userId, passwordHash) =>
  prisma.user.update({ where: { userId }, data: { passwordHash } });

const setRefreshToken = (userId, refreshToken) =>
  prisma.user.update({ where: { userId }, data: { refreshToken, lastLoginAt: new Date() } });

module.exports = { findByEmail, findById, setPasswordHash, setRefreshToken };
