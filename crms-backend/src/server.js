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
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
