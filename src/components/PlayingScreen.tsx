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
  drawPipe,
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

const playPointSound = () => {
  const audio = new Audio('/sounds/point.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

const playHitSound = () => {
  const audio = new Audio('/sounds/hit.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

// Pipe interface
interface Pipe {
  x: number;
  gapY: number; // Center Y position of the gap
  gap: number; // Gap size (fixed when pipe is spawned)
  passed: boolean; // Whether the bird has passed this pipe for scoring
}

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

  // Pipe state
  const pipesRef = useRef<Pipe[]>([]);
  const lastPipeSpawnRef = useRef(0);
  const pipeCountRef = useRef(0); // Total pipes spawned (for difficulty)

  // Parallax scroll offsets
  const scrollOffsetRef = useRef(0);

  // Physics constants (slower, higher jump)
  const GRAVITY = 0.1;
  const FLAP_VELOCITY = -3.5;
  const MAX_FALL_SPEED = 2.5;
  const ROTATION_MULTIPLIER = 0.25;

  // Pipe constants
  const PIPE_WIDTH = Math.floor(GAME.PIPE_WIDTH * 0.8); // 20% narrower
  const PIPE_SPEED = 1; // Slowed to match game speed
  const PIPE_SPAWN_INTERVAL = 180; // Frames between pipe spawns
  const BASE_GAP = 120; // Starting gap size
  const MIN_GAP = 70; // Minimum gap size at max difficulty
  const GAP_DECREASE_INTERVAL = 10; // Decrease gap every N points
  const GAP_DECREASE_AMOUNT = 5; // How much to decrease per interval

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

  // Calculate gap for next pipe based on pipe count
  const getNextPipeGap = useCallback(() => {
    const decreases = Math.floor(pipeCountRef.current / GAP_DECREASE_INTERVAL);
    const gap = BASE_GAP - (decreases * GAP_DECREASE_AMOUNT);
    return Math.max(gap, MIN_GAP);
  }, []);

  // Spawn a new pipe
  const spawnPipe = useCallback((spawnX: number) => {
    const gap = getNextPipeGap();
    const groundY = GAME.HEIGHT - GAME.GROUND_HEIGHT;
    const minGapY = 80 + gap / 2; // Minimum gap center Y
    const maxGapY = groundY - 80 - gap / 2; // Maximum gap center Y
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);

    pipesRef.current.push({
      x: spawnX,
      gapY,
      gap, // Store the gap with the pipe
      passed: false,
    });
    pipeCountRef.current++;
  }, [getNextPipeGap]);

  // Check collision between bird and pipes
  const checkCollision = useCallback((birdX: number, birdY: number): boolean => {
    const birdLeft = birdX - GAME.BIRD_WIDTH / 2 + 4; // Slightly smaller hitbox
    const birdRight = birdX + GAME.BIRD_WIDTH / 2 - 4;
    const birdTop = birdY - GAME.BIRD_HEIGHT / 2 + 4;
    const birdBottom = birdY + GAME.BIRD_HEIGHT / 2 - 4;

    for (const pipe of pipesRef.current) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;
      const gapTop = pipe.gapY - pipe.gap / 2;
      const gapBottom = pipe.gapY + pipe.gap / 2;

      // Check if bird is horizontally overlapping with pipe
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check if bird is outside the gap vertically
        if (birdTop < gapTop || birdBottom > gapBottom) {
          return true;
        }
      }
    }
    return false;
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

    // Calculate extended width for landscape mode
    const extraWidth = offsetX > 0 ? (offsetX / scale) + 50 : 50;

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

      // Pipe spawning (spawn beyond visible area for landscape mode)
      lastPipeSpawnRef.current++;
      if (lastPipeSpawnRef.current >= PIPE_SPAWN_INTERVAL) {
        spawnPipe(GAME.WIDTH + extraWidth);
        lastPipeSpawnRef.current = 0;
      }

      // Update pipes (move left and check scoring)
      const pipesToRemove: number[] = [];
      pipesRef.current.forEach((pipe, index) => {
        // Move pipe left
        pipe.x -= PIPE_SPEED;

        // Check if bird passed the pipe (for scoring)
        if (!pipe.passed && pipe.x + PIPE_WIDTH < GAME.BIRD_X) {
          pipe.passed = true;
          scoreRef.current++;
          playPointSound();
        }

        // Mark pipes that are off screen for removal (account for landscape)
        if (pipe.x + PIPE_WIDTH < -extraWidth) {
          pipesToRemove.push(index);
        }
      });

      // Remove off-screen pipes (iterate backwards to avoid index issues)
      for (let i = pipesToRemove.length - 1; i >= 0; i--) {
        pipesRef.current.splice(pipesToRemove[i], 1);
      }

      // Check pipe collision
      if (checkCollision(GAME.BIRD_X, birdYRef.current)) {
        playHitSound();
        gameActiveRef.current = false;
        onGameOver(scoreRef.current);
      }
    }

    // Update scroll offset
    scrollOffsetRef.current += 2;
    const groundOffset = scrollOffsetRef.current;
    const bushOffset = groundOffset;
    const cityOffset = groundOffset * 0.2;
    const cloudOffset = groundOffset * 0.1;

    // Use pre-calculated extraWidth
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

    // Draw game elements (use extended coordinate system for landscape)
    ctx.save();
    ctx.translate(offsetX - extraWidth * scale, offsetY);
    ctx.scale(scale, scale);

    // Draw pipes (use each pipe's stored gap)
    pipesRef.current.forEach((pipe) => {
      // Offset pipe x to account for extended coordinate system
      const pipeDrawX = pipe.x + extraWidth;

      // Top pipe (extends from top of screen to gap)
      const topPipeHeight = pipe.gapY - pipe.gap / 2;
      if (topPipeHeight > 0) {
        drawPipe(ctx, pipeDrawX, 0, PIPE_WIDTH, topPipeHeight, true);
      }

      // Bottom pipe (extends from gap to ground)
      const bottomPipeY = pipe.gapY + pipe.gap / 2;
      const bottomPipeHeight = groundY - bottomPipeY;
      if (bottomPipeHeight > 0) {
        drawPipe(ctx, pipeDrawX, bottomPipeY, PIPE_WIDTH, bottomPipeHeight, false);
      }
    });

    // Draw score (offset for extended coordinate system)
    drawScore(ctx, scoreRef.current, GAME.WIDTH / 2 + extraWidth, 40);

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

    // Draw bird (offset for extended coordinate system)
    drawBird(ctx, GAME.BIRD_X + extraWidth, birdYRef.current, birdFrameRef.current, birdRotation, 1);

    ctx.restore();

    // Continue animation loop
    animationRef.current = requestAnimationFrame(render);
  }, [getScaleFactor, drawScore, onGameOver, spawnPipe, checkCollision]);

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
