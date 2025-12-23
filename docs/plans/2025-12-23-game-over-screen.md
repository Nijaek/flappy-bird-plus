# Game Over Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a canvas-based Game Over screen that shows score, best score, leaderboard ranking with 5 nearby players, and play again/home buttons.

**Architecture:** Canvas-based component following existing patterns (HomeScreen.tsx). Slide-up animation over blurred game background. New API endpoint for fetching nearby leaderboard players.

**Tech Stack:** React 19, Next.js 16, Canvas 2D API, Redis sorted sets for leaderboard

---

## Task 1: Create Nearby Leaderboard API Endpoint

**Files:**
- Create: `src/app/api/leaderboard/nearby/route.ts`

**Step 1: Create the API route file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY } from '@/lib/redis';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const rankParam = searchParams.get('rank');

    // Get total players count
    const totalPlayers = await redis.zcard(LEADERBOARD_KEY);

    if (totalPlayers === 0) {
      return NextResponse.json({
        nearbyPlayers: [],
        totalPlayers: 0,
      });
    }

    // Get user's rank if not provided
    let userRank: number;
    if (rankParam) {
      userRank = parseInt(rankParam);
    } else {
      const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
      if (rank === null) {
        return NextResponse.json({
          nearbyPlayers: [],
          totalPlayers,
        });
      }
      userRank = rank + 1; // Convert 0-indexed to 1-indexed
    }

    // Calculate range for 5 players centered on user
    // If rank is 1-2, show 1-5
    // If rank is near bottom, show last 5
    // Otherwise, show 2 above and 2 below
    let startRank: number;
    let endRank: number;

    if (userRank <= 2) {
      startRank = 1;
      endRank = Math.min(5, totalPlayers);
    } else if (userRank >= totalPlayers - 1) {
      startRank = Math.max(1, totalPlayers - 4);
      endRank = totalPlayers;
    } else {
      startRank = userRank - 2;
      endRank = userRank + 2;
    }

    // Fetch from Redis (0-indexed)
    const data = await redis.zrevrange(
      LEADERBOARD_KEY,
      startRank - 1,
      endRank - 1,
      'WITHSCORES'
    );

    if (data.length === 0) {
      return NextResponse.json({
        nearbyPlayers: [],
        totalPlayers,
      });
    }

    // Parse user IDs and scores
    const entries: { oduserId: string; score: number }[] = [];
    for (let i = 0; i < data.length; i += 2) {
      entries.push({
        oduserId: data[i],
        score: parseInt(data[i + 1]),
      });
    }

    // Fetch display names
    const users = await prisma.user.findMany({
      where: { id: { in: entries.map(e => e.oduserId) } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    const nearbyPlayers = entries.map((entry, i) => ({
      rank: startRank + i,
      displayName: userMap.get(entry.oduserId) || 'Unknown',
      bestScore: entry.score,
      isPlayer: entry.oduserId === userId,
    }));

    return NextResponse.json({
      nearbyPlayers,
      totalPlayers,
    });
  } catch (error) {
    console.error('Nearby leaderboard fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch nearby players' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the endpoint builds**

Run: `npm run build`
Expected: Build succeeds with new route listed

**Step 3: Commit**

```bash
git add src/app/api/leaderboard/nearby/route.ts
git commit -m "feat: add nearby leaderboard API endpoint"
```

---

## Task 2: Create GameOverScreen Component - Basic Structure

**Files:**
- Create: `src/components/GameOverScreen.tsx`

**Step 1: Create component with props interface and basic canvas setup**

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { COLORS, GAME } from '@/game/constants';
import { drawButton } from '@/game/renderer';

// Click sound for buttons
const playClickSound = () => {
  const audio = new Audio('/sounds/click_001.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

interface NearbyPlayer {
  rank: number;
  displayName: string;
  bestScore: number;
  isPlayer: boolean;
}

interface GameOverScreenProps {
  score: number;
  bestScore: number;
  isNewBest: boolean;
  isAuthenticated: boolean;
  leaderboardData: {
    playerRank: number;
    totalPlayers: number;
    nearbyPlayers: NearbyPlayer[];
  } | null;
  onPlayAgain: () => void;
  onHome: () => void;
  onSignIn: () => void;
  gameFrameData: ImageData | null;
}

export default function GameOverScreen({
  score,
  bestScore,
  isNewBest,
  isAuthenticated,
  leaderboardData,
  onPlayAgain,
  onHome,
  onSignIn,
  gameFrameData,
}: GameOverScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blurredBgRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Animation state
  const [panelY, setPanelY] = useState<number | null>(null);
  const animationStartRef = useRef<number>(0);

  // Button states
  const [isPlayAgainPressed, setIsPlayAgainPressed] = useState(false);
  const [isHomePressed, setIsHomePressed] = useState(false);
  const [isSignInPressed, setIsSignInPressed] = useState(false);

  // Panel dimensions
  const PANEL_WIDTH = 260;
  const PANEL_HEIGHT = isAuthenticated ? 340 : 320;
  const ANIMATION_DURATION = 300;

  // Handle canvas resize
  useEffect(() => {
    const updateSize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate scale factor
  const getScaleFactor = useCallback(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return 1;
    const scaleX = canvasSize.width / GAME.WIDTH;
    const scaleY = canvasSize.height / GAME.HEIGHT;
    return Math.min(scaleX, scaleY);
  }, [canvasSize]);

  // Create blurred background on mount
  useEffect(() => {
    if (!gameFrameData || !blurredBgRef.current) return;

    const bgCanvas = blurredBgRef.current;
    bgCanvas.width = gameFrameData.width;
    bgCanvas.height = gameFrameData.height;

    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    // Draw the game frame
    bgCtx.putImageData(gameFrameData, 0, 0);

    // Apply blur filter
    bgCtx.filter = 'blur(8px)';
    bgCtx.drawImage(bgCanvas, 0, 0);
    bgCtx.filter = 'none';

    // Add dark overlay
    bgCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  }, [gameFrameData]);

  // Slide-up animation
  useEffect(() => {
    if (canvasSize.height === 0) return;

    const targetY = (canvasSize.height - PANEL_HEIGHT * getScaleFactor()) / 2;
    const startY = canvasSize.height;
    animationStartRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - animationStartRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      setPanelY(startY - (startY - targetY) * eased);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    // Small delay before animation starts
    const timeoutId = setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [canvasSize.height, PANEL_HEIGHT, getScaleFactor]);

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || panelY === null) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const scale = getScaleFactor();
    const scaledWidth = GAME.WIDTH * scale;
    const scaledHeight = GAME.HEIGHT * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw blurred background
    if (blurredBgRef.current) {
      ctx.drawImage(blurredBgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Fallback: solid dark background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Calculate panel position
    const panelX = (canvas.width - PANEL_WIDTH * scale) / 2;
    const currentPanelY = panelY;

    ctx.save();
    ctx.translate(panelX, currentPanelY);
    ctx.scale(scale, scale);

    // Draw panel background
    drawPanel(ctx, 0, 0, PANEL_WIDTH, PANEL_HEIGHT);

    // Draw content
    drawGameOverContent(
      ctx,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      score,
      bestScore,
      isNewBest,
      isAuthenticated,
      leaderboardData,
      isPlayAgainPressed,
      isHomePressed,
      isSignInPressed
    );

    ctx.restore();
  }, [
    panelY,
    canvasSize,
    score,
    bestScore,
    isNewBest,
    isAuthenticated,
    leaderboardData,
    isPlayAgainPressed,
    isHomePressed,
    isSignInPressed,
    getScaleFactor,
    PANEL_HEIGHT,
  ]);

  // Button bounds calculation
  const getButtonBounds = useCallback(() => {
    const scale = getScaleFactor();
    const panelX = (canvasSize.width - PANEL_WIDTH * scale) / 2;
    const currentPanelY = panelY ?? canvasSize.height;

    const buttonWidth = 100;
    const buttonHeight = 36;
    const buttonY = PANEL_HEIGHT - 50;
    const buttonSpacing = 20;

    const playAgainX = (PANEL_WIDTH - buttonWidth * 2 - buttonSpacing) / 2;
    const homeX = playAgainX + buttonWidth + buttonSpacing;

    return {
      playAgain: {
        x: panelX + playAgainX * scale,
        y: currentPanelY + buttonY * scale,
        width: buttonWidth * scale,
        height: buttonHeight * scale,
      },
      home: {
        x: panelX + homeX * scale,
        y: currentPanelY + buttonY * scale,
        width: buttonWidth * scale,
        height: buttonHeight * scale,
      },
      signIn: isAuthenticated ? null : {
        x: panelX + (PANEL_WIDTH / 2 - 50) * scale,
        y: currentPanelY + (PANEL_HEIGHT - 100) * scale,
        width: 100 * scale,
        height: 32 * scale,
      },
    };
  }, [canvasSize, panelY, getScaleFactor, PANEL_HEIGHT, isAuthenticated]);

  const isInBounds = (x: number, y: number, bounds: { x: number; y: number; width: number; height: number } | null) => {
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  };

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bounds = getButtonBounds();

    if (isInBounds(x, y, bounds.playAgain)) {
      setIsPlayAgainPressed(true);
      playClickSound();
    } else if (isInBounds(x, y, bounds.home)) {
      setIsHomePressed(true);
      playClickSound();
    } else if (isInBounds(x, y, bounds.signIn)) {
      setIsSignInPressed(true);
      playClickSound();
    }
  }, [getButtonBounds]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bounds = getButtonBounds();

    if (isPlayAgainPressed && isInBounds(x, y, bounds.playAgain)) {
      onPlayAgain();
    } else if (isHomePressed && isInBounds(x, y, bounds.home)) {
      onHome();
    } else if (isSignInPressed && isInBounds(x, y, bounds.signIn)) {
      onSignIn();
    }

    setIsPlayAgainPressed(false);
    setIsHomePressed(false);
    setIsSignInPressed(false);
  }, [isPlayAgainPressed, isHomePressed, isSignInPressed, getButtonBounds, onPlayAgain, onHome, onSignIn]);

  const handlePointerLeave = useCallback(() => {
    setIsPlayAgainPressed(false);
    setIsHomePressed(false);
    setIsSignInPressed(false);
  }, []);

  return (
    <>
      <canvas
        ref={blurredBgRef}
        style={{ display: 'none' }}
      />
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="fixed inset-0 cursor-pointer"
        style={{
          imageRendering: 'pixelated',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </>
  );
}

// Helper: Draw panel background
function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const radius = 8;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  drawRoundedRect(ctx, x + 4, y + 4, width, height, radius);

  // Panel background
  ctx.fillStyle = COLORS.panelTan;
  drawRoundedRect(ctx, x, y, width, height, radius);

  // Border
  ctx.strokeStyle = COLORS.panelDark;
  ctx.lineWidth = 3;
  drawRoundedRectStroke(ctx, x, y, width, height, radius);

  // Inner highlight
  ctx.strokeStyle = COLORS.panelLight;
  ctx.lineWidth = 2;
  drawRoundedRectStroke(ctx, x + 4, y + 4, width - 8, height - 8, radius - 2);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

function drawRoundedRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.stroke();
}

// Helper: Draw all game over content
function drawGameOverContent(
  ctx: CanvasRenderingContext2D,
  panelWidth: number,
  panelHeight: number,
  score: number,
  bestScore: number,
  isNewBest: boolean,
  isAuthenticated: boolean,
  leaderboardData: GameOverScreenProps['leaderboardData'],
  isPlayAgainPressed: boolean,
  isHomePressed: boolean,
  isSignInPressed: boolean
) {
  const centerX = panelWidth / 2;
  let currentY = 20;

  // "GAME OVER" title
  ctx.font = 'bold 18px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Outline
  ctx.fillStyle = COLORS.textOutline;
  for (const [ox, oy] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
    ctx.fillText('GAME OVER', centerX + ox, currentY + oy);
  }
  ctx.fillStyle = COLORS.textWhite;
  ctx.fillText('GAME OVER', centerX, currentY);

  currentY += 35;

  // Score section
  ctx.font = 'bold 10px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS.textOutline;
  ctx.fillText('SCORE', centerX, currentY);
  currentY += 16;

  ctx.font = 'bold 24px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS.textOutline;
  for (const [ox, oy] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
    ctx.fillText(String(score), centerX + ox, currentY + oy);
  }
  ctx.fillStyle = COLORS.textWhite;
  ctx.fillText(String(score), centerX, currentY);
  currentY += 30;

  // NEW BEST indicator
  if (isNewBest) {
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.fillStyle = COLORS.textOutline;
    for (const [ox, oy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      ctx.fillText('NEW BEST!', centerX + ox, currentY + oy);
    }
    ctx.fillStyle = COLORS.medalGold;
    ctx.fillText('NEW BEST!', centerX, currentY);
    currentY += 18;
  }

  // Best score
  ctx.font = 'bold 10px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS.textOutline;
  const bestLabel = isAuthenticated ? 'YOUR BEST' : 'SESSION BEST';
  ctx.fillText(bestLabel, centerX, currentY);
  currentY += 14;

  ctx.font = 'bold 16px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS.textOutline;
  for (const [ox, oy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    ctx.fillText(String(bestScore), centerX + ox, currentY + oy);
  }
  ctx.fillStyle = COLORS.textWhite;
  ctx.fillText(String(bestScore), centerX, currentY);
  currentY += 28;

  // Leaderboard section (authenticated) or sign-in prompt (guest)
  if (isAuthenticated && leaderboardData) {
    drawLeaderboardSection(ctx, centerX, currentY, leaderboardData);
  } else if (!isAuthenticated) {
    drawSignInPrompt(ctx, centerX, currentY, panelWidth, isSignInPressed);
  }

  // Bottom buttons
  const buttonY = panelHeight - 50;
  const buttonWidth = 100;
  const buttonHeight = 36;
  const buttonSpacing = 20;
  const playAgainX = (panelWidth - buttonWidth * 2 - buttonSpacing) / 2;
  const homeX = playAgainX + buttonWidth + buttonSpacing;

  drawButton(ctx, playAgainX, buttonY, buttonWidth, buttonHeight, isPlayAgainPressed);
  drawButton(ctx, homeX, buttonY, buttonWidth, buttonHeight, isHomePressed);

  // Button labels
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const playLabelY = buttonY + buttonHeight / 2 + (isPlayAgainPressed ? 2 : 0);
  ctx.fillStyle = COLORS.textOutline;
  ctx.fillText('RETRY', playAgainX + buttonWidth / 2, playLabelY);

  const homeLabelY = buttonY + buttonHeight / 2 + (isHomePressed ? 2 : 0);
  ctx.fillStyle = COLORS.textOutline;
  ctx.fillText('HOME', homeX + buttonWidth / 2, homeLabelY);
}

function drawLeaderboardSection(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  startY: number,
  data: NonNullable<GameOverScreenProps['leaderboardData']>
) {
  const rowHeight = 18;
  const startX = 20;
  const rowWidth = 220;

  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  data.nearbyPlayers.forEach((player, i) => {
    const y = startY + i * rowHeight;

    // Highlight current player's row
    if (player.isPlayer) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.fillRect(startX - 5, y - 2, rowWidth, rowHeight);
    }

    // Rank
    ctx.fillStyle = player.isPlayer ? COLORS.medalGold : COLORS.textOutline;
    ctx.textAlign = 'left';
    ctx.fillText(`#${player.rank}`, startX, y);

    // Name (truncate if needed)
    const displayName = player.displayName.length > 10
      ? player.displayName.slice(0, 8) + '..'
      : player.displayName;
    ctx.fillText(displayName, startX + 40, y);

    // Score
    ctx.textAlign = 'right';
    ctx.fillText(String(player.bestScore), startX + rowWidth - 10, y);
  });

  // Total players info
  const infoY = startY + data.nearbyPlayers.length * rowHeight + 5;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textOutline;
  ctx.font = 'bold 7px "Press Start 2P", monospace';
  ctx.fillText(`${data.totalPlayers} players`, centerX, infoY);
}

function drawSignInPrompt(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  startY: number,
  panelWidth: number,
  isSignInPressed: boolean
) {
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.textOutline;

  ctx.fillText('Sign in to save', centerX, startY);
  ctx.fillText('your score and', centerX, startY + 14);
  ctx.fillText('compete on the', centerX, startY + 28);
  ctx.fillText('leaderboard!', centerX, startY + 42);

  // Sign in button
  const buttonWidth = 100;
  const buttonHeight = 32;
  const buttonX = (panelWidth - buttonWidth) / 2;
  const buttonY = startY + 60;

  drawButton(ctx, buttonX, buttonY, buttonWidth, buttonHeight, isSignInPressed);

  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS.textOutline;
  ctx.fillText('SIGN IN', centerX, buttonY + buttonHeight / 2 - 4 + (isSignInPressed ? 2 : 0));
}
```

**Step 2: Verify the component builds**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/GameOverScreen.tsx
git commit -m "feat: add GameOverScreen component with canvas rendering"
```

---

## Task 3: Wire Up GameOverScreen to page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add imports and new state**

In `src/app/page.tsx`, add import at top:

```typescript
import GameOverScreen from '@/components/GameOverScreen';
```

Add new state after existing state declarations (around line 23):

```typescript
const [gameFrameData, setGameFrameData] = useState<ImageData | null>(null);
const [nearbyLeaderboard, setNearbyLeaderboard] = useState<{
  playerRank: number;
  totalPlayers: number;
  nearbyPlayers: Array<{
    rank: number;
    displayName: string;
    bestScore: number;
    isPlayer: boolean;
  }>;
} | null>(null);
```

**Step 2: Update handleGameOver to fetch nearby players**

Replace the existing `handleGameOver` function (around line 89-113):

```typescript
const handleGameOver = useCallback(async (score: number, durationMs: number, frameData?: ImageData) => {
  setLastScore(score);
  setLastSubmitResult(null);
  setNearbyLeaderboard(null);

  if (frameData) {
    setGameFrameData(frameData);
  }

  if (!isAuthenticated) {
    setSessionBest(prev => Math.max(prev, score));
  }

  let userRank: number | null = null;

  if (isAuthenticated) {
    const result = await submitScore(score, durationMs);
    if (result) {
      setUserBest(result.you.bestScore);
      userRank = result.you.rank;
      setLastSubmitResult({
        isNewBest: result.you.isNewBest,
        rank: result.you.rank,
      });

      // Fetch nearby leaderboard
      if (userRank !== null) {
        try {
          const response = await fetch(`/api/leaderboard/nearby?rank=${userRank}`);
          if (response.ok) {
            const data = await response.json();
            setNearbyLeaderboard({
              playerRank: userRank,
              totalPlayers: data.totalPlayers,
              nearbyPlayers: data.nearbyPlayers,
            });
          }
        } catch (err) {
          console.error('Failed to fetch nearby leaderboard:', err);
        }
      }
    }
  }

  setGameState('gameOver');
}, [isAuthenticated, submitScore]);
```

**Step 3: Add handlers for GameOverScreen buttons**

Add these handlers after `handleGameOver`:

```typescript
const handlePlayAgain = useCallback(async () => {
  setGameFrameData(null);
  setNearbyLeaderboard(null);
  resetSession();
  setGameState('getReady');
  await startGame();
}, [resetSession, startGame]);

const handleGoHome = useCallback(() => {
  setGameFrameData(null);
  setNearbyLeaderboard(null);
  resetSession();
  setGameState('home');
}, [resetSession]);

const handleSignInFromGameOver = useCallback(() => {
  setGameFrameData(null);
  setNearbyLeaderboard(null);
  resetSession();
  setShowAuthModal(true);
  setGameState('home');
}, [resetSession]);
```

**Step 4: Update the render section to show GameOverScreen**

Replace the return statement's game state rendering (around line 138-151):

```typescript
return (
  <>
    {gameState === 'home' && (
      <HomeScreen
        onStart={handleGoToGetReady}
        isAuthenticated={isAuthenticated}
        userDisplayName={session?.user?.name || null}
        bestScore={bestScore}
      />
    )}
    {gameState === 'getReady' && <GetReadyScreen onStart={handleStartPlaying} />}
    {gameState === 'playing' && <PlayingScreen onGameOver={handleGameOver} />}
    {gameState === 'gameOver' && (
      <GameOverScreen
        score={lastScore}
        bestScore={bestScore}
        isNewBest={lastSubmitResult?.isNewBest ?? false}
        isAuthenticated={isAuthenticated}
        leaderboardData={nearbyLeaderboard}
        onPlayAgain={handlePlayAgain}
        onHome={handleGoHome}
        onSignIn={handleSignInFromGameOver}
        gameFrameData={gameFrameData}
      />
    )}
  </>
);
```

**Step 5: Verify the changes build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up GameOverScreen to page state machine"
```

---

## Task 4: Update PlayingScreen to Capture Frame on Death

**Files:**
- Modify: `src/components/PlayingScreen.tsx`

**Step 1: Update onGameOver callback type**

Find the `PlayingScreenProps` interface (around line 14) and update it:

```typescript
interface PlayingScreenProps {
  onGameOver: (score: number, durationMs: number, frameData?: ImageData) => void;
}
```

**Step 2: Capture canvas frame before calling onGameOver**

Find the collision detection code where `onGameOver` is called. There are two places:

1. Ground collision (around line 248-255)
2. Pipe collision (around line 295-300)

For ground collision, update to:

```typescript
if (birdYRef.current > groundY - GAME.BIRD_HEIGHT / 2) {
  playHitSound();

  // Capture frame before game over
  const canvas = canvasRef.current;
  let frameData: ImageData | undefined;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }

  onGameOver(scoreRef.current, Date.now() - startTimeRef.current, frameData);
  return;
}
```

For pipe collision, update similarly:

```typescript
if (collision) {
  playHitSound();

  // Capture frame before game over
  const canvas = canvasRef.current;
  let frameData: ImageData | undefined;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }

  onGameOver(scoreRef.current, Date.now() - startTimeRef.current, frameData);
  return;
}
```

**Step 3: Verify the changes build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/PlayingScreen.tsx
git commit -m "feat: capture canvas frame on game over for blur background"
```

---

## Task 5: Test the Complete Flow

**Step 1: Start development server**

Run: `npm run dev`
Expected: Server starts without errors

**Step 2: Manual testing checklist**

Test these scenarios:
- [ ] Play as guest, die, see Game Over screen with session best and sign-in prompt
- [ ] Sign in, play, die, see Game Over screen with leaderboard
- [ ] Verify "NEW BEST!" appears when beating personal best
- [ ] Verify "RETRY" button restarts game
- [ ] Verify "HOME" button returns to home screen
- [ ] Verify background shows blurred game frame
- [ ] Verify panel slides up smoothly

**Step 3: Fix any issues found**

If issues are found, fix them and commit with descriptive message.

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify game over screen complete flow"
```

---

## Task 6: Clean Up and Final Review

**Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds with no warnings

**Step 2: Remove any TODO comments added during development**

Search for TODO in new/modified files and address or remove.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: clean up game over screen implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create nearby leaderboard API | `src/app/api/leaderboard/nearby/route.ts` |
| 2 | Create GameOverScreen component | `src/components/GameOverScreen.tsx` |
| 3 | Wire up to page.tsx | `src/app/page.tsx` |
| 4 | Capture frame on death | `src/components/PlayingScreen.tsx` |
| 5 | Test complete flow | Manual testing |
| 6 | Clean up | Final review |
