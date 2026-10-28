const Redis = require('ioredis');

// Reusable Redis client with graceful offline fallback
const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  retryStrategy(times) {
    // Retry up to 5 times with exponential backoff, then wait 10s
    if (times > 5) return 10000;
    return Math.min(times * 500, 2000);
  }
});

let isConnected = false;

redis.on('connect', () => {
  isConnected = true;
  console.log('⚡ Connected to Redis cache');
});

redis.on('error', (err) => {
  isConnected = false;
  // Non-fatal warning: the application continues seamlessly via PostgreSQL
  console.warn('[Redis] Cache operating in fallback mode:', err.message);
});

// Helper functions for safe caching
async function getCached(key) {
  try {
    if (!isConnected) return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setCached(key, value, ttlSeconds = 180) {
  try {
    if (!isConnected) return;
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Non-fatal
  }
}

async function invalidateKeys(pattern) {
  try {
    if (!isConnected) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-fatal
  }
}

// Attempt initial connection without blocking app startup
redis.connect().catch(() => {});

module.exports = {
  redis,
  getCached,
  setCached,
  invalidateKeys,
  isAvailable: () => isConnected
};
