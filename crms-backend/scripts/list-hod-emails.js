const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'head'
      }
    },
    select: {
      name: true,
      email: true,
      department: {
        select: {
          departmentName: true
        }
      }
    }
  });

  if (users.length === 0) {
    console.log('No HOD emails found in the database.');
    return;
  }

  console.log(`\n--- Found ${users.length} HOD Emails ---`);
  users.forEach((u, i) => {
    const dept = u.department ? u.department.departmentName : 'No Department Assigned';
    console.log(`${i + 1}. ${u.email} (${u.name} - ${dept})`);
  });
  console.log('------------------------------\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
