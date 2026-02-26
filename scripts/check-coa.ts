import { prisma } from '../src/lib/prisma';

async function main() {
  const githubId = 'cmfi3rcrl0000zcj0ajbj4za5';
  
  // Check COA ownership
  const allCoa = await prisma.chart_of_accounts.count();
  const userCoa = await prisma.chart_of_accounts.count({ where: { userId: githubId } });
  const nullCoa = await prisma.chart_of_accounts.count({ where: { userId: null } });
  
  console.log(`Total COA: ${allCoa}`);
  console.log(`GitHub user COA: ${userCoa}`);
  console.log(`NULL userId COA: ${nullCoa}`);
  
  // Sample COA codes
  const sample = await prisma.chart_of_accounts.findMany({ take: 5 });
  sample.forEach(c => console.log(`${c.code} | ${c.account_type} | userId: ${c.userId}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
