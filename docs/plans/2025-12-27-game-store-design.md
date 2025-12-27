# Game Store Design

## Overview

A modal-based shop where players spend points earned from gameplay to unlock and equip cosmetic items. Two tabs: Skins (bird colors) and Trails (particle effects behind the bird).

## Currency System

- Players earn **1 point per pipe passed** (score of 15 = 15 points)
- Points accumulate in `pointsBalance` field on User
- All transactions logged in `PointTransaction` table

## Items & Pricing

### Skins (Bird Colors)

| SKU | Name | Tier | Price |
|-----|------|------|-------|
| skin_yellow | Yellow | Default | Free |
| skin_blue | Blue | Basic | 50 |
| skin_red | Red | Basic | 50 |
| skin_rainbow | Rainbow | Premium | 250 |

### Trails (Particle Effects)

| SKU | Name | Tier | Price |
|-----|------|------|-------|
| trail_sparkles | Sparkles | Basic | 50 |
| trail_bubbles | Bubbles | Basic | 50 |
| trail_fire | Fire | Mid | 100 |
| trail_stars | Stars | Mid | 100 |
| trail_rainbow | Rainbow | Premium | 250 |

## Shop Modal UI

### Structure
- Opens from existing "Shop" button on HomeScreen
- Follows same modal pattern as SettingsModal/AccountModal
- Close button (X) in top-right, ESC key closes

### Header
- Title: "SHOP" centered at top
- Points balance displayed below title (e.g., "★ 125")

### Tabs
- Two horizontal tabs: **SKINS** | **TRAILS**
- Active tab highlighted, inactive tab dimmed

### Item Grid
- 2 items per row (~120px cards with gap)
- Each card shows:
  - Animated preview (bird flapping or particles moving)
  - Item name
  - Price badge (or "OWNED" / "EQUIPPED" status)

### Card States
- **Locked**: Shows price, normal appearance
- **Selected**: Highlighted border, "TAP TO BUY" prompt
- **Owned**: Shows "OWNED" badge
- **Equipped**: Shows checkmark, "EQUIPPED" badge

## Interaction Flow

### Purchasing (unowned items)
1. Tap item card → enters "selected" state with highlight
2. Tap again → purchase executes:
   - Deduct points from balance
   - Create UserItem record
   - Log PointTransaction (reason: 'purchase')
   - Auto-equip the item
3. Tap elsewhere → deselects without buying

### Insufficient Funds
- Tap item you can't afford → "Not enough points!" message
- Card doesn't enter selected state

### Equipping (owned items)
- Single tap → immediately equips
- Previous item of same type unequips

### Unequipping
- Tap currently equipped item → unequips
- Trails can be fully unequipped (optional)
- Skins always have one equipped (default to Yellow)

## Rendering Implementation

### Skins (Bird Colors)
Modify `drawBird()` in `renderer.ts` to accept color palette parameter:

- **Yellow** (default): `#F8E848` body, `#e6c91d` shadow
- **Blue**: `#68C8D8` body, `#4898A8` shadow
- **Red**: `#E85858` body, `#B83838` shadow
- **Rainbow**: Cycle through hues over time (animated)

### Trails (Particle System)
New `TrailSystem` class:

- Spawns particles at bird position every N frames
- Each particle: position, velocity, lifetime, size, color, type
- ~20-30 particles max for performance
- Rendered behind bird, before pipes

**Particle Types:**
- **Sparkles**: Small dots, random scatter, quick fade
- **Bubbles**: Circles float up, shrink as they fade
- **Fire**: Orange/red, flicker opacity, drift upward
- **Stars**: Star/cross shapes, gentle float
- **Rainbow**: Multi-colored, cycle through spectrum

### Preview Rendering
- Shop cards use small canvas elements (60x60px)
- Bird previews: render at center, animate wing frames
- Trail previews: render particles in loop pattern

## API Routes

### GET `/api/shop/items`
Returns all active items with ownership/equipped status.

Response:
```json
{
  "items": [
    { "id": "...", "sku": "skin_blue", "name": "Blue", "type": "skin", "price": 50, "owned": false, "equipped": false }
  ]
}
```

### POST `/api/shop/purchase`
Purchase an item.

Request: `{ "itemId": "..." }`

Validates:
- User authenticated
- Item exists and active
- Not already owned
- Sufficient balance

Response: `{ "success": true, "newBalance": 125 }`

### POST `/api/shop/equip`
Equip or unequip an item.

Request: `{ "itemId": "..." | null, "type": "skin" | "trail" }`

- `null` unequips (only valid for trails)
- Validates user owns item

Response: `{ "success": true }`

### PATCH `/api/users/me` (extend existing)
Award points after game ends.

- Called from game-over flow with final score
- Awards points equal to score
- Logs PointTransaction (reason: 'run')

## Data Seeding

Create seed script to populate `Item` table:
- All 9 items with SKUs, names, types, prices
- Yellow skin is free (price: 0)

## Game Integration

### On Game Start
1. Fetch user's equipped skin/trail from `/api/users/me`
2. Pass cosmetics to game engine
3. Renderer uses skin colors
4. Trail system spawns correct particle type

### Points Display
- Show balance on HomeScreen (near shop button)
- Show in AccountModal
- Update reactively after purchases

### Default State
- New users: Yellow skin equipped, no trail
- `pointsBalance` starts at 0

### Guest Users
- Can browse shop
- Cannot purchase (prompt to sign up)
