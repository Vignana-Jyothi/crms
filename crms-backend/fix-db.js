const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixData() {
  console.log('Fixing legacy CSBS data...');
  
  // Get CSE department
  const cse = await prisma.department.findUnique({ where: { branchCode: 'CSE' } });
  
  if (cse) {
    // 1. Fix departmentId for CSBS
    const csbsUpdate = await prisma.timetable.updateMany({
      where: { 
        departmentId: null,
        section: { contains: 'CSBS' }
      },
      data: {
        departmentId: cse.departmentId
      }
    });
    console.log(`Updated ${csbsUpdate.count} CSBS records with CSE department ID.`);
  }

  // 2. Fix studentYear for all legacy OCR records that are null
  const yearUpdate = await prisma.timetable.updateMany({
    where: {
      studentYear: null
    },
    data: {
      studentYear: '1'
    }
  });
  console.log(`Updated ${yearUpdate.count} legacy records with studentYear = '1'.`);
  
  console.log('Done!');
}

fixData().then(() => prisma.$disconnect()).catch(console.error);
