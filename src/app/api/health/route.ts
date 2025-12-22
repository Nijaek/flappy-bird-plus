import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      database: 'up' | 'down';
      redis: 'up' | 'down';
    };
    timestamp: string;
  } = {
    status: 'healthy',
    services: {
      database: 'down',
      redis: 'down',
    },
    timestamp: new Date().toISOString(),
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'up';
  } catch {
    health.status = 'unhealthy';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'up';
  } catch {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
