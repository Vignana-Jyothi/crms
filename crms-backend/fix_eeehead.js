const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const dept = await prisma.department.findUnique({ where: { branchCode: 'EEE' } });
  if (dept) {
    const updated = await prisma.user.updateMany({
      where: { email: 'eeehead@vnrvjiet.in' },
      data: { departmentId: dept.departmentId }
    });
    console.log('Fixed:', updated.count);
  }
}

fix().finally(() => prisma.$disconnect());
