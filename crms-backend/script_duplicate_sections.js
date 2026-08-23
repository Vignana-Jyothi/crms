const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const resources = await prisma.resource.findMany({
    where: {
      allocatedSemester: { not: null }
    }
  });
  console.log("Found resources with allocatedSemester:", resources.length);
  for (const r of resources.slice(0, 5)) {
    console.log(r.resourceId, r.resourceName, r.allocatedSemester, r.allocatedBranch, r.allocatedSection);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
