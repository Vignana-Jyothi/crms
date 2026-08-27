const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(env.port, async () => {
  console.log(`CRMS backend listening on port ${env.port} [${env.nodeEnv}]`);
  
  // Temporary script to simplify block names and update C001
  try {
    await prisma.block.updateMany({ where: { blockCode: 'A' }, data: { blockName: 'Block A' } });
    await prisma.block.updateMany({ where: { blockCode: 'B' }, data: { blockName: 'Block B' } });
    await prisma.block.updateMany({ where: { blockCode: 'C' }, data: { blockName: 'Block C' } });
    await prisma.block.updateMany({ where: { blockCode: 'D' }, data: { blockName: 'Block D' } });
    await prisma.block.updateMany({ where: { blockCode: 'E' }, data: { blockName: 'Block E' } });
    await prisma.block.updateMany({ where: { blockCode: 'P' }, data: { blockName: 'PG Block' } });

    let aud = await prisma.resourceType.findFirst({ where: { typeName: 'Auditorium' } });
    if (!aud) aud = await prisma.resourceType.create({ data: { typeName: 'Auditorium' } });
    
    // Update C 001 to be the true KS Auditorium
    await prisma.resource.updateMany({ 
      where: { resourceId: 'C 001' }, 
      data: { 
        resourceTypeId: aud.resourceTypeId,
        resourceName: 'K.S. Auditorium',
        capacityOrAreaSqm: 1200
      } 
    });

    // Handle the duplicate KS-AUDITORIUM
    try {
      await prisma.resource.deleteMany({ where: { resourceId: 'KS-AUDITORIUM' } });
    } catch (e) {
      // If there are foreign key constraints, just mark it inactive
      await prisma.resource.updateMany({
        where: { resourceId: 'KS-AUDITORIUM' },
        data: { status: 'Inactive' }
      });
    }

    // Reset Seminar Hall names to just their room names as requested
    await prisma.resource.updateMany({
      where: { resourceId: 'SEMINAR-HALL-D' },
      data: { resourceName: 'Seminar Hall D' }
    });
    
    await prisma.resource.updateMany({
      where: { resourceId: 'SEMINAR-HALL-A' },
      data: { resourceName: 'Seminar Hall A' }
    });

    console.log('Block names and C001 successfully updated!');
  } catch (err) {
    console.error('Failed to update DB on startup:', err);
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
