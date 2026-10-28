const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const data = await prisma.timetable.findMany({
    where: { departmentId: 5, studentYear: '2', section: 'A', dayOfWeek: 'Monday' },
    include: { resource: { select: { resourceName: true } } },
    orderBy: { startTime: 'asc' }
  });
  for (const t of data) {
    console.log(JSON.stringify({ start: t.startTime, end: t.endTime, code: t.courseCode, rid: t.resourceId }));
  }
}
test().finally(() => prisma.$disconnect());
