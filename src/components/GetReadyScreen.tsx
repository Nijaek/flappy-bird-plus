'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { GAME, ANIMATION } from '@/game/constants';
import {
  drawSky,
  drawCloud,
  drawCitySilhouetteExtended,
  drawBushes,
  drawGround,
  drawBird,
} from '@/game/renderer';

// Wing sound for starting game
const playWingSound = () => {
  const audio = new Audio('/sounds/wing.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {
    // Ignore errors
  });
};

interface GetReadyScreenProps {
  onStart: () => void;
}

export default function GetReadyScreen({ onStart }: GetReadyScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Bird animation frame
  const birdFrameRef = useRef(0);
  const lastBirdFrameTime = useRef(0);

  // Parallax scroll offsets
  const scrollOffsetRef = useRef(0);

  // Calculate scale factor to fit game on screen (contain mode)
  const getScaleFactor = useCallback(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return 1;
    const scaleX = canvasSize.width / GAME.WIDTH;
    const scaleY = canvasSize.height / GAME.HEIGHT;
    return Math.min(scaleX, scaleY);
  }, [canvasSize]);

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

  // Handle keyboard input (spacebar to start)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        playWingSound();
        onStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  // Draw pixel art hand/click indicator (palm view with pointer finger up, flipped)
  const drawClickIndicator = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-scale * 0.4, scale * 0.4); // 60% smaller, flipped horizontally

    const black = '#000000';
    const white = '#FFFFFF';

    // Draw entire hand as black silhouette first, then white fill on top
    ctx.fillStyle = black;

    // Index finger outline (pointing up) - positioned between thumb and middle finger
    ctx.fillRect(1, -48, 10, 28);

    // Palm outline
    ctx.fillRect(-22, -20, 36, 24);

    // Thumb outline (bent inward)
    ctx.fillRect(10, -22, 10, 14);

    // Three folded fingers bumps (middle, ring, pinky) - thicker
    ctx.fillRect(-22, -27, 8, 11);  // Pinky (moved up)
    ctx.fillRect(-14, -27, 8, 11);  // Ring finger
    ctx.fillRect(-6, -31, 8, 15);   // Middle finger

    // White fill (2px inset from black outline for consistent border)
    ctx.fillStyle = white;

    // Palm fill (draw first as base)
    ctx.fillRect(-20, -18, 32, 20);

    // Index finger fill (2px border all sides, overlap into palm)
    ctx.fillRect(3, -46, 6, 30);

    // Thumb fill (2px border on top/right/bottom, overlap into palm on left)
    ctx.fillRect(10, -20, 8, 10);

    // Three folded fingers fill (2px border, overlap into palm)
    ctx.fillRect(-20, -25, 4, 9);   // Pinky
    ctx.fillRect(-12, -25, 4, 9);   // Ring finger
    ctx.fillRect(-4, -29, 4, 13);   // Middle finger

    // Motion lines (will appear on opposite side due to flip)
    ctx.fillStyle = black;
    ctx.fillRect(16, -44, 8, 2);
    ctx.fillRect(18, -38, 8, 2);
    ctx.fillRect(16, -32, 8, 2);

    ctx.restore();
  }, []);

  // Draw "Tap" text bubble
  const drawTapText = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) => {
    const bubbleWidth = 44;
    const bubbleHeight = 22;
    const borderWidth = 2;
    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y - bubbleHeight / 2;

    const orange = '#F87820';
    const borderColor = '#D3661B'; // ~15% darker

    // Border (pixelated rectangle)
    ctx.fillStyle = borderColor;
    ctx.fillRect(bubbleX - borderWidth, bubbleY - borderWidth, bubbleWidth + borderWidth * 2, bubbleHeight + borderWidth * 2);

    // Bubble tail border (pointing left - pixelated)
    ctx.fillRect(bubbleX - 10, bubbleY + bubbleHeight / 2 - 5, 10, 10);

    // Main bubble (pixelated rectangle)
    ctx.fillStyle = orange;
    ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    // Bubble tail fill (pixelated - stacked rectangles)
    ctx.fillRect(bubbleX - 8, bubbleY + bubbleHeight / 2 - 3, 8, 6);
    ctx.fillRect(bubbleX - 6, bubbleY + bubbleHeight / 2 - 2, 6, 4);
    ctx.fillRect(bubbleX - 4, bubbleY + bubbleHeight / 2 - 1, 4, 2);

    // "Tap" text
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap', x, y + 1);
  }, []);

  // Draw score at top
  const drawScore = useCallback((
    ctx: CanvasRenderingContext2D,
    score: number,
    x: number,
    y: number
  ) => {
    const scoreText = score.toString();

    ctx.font = 'bold 28px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Draw outline
    ctx.fillStyle = '#000000';
    const outlineOffsets = [
      [-2, -2], [-2, 2], [2, -2], [2, 2],
      [-2, 0], [2, 0], [0, -2], [0, 2],
      [-1, -1], [-1, 1], [1, -1], [1, 1],
    ];
    outlineOffsets.forEach(([ox, oy]) => {
      ctx.fillText(scoreText, x + ox, y + oy);
    });

    // Draw main text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(scoreText, x, y);
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
    const bushOffset = groundOffset;
    const cityOffset = groundOffset * 0.2;
    const cloudOffset = groundOffset * 0.1;

    // Calculate extended width needed to fill entire canvas
    const extraWidth = offsetX > 0 ? (offsetX / scale) + 50 : 50;
    const totalWidth = GAME.WIDTH + extraWidth * 2;
    const groundY = GAME.HEIGHT - GAME.GROUND_HEIGHT;

    // Fill entire canvas with sky color first
    ctx.fillStyle = '#70C5CE';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set up coordinate system for background (shifted left to allow extension)
    ctx.save();
    ctx.translate(offsetX - extraWidth * scale, offsetY);
    ctx.scale(scale, scale);

    // Draw background layers with parallax
    drawSky(ctx, totalWidth, GAME.HEIGHT);

    // Clouds
    const cloudY = groundY - 30;
    const cloudSpacing = 100;
    const cloudPatternWidth = cloudSpacing * 20;
    const wrappedCloudOffset = cloudOffset % cloudPatternWidth;
    const numClouds = Math.ceil((totalWidth + cloudPatternWidth) / cloudSpacing) + 6;

    for (let i = -6; i < numClouds; i++) {
      const baseX = i * cloudSpacing - wrappedCloudOffset;
      const yVariation = (i % 3 - 1) * 8;
      const scaleVariation = 2.0 + (i % 4) * 0.18;
      drawCloud(ctx, baseX, cloudY + yVariation, scaleVariation);
    }

    // City silhouette
    const isLandscape = canvas.width > canvas.height;
    drawCitySilhouetteExtended(ctx, totalWidth, groundY, cityOffset, isLandscape);

    // Bushes
    drawBushes(ctx, totalWidth, groundY, bushOffset);

    // Ground
    drawGround(ctx, totalWidth, GAME.HEIGHT, groundOffset);

    ctx.restore();

    // Draw game elements in normal coordinate system
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw score at top center
    drawScore(ctx, 0, GAME.WIDTH / 2, 40);

    // Update bird animation frame
    if (timestamp - lastBirdFrameTime.current > GAME.BIRD_ANIMATION_SPEED) {
      birdFrameRef.current = (birdFrameRef.current + 1) % 3;
      lastBirdFrameTime.current = timestamp;
    }

    // Bird position (static with hover animation)
    const birdX = GAME.BIRD_X;
    const birdY = GAME.HEIGHT / 2 - 50 + Math.sin(elapsed * ANIMATION.BIRD_HOVER_SPEED) * ANIMATION.BIRD_HOVER_AMPLITUDE;
    const birdRotation = Math.sin(elapsed * ANIMATION.BIRD_HOVER_SPEED) * 0.1;

    drawBird(ctx, birdX, birdY, birdFrameRef.current, birdRotation, 1);

    // Draw click indicator below and to the right of bird
    const indicatorX = GAME.WIDTH / 2;
    const indicatorY = GAME.HEIGHT / 2 + 40;

    // Gentle bob animation for indicator
    const indicatorBob = Math.sin(elapsed * 0.005) * 3;

    drawClickIndicator(ctx, indicatorX, indicatorY + indicatorBob, 1.5);
    drawTapText(ctx, indicatorX + 55, indicatorY - 15 + indicatorBob);

    ctx.restore();

    // Continue animation loop
    animationRef.current = requestAnimationFrame(render);
  }, [getScaleFactor, drawScore, drawClickIndicator, drawTapText]);

  // Start animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Handle click to start
  const handleClick = useCallback(() => {
    playWingSound();
    onStart();
  }, [onStart]);

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
      onClick={handleClick}
    />
  );
}
