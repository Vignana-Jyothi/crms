const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mappingData = [
  { branch: 'UG-CE', section: 'A', room: 'D 113' },
  { branch: 'UG-CE', section: 'B', room: 'D 114' },
  { branch: 'UG-EEE', section: 'A', room: 'B 306' },
  { branch: 'UG-EEE', section: 'B', room: 'B 307' },
  { branch: 'UG-ME', section: 'A', room: 'D 302' },
  { branch: 'UG-ME', section: 'B', room: 'D 303' },
  { branch: 'UG-ECE', section: 'A', room: 'A 201' },
  { branch: 'UG-ECE', section: 'B', room: 'B 209' },
  { branch: 'UG-ECE', section: 'C', room: 'B 212' },
  { branch: 'UG-ECE', section: 'D', room: 'B 213' },
  { branch: 'UG-EVL', section: 'A', room: 'C 203' },
  { branch: 'UG-CSE', section: 'A', room: 'E 138' },
  { branch: 'UG-CSE', section: 'B', room: 'E 139' },
  { branch: 'UG-CSE', section: 'C', room: 'E 140' },
  { branch: 'UG-CSE', section: 'D', room: 'E 141' },
  { branch: 'UG-CSE', section: 'E', room: 'E 107' },
  { branch: 'UG-EIE', section: 'A', room: 'C 201' },
  { branch: 'UG-EIE', section: 'B', room: 'C 202' },
  { branch: 'UG-IT', section: 'A', room: 'B 414' },
  { branch: 'UG-IT', section: 'B', room: 'B 415' },
  { branch: 'UG-IT', section: 'C', room: 'B 416' },
  { branch: 'UG-AE', section: 'A', room: 'D 415' },
  { branch: 'UG-AIML', section: 'A', room: 'E 204' },
  { branch: 'UG-AIML', section: 'B', room: 'E 205' },
  { branch: 'UG-AIML', section: 'C', room: 'E 241' },
  { branch: 'UG-IOT', section: 'A', room: 'E 240' },
  { branch: 'UG-RAI', section: 'A', room: 'E 037' },
  { branch: 'UG-DS', section: 'A', room: 'E 437' },
  { branch: 'UG-DS', section: 'B', room: 'E 438' },
  { branch: 'UG-DS', section: 'C', room: 'E 439' },
  { branch: 'UG-CYS', section: 'A', room: 'E 522' },
  { branch: 'UG-CYS', section: 'B', room: 'E 523' },
  { branch: 'UG-CYS', section: 'C', room: 'E 524' },
  { branch: 'UG-AID', section: 'A', room: 'E 440' },
  { branch: 'UG-BIO', section: 'A', room: 'D 503' }
];

async function run() {
  const allResources = await prisma.resource.findMany();
  let updatedCount = 0;

  for (const map of mappingData) {
    // Find matching room
    const match = allResources.find(r => 
      r.resourceName.replace(/\s+/g, '').toLowerCase() === map.room.replace(/\s+/g, '').toLowerCase()
    );

    if (match) {
      await prisma.resource.update({
        where: { resourceId: match.resourceId },
        data: {
          allocatedSemester: "2026", // Academic Year
          allocatedBranch: map.branch,
          allocatedSection: map.section
        }
      });
      console.log(`Mapped ${match.resourceName} to ${map.branch} Section ${map.section}`);
      updatedCount++;
    } else {
      console.warn(`Room not found in DB: ${map.room}`);
    }
  }

  console.log(`Successfully mapped ${updatedCount} rooms!`);
  await prisma.$disconnect();
}

run().catch(console.error);
