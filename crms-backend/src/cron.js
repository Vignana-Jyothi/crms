const prisma = require('./config/prisma');

function startCronJobs() {
  console.log('🕒 Initializing cron jobs...');

  // Run every hour (3600000 ms)
  setInterval(async () => {
    console.log('🕒 Running 24-hour approval escalation check...');
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Find pending approvals by Department Admins (roleId 3) older than 24 hours
      const pendingApprovals = await prisma.approval.findMany({
        where: {
          decision: null,
          approverRoleId: 3, // Department Admin
          createdAt: {
            lt: twentyFourHoursAgo,
          },
        },
      });

      if (pendingApprovals.length > 0) {
        console.log(`🕒 Found ${pendingApprovals.length} pending approvals to escalate to Super Admin.`);
        
        for (const approval of pendingApprovals) {
          // Escalate to Super Admin (roleId 1)
          await prisma.approval.update({
            where: { approvalId: approval.approvalId },
            data: {
              approverRoleId: 1,
              approverUserId: null,
              remarks: 'System: Automatically escalated to Super Admin due to 24-hour SLA timeout.',
            },
          });
          
          // Log the escalation
          await prisma.auditLog.create({
            data: {
              userId: null,
              action: 'ESCALATE_APPROVAL',
              entityType: 'booking',
              entityId: String(approval.bookingId),
              details: `Approval request auto-escalated from Department Admin to Super Admin`,
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Error during cron escalation job:', error);
    }
  }, 3600000);
}

module.exports = { startCronJobs };
