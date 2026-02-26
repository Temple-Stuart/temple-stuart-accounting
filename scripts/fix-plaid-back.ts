import { prisma } from '../src/lib/prisma';

async function main() {
  const wrongUserId = 'm6wf8z6gjmmjp8dawz';           // astuart@ lowercase - WRONG
  const correctUserId = 'cmf6dqgj70000zcrmhwwssuze';  // Astuart@ capital A - YOUR LOGIN
  
  const result = await prisma.plaid_items.updateMany({
    where: { userId: wrongUserId },
    data: { userId: correctUserId }
  });
  
  console.log(`✅ Moved ${result.count} Plaid items back to Astuart@templestuart.com`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
