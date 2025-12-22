import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTokens() {
  console.log('Starting token cleanup...');

  const result = await prisma.runToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Used tokens older than 24h
      ],
    },
  });

  console.log(`Deleted ${result.count} expired/used tokens`);

  await prisma.$disconnect();
}

cleanupTokens().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
