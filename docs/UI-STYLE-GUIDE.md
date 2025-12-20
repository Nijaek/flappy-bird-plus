# Flappy Bird Plus — UI Style Guide

This document defines the visual design system based on the original Flappy Bird aesthetic, extended for our accounts, leaderboard, and shop features.

---

## 1) Design Philosophy

### Core Principles
- **Retro pixel art**: All assets use pixelated graphics with no anti-aliasing
- **Limited color palette**: Each element uses 3-5 colors maximum
- **Chunky outlines**: Text and UI elements have thick dark outlines (2-3px)
- **Playful simplicity**: Clean, uncluttered layouts with generous spacing
- **Consistent scale**: Maintain pixel-perfect scaling (1x, 2x, 3x) — never fractional

### Visual Hierarchy
1. Game action (bird, pipes) — always in focus
2. Score display — visible but unobtrusive
3. UI panels — appear on specific states (game over, menus)
4. Background elements — decorative, low contrast

### Pixel Art Rendering (CRITICAL)
The game MUST maintain a crisp, pixelated aesthetic at all scales:

**Canvas Settings:**
```javascript
ctx.imageSmoothingEnabled = false;
```

**CSS Requirements:**
```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* Firefox fallback */
}
```

**Scaling Rules:**
- Never use fractional scaling — only integer multiples (1x, 2x, 3x)
- Use `Math.floor()` for all position calculations when possible
- Avoid anti-aliased drawing operations (use `fillRect` over `arc` for small elements)

### Parallax Scrolling System
Background elements scroll at different speeds to create depth:

| Layer | Element | Speed Multiplier | Notes |
|-------|---------|------------------|-------|
| 4 (front) | Ground | 1.0x | Fastest, reference speed |
| 3 | Bushes | 0.6x | Medium-fast |
| 2 | Buildings | 0.2x | Slow, creates depth |
| 1 (back) | Clouds | 0.1x | Slowest, distant feel |

**Draw Order (back to front):**
1. Sky (static)
2. Clouds (parallax 0.1x)
3. City/Buildings (parallax 0.2x)
4. Bushes (parallax 0.6x)
5. Ground (parallax 1.0x)
6. Game objects (bird, pipes)
7. UI elements (buttons, score)

---

## 2) Color Palette

### Sky & Background
| Name | Hex | Usage |
|------|-----|-------|
| Sky Blue | `#70C5CE` | Main sky background |
| Sky Blue Light | `#87CEEB` | Upper sky gradient (optional) |
| Cloud White | `#FFFFFF` | Cloud sprites |

### Ground & Environment
| Name | Hex | Usage |
|------|-----|-------|
| Grass Green | `#80B038` | Grass stripe top |
| Grass Dark | `#5A8028` | Grass stripe shadow |
| Ground Tan | `#DED895` | Dirt/sand base |
| Ground Stripe | `#D2B048` | Horizontal ground stripes |

### Pipes
| Name | Hex | Usage |
|------|-----|-------|
| Pipe Green | `#73BF2E` | Pipe body main |
| Pipe Light | `#8CD038` | Pipe body highlight |
| Pipe Dark | `#557B1F` | Pipe body shadow |
| Pipe Cap Green | `#58A020` | Pipe cap (lip) main |
| Pipe Cap Light | `#6DC030` | Pipe cap highlight |
| Pipe Cap Dark | `#3D7010` | Pipe cap shadow/outline |

### Bird (Default Yellow)
| Name | Hex | Usage |
|------|-----|-------|
| Body Yellow | `#F8E848` | Main body |
| Body Orange | `#E89030` | Body shading |
| Beak Orange | `#F88028` | Beak |
| Beak Red | `#D85020` | Beak shadow |
| Eye White | `#FFFFFF` | Eye base |
| Eye Black | `#000000` | Pupil |
| Wing Tip | `#E85048` | Wing accent (optional) |

### Bird Variants (for Shop)
| Variant | Primary | Secondary | Accent |
|---------|---------|-----------|--------|
| Yellow (default) | `#F8E848` | `#E89030` | `#F88028` |
| Blue | `#68C8D8` | `#4898A8` | `#F88028` |
| Red | `#E85858` | `#B83838` | `#F8C848` |

### UI Elements
| Name | Hex | Usage |
|------|-----|-------|
| Panel Tan | `#DEB858` | Button/panel background |
| Panel Light | `#F8E8A8` | Panel highlight edge |
| Panel Dark | `#8B6914` | Panel shadow/outline |
| Button Cream | `#F8F0D8` | Button face |
| Button Border | `#8B6914` | Button outline |

### Text Colors
| Name | Hex | Usage |
|------|-----|-------|
| Text White | `#FFFFFF` | Score, title fill |
| Text Orange | `#F87820` | "Game Over", numbers |
| Text Outline | `#543810` | Dark brown outline |
| Text Shadow | `#000000` | Drop shadow (optional) |

### Accent Colors
| Name | Hex | Usage |
|------|-----|-------|
| Play Green | `#58A028` | Play button icon |
| Medal Bronze | `#CD7F32` | Bronze medal |
| Medal Silver | `#C0C0C0` | Silver medal |
| Medal Gold | `#FFD700` | Gold medal |
| Medal Platinum | `#E5E4E2` | Platinum medal |
| New Sparkle | `#F85858` | "NEW" indicator |
| Coin Gold | `#FFD700` | Points/currency icon |

---

## 3) Typography

### Primary Font: Pixel/Bitmap Style
Use a pixel font that matches the original aesthetic. Recommended options:
- **04b19** (closest to original)
- **Press Start 2P** (Google Fonts, good fallback)
- **Pixelify Sans** (Google Fonts)
- Custom sprite-based text rendering for authenticity

### Text Styles

#### Game Title ("FlappyBird")
- Font size: 48-64px equivalent (scaled)
- Fill: White (`#FFFFFF`)
- Outline: Dark brown (`#543810`), 3-4px
- Letter spacing: -2px (letters touch slightly)
- Style: Bold, chunky serifs

#### Score Display (In-Game)
- Font size: 36-48px equivalent
- Fill: White (`#FFFFFF`)
- Outline: Black (`#000000`), 2-3px
- Position: Top center, 10% from top
- Shadow: Optional 2px drop shadow

#### "Game Over" / "Get Ready"
- Font size: 32-40px equivalent
- Fill: Orange gradient (`#F87820` to `#E86010`)
- Outline: Dark brown (`#543810`), 2-3px
- Style: Italic/slanted pixel font

#### Panel Labels ("SCORE", "BEST", "MEDAL")
- Font size: 12-16px equivalent
- Fill: Orange (`#F87820`)
- No outline
- All caps

#### Panel Numbers
- Font size: 24-32px equivalent
- Fill: White (`#FFFFFF`)
- Outline: Dark brown, 1-2px
- Right-aligned

#### Button Text ("RATE", "OK", "MENU")
- Font size: 16-20px equivalent
- Fill: Dark brown (`#543810`)
- No outline
- All caps, centered

---

## 4) UI Components

### Buttons

#### Standard Button
```
┌─────────────────────────┐
│  ╔═══════════════════╗  │  <- Outer dark border (2px)
│  ║                   ║  │
│  ║     BUTTON        ║  │  <- Cream fill with text
│  ║                   ║  │
│  ╚═══════════════════╝  │  <- Inner highlight (1px top/left)
└─────────────────────────┘     Shadow (1px bottom/right)
```
- Size: 80-120px wide × 40-50px tall
- Corner radius: 8px (pixel-rounded)
- Border: 3px dark brown (`#8B6914`)
- Fill: Cream (`#F8F0D8`)
- Inner highlight: 1px lighter edge top/left
- Shadow: 1px darker edge bottom/right
- States:
  - **Default**: As described
  - **Pressed**: Shift content down 2px, darken fill 10%
  - **Disabled**: Grayscale, 50% opacity

#### Icon Button (Play, Leaderboard)
- Size: 52×52px to 80×80px
- Same border treatment as standard button
- Icon centered, 60% of button size
- Play icon: Green triangle (`#58A028`)
- Leaderboard icon: Orange podium (`#F87820`)

#### Small Button (Rate, Share)
- Size: 60-80px wide × 30-36px tall
- Same style, smaller text

### Panels

#### Score Panel (Game Over)
```
╔══════════════════════════════════╗
║  ┌────────────────────────────┐  ║
║  │  MEDAL          SCORE      │  ║
║  │  [    ]          200       │  ║
║  │                  BEST      │  ║
║  │                   200      │  ║
║  └────────────────────────────┘  ║
╚══════════════════════════════════╝
```
- Outer size: ~220×120px
- Border: 4px dark brown with highlight/shadow edges
- Fill: Tan gradient (`#DEB858` to `#C8A848`)
- Inner padding: 12-16px
- Medal area: Left side, 40×40px placeholder
- Score area: Right side, right-aligned numbers

#### Modal Panel (Shop, Leaderboard, Auth)
- Full-screen or centered overlay
- Dark semi-transparent backdrop (`rgba(0,0,0,0.6)`)
- Panel: Same tan style, larger (280×400px typical)
- Close button: Top-right corner (X icon)
- Title bar: Darker tan strip at top

### Medals
Four tiers based on score thresholds:
| Medal | Score Range | Color |
|-------|-------------|-------|
| None | 0-9 | Empty circle outline |
| Bronze | 10-19 | `#CD7F32` |
| Silver | 20-29 | `#C0C0C0` |
| Gold | 30-39 | `#FFD700` |
| Platinum | 40+ | `#E5E4E2` with sparkle |

Medal sprite: 32×32px, circular with wing emblem

### "NEW" Indicator
- Red/coral color (`#F85858`)
- Small pixel text or sparkle icon
- Positioned left of "BEST" score
- Animated: gentle pulse or sparkle

---

## 5) Game Elements

### Bird
- Sprite size: 34×24px (base resolution)
- Animation: 3 frames (wing up, mid, down)
- Frame rate: 150ms per frame while flying
- Rotation: -30° (up) to +90° (down) based on velocity
- Collision box: Slightly smaller than sprite (forgiving)

### Pipes
- Width: 52px
- Gap between pipes: 100-120px (adjustable difficulty)
- Cap (lip): 52×26px, extends 2-3px beyond body
- Body: Repeating 52×1px texture
- Spawn: Off-screen right, move left at constant speed
- Spacing: 200-250px between pipe pairs

### Ground
- Height: 112px total
  - Grass stripe: 12px (two-tone green)
  - Dirt: 100px (tan with horizontal stripes)
- Scrolling: Continuous loop, synced with pipe speed
- Repeating texture width: 336px

### Background
- Static (does not scroll with gameplay)
- Layers (back to front):
  1. Sky gradient (solid or subtle gradient)
  2. City silhouette (light green, `#A0D838`)
  3. Bushes/trees (medium green, `#80C020`)
  4. Clouds (white, scattered)

### Clouds
- 2-3 cloud variants
- Sizes: 50×30px, 80×40px, 100×50px
- Optional: Slow parallax scroll (10% of ground speed)

---

## 6) Screens & Layouts

### Home Screen
```
┌──────────────────────────────┐
│                              │
│        [FLAPPY BIRD]         │  <- Title logo, centered
│            PLUS              │  <- Subtitle (our addition)
│                              │
│           🐦                 │  <- Bird, animated idle
│                              │
│                              │
│          [RATE]              │  <- Optional rate button
│                              │
│     [▶ PLAY]  [🏆 RANK]      │  <- Main action buttons
│                              │
│   [👤 ACCOUNT]  [🛒 SHOP]    │  <- Secondary buttons (our addition)
│                              │
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

### Get Ready Screen
```
┌──────────────────────────────┐
│            12                │  <- Score (starts at 0)
│                              │
│        [GET READY!]          │  <- Animated text
│                              │
│           🐦                 │  <- Bird at start position
│                              │
│          [TAP]               │  <- Tap instruction icon
│           👆                 │
│                              │
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

### Gameplay Screen
```
┌──────────────────────────────┐
│            12                │  <- Current score, large
│                              │
│    ║     🐦        ║         │  <- Bird between pipes
│    ║               ║ ╔════╗  │
│    ║               ║ ║    ║  │  <- Pipes
│    ╠═══╗           ║ ║    ║  │
│    ║   ║           ╠═╩════╣  │
│    ║   ║                     │
│    ║   ║                     │
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

### Game Over Screen
```
┌──────────────────────────────┐
│                              │
│        [GAME OVER]           │  <- Animated entry (drops in)
│                              │
│   ╔══════════════════════╗   │
│   ║ MEDAL        SCORE   ║   │
│   ║ [🥇]          200    ║   │  <- Score panel
│   ║              BEST    ║   │
│   ║          NEW  200    ║   │
│   ╚══════════════════════╝   │
│                              │
│   ╔══════════════════════╗   │  <- Leaderboard preview (our addition)
│   ║  #1  ProPlayer  523  ║   │
│   ║  #2  BirdMaster 489  ║   │
│   ║  ...                 ║   │
│   ║  #150 You ★    200   ║   │
│   ╚══════════════════════╝   │
│                              │
│     [▶ PLAY]  [🏆 RANK]      │
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

### Shop Screen (New)
```
┌──────────────────────────────┐
│  [X]        SHOP        🪙247│  <- Close, title, points balance
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  [SKINS]  [TRAILS]  [BGS]   │  <- Category tabs
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                              │
│  ┌────┐  ┌────┐  ┌────┐     │
│  │ 🐦 │  │ 🐦 │  │ 🐦 │     │  <- Item grid
│  │yellow│ │blue │  │ red │     │
│  │ ✓   │  │🪙50│  │🪙100│     │  <- Owned/price
│  └────┘  └────┘  └────┘     │
│                              │
│  ┌────┐  ┌────┐  ┌────┐     │
│  │ ?? │  │ ?? │  │ ?? │     │  <- Locked items
│  │????│  │????│  │????│     │
│  │🪙200│  │🪙500│  │🪙999│     │
│  └────┘  └────┘  └────┘     │
│                              │
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

### Leaderboard Screen (New)
```
┌──────────────────────────────┐
│  [X]     LEADERBOARD         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  [GLOBAL]  [WEEKLY]  [DAILY] │  <- Time filter tabs
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                              │
│   🥇 #1   ProPlayer    523   │
│   🥈 #2   BirdMaster   489   │
│   🥉 #3   FlappyKing   456   │
│      #4   PipeDreamer  412   │
│      #5   SkyHigh      398   │
│      ...                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ★  #150  You          200   │  <- Your rank (highlighted)
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                              │
│         [▲] [▼]              │  <- Pagination
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

### Account/Auth Modal (New)
```
┌──────────────────────────────┐
│  [X]       ACCOUNT           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                              │
│         [🐦 Avatar]          │
│         GuestPlayer          │  <- Display name
│         🪙 247 points        │
│                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                              │
│   [ 🔵 Sign in with Google]  │
│                              │
│   ──────── OR ────────       │
│                              │
│   Email: [____________]      │
│   Pass:  [____________]      │
│                              │
│   [  LOG IN  ]  [SIGN UP]    │
│                              │
│   Forgot password?           │
│                              │
├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓ GROUND ▓▓▓▓▓▓▓▓▓│
└──────────────────────────────┘
```

---

## 7) Animations & Transitions

### Bird Animations
| Animation | Frames | Duration | Easing |
|-----------|--------|----------|--------|
| Idle hover | 3 | 450ms loop | Linear |
| Flying | 3 | 150ms loop | Linear |
| Death fall | 1 (wings up) | Until ground | Gravity (physics) |
| Death spin | Rotation only | 300ms | Ease-out |

### UI Animations
| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Score increment | Scale pop | 100ms | Ease-out |
| Game Over text | Drop in + bounce | 400ms | Bounce |
| Score panel | Slide up | 300ms | Ease-out |
| Medal award | Delay + pop + shine | 200ms + 300ms | Ease-out |
| "NEW" indicator | Pulse | 600ms loop | Sine |
| Button press | Scale down | 50ms | Linear |
| Button release | Scale up | 100ms | Ease-out |
| Modal open | Fade + scale | 200ms | Ease-out |
| Modal close | Fade + scale | 150ms | Ease-in |

### Screen Transitions
| Transition | Animation | Duration |
|------------|-----------|----------|
| Home → Get Ready | Fade | 200ms |
| Get Ready → Play | Instant (on tap) | 0ms |
| Play → Game Over | Flash white + fade | 100ms + 200ms |
| Any → Modal | Backdrop fade + panel scale | 200ms |

### Particle Effects (Optional)
- **Score point**: Small burst at pipe gap
- **Medal earned**: Sparkle particles
- **Purchase**: Coin burst animation
- **New best**: Firework particles

---

## 8) Sound Design Notes

While this is a visual style guide, audio should match the aesthetic:

| Event | Sound Style |
|-------|-------------|
| Flap/jump | Short "whoosh" or "wing" (8-bit style) |
| Score point | Quick "ding" or "blip" |
| Collision | Thud + sad tone |
| Game over | Descending notes |
| Button press | Click/pop |
| Medal earned | Fanfare (short) |
| Purchase | Coin/cash register |
| New best | Celebratory jingle |

---

## 9) Responsive Considerations

### Mobile (Primary)
- Portrait orientation only
- Touch targets: Minimum 44×44px
- Full viewport height game
- Bottom buttons above safe area (iOS notch)

### Desktop
- Centered game container
- Max width: 400px (maintain aspect ratio)
- Keyboard support (Space/Up to flap)
- Hover states on buttons

### Scaling
- Design at 1x (base resolution ~400×600)
- Assets provided at 1x, 2x, 3x
- Use CSS `image-rendering: pixelated` for crisp scaling
- Never scale to non-integer multiples

---

## 10) Asset Checklist

### Sprites Required
- [ ] Bird (yellow): 3 frames × 34×24px
- [ ] Bird (blue): 3 frames × 34×24px
- [ ] Bird (red): 3 frames × 34×24px
- [ ] Pipe body: 52×1px (tileable)
- [ ] Pipe cap (top): 52×26px
- [ ] Pipe cap (bottom): 52×26px (flipped)
- [ ] Ground: 336×112px (tileable)
- [ ] Background: 288×512px
- [ ] Clouds: 3 variants
- [ ] City silhouette: 288×100px

### UI Elements Required
- [ ] Logo "FlappyBird Plus"
- [ ] "Game Over" text
- [ ] "Get Ready" text
- [ ] Numbers 0-9 (large, white outline)
- [ ] Numbers 0-9 (medium, orange)
- [ ] Numbers 0-9 (small, for UI)
- [ ] Medals: Bronze, Silver, Gold, Platinum
- [ ] Medal empty placeholder
- [ ] "NEW" sparkle indicator
- [ ] Button: Play icon
- [ ] Button: Leaderboard icon
- [ ] Button: Shop/cart icon
- [ ] Button: Account/user icon
- [ ] Button: Close (X)
- [ ] Button: Settings/gear
- [ ] Tap instruction icon
- [ ] Panel frame (9-slice)
- [ ] Tab active/inactive states
- [ ] Coin/points icon
- [ ] Checkmark (owned)
- [ ] Lock icon (locked item)

### Additional for Shop (Cosmetics)
- [ ] Trail effects: 3-5 variants
- [ ] Background variants: 3-5 themes
- [ ] Preview frames for shop items

---

## 11) Implementation Notes

### CSS Properties for Pixel Art
```css
/* Prevent blurry scaling */
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* Disable smoothing on canvas */
canvas {
  image-rendering: pixelated;
}
```

### Canvas Context Settings
```javascript
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
```

### Font Rendering
```css
/* For pixel fonts */
.pixel-text {
  font-family: 'Press Start 2P', monospace;
  font-smooth: never;
  -webkit-font-smoothing: none;
}
```

### Color Variables (CSS Custom Properties)
```css
:root {
  /* Sky */
  --color-sky: #70C5CE;

  /* Ground */
  --color-grass: #80B038;
  --color-ground: #DED895;

  /* Pipes */
  --color-pipe: #73BF2E;
  --color-pipe-cap: #58A020;

  /* UI */
  --color-panel: #DEB858;
  --color-button: #F8F0D8;
  --color-border: #8B6914;

  /* Text */
  --color-text-white: #FFFFFF;
  --color-text-orange: #F87820;
  --color-text-outline: #543810;

  /* Accents */
  --color-play: #58A028;
  --color-new: #F85858;
  --color-coin: #FFD700;
}
```

---

## 12) Extending the Style (Our Additions)

When adding new UI for accounts, shop, and leaderboards, maintain consistency:

### New Buttons
Follow the same button style — tan panel, dark border, pixel font.

### New Panels
Use the same 9-slice panel frame, tan fill, dark border with highlight/shadow edges.

### New Icons
Design in the same pixel art style:
- 16×16px or 24×24px base size
- 3-4 colors maximum
- Clear silhouette at small sizes
- Dark outline for visibility

### Typography for New Screens
- Headers: Orange pixel font with outline
- Body text: Smaller white or dark brown pixel font
- Labels: Orange, all caps, no outline
- Values: White with subtle outline

### Consistency Checklist for New Features
- [ ] Uses defined color palette (no new colors without justification)
- [ ] Pixel-perfect alignment (no sub-pixel positioning)
- [ ] Consistent button sizes and styles
- [ ] Animations match existing timing/easing
- [ ] Maintains retro 8-bit aesthetic
- [ ] Touch targets meet 44×44px minimum
- [ ] Works at all scaling factors (1x, 2x, 3x)
