const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function renameBlocks() {
  const blockUpdates = {
    'A': 'Block A',
    'B': 'Block B',
    'C': 'Block C',
    'D': 'Block D',
    'E': 'Block E',
    'P': 'Block P',
    'SC': 'Block SC'
  };

  try {
    for (const [code, newName] of Object.entries(blockUpdates)) {
      const block = await prisma.block.findFirst({
        where: { blockCode: code }
      });

      if (block) {
        await prisma.block.update({
          where: { blockId: block.blockId },
          data: { blockName: newName }
        });
        console.log(`Updated block ${code} to ${newName}`);
      } else {
        console.log(`Block ${code} not found, skipping.`);
      }
    }
    
    // Also, handle any Block that might have been named "PG Block" directly
    const pgBlock = await prisma.block.findFirst({
      where: { blockName: { contains: 'PG Block' } }
    });
    if (pgBlock && pgBlock.blockCode !== 'P') {
      await prisma.block.update({
        where: { blockId: pgBlock.blockId },
        data: { blockCode: 'P', blockName: 'Block P' }
      });
      console.log(`Updated legacy PG Block to Block P`);
    }

    console.log('Block rename complete!');
  } catch (error) {
    console.error('Error renaming blocks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

renameBlocks();
