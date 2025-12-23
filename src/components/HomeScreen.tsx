'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { COLORS, GAME, ANIMATION } from '@/game/constants';
import {
  drawSky,
  drawCloud,
  drawCitySilhouetteExtended,
  drawBushes,
  drawGround,
  drawBird,
  drawTitle,
  drawButton,
  drawPlayIcon,
} from '@/game/renderer';

// Click sound for buttons
const playClickSound = () => {
  const audio = new Audio('/sounds/click_001.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {
    // Ignore errors (e.g., if user hasn't interacted with page yet)
  });
};

interface HomeScreenProps {
  onStart: () => void;
  isAuthenticated: boolean;
  userDisplayName: string | null;
  bestScore: number;
  onAccountClick?: () => void;
}

export default function HomeScreen({ onStart, isAuthenticated, userDisplayName, bestScore, onAccountClick }: HomeScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [isPlayPressed, setIsPlayPressed] = useState(false);
  const [isScorePressed, setIsScorePressed] = useState(false);
  const [isShopPressed, setIsShopPressed] = useState(false);
  const [isAccountPressed, setIsAccountPressed] = useState(false);
  const [isSettingsPressed, setIsSettingsPressed] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Bird animation frame
  const birdFrameRef = useRef(0);
  const lastBirdFrameTime = useRef(0);

  // Parallax scroll offsets (different speeds for depth)
  const scrollOffsetRef = useRef(0);

  // Calculate scale factor to fit game on screen (contain mode)
  const getScaleFactor = useCallback(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return 1;
    const scaleX = canvasSize.width / GAME.WIDTH;
    const scaleY = canvasSize.height / GAME.HEIGHT;
    // Use min to ensure entire game is visible (contain mode)
    return Math.min(scaleX, scaleY);
  }, [canvasSize]);

  // Calculate button bounds for click detection
  const getButtonBounds = useCallback(() => {
    const scale = getScaleFactor();
    const buttonWidth = 104;
    const buttonHeight = 58;
    const buttonSpacing = 20;

    // Small buttons config
    const smallButtonSpacing = 10;
    const totalWidth = buttonWidth * 2 + buttonSpacing; // 228
    const smallButtonWidth = (totalWidth - smallButtonSpacing * 2) / 3; // ~69
    const smallButtonHeight = 40;

    // Calculate the visible game area offset
    const scaledWidth = GAME.WIDTH * scale;
    const scaledHeight = GAME.HEIGHT * scale;
    const offsetX = (canvasSize.width - scaledWidth) / 2;
    const offsetY = (canvasSize.height - scaledHeight) / 2;

    // Play button position in game coordinates (matches render logic)
    const playButtonX = (GAME.WIDTH - buttonWidth * 2 - buttonSpacing) / 2;
    const buttonsY = GAME.HEIGHT - GAME.GROUND_HEIGHT - 80;
    const scoreButtonX = playButtonX + buttonWidth + buttonSpacing;
    const smallButtonsY = buttonsY + buttonHeight + 12;

    return {
      play: {
        x: offsetX + playButtonX * scale,
        y: offsetY + buttonsY * scale,
        width: buttonWidth * scale,
        height: buttonHeight * scale,
      },
      score: {
        x: offsetX + scoreButtonX * scale,
        y: offsetY + buttonsY * scale,
        width: buttonWidth * scale,
        height: buttonHeight * scale,
      },
      shop: {
        x: offsetX + playButtonX * scale,
        y: offsetY + smallButtonsY * scale,
        width: smallButtonWidth * scale,
        height: smallButtonHeight * scale,
      },
      account: {
        x: offsetX + (playButtonX + smallButtonWidth + smallButtonSpacing) * scale,
        y: offsetY + smallButtonsY * scale,
        width: smallButtonWidth * scale,
        height: smallButtonHeight * scale,
      },
      settings: {
        x: offsetX + (playButtonX + (smallButtonWidth + smallButtonSpacing) * 2) * scale,
        y: offsetY + smallButtonsY * scale,
        width: smallButtonWidth * scale,
        height: smallButtonHeight * scale,
      },
    };
  }, [canvasSize, getScaleFactor]);

  // Handle canvas resize to fill entire screen
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

  // Main render loop
  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize start time
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;

    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;

    // Calculate scale to fit game on screen (contain mode)
    const scale = getScaleFactor();

    // Center the game view
    const scaledWidth = GAME.WIDTH * scale;
    const scaledHeight = GAME.HEIGHT * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Update scroll offset
    scrollOffsetRef.current += 1;
    const groundOffset = scrollOffsetRef.current;
    const bushOffset = groundOffset; // Same speed as ground
    const cityOffset = groundOffset * 0.2;
    const cloudOffset = groundOffset * 0.1;

    // Calculate extended width needed to fill entire canvas
    const extraWidth = offsetX > 0 ? (offsetX / scale) + 50 : 50;
    const totalWidth = GAME.WIDTH + extraWidth * 2;
    const groundY = GAME.HEIGHT - GAME.GROUND_HEIGHT;

    // Fill entire canvas with sky color first
    ctx.fillStyle = '#70C5CE';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set up coordinate system for game area (shifted left to allow extension)
    ctx.save();
    ctx.translate(offsetX - extraWidth * scale, offsetY);
    ctx.scale(scale, scale);

    // =======================================================================
    // DRAW BACKGROUND (back to front with parallax) - EXTENDED WIDTH
    // =======================================================================

    // Sky - fill extended area
    drawSky(ctx, totalWidth, GAME.HEIGHT);

    // 1. CLOUDS (furthest back, slowest parallax) - spread across extended width
    // Position clouds so tops are visible above buildings, bottoms extend to ground
    const cloudY = groundY - 30;
    const cloudSpacing = 100;
    const cloudPatternWidth = cloudSpacing * 20;
    const wrappedCloudOffset = cloudOffset % cloudPatternWidth;
    const numClouds = Math.ceil((totalWidth + cloudPatternWidth) / cloudSpacing) + 6;

    for (let i = -6; i < numClouds; i++) {
      const baseX = i * cloudSpacing - wrappedCloudOffset;
      const yVariation = (i % 3 - 1) * 8;
      const scaleVariation = 2.0 + (i % 4) * 0.18; // Larger clouds (~20% taller)
      drawCloud(ctx, baseX, cloudY + yVariation, scaleVariation);
    }

    // 2. CITY SILHOUETTE (behind bushes, slow parallax) - taller buildings for landscape
    const isLandscape = canvas.width > canvas.height;
    drawCitySilhouetteExtended(ctx, totalWidth, groundY, cityOffset, isLandscape);

    // 3. BUSHES (medium parallax) - extended width
    drawBushes(ctx, totalWidth, groundY, bushOffset);

    // 4. GROUND (fastest, foreground) - extended width
    drawGround(ctx, totalWidth, GAME.HEIGHT, groundOffset);

    ctx.restore();

    // Now draw game elements in normal coordinate system
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // =======================================================================
    // DRAW TITLE (bouncing)
    // =======================================================================

    const titleY = 90 + Math.sin(elapsed * ANIMATION.TITLE_BOUNCE_SPEED) * ANIMATION.TITLE_BOUNCE_AMPLITUDE;
    drawTitle(ctx, GAME.WIDTH / 2, titleY, 0.75);

    // =======================================================================
    // DRAW BIRD (hovering and animating)
    // =======================================================================

    // Update bird animation frame
    if (timestamp - lastBirdFrameTime.current > GAME.BIRD_ANIMATION_SPEED) {
      birdFrameRef.current = (birdFrameRef.current + 1) % 3;
      lastBirdFrameTime.current = timestamp;
    }

    // Bird position with hover animation
    const birdY = 210 + Math.sin(elapsed * ANIMATION.BIRD_HOVER_SPEED) * ANIMATION.BIRD_HOVER_AMPLITUDE;

    // Slight rotation based on hover position
    const birdRotation = Math.sin(elapsed * ANIMATION.BIRD_HOVER_SPEED) * 0.15;

    drawBird(ctx, GAME.WIDTH / 2, birdY, birdFrameRef.current, birdRotation, 1.2);

    // =======================================================================
    // DRAW BUTTONS (Play and Leaderboard like in reference)
    // =======================================================================

    const buttonWidth = 104;
    const buttonHeight = 58;
    const buttonSpacing = 20;
    const buttonsY = GAME.HEIGHT - GAME.GROUND_HEIGHT - 80;

    // =======================================================================
    // DRAW USER INFO & BEST SCORE (top right with floating animation)
    // =======================================================================
    const scoreFloat = Math.sin(elapsed * 0.003) * 3;
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const scoreX = GAME.WIDTH - 10;
    let currentY = 14 + scoreFloat;

    // Show username if logged in
    if (isAuthenticated && userDisplayName) {
      const displayName = userDisplayName.length > 12
        ? userDisplayName.slice(0, 10) + '..'
        : userDisplayName;

      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.fillStyle = COLORS.textOutline;
      for (const [ox, oy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        ctx.fillText(displayName, scoreX + ox, currentY + oy);
      }
      ctx.fillStyle = '#90EE90'; // Light green for logged in
      ctx.fillText(displayName, scoreX, currentY);
      currentY += 16;
    }

    // Best score
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    const scoreText = `Best: ${bestScore}`;

    ctx.fillStyle = COLORS.textOutline;
    for (const [ox, oy] of [[-2, -2], [-2, 2], [2, -2], [2, 2], [-2, 0], [2, 0], [0, -2], [0, 2]]) {
      ctx.fillText(scoreText, scoreX + ox, currentY + oy);
    }
    ctx.fillStyle = COLORS.textWhite;
    ctx.fillText(scoreText, scoreX, currentY);

    // Show hint for guests
    if (!isAuthenticated) {
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      const hintText = 'Sign in to save';
      ctx.fillStyle = COLORS.textOutline;
      for (const [ox, oy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        ctx.fillText(hintText, scoreX + ox, currentY + 22 + oy);
      }
      ctx.fillStyle = '#FFD700'; // Gold hint
      ctx.fillText(hintText, scoreX, currentY + 22);
    }

    // =======================================================================
    // DRAW BUTTONS
    // =======================================================================

    // Play button (left)
    const playButtonX = (GAME.WIDTH - buttonWidth * 2 - buttonSpacing) / 2;
    drawButton(ctx, playButtonX, buttonsY, buttonWidth, buttonHeight, isPlayPressed);

    // Play icon
    const playIconX = playButtonX + buttonWidth / 2;
    const playIconY = buttonsY + buttonHeight / 2 + (isPlayPressed ? 2 : 0);
    drawPlayIcon(ctx, playIconX, playIconY, 26);

    // Leaderboard button (right)
    const leaderboardButtonX = playButtonX + buttonWidth + buttonSpacing;
    drawButton(ctx, leaderboardButtonX, buttonsY, buttonWidth, buttonHeight, isScorePressed);

    // Draw leaderboard icon (podium)
    const scoreIconY = buttonsY + buttonHeight / 2 + (isScorePressed ? 2 : 0);
    drawLeaderboardIcon(ctx, leaderboardButtonX + buttonWidth / 2, scoreIconY);

    // =======================================================================
    // DRAW SMALL BUTTONS (Shop, Account, Settings)
    // =======================================================================
    const smallButtonSpacing = 10;
    const totalButtonWidth = buttonWidth * 2 + buttonSpacing;
    const smallButtonWidth = (totalButtonWidth - smallButtonSpacing * 2) / 3;
    const smallButtonHeight = 40;
    const smallButtonsY = buttonsY + buttonHeight + 12;

    // Shop button
    const shopButtonX = playButtonX;
    drawButton(ctx, shopButtonX, smallButtonsY, smallButtonWidth, smallButtonHeight, isShopPressed);
    drawShopIcon(ctx, shopButtonX + smallButtonWidth / 2, smallButtonsY + smallButtonHeight / 2 + (isShopPressed ? 2 : 0));

    // Account button
    const accountButtonX = playButtonX + smallButtonWidth + smallButtonSpacing;
    drawButton(ctx, accountButtonX, smallButtonsY, smallButtonWidth, smallButtonHeight, isAccountPressed);
    drawAccountIcon(ctx, accountButtonX + smallButtonWidth / 2, smallButtonsY + smallButtonHeight / 2 + (isAccountPressed ? 2 : 0));

    // Settings button
    const settingsButtonX = playButtonX + (smallButtonWidth + smallButtonSpacing) * 2;
    drawButton(ctx, settingsButtonX, smallButtonsY, smallButtonWidth, smallButtonHeight, isSettingsPressed);
    drawSettingsIcon(ctx, settingsButtonX + smallButtonWidth / 2, smallButtonsY + smallButtonHeight / 2 + (isSettingsPressed ? 2 : 0));

    ctx.restore();

    // Continue animation loop
    animationRef.current = requestAnimationFrame(render);
  }, [isPlayPressed, isScorePressed, isShopPressed, isAccountPressed, isSettingsPressed, bestScore, isAuthenticated, userDisplayName, getScaleFactor]);

  // Start animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Handle keyboard input (spacebar to start)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        playClickSound();
        onStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  // Helper to check if point is within bounds
  const isInBounds = (x: number, y: number, bounds: { x: number; y: number; width: number; height: number }) => {
    return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  };

  // Handle mouse/touch events
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bounds = getButtonBounds();

    if (isInBounds(x, y, bounds.play)) {
      setIsPlayPressed(true);
      playClickSound();
    } else if (isInBounds(x, y, bounds.score)) {
      setIsScorePressed(true);
      playClickSound();
    } else if (isInBounds(x, y, bounds.shop)) {
      setIsShopPressed(true);
      playClickSound();
    } else if (isInBounds(x, y, bounds.account)) {
      setIsAccountPressed(true);
      playClickSound();
    } else if (isInBounds(x, y, bounds.settings)) {
      setIsSettingsPressed(true);
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

    // Check if release is within play button bounds
    if (isPlayPressed && isInBounds(x, y, bounds.play)) {
      onStart();
    }

    // Check if release is within score button bounds
    if (isScorePressed && isInBounds(x, y, bounds.score)) {
      // TODO: Show leaderboard
    }

    // Check if release is within shop button bounds
    if (isShopPressed && isInBounds(x, y, bounds.shop)) {
      // TODO: Show shop
    }

    // Check if release is within account button bounds
    if (isAccountPressed && isInBounds(x, y, bounds.account)) {
      if (isAuthenticated) {
        signOut();
      } else if (onAccountClick) {
        onAccountClick();
      }
    }

    // Check if release is within settings button bounds
    if (isSettingsPressed && isInBounds(x, y, bounds.settings)) {
      // TODO: Show settings
    }

    setIsPlayPressed(false);
    setIsScorePressed(false);
    setIsShopPressed(false);
    setIsAccountPressed(false);
    setIsSettingsPressed(false);
  }, [isPlayPressed, isScorePressed, isShopPressed, isAccountPressed, isSettingsPressed, getButtonBounds, onStart]);

  const handlePointerLeave = useCallback(() => {
    setIsPlayPressed(false);
    setIsScorePressed(false);
    setIsShopPressed(false);
    setIsAccountPressed(false);
    setIsSettingsPressed(false);
  }, []);

  return (
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
  );
}

// Helper function to draw leaderboard/podium icon
function drawLeaderboardIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  const color = '#F87820'; // Orange color

  // Draw podium shapes
  ctx.fillStyle = color;

  // First place (center, tallest)
  ctx.fillRect(x - 4, y - 14, 12, 22);

  // Second place (right)
  ctx.fillRect(x + 10, y - 6, 10, 14);

  // Third place (left)
  ctx.fillRect(x - 16, y - 2, 10, 10);

  // Draw numbers
  ctx.fillStyle = COLORS.textWhite;
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('1', x + 2, y - 4);
  ctx.fillText('2', x + 15, y + 2);
  ctx.fillText('3', x - 11, y + 4);
}

// Helper function to draw shop icon (shopping bag)
function drawShopIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  const s = 2; // Pixel size
  const color = '#F87820'; // Orange

  // Bag body
  ctx.fillStyle = color;
  ctx.fillRect(x - s * 4, y - s * 2, s * 8, s * 6);

  // Bag top (narrower)
  ctx.fillRect(x - s * 3, y - s * 4, s * 6, s * 2);

  // Handle (arch)
  ctx.fillStyle = COLORS.textOutline;
  ctx.fillRect(x - s * 2, y - s * 6, s, s * 3);
  ctx.fillRect(x + s, y - s * 6, s, s * 3);
  ctx.fillRect(x - s * 2, y - s * 7, s * 4, s);
}

// Helper function to draw account icon (person silhouette)
function drawAccountIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  const s = 2; // Pixel size
  const color = '#F87820'; // Orange

  ctx.fillStyle = color;

  // Head (circle-ish)
  ctx.fillRect(x - s * 2, y - s * 6, s * 4, s);
  ctx.fillRect(x - s * 3, y - s * 5, s * 6, s * 3);
  ctx.fillRect(x - s * 2, y - s * 2, s * 4, s);

  // Body (shoulders and torso)
  ctx.fillRect(x - s * 4, y, s * 8, s * 2);
  ctx.fillRect(x - s * 5, y + s * 2, s * 10, s * 3);
}

// Helper function to draw settings icon (gear)
function drawSettingsIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  const s = 2; // Pixel size
  const color = '#F87820'; // Orange

  ctx.fillStyle = color;

  // Gear teeth (top, bottom, left, right)
  ctx.fillRect(x - s, y - s * 5, s * 2, s * 2); // Top
  ctx.fillRect(x - s, y + s * 3, s * 2, s * 2); // Bottom
  ctx.fillRect(x - s * 5, y - s, s * 2, s * 2); // Left
  ctx.fillRect(x + s * 3, y - s, s * 2, s * 2); // Right

  // Diagonal teeth
  ctx.fillRect(x + s * 2, y - s * 4, s * 2, s * 2); // Top-right
  ctx.fillRect(x - s * 4, y - s * 4, s * 2, s * 2); // Top-left
  ctx.fillRect(x + s * 2, y + s * 2, s * 2, s * 2); // Bottom-right
  ctx.fillRect(x - s * 4, y + s * 2, s * 2, s * 2); // Bottom-left

  // Center circle
  ctx.fillRect(x - s * 3, y - s * 2, s * 6, s);
  ctx.fillRect(x - s * 3, y + s, s * 6, s);
  ctx.fillRect(x - s * 2, y - s * 3, s * 4, s * 6);

  // Center hole
  ctx.fillStyle = COLORS.buttonCream;
  ctx.fillRect(x - s, y - s, s * 2, s * 2);
}
