import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY } from '@/lib/redis';
import crypto from 'crypto';

// Anti-cheat constants
// Pipes spawn every 1.2 seconds (3s / 2.5x speed). Allow 0.8s minimum for buffer.
const MIN_PIPE_INTERVAL_MS = 800; // Minimum 0.8 seconds per pipe
const MAX_SCORE = 1000;
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MIN_DURATION_MS = 1000; // 1 second minimum

// Rate limits
const RUNS_PER_HOUR_USER = 100;
const RUNS_PER_HOUR_IP = 500;

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.AUTH_SECRET).digest('hex').slice(0, 16);
}

interface ValidationResult {
  valid: boolean;
  flagged: boolean;
  flagReason?: string;
}

function validateRun(score: number, durationMs: number): ValidationResult {
  // Basic bounds checks
  if (score < 0 || score > MAX_SCORE) {
    return { valid: false, flagged: true, flagReason: 'score_out_of_bounds' };
  }

  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    return { valid: false, flagged: true, flagReason: 'duration_out_of_bounds' };
  }

  // Timing validation: score should be achievable in given time
  const minRequiredTime = score * MIN_PIPE_INTERVAL_MS;
  if (durationMs < minRequiredTime) {
    return { valid: false, flagged: true, flagReason: 'impossible_timing' };
  }

  // Soft flag: unusually fast scoring (flag but accept)
  const maxExpectedScore = Math.floor(durationMs / MIN_PIPE_INTERVAL_MS);
  if (score > maxExpectedScore * 0.95) {
    return { valid: true, flagged: true, flagReason: 'suspiciously_fast' };
  }

  return { valid: true, flagged: false };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = hashIP(ip);

    // Check rate limits
    const userRateKey = `ratelimit:runs:user:${userId}`;
    const ipRateKey = `ratelimit:runs:ip:${ipHash}`;

    const [userRuns, ipRuns] = await Promise.all([
      redis.incr(userRateKey),
      redis.incr(ipRateKey),
    ]);

    // Set expiry on first increment
    if (userRuns === 1) await redis.expire(userRateKey, 3600);
    if (ipRuns === 1) await redis.expire(ipRateKey, 3600);

    if (userRuns > RUNS_PER_HOUR_USER) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many runs. Please try again later.' } },
        { status: 429 }
      );
    }

    if (ipRuns > RUNS_PER_HOUR_IP) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests from this network.' } },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { runToken, score, durationMs } = body;

    if (!runToken || typeof score !== 'number' || typeof durationMs !== 'number') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
        { status: 400 }
      );
    }

    // Validate run token
    const tokenRecord = await prisma.runToken.findUnique({
      where: { token: runToken },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid or expired run token' } },
        { status: 400 }
      );
    }

    if (tokenRecord.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Token does not belong to this user' } },
        { status: 403 }
      );
    }

    if (tokenRecord.used) {
      return NextResponse.json(
        { error: { code: 'TOKEN_USED', message: 'Run token has already been used' } },
        { status: 400 }
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: 'TOKEN_EXPIRED', message: 'Run token has expired' } },
        { status: 400 }
      );
    }

    // Validate run (anti-cheat)
    const validation = validateRun(score, durationMs);

    if (!validation.valid) {
      // Mark token as used even for invalid runs
      await prisma.runToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      return NextResponse.json(
        { error: { code: 'INVALID_RUN', message: 'Run validation failed' } },
        { status: 400 }
      );
    }

    // Process run in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.runToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      // Create run record
      const run = await tx.run.create({
        data: {
          userId,
          score,
          durationMs,
          runToken,
          ipHash,
          flagged: validation.flagged,
          flagReason: validation.flagReason,
        },
      });

      // Update user points
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          pointsBalance: { increment: score },
        },
      });

      // Log point transaction
      await tx.pointTransaction.create({
        data: {
          userId,
          delta: score,
          reason: 'run',
          refId: run.id,
        },
      });

      // Update best score if needed
      const currentBest = await tx.userBestScore.findUnique({
        where: { userId },
      });

      let isNewBest = false;
      if (!currentBest || score > currentBest.bestScore) {
        isNewBest = true;
        await tx.userBestScore.upsert({
          where: { userId },
          create: {
            userId,
            bestScore: score,
            achievedAt: new Date(),
          },
          update: {
            bestScore: score,
            achievedAt: new Date(),
          },
        });
      }

      return {
        run,
        user,
        isNewBest,
        bestScore: isNewBest ? score : currentBest?.bestScore || score,
      };
    });

    // Update Redis leaderboard (async, don't wait)
    redis.zadd(LEADERBOARD_KEY, result.bestScore, userId).catch(console.error);

    // Get user's rank
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const userRank = rank !== null ? rank + 1 : null;

    // Get top 10
    const top10Data = await redis.zrevrange(LEADERBOARD_KEY, 0, 9, 'WITHSCORES');
    const top10UserIds = top10Data.filter((_, i) => i % 2 === 0);

    const top10Users = await prisma.user.findMany({
      where: { id: { in: top10UserIds } },
      select: { id: true, displayName: true },
    });

    const top10 = top10UserIds.map((id, i) => {
      const user = top10Users.find(u => u.id === id);
      return {
        rank: i + 1,
        displayName: user?.displayName || 'Unknown',
        bestScore: parseInt(top10Data[i * 2 + 1]),
      };
    });

    return NextResponse.json({
      top10,
      you: {
        rank: userRank,
        bestScore: result.bestScore,
        isNewBest: result.isNewBest,
      },
      pointsEarned: score,
      pointsBalance: result.user.pointsBalance,
    });
  } catch (error) {
    console.error('Run submission error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to submit run' } },
      { status: 500 }
    );
  }
}
