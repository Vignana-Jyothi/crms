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
    
    // Remove day suffixes like (W), (F), (Th) etc.
    let cleaned = r.facultyName.replace(/\(\s*(M|T|W|Th|F|S)\s*\)/ig, '');
    
    // Split by /, &, ,
    let names = cleaned.split(/[\/,&]/).map(n => n.trim()).filter(Boolean);
    
    // Split accidentally concatenated names (e.g. "Dr. A Dr. B")
    let finalNames = [];
    names.forEach(name => {
      const parts = name.split(/(?=\b(?:Dr\.?|Mr\.?|Ms\.?|Prof\.?)\s*[A-Z])/i)
                        .map(n => n.trim())
                        .filter(Boolean);
      finalNames.push(...parts);
    });

    for (let name of finalNames) {
      // Remove trailing hyphens or random punctuation
      name = name.replace(/^[-.]+|-+$/g, '').trim();
      
      // Ignore if it's just a title or a single letter
      const lower = name.toLowerCase().replace(/[^a-z]/g, '');
      if (['dr', 'mr', 'ms', 'prof', 'w', 'f', 't', 's', 'th', 'm'].includes(lower) || name.length <= 2) {
        continue;
      }
      
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
