/**
 * BANK-03 — the one-shot merge for this case, run locally by Alex:
 *
 *   DATABASE_URL=… npx tsx scripts/plaid-attach-item.ts --user <email> --item <plaid_items.id | Plaid item_id>
 *   DATABASE_URL=… npx tsx scripts/plaid-attach-item.ts --user <email> --item <…> --execute
 *
 * Without --execute it is a DRY RUN: it prints the BEFORE counts (every account
 * of both items with its history) and the plan, and writes nothing. With
 * --execute it runs the merge in one transaction (src/lib/plaid/attachItem.ts)
 * and prints the AFTER counts. The same code path as POST /api/plaid/attach-item.
 * Exits 1 when the plan stops or an assertion throws (everything rolled back).
 */
import { PrismaClient } from '@prisma/client';
import { attachItem, describePlan, planAttach, totalOf } from '../src/lib/plaid/attachItem';
import { prismaAttach } from '../src/lib/plaid/prismaAttach';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set (run locally)');
  const email = arg('user');
  const itemRef = arg('item');
  const execute = process.argv.includes('--execute');
  if (!email || !itemRef) throw new Error('usage: --user <email> --item <plaid_items.id | Plaid item_id> [--execute]');

  const prisma = new PrismaClient();
  try {
    const user = await prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true } });
    if (!user) throw new Error(`no user ${email}`);
    const item = await prisma.plaid_items.findFirst({ where: { userId: user.id, OR: [{ id: itemRef }, { itemId: itemRef }] }, select: { id: true, itemId: true, institutionId: true, institutionName: true } });
    if (!item) throw new Error(`no plaid_items row ${itemRef} for ${email}`);

    const counts = async (label: string) => {
      const rows = await prisma.$queryRaw<Array<{ item: string; institution: string | null; retired_at: Date | null; account: string; mask: string | null; plaid_account_id: string; transactions: bigint; investment_transactions: bigint; bank_reconciliations: bigint }>>`
        SELECT pi.id AS item, pi."institutionName" AS institution, pi.retired_at, a.id AS account, a.mask, a."accountId" AS plaid_account_id,
               (SELECT count(*) FROM transactions t WHERE t."accountId" = a.id) AS transactions,
               (SELECT count(*) FROM investment_transactions i WHERE i."accountId" = a.id) AS investment_transactions,
               (SELECT count(*) FROM bank_reconciliations r WHERE r.account_id = a.id) AS bank_reconciliations
        FROM plaid_items pi LEFT JOIN accounts a ON a."plaidItemId" = pi.id
        WHERE pi."userId" = ${user.id} AND pi."institutionId" = ${item.institutionId}
        ORDER BY pi."createdAt", a.mask`;
      console.log(`\n${label}`);
      console.table(rows.map((r) => ({ ...r, transactions: Number(r.transactions), investment_transactions: Number(r.investment_transactions), bank_reconciliations: Number(r.bank_reconciliations), retired_at: r.retired_at?.toISOString() ?? null })));
    };

    await counts(`BEFORE — plaid_items + accounts of institution ${item.institutionId} for ${user.email}`);
    const db = prismaAttach(prisma);
    const plan = await planAttach(db, { userId: user.id, newItemRowId: item.id });
    console.log(`\nPLAN: ${plan.kind} — ${describePlan(plan)}`);
    if (plan.kind === 'merge') {
      for (const p of plan.pairs) console.log(`  ••••${p.mask}: old ${p.oldRow.id} ${JSON.stringify(p.before.old)} · new ${p.newRow.id} ${JSON.stringify(p.before.new)} → ${p.survivorIs} row survives (${totalOf(p.before.old) + totalOf(p.before.new)} rows)`);
      console.log(`  retire ${plan.oldItem.id} (${plan.oldItem.itemId}) — ${plan.retireReason}`);
    }
    if (plan.kind !== 'merge') { process.exitCode = plan.kind === 'stop' ? 1 : 0; return; }
    if (!execute) { console.log('\nDRY RUN — nothing written. Re-run with --execute to apply.'); return; }

    const { report } = await attachItem(db, { userId: user.id, newItemRowId: item.id });
    console.log(`\nEXECUTED: ${JSON.stringify(report, null, 1)}`);
    await counts('AFTER');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('plaid-attach-item failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
