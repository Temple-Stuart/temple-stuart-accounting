import { prisma } from '../src/lib/prisma';

async function main() {
  const userId = 'm6wf8z6gjmmjp8dawz';

  // Check what this user owns
  const [accounts, plaidItems, transactions, coa, budgets] = await Promise.all([
    prisma.accounts.count({ where: { userId } }),
    prisma.plaid_items.count({ where: { userId } }),
    prisma.transactions.count({ where: { accounts: { userId } } }),
    prisma.chart_of_accounts.count({ where: { userId } }),
    prisma.budgets.count({ where: { userId } })
  ]);

  console.log(`User m6wf8z6gjmmjp8dawz owns:`);
  console.log(`  Accounts: ${accounts}`);
  console.log(`  Plaid Items: ${plaidItems}`);
  console.log(`  Transactions: ${transactions}`);
  console.log(`  COA: ${coa}`);
  console.log(`  Budgets: ${budgets}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
