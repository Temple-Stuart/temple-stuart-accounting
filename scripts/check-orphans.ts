const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const allLedger = await p.ledger_entries.findMany({
    select: { id: true, account_id: true }
  });
  let orphaned = 0;
  for (const entry of allLedger) {
    const acct = await p.chart_of_accounts.findUnique({ where: { id: entry.account_id } });
    if (acct === null) {
      console.log('ORPHANED ledger entry:', entry.id, 'points to missing account:', entry.account_id);
      orphaned++;
    }
  }
  console.log('Total ledger entries checked:', allLedger.length);
  console.log('Orphaned entries (no COA):', orphaned);
  await p.$disconnect();
})();
