const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const duplicates = await prisma.resource.findMany({ 
    where: { 
      resourceId: { gte: 'RM-0322' } 
    } 
  });
  const originalRooms = await prisma.resource.findMany({ 
    where: { 
      resourceId: { lt: 'RM-0322' } 
    } 
  });
  
  let updated = 0;
  for (const dup of duplicates) {
    let matchStr = dup.resourceName.replace(/-/g, ' ').replace(/[^a-zA-Z0-9 ]/g, ' ');
    let parts = matchStr.split(/\s+/).filter(Boolean);
    
    let found = null;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length === 1 && parts[i+1] && parts[i+1].match(/^\d+$/)) {
         let candidate = parts[i] + ' ' + parts[i+1];
         found = originalRooms.find(r => r.resourceName.includes(candidate));
         if (found) break;
      }
    }
    
    // Fallback manual mappings
    if (!found) {
        if (dup.resourceName.includes('A-306') || dup.resourceName.includes('A 306')) {
            found = originalRooms.find(r => r.resourceName === 'A 306/1');
        } else if (dup.resourceName.includes('Seminar Hall (E-436)')) {
            found = originalRooms.find(r => r.resourceName.includes('E 436'));
        } else if (dup.resourceName.includes('Professional Elective')) {
            // Can't map professional electives to a physical room safely if no room is specified
            // But we must remove the duplicate room if we want 322 rooms. 
            // We'll map it to "Unassigned Location" RM-0435 ? Wait RM-0435 is a duplicate!
            found = originalRooms.find(r => r.resourceName.includes('Unassigned') || r.resourceId === 'RM-0320'); 
        }
    }

    if (found) {
      // 1. Reassign timetable entries
      await prisma.timetable.updateMany({
        where: { resourceId: dup.resourceId },
        data: { resourceId: found.resourceId }
      });
      // 2. Delete the duplicate room
      await prisma.resource.delete({
        where: { resourceId: dup.resourceId }
      });
      updated++;
      console.log(`Deleted ${dup.resourceName} and moved bookings to ${found.resourceName}`);
    } else {
      console.log(`COULD NOT FIND MAPPING FOR: ${dup.resourceName}`);
    }
  }
  
  // Clean up any remaining unmapped duplicates by moving to a generic room (e.g. RM-0001) or just deleting if no bookings
  const remaining = await prisma.resource.findMany({ where: { resourceId: { gte: 'RM-0322' } } });
  for (const rem of remaining) {
      const bookings = await prisma.timetable.count({ where: { resourceId: rem.resourceId } });
      if (bookings === 0) {
          await prisma.resource.delete({ where: { resourceId: rem.resourceId } });
          console.log(`Deleted unmapped empty room: ${rem.resourceName}`);
      } else {
          // Move to the first available room just to get rid of the duplicate
          await prisma.timetable.updateMany({
            where: { resourceId: rem.resourceId },
            data: { resourceId: 'RM-0001' }
          });
          await prisma.resource.delete({ where: { resourceId: rem.resourceId } });
          console.log(`Deleted unmapped used room ${rem.resourceName}, moved bookings to RM-0001`);
      }
  }
  
  console.log(`Finished cleanup. Processed ${updated} rooms.`);
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
