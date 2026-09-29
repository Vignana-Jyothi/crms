const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeUsers() {
  console.log('Finding duplicate users...');
  
  const allUsers = await prisma.user.findMany({
    include: { role: true }
  });
  
  // Group by name
  const nameGroups = {};
  for (const u of allUsers) {
    if (!nameGroups[u.name]) nameGroups[u.name] = [];
    nameGroups[u.name].push(u);
  }
  
  for (const [name, users] of Object.entries(nameGroups)) {
    if (users.length > 1) {
      console.log(`\nFound duplicates for: ${name}`);
      
      // Find the one to keep (HOD / Admin)
      let keeper = users.find(u => 
        u.email?.includes('head@') || 
        u.email?.includes('dean@') || 
        u.email?.includes('principal@') ||
        u.role?.roleName === 'Department Admin' ||
        u.role?.roleName === 'Institute Admin'
      );
      
      if (!keeper) {
        // If neither is HOD, keep the one with a department, or just the first one
        keeper = users.find(u => u.departmentId !== null) || users[0];
      }
      
      const duplicates = users.filter(u => u.userId !== keeper.userId);
      
      for (const dup of duplicates) {
        console.log(`  Merging user ${dup.userId} (${dup.email}) -> ${keeper.userId} (${keeper.email})`);
        
        // 1. Reassign Timetables
        await prisma.timetable.updateMany({
          where: { uploaderUserId: dup.userId },
          data: { uploaderUserId: keeper.userId }
        });
        
        // 2. Reassign Bookings
        await prisma.booking.updateMany({
          where: { requesterUserId: dup.userId },
          data: { requesterUserId: keeper.userId }
        });
        
        // 3. Reassign Approvals
        await prisma.approval.updateMany({
          where: { approverUserId: dup.userId },
          data: { approverUserId: keeper.userId }
        });
        
        // 4. Reassign Announcements
        await prisma.announcement.updateMany({
          where: { authorUserId: dup.userId },
          data: { authorUserId: keeper.userId }
        });
        
        // 5. Reassign Audit Logs
        await prisma.auditLog.updateMany({
          where: { userId: dup.userId },
          data: { userId: keeper.userId }
        });
        
        // 6. Delete duplicate
        await prisma.user.delete({
          where: { userId: dup.userId }
        });
        console.log(`  Deleted user ${dup.userId}.`);
      }
    }
  }
  console.log('\nMerge complete.');
}

mergeUsers()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
