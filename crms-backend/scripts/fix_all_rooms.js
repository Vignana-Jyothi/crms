const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Get all timetables where facultyName contains "Room:"
  const timetables = await prisma.timetable.findMany({
    where: {
      facultyName: {
        contains: 'Room:'
      }
    }
  });

  // Get all resources to map room name to resourceId
  const resources = await prisma.resource.findMany();
  
  let updatedCount = 0;

  for (const t of timetables) {
    let newFacultyName = t.facultyName;
    let newResourceId = t.resourceId;

    // Pattern: "Room: D-102 | Dr. G. Gangadhar"
    // Also handle possible formats like "Room: E-525 | Dr. B. Mahendran"
    const match = t.facultyName?.match(/^Room:\s*(.+?)\s*\|\s*(.+)$/i);
    if (match) {
      const roomStr = match[1];
      const actualFaculty = match[2];
      
      newFacultyName = actualFaculty;
      
      const lookup1 = roomStr.replace(/ /g, '').replace(/-/g, '').toLowerCase(); // e525
      
      // Find matching resource
      const res = resources.find(r => 
        r.resourceName.replace(/ /g, '').replace(/-/g, '').toLowerCase() === lookup1
      );
      
      if (res) {
        newResourceId = res.resourceId;
      } else {
        console.warn(`Could not find resource for room string: ${roomStr}`);
      }
    }

    // Update if changed
    if (t.facultyName !== newFacultyName || t.resourceId !== newResourceId) {
      await prisma.timetable.update({
        where: { timetableId: t.timetableId },
        data: {
          facultyName: newFacultyName,
          resourceId: newResourceId
        }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated rooms for ${updatedCount} timetable entries across all branches!`);
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
