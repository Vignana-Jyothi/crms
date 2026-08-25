const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Fetching all timetables...');
  const timetables = await prisma.timetable.findMany();
  
  console.log(`Found ${timetables.length} total timetable entries.`);
  
  // Group by day, resource, course, and section to find overlaps
  const grouped = {};
  
  for (const t of timetables) {
    if (!t.dayOfWeek || !t.resourceId || !t.startTime || !t.endTime) continue;
    
    const key = `${t.dayOfWeek}_${t.resourceId}_${t.courseCode}_${t.section}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }
  
  let deletedCount = 0;
  
  for (const key in grouped) {
    const items = grouped[key];
    if (items.length <= 1) continue;
    
    // Check for overlaps within the same group
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const t1 = items[i];
        const t2 = items[j];
        
        // Skip if either is already deleted
        if (t1.deleted || t2.deleted) continue;
        
        const start1 = new Date(t1.startTime).getTime();
        const end1 = new Date(t1.endTime).getTime();
        const start2 = new Date(t2.startTime).getTime();
        const end2 = new Date(t2.endTime).getTime();
        
        // If they overlap
        if (start1 < end2 && start2 < end1) {
          // Calculate durations to keep the longer one (or just keep t1)
          const duration1 = end1 - start1;
          const duration2 = end2 - start2;
          
          let toDelete = t2.timetableId;
          if (duration2 > duration1) {
            toDelete = t1.timetableId;
            t1.deleted = true;
          } else {
            t2.deleted = true;
          }
          
          await prisma.timetable.delete({ where: { timetableId: toDelete } });
          deletedCount++;
          console.log(`Deleted duplicate timetable ID: ${toDelete}`);
        }
      }
    }
  }
  
  console.log(`Cleanup complete! Deleted ${deletedCount} overlapping duplicate entries.`);
}

cleanup().catch(e => {
  console.error(e);
}).finally(() => {
  prisma.$disconnect();
});
