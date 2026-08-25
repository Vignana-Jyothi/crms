const prisma = require('../../config/prisma');

const listRoles = () => prisma.role.findMany({ orderBy: { roleId: 'asc' } });
const listDepartments = () => prisma.department.findMany({ orderBy: { departmentName: 'asc' } });
const listBlocks = () => prisma.block.findMany({ orderBy: { blockCode: 'asc' } });
const listResourceTypes = () => prisma.resourceType.findMany({ orderBy: { resourceTypeId: 'asc' } });

const listFaculty = async () => {
  const records = await prisma.timetable.findMany({
    where: { facultyName: { not: null, not: '' } },
    select: { facultyName: true },
    distinct: ['facultyName'],
    orderBy: { facultyName: 'asc' }
  });
  return records.map(r => r.facultyName);
};

const listSections = async () => {
  const records = await prisma.timetable.findMany({
    where: { section: { not: null, not: '' } },
    select: { section: true, departmentId: true },
    distinct: ['section', 'departmentId'],
    orderBy: [{ departmentId: 'asc' }, { section: 'asc' }]
  });
  return records;
};

module.exports = { listRoles, listDepartments, listBlocks, listResourceTypes, listFaculty, listSections };
