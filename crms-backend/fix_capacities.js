const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const missing = await prisma.resource.findMany({ where: { capacityOrAreaSqm: null } });
  const allRooms = await prisma.resource.findMany({ where: { capacityOrAreaSqm: { not: null } } });
  
  let updated = 0;
  for (const m of missing) {
    // Try to find the first valid room name in the string
    // e.g. "A-309/B-005" -> "A 309"
    // e.g. "E-502(Wed) E-315(Fri)" -> "E 502"
    let matchStr = m.resourceName.replace(/-/g, ' ').replace(/[^a-zA-Z0-9 ]/g, ' ');
    let parts = matchStr.split(/\s+/).filter(Boolean);
    
    let found = null;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length === 1 && parts[i+1] && parts[i+1].match(/^\d+$/)) {
         let candidate = parts[i] + ' ' + parts[i+1];
         found = allRooms.find(r => r.resourceName.includes(candidate));
         if (found) break;
      }
    }
    
    if (found) {
      await prisma.resource.update({
        where: { resourceId: m.resourceId },
        data: {
          capacityOrAreaSqm: found.capacityOrAreaSqm,
          floor: found.floor,
          departmentId: found.departmentId,
          blockId: found.blockId
        }
      });
      updated++;
      console.log(`Updated ${m.resourceName} -> Copied from ${found.resourceName}`);
    } else {
        // hardcode some manual fallbacks if needed
        if (m.resourceName.includes('A-306') || m.resourceName.includes('A 306')) {
            let a306 = allRooms.find(r => r.resourceName === 'A 306/1');
            if (a306) {
                await prisma.resource.update({
                    where: { resourceId: m.resourceId },
                    data: {
                      capacityOrAreaSqm: a306.capacityOrAreaSqm,
                      floor: a306.floor,
                      departmentId: a306.departmentId,
                      blockId: a306.blockId
                    }
                  });
                  updated++;
                  console.log(`Updated ${m.resourceName} -> Copied from A 306/1 (fallback)`);
            }
        }
    }
  }
  console.log(`Finished updating ${updated} rooms.`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
