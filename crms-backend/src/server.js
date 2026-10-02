const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(env.port, () => {
  console.log(`CRMS backend listening on port ${env.port} [${env.nodeEnv}]`);
  
  // Log the database connection URL so we can verify which DB is being used
  const dbUrl = process.env.DATABASE_URL || 'UNKNOWN';
  // Mask the password for security, but show the database name and port
  const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ':***@');
  console.log(`🔗 Connected to Database: ${maskedDbUrl}`);
});

// Graceful shutdown — important under PM2/systemd/Docker restarts,
// same pattern you'd want on BETA/GAMMA for the other VJ services.
async function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
// Escalate approvals older than 24h to Super Admin
function startEscalationJob() {
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const escalated = await prisma.approval.updateMany({
        where: {
          decision: null,
          approverRoleId: { not: 1 },
          booking: { createdAt: { lt: twentyFourHoursAgo } }
        },
        data: {
          approverRoleId: 1,
          approverUserId: null,
        }
      });
      if (escalated.count > 0) {
        console.log(`[Escalation Job] Escalated ${escalated.count} pending approvals to Super Admin.`);
      }
    } catch (err) {
      console.error('[Escalation Job] Error escalating approvals:', err);
    }
  }, ONE_HOUR);
}
startEscalationJob();

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
