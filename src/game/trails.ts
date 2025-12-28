// src/game/trails.ts

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: string;
  baseX: number; // Original spawn position for subtle animations
  baseY: number;
  spawnScrollOffset: number; // Scroll offset when particle was spawned
}

export class TrailSystem {
  private particles: Particle[] = [];
  private trailType: string | null = null;
  private spawnTimer: number = 0;
  private readonly MAX_PARTICLES = 80; // More particles for longer trail
  private readonly SPAWN_INTERVAL = 20; // Faster spawn for smoother path

  setTrail(trailSku: string | null) {
    this.trailType = trailSku;
    if (!trailSku) {
      this.particles = [];
    }
  }

  update(birdX: number, birdY: number, deltaMs: number, scrollOffset: number) {
    if (!this.trailType) return;

    // Spawn new particles
    this.spawnTimer += deltaMs;
    if (this.spawnTimer >= this.SPAWN_INTERVAL && this.particles.length < this.MAX_PARTICLES) {
      this.spawnTimer = 0;
      this.spawnParticle(birdX, birdY, scrollOffset);
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Particles stay mostly in place, with subtle type-specific animations
      const lifeRatio = p.life / p.maxLife;

      if (p.type === 'trail_bubbles') {
        // Gentle float up from spawn point
        p.y = p.baseY - (1 - lifeRatio) * 12;
        p.size *= 0.998; // Slight shrink
      } else if (p.type === 'trail_fire') {
        // Subtle flicker and slight rise
        p.x = p.baseX + Math.sin(p.life * 0.02) * 2;
        p.y = p.baseY - (1 - lifeRatio) * 10;
      } else if (p.type === 'trail_sparkles') {
        // Subtle twinkle movement
        p.x = p.baseX + Math.sin(p.life * 0.03) * 1.5;
        p.y = p.baseY + Math.cos(p.life * 0.03) * 1.5;
      } else if (p.type === 'trail_stars') {
        // Gentle pulse (handled in draw via size)
        p.x = p.baseX;
        p.y = p.baseY;
      } else if (p.type === 'trail_rainbow') {
        // Subtle wave motion
        p.x = p.baseX + Math.sin(p.life * 0.02) * 1;
        p.y = p.baseY + Math.cos(p.life * 0.025) * 1;
      }
    }
  }

  private spawnParticle(x: number, y: number, scrollOffset: number) {
    // Spawn position is behind the bird
    const spawnX = x - 15;
    const spawnY = y + (Math.random() - 0.5) * 4; // Slight vertical spread

    const configs: Record<string, () => Partial<Particle>> = {
      trail_sparkles: () => ({
        size: 2 + Math.random() * 2,
        maxLife: 1000, // 2x longer
        color: ['#FFD700', '#FFEC8B', '#FFF8DC'][Math.floor(Math.random() * 3)],
      }),
      trail_bubbles: () => ({
        size: 3 + Math.random() * 3,
        maxLife: 1200, // 2x longer
        color: ['#87CEEB', '#ADD8E6', '#B0E0E6'][Math.floor(Math.random() * 3)],
      }),
      trail_fire: () => ({
        size: 3 + Math.random() * 3,
        maxLife: 800, // 2x longer
        color: ['#FF4500', '#FF6347', '#FFA500'][Math.floor(Math.random() * 3)],
      }),
      trail_stars: () => ({
        size: 3 + Math.random() * 2,
        maxLife: 1100, // 2x longer
        color: ['#FFD700', '#FFA500', '#FFFFFF'][Math.floor(Math.random() * 3)],
      }),
      trail_rainbow: () => {
        const hue = Math.random() * 360;
        return {
          size: 3 + Math.random() * 2,
          maxLife: 1000, // 2x longer
          color: `hsl(${hue}, 80%, 60%)`,
        };
      },
    };

    const config = configs[this.trailType!]?.() ?? {};

    this.particles.push({
      x: spawnX,
      y: spawnY,
      baseX: spawnX,
      baseY: spawnY,
      vx: 0,
      vy: 0,
      life: config.maxLife ?? 800,
      maxLife: config.maxLife ?? 800,
      size: config.size ?? 3,
      color: config.color ?? '#FFFFFF',
      type: this.trailType!,
      spawnScrollOffset: scrollOffset,
    });
  }

  draw(ctx: CanvasRenderingContext2D, currentScrollOffset: number) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      // Apply scroll offset difference so particles stay in world space
      const scrollDelta = currentScrollOffset - p.spawnScrollOffset;
      const drawX = p.x - scrollDelta;
      const drawY = p.y;

      // Skip particles that have scrolled off screen
      if (drawX < -20) continue;

      if (p.type === 'trail_bubbles') {
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'trail_stars') {
        // 4-point star
        const s = p.size;
        ctx.fillRect(drawX - s, drawY - 1, s * 2, 2);
        ctx.fillRect(drawX - 1, drawY - s, 2, s * 2);
      } else {
        // Default: square
        ctx.fillRect(drawX - p.size / 2, drawY - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles = [];
    this.spawnTimer = 0;
  }
}
