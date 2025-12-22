import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

const LEADERBOARD_KEY = 'leaderboard:best_scores';

async function syncLeaderboard() {
  console.log('Starting leaderboard sync...');

  // Clear existing leaderboard
  await redis.del(LEADERBOARD_KEY);

  // Fetch all best scores
  const bestScores = await prisma.userBestScore.findMany({
    select: {
      userId: true,
      bestScore: true,
    },
  });

  console.log(`Found ${bestScores.length} users with scores`);

  if (bestScores.length === 0) {
    console.log('No scores to sync');
    return;
  }

  // Add to Redis in batches
  const BATCH_SIZE = 1000;
  for (let i = 0; i < bestScores.length; i += BATCH_SIZE) {
    const batch = bestScores.slice(i, i + BATCH_SIZE);
    const pipeline = redis.pipeline();

    for (const entry of batch) {
      pipeline.zadd(LEADERBOARD_KEY, entry.bestScore, entry.userId);
    }

    await pipeline.exec();
    console.log(`Synced ${Math.min(i + BATCH_SIZE, bestScores.length)} / ${bestScores.length}`);
  }

  const total = await redis.zcard(LEADERBOARD_KEY);
  console.log(`Sync complete. ${total} entries in leaderboard.`);

  await prisma.$disconnect();
  await redis.quit();
}

syncLeaderboard().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
