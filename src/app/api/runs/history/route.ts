import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const cursor = searchParams.get('cursor');

    const runs = await prisma.run.findMany({
      where: {
        userId: session.user.id,
        ...(cursor && { id: { lt: cursor } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      select: {
        id: true,
        score: true,
        durationMs: true,
        createdAt: true,
      },
    });

    const hasMore = runs.length > limit;
    const results = hasMore ? runs.slice(0, limit) : runs;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return NextResponse.json({
      runs: results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('Run history fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch run history' } },
      { status: 500 }
    );
  }
}
