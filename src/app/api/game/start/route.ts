import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

// Rate limit: 1 game start per 3 seconds per user
const RATE_LIMIT_WINDOW = 3; // seconds

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check rate limit
    const rateLimitKey = `ratelimit:gamestart:${userId}`;
    const lastStart = await redis.get(rateLimitKey);

    if (lastStart) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Please wait before starting another game' } },
        { status: 429 }
      );
    }

    // Set rate limit
    await redis.setex(rateLimitKey, RATE_LIMIT_WINDOW, '1');

    // Generate run token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database
    await prisma.runToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return NextResponse.json({
      runToken: token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Game start error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to start game' } },
      { status: 500 }
    );
  }
}
