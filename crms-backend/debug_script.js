const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'aehead@vnrvjiet.in' },
      include: { role: true, department: true }
    });
    console.log(JSON.stringify(user, null, 2));

    const bookings = await prisma.booking.findMany({
      where: { resource: { departmentId: user.departmentId } },
      include: { resource: true }
    });
    console.log('Bookings for their department:', bookings.length);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
