const prisma = require('../../config/prisma');

function list({ resourceTypeId, departmentId, blockId, status, search, minCapacity, capacity }) {
  const cap = minCapacity || capacity;
  let searchConditions = undefined;
  if (search) {
    const normalized = search.replace(/[- ]/g, '');
    const match = normalized.match(/^([a-zA-Z]+)(\d+)$/);
    if (match) {
      const letters = match[1];
      const numbers = match[2];
      searchConditions = {
        OR: [
          { resourceName: { contains: search, mode: 'insensitive' } },
          { resourceName: { contains: `${letters}${numbers}`, mode: 'insensitive' } },
          { resourceName: { contains: `${letters} ${numbers}`, mode: 'insensitive' } },
          { resourceName: { contains: `${letters}-${numbers}`, mode: 'insensitive' } }
        ]
      };
    } else {
      searchConditions = { resourceName: { contains: search, mode: 'insensitive' } };
    }
  }

  return prisma.resource.findMany({
    where: {
      ...(resourceTypeId && { resourceTypeId: Number(resourceTypeId) }),
      ...(departmentId && { departmentId: Number(departmentId) }),
      ...(blockId && { blockId: Number(blockId) }),
      ...(status && { status }),
      ...(cap && { capacityOrAreaSqm: { gte: Number(cap) } }),
      ...searchConditions,
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
