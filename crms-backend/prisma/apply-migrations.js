// Applies the hand-written SQL files in prisma/migrations in name order.
// Every statement in them must be idempotent (IF NOT EXISTS), so this can
// run on each deploy: a database created before a schema change catches
// up, and an up-to-date one is left untouched.
// Usage (inside the backend container): node prisma/apply-migrations.js
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const prisma = new PrismaClient();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\s*--.*$/gm, '');
      // Prisma runs one statement per call; these files hold only plain DDL.
      const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      console.log(`applied ${file} (${statements.length} statements)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('migration failed:', err.message);
  process.exit(1);
});
