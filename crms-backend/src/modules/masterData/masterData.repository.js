const prisma = require('../../config/prisma');

const listRoles = () => prisma.role.findMany({ orderBy: { roleId: 'asc' } });
const listDepartments = () => prisma.department.findMany({ orderBy: { departmentName: 'asc' } });
const listBlocks = () => prisma.block.findMany({ orderBy: { blockCode: 'asc' } });
const listResourceTypes = () => prisma.resourceType.findMany({ where: { resources: { some: {} } }, orderBy: { resourceTypeId: 'asc' } });

const listFaculty = async () => {
  const records = await prisma.timetable.findMany({
    where: { facultyName: { not: null, not: '' } },
    select: { facultyName: true, courseCode: true },
    distinct: ['facultyName', 'courseCode'],
    orderBy: { facultyName: 'asc' }
  });
  
  const facultyMap = {};
  for (const r of records) {
    if (!r.facultyName) continue;
    const names = r.facultyName.split(/[\/,&]/).map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      if (!facultyMap[name]) facultyMap[name] = new Set();
      if (r.courseCode) facultyMap[name].add(r.courseCode);
    }
  }
  
  return Object.keys(facultyMap).sort().map(f => {
    return { name: f, label: f };
  });
};

const listSections = async () => {
  const records = await prisma.timetable.findMany({
    where: { section: { not: null, not: '' } },
    select: { section: true, departmentId: true, studentYear: true },
    distinct: ['section', 'departmentId', 'studentYear'],
    orderBy: [{ departmentId: 'asc' }, { studentYear: 'asc' }, { section: 'asc' }]
  });
  return records;
};

module.exports = { listRoles, listDepartments, listBlocks, listResourceTypes, listFaculty, listSections };
