import { prisma } from '../src/lib/prisma';

async function main() {
  const accounts = await prisma.accounts.findMany({
    include: { plaid_items: true }
  });
  
  console.log('\n=== ACCOUNTS ===');
  accounts.forEach(a => {
    console.log(`${a.name} | accounts.userId: ${a.userId || 'NULL'} | plaid_items.userId: ${a.plaid_items?.userId}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
