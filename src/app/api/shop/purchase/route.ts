// src/app/api/shop/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body with error handling
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { itemId } = body as { itemId?: unknown };

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Item ID required' } },
        { status: 400 }
      );
    }

    // Get item (can be outside transaction since items rarely change)
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item || !item.active) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    // Determine which equipped field to update based on item type
    const equippedField =
      item.type === 'skin'
        ? 'equippedSkinId'
        : item.type === 'trail'
          ? 'equippedTrailId'
          : 'equippedBgId';

    // Use interactive transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if already owned (inside transaction)
      const existingOwnership = await tx.userItem.findUnique({
        where: { userId_itemId: { userId, itemId } },
      });

      if (existingOwnership) {
        return { error: 'ALREADY_OWNED' as const };
      }

      // Get user balance (inside transaction)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { pointsBalance: true },
      });

      if (!user || user.pointsBalance < item.pricePoints) {
        return { error: 'INSUFFICIENT_POINTS' as const };
      }

      // Deduct points and equip item
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          pointsBalance: { decrement: item.pricePoints },
          [equippedField]: itemId,
        },
        select: { pointsBalance: true },
      });

      // Create ownership record
      await tx.userItem.create({
        data: { userId, itemId },
      });

      // Log point transaction
      await tx.pointTransaction.create({
        data: {
          userId,
          delta: -item.pricePoints,
          reason: 'purchase',
          refId: itemId,
        },
      });

      return { success: true, newBalance: updatedUser.pointsBalance };
    });

    // Handle transaction result
    if ('error' in result) {
      if (result.error === 'ALREADY_OWNED') {
        return NextResponse.json(
          { error: { code: 'ALREADY_OWNED', message: 'Item already owned' } },
          { status: 400 }
        );
      }
      if (result.error === 'INSUFFICIENT_POINTS') {
        return NextResponse.json(
          { error: { code: 'INSUFFICIENT_POINTS', message: 'Insufficient points' } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('Purchase failed:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Purchase failed' } },
      { status: 500 }
    );
  }
}
