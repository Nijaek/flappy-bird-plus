# Game Store Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a game store with purchasable skins (bird colors) and trails (particle effects) using points earned from gameplay.

**Architecture:** Modal-based shop UI with tabs for Skins/Trails. Points earned 1:1 with score. Items stored in database, equipped cosmetics applied to game renderer. Trail system uses particle spawning.

**Tech Stack:** Next.js, React, Prisma, Canvas 2D, TypeScript

---

## Task 1: Seed Shop Items in Database

**Files:**
- Create: `prisma/seed-items.ts`
- Modify: `package.json` (add seed script)

**Step 1: Create the seed script**

```typescript
// prisma/seed-items.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const items = [
  // Skins
  { sku: 'skin_yellow', name: 'Yellow', type: 'skin', pricePoints: 0, active: true },
  { sku: 'skin_blue', name: 'Blue', type: 'skin', pricePoints: 50, active: true },
  { sku: 'skin_red', name: 'Red', type: 'skin', pricePoints: 50, active: true },
  { sku: 'skin_rainbow', name: 'Rainbow', type: 'skin', pricePoints: 250, active: true },
  // Trails
  { sku: 'trail_sparkles', name: 'Sparkles', type: 'trail', pricePoints: 50, active: true },
  { sku: 'trail_bubbles', name: 'Bubbles', type: 'trail', pricePoints: 50, active: true },
  { sku: 'trail_fire', name: 'Fire', type: 'trail', pricePoints: 100, active: true },
  { sku: 'trail_stars', name: 'Stars', type: 'trail', pricePoints: 100, active: true },
  { sku: 'trail_rainbow', name: 'Rainbow', type: 'trail', pricePoints: 250, active: true },
];

async function main() {
  console.log('Seeding shop items...');

  for (const item of items) {
    await prisma.item.upsert({
      where: { sku: item.sku },
      update: item,
      create: item,
    });
    console.log(`  ✓ ${item.sku}`);
  }

  console.log('Done seeding items.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Add seed script to package.json**

Add to `package.json` scripts:
```json
"seed:items": "npx tsx prisma/seed-items.ts"
```

**Step 3: Run the seed script**

Run: `npm run seed:items`
Expected: Items created in database

**Step 4: Commit**

```bash
git add prisma/seed-items.ts package.json
git commit -m "feat: add shop items seed script"
```

---

## Task 2: Create Shop API - GET Items

**Files:**
- Create: `src/app/api/shop/items/route.ts`

**Step 1: Create the items API endpoint**

```typescript
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
```

**Step 2: Test manually**

Run: `npm run dev`
Test: `curl http://localhost:3000/api/shop/items`
Expected: JSON with items array

**Step 3: Commit**

```bash
git add src/app/api/shop/items/route.ts
git commit -m "feat: add GET /api/shop/items endpoint"
```

---

## Task 3: Create Shop API - Purchase

**Files:**
- Create: `src/app/api/shop/purchase/route.ts`

**Step 1: Create the purchase API endpoint**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/app/api/shop/purchase/route.ts
git commit -m "feat: add POST /api/shop/purchase endpoint"
```

---

## Task 4: Create Shop API - Equip

**Files:**
- Create: `src/app/api/shop/equip/route.ts`

**Step 1: Create the equip API endpoint**

```typescript
// src/app/api/shop/equip/route.ts
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
    const { itemId, type } = await request.json();

    if (!type || !['skin', 'trail'].includes(type)) {
      return NextResponse.json(
        { error: { message: 'Valid type required (skin or trail)' } },
        { status: 400 }
      );
    }

    const equippedField = type === 'skin' ? 'equippedSkinId' : 'equippedTrailId';

    // If itemId is null, unequip (only valid for trails)
    if (itemId === null) {
      if (type === 'skin') {
        return NextResponse.json(
          { error: { message: 'Cannot unequip skin' } },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { [equippedField]: null },
      });

      return NextResponse.json({ success: true });
    }

    // Verify ownership
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item || item.type !== type) {
      return NextResponse.json(
        { error: { message: 'Item not found' } },
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
          { error: { message: 'Item not owned' } },
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
      { error: { message: 'Equip failed' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/shop/equip/route.ts
git commit -m "feat: add POST /api/shop/equip endpoint"
```

---

## Task 5: Update Points Award on Game End

**Files:**
- Modify: `src/app/api/runs/end/route.ts`

**Step 1: Find and modify the runs end endpoint**

Add points awarding after score submission. In the existing transaction or after it:

```typescript
// Add after the run is recorded successfully:
// Award points equal to score
if (score > 0) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { pointsBalance: { increment: score } },
    }),
    prisma.pointTransaction.create({
      data: {
        userId,
        delta: score,
        reason: 'run',
        refId: run.id, // or the run ID from the transaction
      },
    }),
  ]);
}
```

**Step 2: Commit**

```bash
git add src/app/api/runs/end/route.ts
git commit -m "feat: award points equal to score after each run"
```

---

## Task 6: Create ShopModal CSS

**Files:**
- Create: `src/components/ShopModal.css`

**Step 1: Create the CSS file**

```css
/* src/components/ShopModal.css */
.shop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shop-modal {
  background: #DEB858;
  border: 4px solid #8B6914;
  box-shadow: 4px 4px 0 #543810, inset 2px 2px 0 #F8E8A8;
  width: 280px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.shop-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: #8B6914;
  z-index: 10;
}

.shop-close:hover {
  color: #D85020;
}

.shop-header {
  padding: 16px 16px 8px;
  text-align: center;
}

.shop-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
  color: #FFFFFF;
  text-shadow: 2px 2px 0 #543810;
  margin: 0;
}

.shop-balance {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #FFD700;
  text-shadow: 1px 1px 0 #543810;
  margin-top: 8px;
}

.shop-tabs {
  display: flex;
  border-bottom: 2px solid #8B6914;
}

.shop-tab {
  flex: 1;
  padding: 10px 8px;
  background: none;
  border: none;
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: #8B6914;
  cursor: pointer;
  transition: background 0.1s;
}

.shop-tab:hover {
  background: rgba(255, 255, 255, 0.2);
}

.shop-tab.active {
  background: #F8E8A8;
  color: #543810;
}

.shop-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.shop-item {
  background: #F8F0D8;
  border: 2px solid #8B6914;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.shop-item:hover {
  transform: translateY(-2px);
  box-shadow: 2px 2px 0 #543810;
}

.shop-item.selected {
  border-color: #F87820;
  box-shadow: 0 0 0 2px #F87820;
}

.shop-item.equipped {
  border-color: #4CAF50;
  background: #E8F5E9;
}

.shop-item-preview {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shop-item-preview canvas {
  image-rendering: pixelated;
}

.shop-item-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #543810;
  margin-top: 6px;
  text-align: center;
}

.shop-item-price {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #8B6914;
  margin-top: 4px;
}

.shop-item-price.owned {
  color: #4CAF50;
}

.shop-item-price.equipped {
  color: #4CAF50;
  font-weight: bold;
}

.shop-buy-prompt {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: #F87820;
  margin-top: 4px;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.shop-error {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #D85020;
  text-align: center;
  padding: 8px;
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.shop-loading {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #8B6914;
  text-align: center;
  padding: 20px;
}
```

**Step 2: Commit**

```bash
git add src/components/ShopModal.css
git commit -m "feat: add ShopModal CSS styles"
```

---

## Task 7: Create ShopModal Component

**Files:**
- Create: `src/components/ShopModal.tsx`

**Step 1: Create the ShopModal component**

```typescript
// src/components/ShopModal.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import './ShopModal.css';

interface ShopModalProps {
  onClose: () => void;
  isAuthenticated: boolean;
}

interface ShopItem {
  id: string;
  sku: string;
  name: string;
  type: 'skin' | 'trail';
  price: number;
  owned: boolean;
  equipped: boolean;
}

type TabType = 'skins' | 'trails';

export default function ShopModal({ onClose, isAuthenticated }: ShopModalProps) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('skins');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch items and balance
  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, userRes] = await Promise.all([
        fetch('/api/shop/items'),
        isAuthenticated ? fetch('/api/users/me') : Promise.resolve(null),
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items);
      }

      if (userRes?.ok) {
        const data = await userRes.json();
        setBalance(data.user?.pointsBalance ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch shop data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleItemClick = async (item: ShopItem) => {
    setError(null);

    if (!isAuthenticated) {
      setError('Sign in to purchase items');
      return;
    }

    // If owned, equip/unequip
    if (item.owned) {
      if (item.equipped) {
        // Unequip (only trails can be unequipped)
        if (item.type === 'trail') {
          try {
            const res = await fetch('/api/shop/equip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: null, type: 'trail' }),
            });
            if (res.ok) {
              await fetchData();
            }
          } catch (err) {
            console.error('Unequip failed:', err);
          }
        }
        return;
      }

      // Equip
      try {
        const res = await fetch('/api/shop/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, type: item.type }),
        });
        if (res.ok) {
          await fetchData();
        }
      } catch (err) {
        console.error('Equip failed:', err);
      }
      return;
    }

    // Not owned - purchase flow
    if (selectedId === item.id) {
      // Second tap - confirm purchase
      if (balance < item.price) {
        setError('Not enough points!');
        setSelectedId(null);
        return;
      }

      try {
        const res = await fetch('/api/shop/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id }),
        });

        if (res.ok) {
          const data = await res.json();
          setBalance(data.newBalance);
          await fetchData();
          setSelectedId(null);
        } else {
          const data = await res.json();
          setError(data.error?.message || 'Purchase failed');
          setSelectedId(null);
        }
      } catch (err) {
        console.error('Purchase failed:', err);
        setError('Purchase failed');
        setSelectedId(null);
      }
    } else {
      // First tap - select
      if (balance < item.price) {
        setError('Not enough points!');
        return;
      }
      setSelectedId(item.id);
    }
  };

  const filteredItems = items.filter(item =>
    activeTab === 'skins' ? item.type === 'skin' : item.type === 'trail'
  );

  if (isLoading) {
    return (
      <div className="shop-overlay">
        <div className="shop-modal">
          <div className="shop-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-overlay">
      <div className="shop-modal">
        <button className="shop-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="shop-header">
          <h1 className="shop-title">SHOP</h1>
          <div className="shop-balance">★ {balance}</div>
        </div>

        <div className="shop-tabs">
          <button
            className={`shop-tab ${activeTab === 'skins' ? 'active' : ''}`}
            onClick={() => { setActiveTab('skins'); setSelectedId(null); setError(null); }}
          >
            SKINS
          </button>
          <button
            className={`shop-tab ${activeTab === 'trails' ? 'active' : ''}`}
            onClick={() => { setActiveTab('trails'); setSelectedId(null); setError(null); }}
          >
            TRAILS
          </button>
        </div>

        {error && <div className="shop-error">{error}</div>}

        <div className="shop-content">
          <div className="shop-grid">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`shop-item ${selectedId === item.id ? 'selected' : ''} ${item.equipped ? 'equipped' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <div className="shop-item-preview">
                  <ItemPreview item={item} />
                </div>
                <div className="shop-item-name">{item.name}</div>
                <div className={`shop-item-price ${item.owned ? (item.equipped ? 'equipped' : 'owned') : ''}`}>
                  {item.equipped ? 'EQUIPPED' : item.owned ? 'OWNED' : `★ ${item.price}`}
                </div>
                {selectedId === item.id && !item.owned && (
                  <div className="shop-buy-prompt">TAP TO BUY</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview component for items
function ItemPreview({ item }: { item: ShopItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 60, 60);

    if (item.type === 'skin') {
      // Draw a simple colored circle for skin preview
      const colors: Record<string, string> = {
        skin_yellow: '#F8E848',
        skin_blue: '#68C8D8',
        skin_red: '#E85858',
        skin_rainbow: 'rainbow',
      };

      const color = colors[item.sku] || '#F8E848';

      if (color === 'rainbow') {
        // Draw rainbow gradient
        const gradient = ctx.createLinearGradient(15, 15, 45, 45);
        gradient.addColorStop(0, '#FF0000');
        gradient.addColorStop(0.2, '#FF7F00');
        gradient.addColorStop(0.4, '#FFFF00');
        gradient.addColorStop(0.6, '#00FF00');
        gradient.addColorStop(0.8, '#0000FF');
        gradient.addColorStop(1, '#9400D3');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = color;
      }

      // Draw bird body shape (simplified)
      ctx.beginPath();
      ctx.ellipse(30, 30, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(36, 26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(38, 26, 3, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#F88028';
      ctx.fillRect(42, 28, 8, 4);
      ctx.fillStyle = '#D85020';
      ctx.fillRect(42, 32, 8, 4);
    } else {
      // Trail preview - draw particles
      const particleColors: Record<string, string[]> = {
        trail_sparkles: ['#FFD700', '#FFEC8B', '#FFF8DC'],
        trail_bubbles: ['#87CEEB', '#ADD8E6', '#B0E0E6'],
        trail_fire: ['#FF4500', '#FF6347', '#FFA500'],
        trail_stars: ['#FFD700', '#FFA500', '#FFFFFF'],
        trail_rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#9400D3'],
      };

      const colors = particleColors[item.sku] || ['#FFFFFF'];

      for (let i = 0; i < 12; i++) {
        const x = 10 + Math.random() * 40;
        const y = 10 + Math.random() * 40;
        const size = 2 + Math.random() * 4;
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;

        if (item.sku === 'trail_stars') {
          // Draw star shape
          drawStar(ctx, x, y, size);
        } else if (item.sku === 'trail_bubbles') {
          // Draw circle
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Draw square
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }
  }, [item]);

  return <canvas ref={canvasRef} width={60} height={60} />;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillRect(x - size / 2, y - 1, size, 2);
  ctx.fillRect(x - 1, y - size / 2, 2, size);
}
```

**Step 2: Commit**

```bash
git add src/components/ShopModal.tsx
git commit -m "feat: add ShopModal component"
```

---

## Task 8: Wire Up ShopModal to HomeScreen

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add shop modal state and import**

Add import:
```typescript
import ShopModal from '@/components/ShopModal';
```

Add state:
```typescript
const [showShopModal, setShowShopModal] = useState(false);
```

Add handler:
```typescript
const handleShopClick = useCallback(() => {
  setShowShopModal(true);
}, []);
```

**Step 2: Pass handler to HomeScreen and render modal**

Update HomeScreen props to include `onShopClick`:
```typescript
<HomeScreen
  onStart={handleGoToGetReady}
  isAuthenticated={isAuthenticated}
  userDisplayName={session?.user?.displayName || null}
  bestScore={bestScore}
  onAccountClick={handleAccountClick}
  onLeaderboardClick={handleLeaderboardClick}
  onSettingsClick={handleSettingsClick}
  onShopClick={handleShopClick}
/>
```

Add modal render:
```typescript
{showShopModal && (
  <ShopModal
    onClose={() => setShowShopModal(false)}
    isAuthenticated={isAuthenticated}
  />
)}
```

**Step 3: Update HomeScreen to use onShopClick**

In `src/components/HomeScreen.tsx`, add to props interface:
```typescript
onShopClick: () => void;
```

Update the shop button click handler to call `onShopClick` instead of doing nothing.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/HomeScreen.tsx
git commit -m "feat: wire ShopModal to HomeScreen shop button"
```

---

## Task 9: Add Skin Color Palettes to Constants

**Files:**
- Modify: `src/game/constants.ts`

**Step 1: Add skin color palettes**

Add after existing COLORS:
```typescript
export const SKIN_PALETTES: Record<string, { body: string; shadow: string }> = {
  skin_yellow: { body: '#F8E848', shadow: '#e6c91d' },
  skin_blue: { body: '#68C8D8', shadow: '#4898A8' },
  skin_red: { body: '#E85858', shadow: '#B83838' },
  skin_rainbow: { body: 'rainbow', shadow: 'rainbow' },
};
```

**Step 2: Commit**

```bash
git add src/game/constants.ts
git commit -m "feat: add skin color palettes to constants"
```

---

## Task 10: Update Bird Renderer for Custom Colors

**Files:**
- Modify: `src/game/renderer.ts`

**Step 1: Update drawBird to accept optional color palette**

Update the function signature and add color parameter handling:

```typescript
export function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number = 1,
  rotation: number = 0,
  scale: number = 1,
  skinSku: string = 'skin_yellow',
  animationTime: number = 0
) {
  // ... existing setup code ...

  // Determine colors based on skin
  let bodyColor = COLORS.birdYellow;
  let shadowColor = COLORS.birdDark;

  const palette = SKIN_PALETTES[skinSku];
  if (palette) {
    if (palette.body === 'rainbow') {
      // Rainbow cycles through hues
      const hue = (animationTime * 0.1) % 360;
      bodyColor = `hsl(${hue}, 80%, 60%)`;
      shadowColor = `hsl(${hue}, 70%, 45%)`;
    } else {
      bodyColor = palette.body;
      shadowColor = palette.shadow;
    }
  }

  // Replace COLORS.birdYellow with bodyColor
  // Replace COLORS.birdDark with shadowColor
  // ... rest of drawing code using these variables ...
}
```

**Step 2: Import SKIN_PALETTES**

Add to imports:
```typescript
import { COLORS, GAME, GROUND_PATTERN, SKIN_PALETTES } from './constants';
```

**Step 3: Commit**

```bash
git add src/game/renderer.ts
git commit -m "feat: update drawBird to support custom skin colors"
```

---

## Task 11: Create Trail Particle System

**Files:**
- Create: `src/game/trails.ts`

**Step 1: Create the particle trail system**

```typescript
// src/game/trails.ts

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: string;
}

export class TrailSystem {
  private particles: Particle[] = [];
  private trailType: string | null = null;
  private spawnTimer: number = 0;
  private readonly MAX_PARTICLES = 30;
  private readonly SPAWN_INTERVAL = 50; // ms

  setTrail(trailSku: string | null) {
    this.trailType = trailSku;
    if (!trailSku) {
      this.particles = [];
    }
  }

  update(birdX: number, birdY: number, deltaMs: number) {
    if (!this.trailType) return;

    // Spawn new particles
    this.spawnTimer += deltaMs;
    if (this.spawnTimer >= this.SPAWN_INTERVAL && this.particles.length < this.MAX_PARTICLES) {
      this.spawnTimer = 0;
      this.spawnParticle(birdX, birdY);
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Apply velocity
      p.x += p.vx * (deltaMs / 16.67);
      p.y += p.vy * (deltaMs / 16.67);

      // Type-specific behavior
      if (p.type === 'trail_bubbles') {
        p.vy -= 0.02; // Float up
        p.size *= 0.995; // Shrink
      } else if (p.type === 'trail_fire') {
        p.vy -= 0.03; // Rise
        p.vx += (Math.random() - 0.5) * 0.1; // Flicker
      }
    }
  }

  private spawnParticle(x: number, y: number) {
    const configs: Record<string, () => Partial<Particle>> = {
      trail_sparkles: () => ({
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 2 + Math.random() * 3,
        maxLife: 400,
        color: ['#FFD700', '#FFEC8B', '#FFF8DC'][Math.floor(Math.random() * 3)],
      }),
      trail_bubbles: () => ({
        vx: (Math.random() - 0.5) * 1,
        vy: -0.5 - Math.random() * 0.5,
        size: 4 + Math.random() * 4,
        maxLife: 600,
        color: ['#87CEEB', '#ADD8E6', '#B0E0E6'][Math.floor(Math.random() * 3)],
      }),
      trail_fire: () => ({
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random(),
        size: 3 + Math.random() * 3,
        maxLife: 350,
        color: ['#FF4500', '#FF6347', '#FFA500'][Math.floor(Math.random() * 3)],
      }),
      trail_stars: () => ({
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        size: 3 + Math.random() * 3,
        maxLife: 500,
        color: ['#FFD700', '#FFA500', '#FFFFFF'][Math.floor(Math.random() * 3)],
      }),
      trail_rainbow: () => {
        const hue = Math.random() * 360;
        return {
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: 3 + Math.random() * 3,
          maxLife: 450,
          color: `hsl(${hue}, 80%, 60%)`,
        };
      },
    };

    const config = configs[this.trailType!]?.() ?? {};

    this.particles.push({
      x: x - 10, // Behind bird
      y,
      vx: config.vx ?? 0,
      vy: config.vy ?? 0,
      life: config.maxLife ?? 400,
      maxLife: config.maxLife ?? 400,
      size: config.size ?? 3,
      color: config.color ?? '#FFFFFF',
      type: this.trailType!,
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'trail_bubbles') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'trail_stars') {
        // 4-point star
        const s = p.size;
        ctx.fillRect(p.x - s, p.y - 1, s * 2, 2);
        ctx.fillRect(p.x - 1, p.y - s, 2, s * 2);
      } else {
        // Default: square
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles = [];
    this.spawnTimer = 0;
  }
}
```

**Step 2: Commit**

```bash
git add src/game/trails.ts
git commit -m "feat: add particle trail system"
```

---

## Task 12: Integrate Trails and Skins into PlayingScreen

**Files:**
- Modify: `src/components/PlayingScreen.tsx`

**Step 1: Add cosmetics props and trail system**

Add to props:
```typescript
interface PlayingScreenProps {
  onGameOver: (score: number, durationMs: number, frameData?: ImageData) => void;
  equippedSkin?: string;
  equippedTrail?: string;
}
```

Add imports and state:
```typescript
import { TrailSystem } from '@/game/trails';

// Inside component:
const trailSystemRef = useRef(new TrailSystem());
const animationTimeRef = useRef(0);
```

**Step 2: Initialize trail on mount**

```typescript
useEffect(() => {
  trailSystemRef.current.setTrail(equippedTrail ?? null);
}, [equippedTrail]);
```

**Step 3: Update render loop to draw trails and pass skin to drawBird**

In the render function, after updating physics and before drawing bird:
```typescript
// Update trails
trailSystemRef.current.update(GAME.BIRD_X + extraWidth, birdYRef.current, deltaMs);
animationTimeRef.current += deltaMs;

// Draw trails (before bird)
trailSystemRef.current.draw(ctx);

// Draw bird with skin
drawBird(
  ctx,
  GAME.BIRD_X + extraWidth,
  birdYRef.current,
  birdFrameRef.current,
  birdRotation,
  1,
  equippedSkin ?? 'skin_yellow',
  animationTimeRef.current
);
```

**Step 4: Commit**

```bash
git add src/components/PlayingScreen.tsx
git commit -m "feat: integrate skins and trails into gameplay"
```

---

## Task 13: Fetch and Pass Cosmetics from Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add state for cosmetics**

```typescript
const [equippedSkin, setEquippedSkin] = useState<string>('skin_yellow');
const [equippedTrail, setEquippedTrail] = useState<string | null>(null);
```

**Step 2: Fetch cosmetics on auth change**

Add to the existing useEffect that fetches user data:
```typescript
// After fetching /api/users/me, extract cosmetics
if (data?.user) {
  // Find equipped skin/trail SKUs
  if (data.user.equippedSkinId) {
    // Fetch item to get SKU
    fetch('/api/shop/items')
      .then(r => r.json())
      .then(shopData => {
        const skin = shopData.items.find((i: any) => i.id === data.user.equippedSkinId);
        if (skin) setEquippedSkin(skin.sku);
        const trail = shopData.items.find((i: any) => i.id === data.user.equippedTrailId);
        if (trail) setEquippedTrail(trail.sku);
      });
  }
}
```

**Step 3: Pass cosmetics to PlayingScreen**

```typescript
<PlayingScreen
  onGameOver={handleGameOver}
  equippedSkin={equippedSkin}
  equippedTrail={equippedTrail ?? undefined}
/>
```

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: fetch and pass equipped cosmetics to game"
```

---

## Task 14: Display Points on HomeScreen

**Files:**
- Modify: `src/components/HomeScreen.tsx`

**Step 1: Add points display to HomeScreen**

Add to props:
```typescript
pointsBalance: number;
```

In the render function, add near the best score display:
```typescript
// Points balance
ctx.font = 'bold 10px "Press Start 2P", monospace';
const pointsText = `★ ${pointsBalance}`;
ctx.fillStyle = COLORS.textOutline;
for (const [ox, oy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
  ctx.fillText(pointsText, scoreX + ox, currentY + 22 + oy);
}
ctx.fillStyle = '#FFD700';
ctx.fillText(pointsText, scoreX, currentY + 22);
```

**Step 2: Pass points from page.tsx**

Add state and fetch points:
```typescript
const [pointsBalance, setPointsBalance] = useState(0);

// In user data fetch:
setPointsBalance(data.user?.pointsBalance ?? 0);
```

Pass to HomeScreen:
```typescript
<HomeScreen
  // ... existing props
  pointsBalance={pointsBalance}
/>
```

**Step 3: Commit**

```bash
git add src/components/HomeScreen.tsx src/app/page.tsx
git commit -m "feat: display points balance on HomeScreen"
```

---

## Task 15: Final Testing and Cleanup

**Step 1: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 2: Run build**

Run: `npm run build` (with proper env vars)
Expected: Build succeeds

**Step 3: Manual testing checklist**

- [ ] Shop opens from HomeScreen button
- [ ] Tabs switch between Skins and Trails
- [ ] Items display with correct prices
- [ ] Owned items show "OWNED" status
- [ ] Equipped items show "EQUIPPED" status
- [ ] Purchase flow: tap to select, tap again to buy
- [ ] Insufficient funds shows error
- [ ] Points deducted after purchase
- [ ] Purchased item auto-equips
- [ ] Equipped skin visible in gameplay
- [ ] Trail particles appear during gameplay
- [ ] Points awarded after each game (equal to score)
- [ ] Points balance updates on HomeScreen

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete game store implementation"
```

---

## Summary

This plan implements the full game store feature:

1. **Database seeding** (Task 1)
2. **API routes** for items, purchase, equip (Tasks 2-4)
3. **Points awarding** after gameplay (Task 5)
4. **ShopModal UI** with tabs and item grid (Tasks 6-8)
5. **Skin rendering** with color palettes (Tasks 9-10)
6. **Trail particle system** (Task 11)
7. **Game integration** for cosmetics (Tasks 12-13)
8. **Points display** on HomeScreen (Task 14)
9. **Testing and polish** (Task 15)
