const prisma = require('./crms-backend/src/config/prisma');

async function inspectRooms() {
  const rooms = ['E 141', 'E-141', 'E141', 'A 203', 'A-203', 'A203'];
  
  for (const r of rooms) {
    const resource = await prisma.resource.findFirst({
      where: { resourceName: { contains: r, mode: 'insensitive' } }
    });
    if (resource) {
      console.log(`Found Room: ${resource.resourceName} (ID: ${resource.resourceId})`);
      const timetables = await prisma.timetable.findMany({
        where: { resourceId: resource.resourceId }
      });
      console.log(`  -> Classes scheduled: ${timetables.length}`);
    }
  }
}
inspectRooms().catch(console.error).finally(() => prisma.$disconnect());
