import { prisma } from '../src/lib/prisma';

async function main() {
  const oldUserId = 'cmf6dqgj70000zcrmhwwssuze';  // Astuart@templestuart.com
  const newUserId = 'm6wf8z6gjmmjp8dawz';          // astuart@templestuart.com
  
  // Move all plaid_items to the correct user
  const result = await prisma.plaid_items.updateMany({
    where: { userId: oldUserId },
    data: { userId: newUserId }
  });
  
  console.log(`✅ Migrated ${result.count} Plaid items to astuart@templestuart.com`);
  
  // Verify
  const items = await prisma.plaid_items.findMany({
    where: { userId: newUserId },
    include: { _count: { select: { accounts: true } } }
  });
  
  console.log('\n=== VERIFIED ===');
  items.forEach(i => {
    console.log(`${i.institutionName}: ${i._count.accounts} accounts`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
