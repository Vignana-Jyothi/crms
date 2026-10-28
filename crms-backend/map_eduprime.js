const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Mapping real classrooms to EduPrime sections...");

  // Map D 113 to CSE - A
  await prisma.resource.updateMany({
    where: { resourceId: 'D 113' },
    data: {
      allocatedSemester: 'B.Tech I Year I Semester', // Or whatever semester string EduPrime expects
      allocatedBranch: 'CSE',
      allocatedSection: 'A',
      allocationNote: 'EduPrime Sync Enabled Classroom'
    }
  });

  // Map D 114 to CSE - B
  await prisma.resource.updateMany({
    where: { resourceId: 'D 114' },
    data: {
      allocatedSemester: 'B.Tech I Year I Semester',
      allocatedBranch: 'CSE',
      allocatedSection: 'B',
      allocationNote: 'EduPrime Sync Enabled Classroom'
    }
  });

  // Map D 102 to CSE - C
  await prisma.resource.updateMany({
    where: { resourceId: 'D 102' },
    data: {
      allocatedSemester: 'B.Tech I Year I Semester',
      allocatedBranch: 'CSE',
      allocatedSection: 'C',
      allocationNote: 'EduPrime Sync Enabled Classroom'
    }
  });

  console.log("Classrooms successfully mapped for EduPrime Sync!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
