import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    // Validate format
    if (name.length < 3 || name.length > 20) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be 3-20 characters',
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json({
        available: false,
        reason: 'Only letters, numbers, underscores, and hyphens allowed',
      });
    }

    // Check database
    const existing = await prisma.user.findFirst({
      where: {
        displayName: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existing,
      reason: existing ? 'Username is already taken' : null,
    });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to check username' } },
      { status: 500 }
    );
  }
}
