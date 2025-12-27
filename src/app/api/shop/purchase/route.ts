// src/app/api/shop/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { error: { message: 'Item ID required' } },
        { status: 400 }
      );
    }

    // Get item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item || !item.active) {
      return NextResponse.json(
        { error: { message: 'Item not found' } },
        { status: 404 }
      );
    }

    // Check if already owned
    const existingOwnership = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });

    if (existingOwnership) {
      return NextResponse.json(
        { error: { message: 'Item already owned' } },
        { status: 400 }
      );
    }

    // Get user balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });

    if (!user || user.pointsBalance < item.pricePoints) {
      return NextResponse.json(
        { error: { message: 'Insufficient points' } },
        { status: 400 }
      );
    }

    // Transaction: deduct points, create ownership, log transaction, equip item
    const equippedField = item.type === 'skin' ? 'equippedSkinId' : 'equippedTrailId';

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          pointsBalance: { decrement: item.pricePoints },
          [equippedField]: itemId,
        },
      }),
      prisma.userItem.create({
        data: { userId, itemId },
      }),
      prisma.pointTransaction.create({
        data: {
          userId,
          delta: -item.pricePoints,
          reason: 'purchase',
          refId: itemId,
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });

    return NextResponse.json({
      success: true,
      newBalance: updatedUser?.pointsBalance ?? 0,
    });
  } catch (error) {
    console.error('Purchase failed:', error);
    return NextResponse.json(
      { error: { message: 'Purchase failed' } },
      { status: 500 }
    );
  }
}
