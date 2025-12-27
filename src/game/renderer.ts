// Flappy Bird Plus - Canvas Rendering Utilities

import { COLORS, GAME, GROUND_PATTERN, SKIN_PALETTES } from './constants';

// =============================================================================
// DRAWING UTILITIES
// =============================================================================

/**
 * Draw a rounded rectangle (pixel-style with sharp corners optional)
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
  strokeWidth: number = 2
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

// =============================================================================
// BACKGROUND RENDERING
// =============================================================================

/**
 * Draw the sky background
 */
export function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw clouds - pixel art style with smaller rectangles
 * Wider and taller cloud design for better screen coverage
 */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number = 1
) {
  ctx.fillStyle = COLORS.cloudWhite;
  const s = 2 * scale; // Smaller pixel size for more detail

  // Taller pixel art cloud shape with finer detail
  // Top bumps (highest points)
  ctx.fillRect(x + s * 6, y - s * 14, s * 6, s * 2);
  ctx.fillRect(x + s * 18, y - s * 14, s * 8, s * 2);

  // Second row from top
  ctx.fillRect(x + s * 4, y - s * 12, s * 10, s * 2);
  ctx.fillRect(x + s * 16, y - s * 12, s * 12, s * 2);
  ctx.fillRect(x + s * 32, y - s * 12, s * 6, s * 2);

  // Third row
  ctx.fillRect(x + s * 2, y - s * 10, s * 14, s * 2);
  ctx.fillRect(x + s * 14, y - s * 10, s * 16, s * 2);
  ctx.fillRect(x + s * 30, y - s * 10, s * 10, s * 2);

  // Fourth row (connecting)
  ctx.fillRect(x, y - s * 8, s * 42, s * 2);

  // Fifth row
  ctx.fillRect(x - s * 2, y - s * 6, s * 46, s * 2);

  // Main body rows (widest)
  ctx.fillRect(x - s * 4, y - s * 4, s * 50, s * 2);
  ctx.fillRect(x - s * 4, y - s * 2, s * 50, s * 2);
  ctx.fillRect(x - s * 4, y, s * 50, s * 2);
  ctx.fillRect(x - s * 2, y + s * 2, s * 46, s * 2);

  // Bottom rows (extending down further)
  ctx.fillRect(x, y + s * 4, s * 42, s * 2);
  ctx.fillRect(x + s * 2, y + s * 6, s * 38, s * 2);
  ctx.fillRect(x + s * 4, y + s * 8, s * 34, s * 2);
  ctx.fillRect(x + s * 6, y + s * 10, s * 30, s * 2);
  ctx.fillRect(x + s * 8, y + s * 12, s * 26, s * 2);
  ctx.fillRect(x + s * 10, y + s * 14, s * 22, s * 2);
  ctx.fillRect(x + s * 12, y + s * 16, s * 18, s * 2);
}

/**
 * Draw city silhouette in background with parallax scrolling
 */
export function drawCitySilhouette(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  offset: number = 0
) {
  drawCitySilhouetteExtended(ctx, width, groundY, offset, false);
}

/**
 * Draw city silhouette with option for taller buildings (landscape mode)
 * Pixel art style with outlines, variety, and clustered overlapping buildings
 */
export function drawCitySilhouetteExtended(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  offset: number = 0,
  tallBuildings: boolean = false
) {
  const s = 4; // Pixel size for clean pixel art
  const heightScale = 0.6; // 40% shorter buildings
  const widthScale = 0.8; // Wider buildings (less reduction)
  const heightMultiplier = (tallBuildings ? 1.6 : 1.0) * heightScale;

  // Building clusters - each cluster has overlapping buildings of varying widths/heights
  // Format: [xOffset, width (in s units), height (in s units)]
  const clusters = [
    // Cluster 1: tall center with shorter sides
    [[0, 5, 12], [3, 7, 18], [8, 5, 14]],
    // Cluster 2: two overlapping buildings
    [[0, 6, 15], [4, 6, 20]],
    // Cluster 3: three buildings staggered
    [[0, 4, 10], [2, 6, 16], [6, 5, 12]],
    // Cluster 4: single wide building
    [[0, 8, 14]],
    // Cluster 5: tall narrow with short wide
    [[0, 8, 9], [2, 4, 22]],
    // Cluster 6: descending heights
    [[0, 5, 18], [4, 5, 14], [8, 5, 10]],
    // Cluster 7: two tall buildings
    [[0, 6, 20], [5, 6, 17]],
  ];

  const clusterWidths = clusters.map(cluster => {
    const maxX = Math.max(...cluster.map(b => Math.floor((b[0] + b[1]) * widthScale) * s));
    return maxX + s * 3; // Add spacing between clusters
  });

  const totalPatternWidth = clusterWidths.reduce((a, b) => a + b, 0);
  const numSets = Math.ceil((width + totalPatternWidth) / totalPatternWidth) + 1;

  for (let set = 0; set < numSets; set++) {
    let clusterX = 0;

    clusters.forEach((cluster, clusterIndex) => {
      const baseClusterX = set * totalPatternWidth + clusterX;
      const adjustedClusterX = baseClusterX - (offset % totalPatternWidth);

      // Skip if cluster is off screen
      if (adjustedClusterX < -clusterWidths[clusterIndex] - 50 || adjustedClusterX > width + 50) {
        clusterX += clusterWidths[clusterIndex];
        return;
      }

      // Draw buildings in cluster (back to front for proper overlap)
      // Sort by height so taller buildings are drawn last (in front)
      const sortedBuildings = [...cluster].sort((a, b) => a[2] - b[2]);

      sortedBuildings.forEach(([bx, bw, bh]) => {
        const buildingWidth = Math.floor(bw * widthScale) * s;
        const buildingHeight = Math.floor(bh * heightMultiplier) * s;
        const x = adjustedClusterX + Math.floor(bx * widthScale) * s;
        const y = groundY - buildingHeight;

        // Skip if off screen
        if (x < -buildingWidth - 10 || x > width + 10) return;

        // Building outline (cyan tint)
        ctx.fillStyle = '#9ad4d5';
        ctx.fillRect(x - 1, y - 1, buildingWidth + 2, buildingHeight + 1);

        // Building body (main color - light green)
        ctx.fillStyle = '#ddf3cf';
        ctx.fillRect(x, y, buildingWidth, buildingHeight);

        // Window details (mint green)
        ctx.fillStyle = '#b5e6cc';
        const windowSize = s;
        const windowSpacing = s * 2;
        for (let wy = y + s * 2; wy < groundY - s * 2; wy += windowSpacing) {
          for (let wx = x + s + 2; wx < x + buildingWidth - s; wx += windowSpacing) {
            ctx.fillRect(wx, wy, windowSize, windowSize);
          }
        }
      });

      clusterX += clusterWidths[clusterIndex];
    });
  }
}

// Seeded random for consistent bush variation
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Draw a single bush with outline
 */
function drawSingleBush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  heightMultiplier: number,
  outlineColor: string,
  fillColor: string
) {
  const h = Math.floor(heightMultiplier);

  // Draw outline first
  ctx.fillStyle = outlineColor;
  ctx.fillRect(x + s - 1, y - s * (3 + h) - 1, s * 4 + 2, s + 2);
  ctx.fillRect(x - 1, y - s * (2 + h) - 1, s * 6 + 2, s + 2);
  ctx.fillRect(x - s - 1, y - s * (1 + h) - 1, s * 8 + 2, s * (1 + h) + 2);

  // Draw fill
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + s, y - s * (3 + h), s * 4, s);
  ctx.fillRect(x, y - s * (2 + h), s * 6, s);
  ctx.fillRect(x - s, y - s * (1 + h), s * 8, s * (1 + h));
}

/**
 * Draw bushes/trees layer - pixel art style with outline, depth layers, and randomness
 */
export function drawBushes(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  offset: number = 0
) {
  const bushSpacing = 28; // Base spacing between bushes
  const patternWidth = bushSpacing * 50; // Repeat pattern
  const wrappedOffset = offset % patternWidth;
  const s = 4; // Pixel size

  // Colors for depth layers
  const backOutline = '#4a9a6a'; // Darker outline for back layer
  const backFill = '#65be88'; // Secondary bushes (behind)
  const frontOutline = '#5ac06a'; // Outline for front layer
  const frontFill = '#83e28a'; // Primary bushes (front)

  // Draw enough bushes to cover the entire width plus buffer
  const numBushes = Math.ceil((width + patternWidth) / bushSpacing) + 4;

  // First pass: Draw back layer bushes (taller, darker, offset)
  for (let i = -2; i < numBushes; i++) {
    const seed = i * 127 + 500; // Different seed for back layer
    const xOffset = (seededRandom(seed) - 0.5) * 16 + 10; // Offset to the side
    const heightVar = seededRandom(seed + 1) * 2 + 1; // Taller (1-3 extra)

    const x = i * bushSpacing - wrappedOffset + xOffset;
    const y = groundY;

    if (x < -bushSpacing * 2 || x > width + bushSpacing) continue;

    drawSingleBush(ctx, x, y, s, heightVar, backOutline, backFill);
  }

  // Second pass: Draw front layer bushes
  for (let i = -2; i < numBushes; i++) {
    const seed = i * 127;
    const xOffset = (seededRandom(seed) - 0.5) * 12;
    const heightVar = seededRandom(seed + 1) * 2; // 0-2 extra height

    const x = i * bushSpacing - wrappedOffset + xOffset;
    const y = groundY;

    if (x < -bushSpacing * 2 || x > width + bushSpacing) continue;

    drawSingleBush(ctx, x, y, s, heightVar, frontOutline, frontFill);
  }
}

/**
 * Draw the ground - seamlessly tiling across any width
 */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number = 0
) {
  const groundY = height - GAME.GROUND_HEIGHT;

  // Grass stripe (top part of ground) - full width
  ctx.fillStyle = COLORS.grassGreen;
  ctx.fillRect(0, groundY, width, GAME.GRASS_HEIGHT / 2);

  ctx.fillStyle = COLORS.grassDark;
  ctx.fillRect(0, groundY + GAME.GRASS_HEIGHT / 2, width, GAME.GRASS_HEIGHT / 2);

  // Dirt/sand section with grid pattern
  const dirtY = groundY + GAME.GRASS_HEIGHT;
  const dirtHeight = GAME.GROUND_HEIGHT - GAME.GRASS_HEIGHT;

  // Base dirt color - full width
  ctx.fillStyle = COLORS.groundTan;
  ctx.fillRect(0, dirtY, width, dirtHeight);

  // Grid pattern - pixel art style checkerboard
  ctx.fillStyle = COLORS.groundDark;
  const gridSize = GROUND_PATTERN.gridSize; // Size of each grid cell
  const patternWidth = gridSize * 100; // Large pattern for seamless loop
  const wrappedOffset = offset % patternWidth;

  // Draw grid pattern (checkerboard style)
  for (let gy = dirtY; gy < dirtY + dirtHeight; gy += gridSize) {
    const rowOffset = ((gy - dirtY) / gridSize) % 2; // Offset every other row
    for (let gx = -patternWidth; gx < width + patternWidth; gx += gridSize * 2) {
      const x = gx - wrappedOffset + (rowOffset * gridSize);

      // Skip if too far off screen
      if (x < -gridSize || x > width + gridSize) continue;

      ctx.fillRect(x, gy, gridSize, gridSize);
    }
  }
}

// =============================================================================
// BIRD RENDERING
// =============================================================================

/**
 * Draw the bird sprite - pixelated style matching original Flappy Bird
 * @param frame - 0: wings up, 1: wings mid, 2: wings down
 * @param rotation - rotation in radians
 * @param skinSku - which skin to use (default: 'skin_yellow')
 * @param animationTime - for rainbow animation
 */
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
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  // Determine colors based on skin
  let bodyColor: string = COLORS.birdYellow;
  let shadowColor: string = COLORS.birdDark;

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

  // Bird dimensions (pixel art style)
  const w = 34;
  const h = 24;
  const ox = -w / 2; // offset X to center
  const oy = -h / 2; // offset Y to center

  // Helper for drawing pixel rectangles
  const px = (px: number, py: number, pw: number, ph: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + px, oy + py, pw, ph);
  };

  // === BODY OUTLINE (black) - continuous with no gaps ===
  // Top edge
  px(8, 0, 16, 2, '#000000');
  // Top-left corner (connects top edge to left edge)
  px(6, 0, 2, 2, '#000000');
  px(4, 2, 4, 2, '#000000');
  px(2, 4, 2, 4, '#000000');  // Extended down to y=8 to overlap with left edge
  // Left edge
  px(0, 6, 2, 10, '#000000');
  // Left step-in at y=16 (body narrows here)
  px(0, 16, 4, 2, '#000000');
  px(2, 18, 2, 2, '#000000');
  // Bottom-left corner (connects left edge to bottom edge)
  px(4, 18, 2, 4, '#000000');
  // Bottom edge
  px(6, 22, 18, 2, '#000000');
  // Right step-in at y=16 (body narrows here)
  px(24, 16, 4, 2, '#000000');
  px(26, 14, 2, 2, '#000000');
  // Right edge (continues after step)
  px(24, 18, 2, 4, '#000000');
  // Right edge (upper)
  px(26, 6, 2, 8, '#000000');
  // Top-right corner (connects right edge to top edge)
  px(24, 2, 2, 6, '#000000');  // Extended down to y=8 to overlap with right edge
  px(24, 0, 2, 2, '#000000');

  // === BODY FILL (yellow) ===
  px(8, 2, 16, 4, bodyColor);  // Top
  px(4, 4, 4, 2, bodyColor);
  px(2, 6, 24, 6, bodyColor);  // Upper body
  px(2, 12, 24, 4, bodyColor); // Mid body
  px(4, 16, 20, 4, bodyColor); // Lower body
  px(6, 20, 18, 2, bodyColor);

  // === BODY SHADING (darker) ===
  px(4, 16, 20, 2, shadowColor);
  px(6, 18, 16, 2, shadowColor);
  px(8, 20, 14, 2, shadowColor);

  // === WING ===
  let wingY = 10;
  if (frame === 0) wingY = 6;  // Up
  else if (frame === 2) wingY = 14; // Down

  // Wing outline (continuous)
  px(2, wingY, 14, 2, '#000000');      // Top
  px(0, wingY, 2, 2, '#000000');       // Top-left corner
  px(0, wingY + 2, 2, 4, '#000000');   // Left edge
  px(0, wingY + 6, 2, 2, '#000000');   // Bottom-left corner
  px(2, wingY + 6, 12, 2, '#000000');  // Bottom
  px(14, wingY + 6, 2, 2, '#000000');  // Bottom-right corner
  px(14, wingY + 2, 2, 4, '#000000');  // Right edge

  // Wing fill
  px(2, wingY + 2, 12, 4, shadowColor);
  // Wing highlight
  px(4, wingY + 2, 8, 2, bodyColor);

  // === EYE (white circle with black pupil) ===
  // Eye outline (draw first, continuous with corners)
  px(18, 2, 8, 2, '#000000');   // Top
  px(16, 2, 2, 2, '#000000');   // Top-left corner
  px(16, 4, 2, 8, '#000000');   // Left edge
  px(16, 12, 2, 2, '#000000');  // Bottom-left corner
  px(18, 12, 8, 2, '#000000');  // Bottom
  px(26, 12, 2, 2, '#000000');  // Bottom-right corner
  px(26, 4, 2, 8, '#000000');   // Right edge
  px(26, 2, 2, 2, '#000000');   // Top-right corner
  // Eye white background
  px(18, 4, 8, 8, COLORS.eyeWhite);

  // Pupil (black)
  px(22, 6, 4, 6, COLORS.eyeBlack);

  // === BEAK (Flappy Bird style - top and bottom lips) ===
  // Top lip outline (black) - continuous
  px(26, 10, 10, 2, '#000000');  // Top edge of upper lip
  px(34, 12, 2, 3, '#000000');   // Right tip of upper lip
  // Top lip fill (orange)
  px(26, 12, 8, 3, COLORS.beakOrange);

  // Bottom lip outline (black) - continuous
  px(34, 15, 2, 3, '#000000');   // Right tip of lower lip
  px(26, 18, 10, 2, '#000000');  // Bottom edge of lower lip
  // Bottom lip fill (darker orange-red)
  px(26, 15, 8, 3, COLORS.beakRed);

  ctx.restore();
}

// =============================================================================
// TITLE RENDERING
// =============================================================================

/**
 * Draw the "Flappy Bird +" title with outline
 * The "+" is rendered in orange color
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Title text settings
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw "Flappy" on first line
  const flappyText = 'Flappy';

  // Calculate positions for two-line layout
  const lineSpacing = 48;
  const flappyY = -lineSpacing / 2;
  const birdY = lineSpacing / 2;

  // Draw outline for "Flappy" (thick, chunky)
  ctx.font = 'bold 36px "Press Start 2P", "Courier New", monospace';
  ctx.fillStyle = COLORS.textOutline;
  const outlineOffsets = [
    [-4, -4], [-4, 0], [-4, 4],
    [0, -4], [0, 4],
    [4, -4], [4, 0], [4, 4],
    [-3, -3], [-3, 3], [3, -3], [3, 3],
    [-2, 0], [2, 0], [0, -2], [0, 2],
  ];

  outlineOffsets.forEach(([ox, oy]) => {
    ctx.fillText(flappyText, ox, flappyY + oy);
  });

  // Draw main "Flappy" text
  ctx.fillStyle = COLORS.textWhite;
  ctx.fillText(flappyText, 0, flappyY);

  // Draw "Bird " part with outline
  const birdText = 'Bird ';
  const plusText = '+';

  // Measure "Bird " width to position the "+"
  const birdWidth = ctx.measureText(birdText).width;
  const plusWidth = ctx.measureText(plusText).width;
  const totalWidth = birdWidth + plusWidth;
  const birdStartX = -totalWidth / 2 + birdWidth / 2;
  const plusStartX = birdStartX + birdWidth / 2 + plusWidth / 2;

  // Draw outline for "Bird "
  ctx.fillStyle = COLORS.textOutline;
  outlineOffsets.forEach(([ox, oy]) => {
    ctx.fillText(birdText, birdStartX + ox, birdY + oy);
  });

  // Draw main "Bird " text
  ctx.fillStyle = COLORS.textWhite;
  ctx.fillText(birdText, birdStartX, birdY);

  // Draw outline for "+"
  ctx.fillStyle = COLORS.textOutline;
  outlineOffsets.forEach(([ox, oy]) => {
    ctx.fillText(plusText, plusStartX + ox, birdY + oy);
  });

  // Draw main "+" text in ORANGE
  ctx.fillStyle = COLORS.textOrange;
  ctx.fillText(plusText, plusStartX, birdY);

  ctx.restore();
}

// =============================================================================
// BUTTON RENDERING
// =============================================================================

/**
 * Draw a game-style button (pixel art style matching original Flappy Bird)
 */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isPressed: boolean = false
) {
  const pressOffset = isPressed ? 2 : 0;
  const radius = 6;

  // Draw shadow (offset down-right)
  if (!isPressed) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    drawPixelRoundedRect(ctx, x + 3, y + 3, width, height, radius);
  }

  // Main button body - cream/white fill
  ctx.fillStyle = COLORS.buttonCream;
  drawPixelRoundedRect(ctx, x, y + pressOffset, width, height, radius);

  // Dark border
  ctx.strokeStyle = COLORS.panelDark;
  ctx.lineWidth = 3;
  drawPixelRoundedRectStroke(ctx, x, y + pressOffset, width, height, radius);

  // Inner highlight (top-left edges) for 3D effect
  if (!isPressed) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y + pressOffset + 3);
    ctx.lineTo(x + width - radius, y + pressOffset + 3);
    ctx.stroke();
  }
}

/**
 * Draw a pixel-style rounded rectangle (filled)
 */
function drawPixelRoundedRect(
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

/**
 * Draw a pixel-style rounded rectangle (stroke only)
 */
function drawPixelRoundedRectStroke(
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

/**
 * Draw play icon (triangle)
 */
export function drawPlayIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = 20
) {
  ctx.fillStyle = COLORS.playGreen;
  ctx.beginPath();
  ctx.moveTo(x - size / 3, y - size / 2);
  ctx.lineTo(x + size / 2, y);
  ctx.lineTo(x - size / 3, y + size / 2);
  ctx.closePath();
  ctx.fill();

  // Outline
  ctx.strokeStyle = COLORS.textOutline;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// =============================================================================
// PIPE RENDERING
// =============================================================================

/**
 * Draw a pipe (top or bottom) with pixelated shading
 * @param isTop - true for top pipe (cap at bottom), false for bottom pipe (cap at top)
 */
export function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isTop: boolean
) {
  const capHeight = 26;
  const capOverhang = 3; // How much the cap extends beyond the body

  // Colors for shading
  const pipeLight = '#8CD038';
  const pipeMid = '#73BF2E';
  const pipeDark = '#557B1F';
  const pipeOutline = '#3D5A14';

  const capLight = '#6DC030';
  const capMid = '#58A020';
  const capDark = '#3D7010';

  // Pipe body
  const bodyX = x;
  const bodyY = isTop ? y : y + capHeight;
  const bodyHeight = height - capHeight;

  // Draw pipe body outline
  ctx.fillStyle = pipeOutline;
  ctx.fillRect(bodyX - 1, bodyY, width + 2, bodyHeight);

  // Draw pipe body with shading (left highlight, right shadow)
  const stripeWidth = Math.floor(width / 4);

  // Left highlight
  ctx.fillStyle = pipeLight;
  ctx.fillRect(bodyX, bodyY, stripeWidth, bodyHeight);

  // Middle sections
  ctx.fillStyle = pipeMid;
  ctx.fillRect(bodyX + stripeWidth, bodyY, stripeWidth * 2, bodyHeight);

  // Right shadow
  ctx.fillStyle = pipeDark;
  ctx.fillRect(bodyX + stripeWidth * 3, bodyY, width - stripeWidth * 3, bodyHeight);

  // Pipe cap
  const capX = x - capOverhang;
  const capY = isTop ? y + height - capHeight : y;
  const capWidth = width + capOverhang * 2;

  // Draw cap outline
  ctx.fillStyle = pipeOutline;
  ctx.fillRect(capX - 1, capY - 1, capWidth + 2, capHeight + 2);

  // Draw cap body with shading
  const capStripeWidth = Math.floor(capWidth / 4);

  // Left highlight
  ctx.fillStyle = capLight;
  ctx.fillRect(capX, capY, capStripeWidth, capHeight);

  // Middle sections
  ctx.fillStyle = capMid;
  ctx.fillRect(capX + capStripeWidth, capY, capStripeWidth * 2, capHeight);

  // Right shadow
  ctx.fillStyle = capDark;
  ctx.fillRect(capX + capStripeWidth * 3, capY, capWidth - capStripeWidth * 3, capHeight);

  // Add horizontal line details on cap for pixel art look
  ctx.fillStyle = pipeOutline;
  if (isTop) {
    // Lines at top of cap (bottom of top pipe)
    ctx.fillRect(capX, capY, capWidth, 2);
  } else {
    // Lines at bottom of cap (top of bottom pipe)
    ctx.fillRect(capX, capY + capHeight - 2, capWidth, 2);
  }

  // Add vertical highlight line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(bodyX + 2, bodyY, 2, bodyHeight);
  ctx.fillRect(capX + 2, capY, 2, capHeight);
}
