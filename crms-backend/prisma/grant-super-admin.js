// Makes an email a Super Admin, creating the user if it isn't registered
// yet. Safe to run on every deploy: an existing user is only promoted and
// reactivated, nothing else about them changes.
// Usage (inside the backend container):
//   node prisma/grant-super-admin.js <email> "<name>"
const { PrismaClient } = require('@prisma/client');

async function main() {
  const [rawEmail, name] = process.argv.slice(2);
  if (!rawEmail || !name) {
    throw new Error('usage: node prisma/grant-super-admin.js <email> "<name>"');
  }
  // Google sign-in hands the backend a lowercase address to look up.
  const email = rawEmail.trim().toLowerCase();
  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { roleName: 'Super Admin' } });
    if (!role) throw new Error('Super Admin role not found');
    const user = await prisma.user.upsert({
      where: { email },
      update: { roleId: role.roleId, status: 'Active' },
      // phone is required and format-checked by the database; this is the
      // same placeholder the seeded admin uses.
      create: { name, email, phone: '9876543210', roleId: role.roleId, status: 'Active' },
      select: { userId: true },
    });
    console.log(`${email} is a Super Admin (user ${user.userId})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('grant-super-admin failed:', err.message);
  process.exit(1);
});
