const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient across the app (and across nodemon
// hot-reloads in dev) instead of opening a new connection pool
// per request.
const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}

module.exports = prisma;
