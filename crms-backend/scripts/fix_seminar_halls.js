const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const timetables = await prisma.timetable.findMany({
    where: {
      facultyName: {
        contains: ' | '
      },
      resourceId: null
    }
  });

  const resources = await prisma.resource.findMany();
  let updatedCount = 0;

  for (const t of timetables) {
    let newFaculty = t.facultyName;
    let newResourceId = t.resourceId;

    // Handle "Seminar Hall (E-436) | Faculty" case
    if (newFaculty.startsWith('Seminar Hall')) {
      const parts = newFaculty.split(' | ');
      if (parts.length === 2) {
        newFaculty = parts[1]; // The actual faculty
        
        // Find or create Seminar Hall
        let res = resources.find(r => r.resourceName === 'Seminar Hall (E-436)');
        if (!res) {
          res = await prisma.resource.create({
            data: {
              resourceId: 'RM-SEM-' + Math.floor(Math.random()*10000),
              resourceType: 'Room',
              resourceName: 'Seminar Hall (E-436)',
              capacity: 100
            }
          });
          resources.push(res);
        }
        newResourceId = res.resourceId;
      }
    } 
    // For other split labs like D-402: Dr. B. Harish babu | D-421: Dr. M. Venkata Ramana
    // We can't really assign a single room, but maybe we should format it nicely?
    // Actually, leaving them as is might be fine, but the user complained about "No Room".
    // For now, let's just fix Seminar Hall since it's exactly what's shown in the screenshot for DBMS.

    if (t.facultyName !== newFaculty || t.resourceId !== newResourceId) {
      await prisma.timetable.update({
        where: { timetableId: t.timetableId },
        data: {
          facultyName: newFaculty,
          resourceId: newResourceId
        }
      });
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} timetable entries with |`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
