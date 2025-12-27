// prisma/seed-items.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const items = [
  // Skins
  { sku: 'skin_yellow', name: 'Yellow', type: 'skin', pricePoints: 0, active: true },
  { sku: 'skin_blue', name: 'Blue', type: 'skin', pricePoints: 50, active: true },
  { sku: 'skin_red', name: 'Red', type: 'skin', pricePoints: 50, active: true },
  { sku: 'skin_rainbow', name: 'Rainbow', type: 'skin', pricePoints: 250, active: true },
  // Trails
  { sku: 'trail_sparkles', name: 'Sparkles', type: 'trail', pricePoints: 50, active: true },
  { sku: 'trail_bubbles', name: 'Bubbles', type: 'trail', pricePoints: 50, active: true },
  { sku: 'trail_fire', name: 'Fire', type: 'trail', pricePoints: 100, active: true },
  { sku: 'trail_stars', name: 'Stars', type: 'trail', pricePoints: 100, active: true },
  { sku: 'trail_rainbow', name: 'Rainbow', type: 'trail', pricePoints: 250, active: true },
];

async function main() {
  console.log('Seeding shop items...');

  for (const item of items) {
    await prisma.item.upsert({
      where: { sku: item.sku },
      update: item,
      create: item,
    });
    console.log(`  ✓ ${item.sku}`);
  }

  console.log('Done seeding items.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
