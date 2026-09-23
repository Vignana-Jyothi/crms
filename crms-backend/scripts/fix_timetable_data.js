const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const specialSubjects = [
  { code: 'library', name: 'Library' },
  { code: 'Sports', name: 'Sports' },
  { code: 'CCA', name: 'Co-Curricular Activities (CCA)' },
  { code: 'ECA', name: 'Extra-Curricular Activities (ECA)' },
  { code: 'CVP', name: 'Career Vision Approach (CVP)' },
  { code: 'CVA-L1', name: 'Career Vision Approach - Level 1' },
  { code: 'CVA-L2', name: 'Career Vision Approach - Level 2' },
  { code: 'CVA-L3', name: 'Career Vision Approach - Level 3' },
  { code: 'CVA-L4', name: 'Career Vision Approach - Level 4' },
  { code: 'MTP', name: 'Mentoring Training and Placements' }
];

async function run() {
  console.log('Starting timetable data fix...');

  try {
    // 1. Un-assign E 526 from 4th Year AIDS
    const conflictUpdate = await prisma.timetable.updateMany({
      where: {
        resourceId: 'E 526',
        studentYear: '4th Year'
      },
      data: {
        resourceId: null
      }
    });
    console.log(`Un-assigned E 526 from ${conflictUpdate.count} incorrect 4th Year timetable slots.`);

    // 2. Fix Special Subjects
    let specialSubjectCount = 0;
    for (const subject of specialSubjects) {
      const updateResult = await prisma.timetable.updateMany({
        where: {
          OR: [
            { courseCode: { equals: subject.code, mode: 'insensitive' } },
            { courseShortName: { equals: subject.code, mode: 'insensitive' } },
            { courseName: { contains: subject.code, mode: 'insensitive' } }
          ]
        },
        data: {
          resourceId: null,
          courseName: subject.name,
          courseShortName: subject.code
        }
      });
      specialSubjectCount += updateResult.count;
    }
    console.log(`Fixed ${specialSubjectCount} special subject slots (removed classrooms and updated names).`);

    console.log('Done!');
  } catch (err) {
    console.error('Error fixing timetable:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
