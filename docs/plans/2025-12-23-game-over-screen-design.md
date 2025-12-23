# Game Over Screen Design

## Overview

A canvas-based Game Over screen that appears immediately after the player dies, showing their score, best score, leaderboard ranking with nearby players, and options to play again or return home.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering approach | Canvas-based | Matches existing pixel art style |
| Score ranking display | 5 nearby players | Provides competitive context |
| Guest experience | Sign-in prompt | Encourages conversion without blocking gameplay |
| Transition animation | Immediate slide-up | Fast retry for engaged players |
| Panel layout | Stacked vertical | Clean, easy to scan |
| Background treatment | Blur effect | Modern touch while maintaining focus |
| New best indicator | Highlighted text | Simple "NEW BEST!" in gold |
| Sound effects | Minimal (reuse existing) | Consistent with game audio |

## Component Structure

### Props

```typescript
interface GameOverScreenProps {
  canvasWidth: number;
  canvasHeight: number;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  isAuthenticated: boolean;
  leaderboardData: {
    playerRank: number;
    totalPlayers: number;
    nearbyPlayers: Array<{
      rank: number;
      displayName: string;
      score: number;
      isPlayer: boolean;
    }>;
  } | null;  // null for guests
  onPlayAgain: () => void;
  onHome: () => void;
  onSignIn: () => void;
  gameFrameImage: ImageData;  // captured frame for blur background
}
```

## Visual Layout

### Authenticated User

```
┌─────────────────────────────┐
│        "GAME OVER"          │  ← Large pixel font, centered
│                             │
│          SCORE              │  ← Label in muted color
│           42                │  ← Large score number
│      ★ NEW BEST! ★          │  ← Gold text (if applicable)
│                             │
│         YOUR BEST           │  ← Label
│           38                │  ← Best score number
│                             │
├─────────────────────────────┤
│  #23  PlayerOne      156    │  ← Nearby players
│  #24  SomeGuy        148    │
│ ▶#25  YOU            142◀   │  ← Highlighted row (your rank)
│  #26  BirdFan        139    │
│  #27  FlappyKing     137    │
├─────────────────────────────┤
│                             │
│  [PLAY AGAIN]    [HOME]     │  ← Two buttons side-by-side
│                             │
└─────────────────────────────┘
```

### Guest User

```
┌─────────────────────────────┐
│        "GAME OVER"          │
│                             │
│          SCORE              │
│           42                │
│                             │
│       SESSION BEST          │  ← "Session" clarifies it's temporary
│           38                │
│                             │
├─────────────────────────────┤
│                             │
│   Sign in to save your      │  ← Explanatory text
│   score and compete on      │
│   the leaderboard!          │
│                             │
│       [SIGN IN]             │  ← Single centered button
│                             │
├─────────────────────────────┤
│                             │
│  [PLAY AGAIN]    [HOME]     │
│                             │
└─────────────────────────────┘
```

## Animation & Background

### Background Blur Effect

1. When death occurs, `PlayingScreen` captures the current canvas frame as `ImageData`
2. Pass this frame to `GameOverScreen` via props
3. Apply `ctx.filter = 'blur(8px)'` when drawing the background
4. Draw semi-transparent dark overlay (`rgba(0, 0, 0, 0.4)`) to further dim

### Slide-Up Animation

```typescript
// Animation state
const [panelY, setPanelY] = useState(canvasHeight); // Start below screen
const targetY = (canvasHeight - PANEL_HEIGHT) / 2;  // Centered

// On mount, animate over 300ms with easeOutCubic
useEffect(() => {
  const startTime = performance.now();
  const duration = 300;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic

    setPanelY(canvasHeight - (canvasHeight - targetY) * eased);

    if (progress < 1) requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}, []);
```

### Timing

- Bird falls and hits ground → existing hit sound plays
- ~100ms pause to let the impact register
- Panel begins sliding up (300ms animation)
- Total time from death to interactive: ~400ms

## Data Flow & API

### Existing Endpoint

`POST /api/runs/submit` already returns:
```typescript
{ isNewBest: boolean, rank: number, top10: [...] }
```

### New Endpoint Required

`GET /api/leaderboard/nearby?rank=25`

Returns 5 players centered on the given rank:
```typescript
{
  nearbyPlayers: [
    { rank: 23, displayName: "PlayerOne", bestScore: 156 },
    { rank: 24, displayName: "SomeGuy", bestScore: 148 },
    { rank: 25, displayName: "YOU", bestScore: 142, isPlayer: true },
    { rank: 26, displayName: "BirdFan", bestScore: 139 },
    { rank: 27, displayName: "FlappyKing", bestScore: 137 }
  ],
  totalPlayers: 1250
}
```

### Edge Cases

- Rank #1-2: Show ranks 1-5, highlight player's position
- Bottom ranks: Show last 5, highlight player's position
- Only 3 players total: Show all 3

### Flow in page.tsx

1. `handleGameOver(score, duration)` called
2. If authenticated: `submitScore()` → get `{ rank, isNewBest }`
3. Fetch nearby players: `GET /api/leaderboard/nearby?rank=${rank}`
4. Set `gameState = 'gameOver'` with all data ready
5. Render `GameOverScreen` with complete props

## Button Interactions

Following `HomeScreen.tsx` pattern:

```typescript
// Track button states
const [isPlayAgainPressed, setIsPlayAgainPressed] = useState(false);
const [isHomePressed, setIsHomePressed] = useState(false);
const [isSignInPressed, setIsSignInPressed] = useState(false);

// Button bounds calculated based on panel position
const playAgainBounds = { x: panelX + 20, y: panelY + 280, width: 110, height: 40 };
const homeBounds = { x: panelX + 150, y: panelY + 280, width: 110, height: 40 };
```

### Visual Feedback

- Default: Button at normal scale
- Pressed: Button scales down slightly (0.95x) like existing buttons
- Pixel-art style borders matching `HomeScreen.tsx`

### Sound

Reuse existing button click sound from game assets on successful button press.

## Files to Create/Modify

### Create

- `src/components/GameOverScreen.tsx` - Main component
- `src/app/api/leaderboard/nearby/route.ts` - New endpoint

### Modify

- `src/app/page.tsx` - Wire up new screen, remove 2-second timeout hack

## Implementation Order

1. Create the new API endpoint (`/api/leaderboard/nearby`)
2. Build `GameOverScreen.tsx` with static layout first
3. Add slide-up animation
4. Add blur background effect
5. Wire up to `page.tsx` with real data
6. Add button interactions and sound
7. Handle guest experience variant
8. Test edge cases (rank #1, new player, guest mode)

## Dependencies

None - uses existing auth, leaderboard infrastructure, and sound assets.
