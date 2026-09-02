const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRawUnsafe('ALTER TABLE timetable ADD COLUMN IF NOT EXISTS course_name VARCHAR(500)');
  console.log('course_name added successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
