import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY, LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    // For top 100, try cache first
    if (offset === 0 && limit <= 100) {
      const cached = await redis.get(LEADERBOARD_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return NextResponse.json({
          leaderboard: parsed.slice(0, limit),
          total: await redis.zcard(LEADERBOARD_KEY),
          offset,
          limit,
        });
      }
    }

    // Get from Redis sorted set
    const end = offset + limit - 1;
    const data = await redis.zrevrange(LEADERBOARD_KEY, offset, end, 'WITHSCORES');

    if (data.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        total: 0,
        offset,
        limit,
      });
    }

    // Parse user IDs and scores
    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < data.length; i += 2) {
      entries.push({
        userId: data[i],
        score: parseInt(data[i + 1]),
      });
    }

    // Fetch user display names
    const users = await prisma.user.findMany({
      where: { id: { in: entries.map(e => e.userId) } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    const leaderboard = entries.map((entry, i) => ({
      rank: offset + i + 1,
      displayName: userMap.get(entry.userId) || 'Unknown',
      bestScore: entry.score,
    }));

    // Cache top 100 if this was a top query
    if (offset === 0 && limit >= 100) {
      await redis.setex(LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL, JSON.stringify(leaderboard.slice(0, 100)));
    }

    const total = await redis.zcard(LEADERBOARD_KEY);

    return NextResponse.json({
      leaderboard,
      total,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch leaderboard' } },
      { status: 500 }
    );
  }
}
