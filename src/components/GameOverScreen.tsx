'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { COLORS, GAME } from '@/game/constants';
import { drawButton, drawPlayIcon } from '@/game/renderer';

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
  const PANEL_HEIGHT = isAuthenticated ? 300 : 280;
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

    // Start animation immediately
    animationRef.current = requestAnimationFrame(animate);

    return () => {
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

  // Keyboard handler for spacebar to retry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        playClickSound();
        onPlayAgain();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayAgain]);

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

  // NEW BEST indicator (only shown when it's a new best)
  if (isNewBest) {
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.fillStyle = COLORS.textOutline;
    for (const [ox, oy] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
      ctx.fillText('NEW HIGH SCORE!', centerX + ox, currentY + oy);
    }
    ctx.fillStyle = COLORS.medalGold;
    ctx.fillText('NEW HIGH SCORE!', centerX, currentY);
    currentY += 24;
  } else {
    currentY += 10; // Add some spacing when no new best
  }

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

  // Button icons
  const playIconX = playAgainX + buttonWidth / 2;
  const playIconY = buttonY + buttonHeight / 2 + (isPlayAgainPressed ? 2 : 0);
  drawPlayIcon(ctx, playIconX, playIconY, 20);

  const homeIconX = homeX + buttonWidth / 2;
  const homeIconY = buttonY + buttonHeight / 2 + (isHomePressed ? 2 : 0);
  drawHomeIcon(ctx, homeIconX, homeIconY, 18);
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

// Helper: Draw home icon (house shape)
function drawHomeIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = 18
) {
  const halfSize = size / 2;

  // Roof (triangle)
  ctx.fillStyle = COLORS.textOutline;
  ctx.beginPath();
  ctx.moveTo(x, y - halfSize); // Top point
  ctx.lineTo(x - halfSize - 2, y - 2); // Left eave
  ctx.lineTo(x + halfSize + 2, y - 2); // Right eave
  ctx.closePath();
  ctx.fill();

  // House body (rectangle)
  const bodyWidth = size * 0.7;
  const bodyHeight = size * 0.5;
  ctx.fillRect(x - bodyWidth / 2, y - 2, bodyWidth, bodyHeight);

  // Door (small rectangle in center)
  ctx.fillStyle = COLORS.panelTan;
  const doorWidth = bodyWidth * 0.35;
  const doorHeight = bodyHeight * 0.7;
  ctx.fillRect(x - doorWidth / 2, y - 2 + bodyHeight - doorHeight, doorWidth, doorHeight);
}
