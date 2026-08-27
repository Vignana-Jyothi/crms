const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const { execSync } = require('child_process');

const server = app.listen(env.port, async () => {
  console.log(`CRMS backend listening on port ${env.port} [${env.nodeEnv}]`);
  
  try {
    console.log('Running database seed script to sync official data...');
    const result = execSync('npm run seed', { encoding: 'utf-8' });
    console.log(result);
  } catch (err) {
    console.error('Failed to run seed script on startup:', err.message);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
  }
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
