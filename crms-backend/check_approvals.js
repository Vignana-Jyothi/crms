const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const admin = await prisma.user.findFirst({
    where: { email: 'deanacademics@vnrvjiet.in' }
  });
  console.log('Dean:', admin);
  
  const approvals = await prisma.approval.findMany({
    where: { decision: null },
    include: { booking: { include: { resource: true } } }
  });
  
  console.log('Pending Approvals:', approvals.map(a => ({
    id: a.approvalId,
    bookingId: a.bookingId,
    resource: a.booking.resource.resourceName,
    dept: a.booking.resource.departmentId,
    approverRoleId: a.approverRoleId,
    approverUserId: a.approverUserId
  })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
