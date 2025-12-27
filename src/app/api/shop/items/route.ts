// src/app/api/shop/items/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // Get all active items
    const items = await prisma.item.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { pricePoints: 'asc' }],
    });

    // Get user's owned items and equipped items
    let ownedItemIds: string[] = [];
    let equippedSkinId: string | null = null;
    let equippedTrailId: string | null = null;

    if (userId) {
      const userItems = await prisma.userItem.findMany({
        where: { userId },
        select: { itemId: true },
      });
      ownedItemIds = userItems.map(ui => ui.itemId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { equippedSkinId: true, equippedTrailId: true },
      });
      equippedSkinId = user?.equippedSkinId ?? null;
      equippedTrailId = user?.equippedTrailId ?? null;
    }

    // Find the default yellow skin (free, always owned)
    const yellowSkin = items.find(i => i.sku === 'skin_yellow');
    if (yellowSkin && !ownedItemIds.includes(yellowSkin.id)) {
      ownedItemIds.push(yellowSkin.id);
    }

    const response = items.map(item => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      type: item.type,
      price: item.pricePoints,
      owned: ownedItemIds.includes(item.id) || item.pricePoints === 0,
      equipped: item.id === equippedSkinId || item.id === equippedTrailId,
    }));

    return NextResponse.json({ items: response });
  } catch (error) {
    console.error('Failed to fetch shop items:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch items' } },
      { status: 500 }
    );
  }
}
