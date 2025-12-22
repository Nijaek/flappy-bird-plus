import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY } from '@/lib/redis';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user's rank from Redis
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const score = await redis.zscore(LEADERBOARD_KEY, userId);

    if (rank === null || score === null) {
      // User hasn't played yet or not on leaderboard
      return NextResponse.json({
        rank: null,
        bestScore: null,
        neighborhood: null,
      });
    }

    const userRank = rank + 1;
    const bestScore = parseInt(score);

    // Get neighborhood (2 above, 2 below)
    const start = Math.max(0, rank - 2);
    const end = rank + 2;

    const neighborData = await redis.zrevrange(LEADERBOARD_KEY, start, end, 'WITHSCORES');

    const neighborEntries: { userId: string; score: number; rank: number }[] = [];
    for (let i = 0; i < neighborData.length; i += 2) {
      neighborEntries.push({
        userId: neighborData[i],
        score: parseInt(neighborData[i + 1]),
        rank: start + (i / 2) + 1,
      });
    }

    // Fetch display names
    const users = await prisma.user.findMany({
      where: { id: { in: neighborEntries.map(e => e.userId) } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    const neighborhood = {
      above: neighborEntries
        .filter(e => e.rank < userRank)
        .map(e => ({
          rank: e.rank,
          displayName: userMap.get(e.userId) || 'Unknown',
          bestScore: e.score,
        })),
      you: {
        rank: userRank,
        bestScore,
      },
      below: neighborEntries
        .filter(e => e.rank > userRank)
        .map(e => ({
          rank: e.rank,
          displayName: userMap.get(e.userId) || 'Unknown',
          bestScore: e.score,
        })),
    };

    return NextResponse.json({
      rank: userRank,
      bestScore,
      neighborhood,
    });
  } catch (error) {
    console.error('Leaderboard me fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch your rank' } },
      { status: 500 }
    );
  }
}
