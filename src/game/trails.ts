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
}

export class TrailSystem {
  private particles: Particle[] = [];
  private trailType: string | null = null;
  private spawnTimer: number = 0;
  private readonly MAX_PARTICLES = 30;
  private readonly SPAWN_INTERVAL = 50; // ms

  setTrail(trailSku: string | null) {
    this.trailType = trailSku;
    if (!trailSku) {
      this.particles = [];
    }
  }

  update(birdX: number, birdY: number, deltaMs: number) {
    if (!this.trailType) return;

    // Spawn new particles
    this.spawnTimer += deltaMs;
    if (this.spawnTimer >= this.SPAWN_INTERVAL && this.particles.length < this.MAX_PARTICLES) {
      this.spawnTimer = 0;
      this.spawnParticle(birdX, birdY);
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Apply velocity
      p.x += p.vx * (deltaMs / 16.67);
      p.y += p.vy * (deltaMs / 16.67);

      // Type-specific behavior
      if (p.type === 'trail_bubbles') {
        p.vy -= 0.02; // Float up
        p.size *= 0.995; // Shrink
      } else if (p.type === 'trail_fire') {
        p.vy -= 0.03; // Rise
        p.vx += (Math.random() - 0.5) * 0.1; // Flicker
      }
    }
  }

  private spawnParticle(x: number, y: number) {
    const configs: Record<string, () => Partial<Particle>> = {
      trail_sparkles: () => ({
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 2 + Math.random() * 3,
        maxLife: 400,
        color: ['#FFD700', '#FFEC8B', '#FFF8DC'][Math.floor(Math.random() * 3)],
      }),
      trail_bubbles: () => ({
        vx: (Math.random() - 0.5) * 1,
        vy: -0.5 - Math.random() * 0.5,
        size: 4 + Math.random() * 4,
        maxLife: 600,
        color: ['#87CEEB', '#ADD8E6', '#B0E0E6'][Math.floor(Math.random() * 3)],
      }),
      trail_fire: () => ({
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random(),
        size: 3 + Math.random() * 3,
        maxLife: 350,
        color: ['#FF4500', '#FF6347', '#FFA500'][Math.floor(Math.random() * 3)],
      }),
      trail_stars: () => ({
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        size: 3 + Math.random() * 3,
        maxLife: 500,
        color: ['#FFD700', '#FFA500', '#FFFFFF'][Math.floor(Math.random() * 3)],
      }),
      trail_rainbow: () => {
        const hue = Math.random() * 360;
        return {
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: 3 + Math.random() * 3,
          maxLife: 450,
          color: `hsl(${hue}, 80%, 60%)`,
        };
      },
    };

    const config = configs[this.trailType!]?.() ?? {};

    this.particles.push({
      x: x - 10, // Behind bird
      y,
      vx: config.vx ?? 0,
      vy: config.vy ?? 0,
      life: config.maxLife ?? 400,
      maxLife: config.maxLife ?? 400,
      size: config.size ?? 3,
      color: config.color ?? '#FFFFFF',
      type: this.trailType!,
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'trail_bubbles') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'trail_stars') {
        // 4-point star
        const s = p.size;
        ctx.fillRect(p.x - s, p.y - 1, s * 2, 2);
        ctx.fillRect(p.x - 1, p.y - s, 2, s * 2);
      } else {
        // Default: square
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles = [];
    this.spawnTimer = 0;
  }
}
