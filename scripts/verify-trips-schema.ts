import { prisma } from '../src/lib/prisma';

async function main() {
  // Just try to query the new fields
  const trip = await prisma.trips.findFirst({
    select: {
      id: true,
      startDate: true,
      endDate: true,
      committedAt: true,
      latitude: true,
      longitude: true,
    }
  });
  
  console.log('Schema update successful!');
  console.log('Sample trip fields:', trip || 'No trips yet');
}

main().catch(console.error).finally(() => prisma.$disconnect());
