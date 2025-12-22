import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is not set');
  }
  return new Redis(url);
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Leaderboard keys
export const LEADERBOARD_KEY = 'leaderboard:best_scores';
export const LEADERBOARD_CACHE_KEY = 'leaderboard:top100:cache';
export const LEADERBOARD_CACHE_TTL = 10; // seconds
