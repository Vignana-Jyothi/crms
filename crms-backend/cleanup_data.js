const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanData() {
  console.log('Starting data cleanup...');
  try {
    // 1. Delete the duplicate K.S. Auditorium (Laboratory)
    console.log('Deleting duplicate K.S. Auditorium...');
    const delRes = await prisma.resource.deleteMany({
      where: {
        resourceName: 'K.S. Auditorium',
        resourceId: 'K.S. Auditorium'
      }
    });
    console.log(`Deleted ${delRes.count} resource(s).`);

    // 2. Clean up Faculty Names in Timetable
    console.log('Fetching all timetables with faculty names...');
    const timetables = await prisma.timetable.findMany({
      where: {
        facultyName: { not: null, not: '' }
      }
    });

    let updatedCount = 0;
    for (const t of timetables) {
      let originalName = t.facultyName;
      let newName = originalName;

      // Remove specific prefixes like Mrs, Mrs., Mr., Mr, Dr.
      newName = newName.replace(/^(Mrs\.|Mrs|Mr\.|Mr|Dr\.|Dr)\s*/i, '');
      
      // Remove (Batch-1), (Batch-2), etc.
      newName = newName.replace(/\(Batch-\d+\)/ig, '');

      // Remove (Tu), (tu)
      newName = newName.replace(/\(Tu\)/ig, '');

      // Trim extra spaces
      newName = newName.trim();

      // If the name ended up empty (e.g. it was just "Mrs"), set it to null or leave it empty
      if (newName === '') {
        newName = null;
      }

      if (newName !== originalName) {
        await prisma.timetable.update({
          where: { timetableId: t.timetableId },
          data: { facultyName: newName }
        });
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} timetable entries to clean up faculty names.`);
    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanData();
