import { prisma } from '../src/lib/prisma';

async function main() {
  const resorts = await prisma.ikon_resorts.findMany({
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { name: 'asc' }
  });

  const withCoords = resorts.filter(r => r.latitude && r.longitude);
  const withoutCoords = resorts.filter(r => !r.latitude || !r.longitude);

  console.log(`Total resorts: ${resorts.length}`);
  console.log(`With coordinates: ${withCoords.length}`);
  console.log(`Without coordinates: ${withoutCoords.length}`);
  
  console.log('\n=== Resorts WITH coordinates ===');
  withCoords.forEach(r => console.log(`✓ ${r.name}: ${r.latitude}, ${r.longitude}`));
  
  console.log('\n=== Resorts WITHOUT coordinates (first 20) ===');
  withoutCoords.slice(0, 20).forEach(r => console.log(`✗ ${r.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
