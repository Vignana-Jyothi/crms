const prisma = require('../../config/prisma');

function list({ resourceTypeId, departmentId, blockId, status, search, minCapacity, capacity }) {
  const cap = minCapacity || capacity;
  return prisma.resource.findMany({
    where: {
      ...(resourceTypeId && { resourceTypeId }),
      ...(departmentId && { departmentId }),
      ...(blockId && { blockId }),
      ...(status && { status }),
      ...(cap && { capacityOrAreaSqm: { gte: cap } }),
      ...(search && { resourceName: { contains: search, mode: 'insensitive' } }),
    },
    include: { resourceType: true, department: true, block: true },
    orderBy: { resourceName: 'asc' },
  });
}

const findById = (resourceId) =>
  prisma.resource.findUnique({
    where: { resourceId },
    include: { resourceType: true, department: true, block: true },
  });

const create = (data) => prisma.resource.create({ data });

const update = (resourceId, data) => prisma.resource.update({ where: { resourceId }, data });

module.exports = { list, findById, create, update };
