import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY } from '@/lib/redis';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const rankParam = searchParams.get('rank');

    // Get total players count
    const totalPlayers = await redis.zcard(LEADERBOARD_KEY);

    if (totalPlayers === 0) {
      return NextResponse.json({
        nearbyPlayers: [],
        totalPlayers: 0,
      });
    }

    // Get user's rank if not provided
    let userRank: number;
    if (rankParam) {
      const parsed = parseInt(rankParam);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid rank parameter' } },
          { status: 400 }
        );
      }
      userRank = parsed;
    } else {
      const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
      if (rank === null) {
        return NextResponse.json({
          nearbyPlayers: [],
          totalPlayers,
        });
      }
      userRank = rank + 1; // Convert 0-indexed to 1-indexed
    }

    // Calculate range for 5 players centered on user
    // If rank is 1-2, show 1-5
    // If rank is near bottom, show last 5
    // Otherwise, show 2 above and 2 below
    let startRank: number;
    let endRank: number;

    if (userRank <= 2) {
      startRank = 1;
      endRank = Math.min(5, totalPlayers);
    } else if (userRank >= totalPlayers - 1) {
      startRank = Math.max(1, totalPlayers - 4);
      endRank = totalPlayers;
    } else {
      startRank = userRank - 2;
      endRank = userRank + 2;
    }

    // Fetch from Redis (0-indexed)
    const data = await redis.zrevrange(
      LEADERBOARD_KEY,
      startRank - 1,
      endRank - 1,
      'WITHSCORES'
    );

    if (data.length === 0) {
      return NextResponse.json({
        nearbyPlayers: [],
        totalPlayers,
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

    // Fetch display names
    const users = await prisma.user.findMany({
      where: { id: { in: entries.map(e => e.userId) } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    const nearbyPlayers = entries.map((entry, i) => ({
      rank: startRank + i,
      displayName: userMap.get(entry.userId) || 'Unknown',
      bestScore: entry.score,
      isPlayer: entry.userId === userId,
    }));

    return NextResponse.json({
      nearbyPlayers,
      totalPlayers,
    });
  } catch (error) {
    console.error('Nearby leaderboard fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch nearby players' } },
      { status: 500 }
    );
  }
}
