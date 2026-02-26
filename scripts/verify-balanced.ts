const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const journals = await p.journal_transactions.findMany({
    where: { id: { in: [
      '9cd87926-a262-44dd-88d0-48cc68271f46',
      '4ce6f70b-9a0b-4163-bfde-ce09b0d17a54'
    ]}},
    include: { ledger_entries: { select: { entry_type: true, amount: true } } }
  });
  for (const j of journals) {
    let d = 0, c = 0;
    for (const e of j.ledger_entries) {
      if (e.entry_type === 'D') d += Number(e.amount);
      else c += Number(e.amount);
    }
    const status = Math.abs(d - c) < 2 ? 'BALANCED' : 'UNBALANCED';
    console.log(status, j.description, 'D:', d/100, 'C:', c/100);
  }
  await p.$disconnect();
})();
