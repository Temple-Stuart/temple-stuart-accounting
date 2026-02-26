import { prisma } from '../src/lib/prisma';

async function main() {
  const oldUserId = 'cmf6dqgj70000zcrmhwwssuze';

  // Safety check - verify owns nothing
  const [accounts, plaidItems, coa, budgets] = await Promise.all([
    prisma.accounts.count({ where: { userId: oldUserId } }),
    prisma.plaid_items.count({ where: { userId: oldUserId } }),
    prisma.chart_of_accounts.count({ where: { userId: oldUserId } }),
    prisma.budgets.count({ where: { userId: oldUserId } })
  ]);

  console.log(`User ${oldUserId} owns:`);
  console.log(`  Accounts: ${accounts}`);
  console.log(`  Plaid Items: ${plaidItems}`);
  console.log(`  COA: ${coa}`);
  console.log(`  Budgets: ${budgets}`);

  if (accounts + plaidItems + coa + budgets > 0) {
    console.error('\nABORTING: User still owns data!');
    return;
  }

  // Delete
  await prisma.users.delete({ where: { id: oldUserId } });
  console.log('\nDeleted user cmf6dqgj70000zcrmhwwssuze');

  // Verify
  const remaining = await prisma.users.findMany({
    select: { id: true, email: true, name: true }
  });
  console.log('\nRemaining users:');
  remaining.forEach(u => console.log(`  ${u.email} (${u.name})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
