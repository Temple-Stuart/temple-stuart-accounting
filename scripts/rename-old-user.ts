import { prisma } from '../src/lib/prisma';

async function main() {
  const oldUserId = 'cmf6dqgj70000zcrmhwwssuze';

  // Before
  const before = await prisma.users.findUnique({ where: { id: oldUserId } });
  console.log(`Before: ${before?.email}`);

  // Update
  const updated = await prisma.users.update({
    where: { id: oldUserId },
    data: { email: 'testy@mctester.com', name: 'Testy McTester' }
  });

  console.log(`After: ${updated.email}`);

  // Verify both users
  console.log('\nFinal state:');
  const users = await prisma.users.findMany({
    where: { email: { contains: 'templestuart.com', mode: 'insensitive' } },
    select: { id: true, email: true, name: true }
  });
  users.forEach(u => console.log(`  ${u.id}: ${u.email} (${u.name})`));

  const testy = await prisma.users.findUnique({ where: { id: oldUserId } });
  console.log(`  ${testy?.id}: ${testy?.email} (${testy?.name})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
