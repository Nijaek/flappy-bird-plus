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

interface PlayingScreenProps {
  onGameOver: (score: number) => void;
}

// Sound effects
const playWingSound = () => {
  const audio = new Audio('/sounds/wing.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

export default function PlayingScreen({ onGameOver }: PlayingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Bird state
  const birdYRef = useRef(GAME.HEIGHT / 2 - 50);
  const birdVelocityRef = useRef(0);
  const birdFrameRef = useRef(1);
  const lastBirdFrameTime = useRef(0);

  // Game state
  const scoreRef = useRef(0);
  const gameActiveRef = useRef(true);

  // Parallax scroll offsets
  const scrollOffsetRef = useRef(0);

  // Physics constants (slower, higher jump)
  const GRAVITY = 0.1;
  const FLAP_VELOCITY = -3.5;
  const MAX_FALL_SPEED = 2.5;
  const ROTATION_MULTIPLIER = 0.25;

  // Calculate scale factor
  const getScaleFactor = useCallback(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return 1;
    const scaleX = canvasSize.width / GAME.WIDTH;
    const scaleY = canvasSize.height / GAME.HEIGHT;
    return Math.min(scaleX, scaleY);
  }, [canvasSize]);

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

  // Flap function
  const flap = useCallback(() => {
    if (!gameActiveRef.current) return;

    birdVelocityRef.current = FLAP_VELOCITY;
    birdFrameRef.current = 0; // Wings up
    playWingSound();
  }, []);

  // Handle input (click/tap/spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        flap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flap]);

  // Draw score
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

    // Disable image smoothing
    ctx.imageSmoothingEnabled = false;

    // Calculate scale
    const scale = getScaleFactor();
    const scaledWidth = GAME.WIDTH * scale;
    const scaledHeight = GAME.HEIGHT * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Update physics
    if (gameActiveRef.current) {
      // Apply gravity
      birdVelocityRef.current += GRAVITY;

      // Clamp fall speed
      if (birdVelocityRef.current > MAX_FALL_SPEED) {
        birdVelocityRef.current = MAX_FALL_SPEED;
      }

      // Update position
      birdYRef.current += birdVelocityRef.current;

      // Ground collision
      const groundY = GAME.HEIGHT - GAME.GROUND_HEIGHT;
      if (birdYRef.current > groundY - GAME.BIRD_HEIGHT / 2) {
        birdYRef.current = groundY - GAME.BIRD_HEIGHT / 2;
        gameActiveRef.current = false;
        onGameOver(scoreRef.current);
      }

      // Ceiling collision
      if (birdYRef.current < GAME.BIRD_HEIGHT / 2) {
        birdYRef.current = GAME.BIRD_HEIGHT / 2;
        birdVelocityRef.current = 0;
      }
    }

    // Update scroll offset
    scrollOffsetRef.current += 2;
    const groundOffset = scrollOffsetRef.current;
    const bushOffset = groundOffset;
    const cityOffset = groundOffset * 0.2;
    const cloudOffset = groundOffset * 0.1;

    // Calculate extended width
    const extraWidth = offsetX > 0 ? (offsetX / scale) + 50 : 50;
    const totalWidth = GAME.WIDTH + extraWidth * 2;
    const groundY = GAME.HEIGHT - GAME.GROUND_HEIGHT;

    // Fill canvas with sky color
    ctx.fillStyle = '#70C5CE';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.save();
    ctx.translate(offsetX - extraWidth * scale, offsetY);
    ctx.scale(scale, scale);

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

    // City
    const isLandscape = canvas.width > canvas.height;
    drawCitySilhouetteExtended(ctx, totalWidth, groundY, cityOffset, isLandscape);

    // Bushes
    drawBushes(ctx, totalWidth, groundY, bushOffset);

    // Ground
    drawGround(ctx, totalWidth, GAME.HEIGHT, groundOffset);

    ctx.restore();

    // Draw game elements
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw score
    drawScore(ctx, scoreRef.current, GAME.WIDTH / 2, 40);

    // Update bird animation frame
    if (timestamp - lastBirdFrameTime.current > GAME.BIRD_ANIMATION_SPEED) {
      if (birdVelocityRef.current < 0) {
        // Going up - wings up
        birdFrameRef.current = 0;
      } else if (birdVelocityRef.current > 2) {
        // Falling fast - wings down
        birdFrameRef.current = 2;
      } else {
        // Neutral
        birdFrameRef.current = 1;
      }
      lastBirdFrameTime.current = timestamp;
    }

    // Calculate bird rotation based on velocity
    const birdRotation = Math.min(Math.max(birdVelocityRef.current * ROTATION_MULTIPLIER, -0.5), Math.PI / 2);

    // Draw bird
    drawBird(ctx, GAME.BIRD_X, birdYRef.current, birdFrameRef.current, birdRotation, 1);

    ctx.restore();

    // Continue animation loop
    animationRef.current = requestAnimationFrame(render);
  }, [getScaleFactor, drawScore, onGameOver]);

  // Start animation loop
  useEffect(() => {
    // Play initial flap sound and start with upward velocity
    playWingSound();
    birdVelocityRef.current = FLAP_VELOCITY;

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Handle click to flap
  const handleClick = useCallback(() => {
    flap();
  }, [flap]);

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
