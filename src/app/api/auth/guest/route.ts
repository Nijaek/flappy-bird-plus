import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Create guest user
    const guestId = uuidv4();
    const guestName = `Guest_${guestId.slice(0, 8)}`;

    const user = await prisma.user.create({
      data: {
        id: guestId,
        name: guestName,
        displayName: guestName,
        isGuest: true,
      },
    });

    // Create a session token for the guest
    const sessionToken = uuidv4();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    });

    // Return session info (client will store this)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        isGuest: true,
      },
      sessionToken,
      expires: expires.toISOString(),
    });
  } catch (error) {
    console.error('Guest session error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to create guest session' } },
      { status: 500 }
    );
  }
}
