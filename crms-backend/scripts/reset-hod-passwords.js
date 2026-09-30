const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log('Fetching all users with "head" in their email...');
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'head'
      }
    }
  });

  if (users.length === 0) {
    console.log('No users found matching the criteria.');
    return;
  }

  console.log(`Found ${users.length} users. Hashing password...`);
  const passwordHash = await bcrypt.hash('Password@123', SALT_ROUNDS);

  const deptAdminRole = await prisma.role.findUnique({
    where: { roleName: 'Department Admin' }
  });

  if (!deptAdminRole) {
    console.error('Department Admin role not found!');
    return;
  }

  let updatedCount = 0;
  for (const user of users) {
    await prisma.user.update({
      where: { userId: user.userId },
      data: { 
        passwordHash,
        roleId: deptAdminRole.roleId 
      }
    });
    console.log(`Updated user: ${user.email}`);
    updatedCount++;
  }

  console.log(`\nSuccessfully updated ${updatedCount} users to Department Admin with the default password.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
