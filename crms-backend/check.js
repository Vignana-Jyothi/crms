const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const types = await prisma.resourceType.findMany({ include: { _count: { select: { resources: true } } } });
  console.log(types.map(t => t.typeName + ': ' + t._count.resources).join('\n'));
}
main().finally(() => prisma.$disconnect());
