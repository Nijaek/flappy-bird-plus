import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        pointsBalance: true,
        isGuest: true,
        equippedSkinId: true,
        equippedTrailId: true,
        equippedBgId: true,
        bestScore: {
          select: {
            bestScore: true,
            achievedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch profile' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName } = body;

    // Validate display name if provided
    if (displayName !== undefined) {
      if (displayName.length < 3 || displayName.length > 20) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Display name must be 3-20 characters' } },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(displayName)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Display name contains invalid characters' } },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
      },
      select: {
        id: true,
        displayName: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
