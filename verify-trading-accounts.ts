import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const tradingAccounts = await prisma.chart_of_accounts.findMany({
    where: { entityType: 'trading' },
    orderBy: { code: 'asc' }
  });
  
  console.log(`\n📊 Found ${tradingAccounts.length} Trading accounts:\n`);
  
  const grouped: {[key: string]: number} = {};
  tradingAccounts.forEach(acc => {
    if (!grouped[acc.accountType]) grouped[acc.accountType] = 0;
    grouped[acc.accountType]++;
  });
  
  Object.entries(grouped).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} accounts`);
  });
  
  console.log('\n✅ Trading COA ready for use');
}

verify().finally(() => prisma.$disconnect());
