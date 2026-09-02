const prisma = require('../../config/prisma');

const listRoles = () => prisma.role.findMany({ orderBy: { roleId: 'asc' } });
const listDepartments = () => prisma.department.findMany({ orderBy: { departmentName: 'asc' } });
const listBlocks = () => prisma.block.findMany({ orderBy: { blockCode: 'asc' } });
const listResourceTypes = () => prisma.resourceType.findMany({ orderBy: { resourceTypeId: 'asc' } });

const listFaculty = async () => {
  const records = await prisma.timetable.findMany({
    where: { facultyName: { not: null, not: '' } },
    select: { facultyName: true, courseCode: true },
    distinct: ['facultyName', 'courseCode'],
    orderBy: { facultyName: 'asc' }
  });
  
  const facultyMap = {};
  for (const r of records) {
    if (!facultyMap[r.facultyName]) facultyMap[r.facultyName] = new Set();
    if (r.courseCode) facultyMap[r.facultyName].add(r.courseCode);
  }
  
  return Object.keys(facultyMap).sort().map(f => {
    const subjects = Array.from(facultyMap[f]);
    let label = f;
    if (subjects.length > 0) {
      label = `${f} (${subjects.join(', ')})`;
    }
    return { name: f, label };
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
