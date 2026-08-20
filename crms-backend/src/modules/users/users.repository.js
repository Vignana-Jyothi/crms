const prisma = require('../../config/prisma');

const SAFE_SELECT = {
  userId: true, name: true, email: true, phone: true, roleId: true,
  departmentId: true, notes: true, roomNo: true, status: true,
  role: { select: { roleName: true } },
  department: { select: { departmentName: true, branchCode: true } },
}; // deliberately excludes passwordHash / refreshToken

const list = (departmentId) =>
  prisma.user.findMany({
    where: departmentId ? { departmentId } : undefined,
    select: SAFE_SELECT,
    orderBy: { name: 'asc' },
  });

const findById = (userId) => prisma.user.findUnique({ where: { userId }, select: SAFE_SELECT });

const updateRole = (userId, roleId, departmentId) =>
  prisma.user.update({ where: { userId }, data: { roleId, departmentId }, select: SAFE_SELECT });

const updateStatus = (userId, status) =>
  prisma.user.update({ where: { userId }, data: { status }, select: SAFE_SELECT });

const create = (data) => prisma.user.create({ data, select: SAFE_SELECT });

module.exports = { list, findById, updateRole, updateStatus, create };
