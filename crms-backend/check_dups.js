const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  const rooms = await prisma.resource.findMany({
    orderBy: { resourceId: 'asc' }
  });
  
  const counts = {};
  for (const r of rooms) {
    if (!counts[r.resourceId]) counts[r.resourceId] = 0;
    counts[r.resourceId]++;
  }
  
  for (const [id, count] of Object.entries(counts)) {
    if (count > 1) {
      console.log(`DUPLICATE FOUND: ${id} x${count}`);
    }
  }

  // Find all A 001, A 013, A 103, A 201
  const targets = await prisma.resource.findMany({
    where: {
      OR: [
        { resourceId: { contains: 'A 001' } },
        { resourceId: { contains: 'A 013' } },
        { resourceId: { contains: 'A 103' } },
        { resourceId: { contains: 'Seminar Hall' } },
        { resourceId: { contains: 'SEMINAR' } }
      ]
    },
    select: { id: true, resourceId: true, resourceName: true }
  });
  
  console.log("Matching targets:");
  console.log(targets);
}

checkDuplicates().catch(console.error).finally(() => prisma.$disconnect());
