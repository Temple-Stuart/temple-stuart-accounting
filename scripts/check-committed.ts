import { prisma } from '../src/lib/prisma';

async function main() {
  const total = await prisma.transactions.count();
  const withCode = await prisma.transactions.count({ 
    where: { accountCode: { not: null } } 
  });
  
  console.log(`Total transactions: ${total}`);
  console.log(`With accountCode (committed): ${withCode}`);
  console.log(`Without accountCode (pending): ${total - withCode}`);
  
  // Sample committed ones
  const sample = await prisma.transactions.findMany({
    where: { accountCode: { not: null } },
    take: 5,
    select: { name: true, accountCode: true, amount: true }
  });
  
  console.log('\nSample committed:');
  sample.forEach(t => console.log(`  ${t.accountCode}: ${t.name} ($${t.amount})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
