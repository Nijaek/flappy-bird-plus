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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { itemId, type } = body as { itemId: string | null; type: string };

    if (!type || !['skin', 'trail'].includes(type)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Valid type required (skin or trail)' } },
        { status: 400 }
      );
    }

    const equippedField = type === 'skin' ? 'equippedSkinId' : 'equippedTrailId';

    // If itemId is null, unequip (only valid for trails)
    if (itemId === null) {
      if (type === 'skin') {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Cannot unequip skin' } },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { [equippedField]: null },
      });

      return NextResponse.json({ success: true });
    }

    // Validate itemId is a string
    if (typeof itemId !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Item ID must be a string' } },
        { status: 400 }
      );
    }

    // Verify item exists and type matches
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item || item.type !== type) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    // Check ownership (free items are always owned)
    if (item.pricePoints > 0) {
      const ownership = await prisma.userItem.findUnique({
        where: { userId_itemId: { userId, itemId } },
      });

      if (!ownership) {
        return NextResponse.json(
          { error: { code: 'NOT_OWNED', message: 'Item not owned' } },
          { status: 400 }
        );
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { [equippedField]: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Equip failed:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Equip failed' } },
      { status: 500 }
    );
  }
}
