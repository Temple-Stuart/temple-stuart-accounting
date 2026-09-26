/**
 * POST-01 (2026-09-26) — THE RETRO. Alex runs this; a session never does.
 *
 *   DATABASE_URL=... npx tsx scripts/post-01-retro-documents.ts [--dry-run]
 *
 * A posting carries its document: the booking behind the bank row. Every POSTED
 * plaid_txn entry that carries NO document is joined to its bank row
 * (journal_entries.source_id = transactions.transactionId) and to that row's
 * transaction_reservation_links (links.transactionId = transactions.id, the
 * entry's own user). Then the ONE rule the commit route's gate applies
 * (src/lib/posting/documentGate.ts, documentFromLinks):
 *   · EXACTLY ONE accepted link, the booking's charge (moneyEventId null) → the
 *     entry gets document_reservation_id = that booking. Deterministic. No vendor
 *     read, no score, no guess.
 *   · TWO accepted links → printed by name, LEFT AS IS — a posting documents one
 *     booking and this script never picks.
 *   · a proposed link → printed by name, left as is — undecided is not a document.
 *   · an accepted REFUND link (moneyEventId set) → printed by name, left as is: a
 *     refund document is set by the writer at posting, which derives its account
 *     from the posted charge; this script sets no refund.
 *   · no accepted link → nothing to set; counted, not printed one by one.
 *   · the database refuses the write (P2002 on journal_entries_document_charge_key:
 *     another POSTED entry already holds this booking's charge) → printed by name,
 *     left as is.
 *
 * IDEMPOTENT BY CONSTRUCTION: it selects only entries with no document, so a
 * second run finds the ones it set already gone from its selection and changes
 * nothing. The immutability trigger (20260227000100_protect_journal_entries)
 * freezes the fields it names; the document columns are not among them.
 *
 * NO FALLBACK. Nothing is defaulted; every row that is not set is printed with
 * its reason.
 *
 * --dry-run: prints what WOULD be set, writes nothing.
 */
import { readFileSync } from 'node:fs';

// ── Minimal .env loader (the probe scripts' idiom): .env.local then .env, no overrides.
function loadEnvFile(path: string): void {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { return; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — this script reads journal_entries, transactions and transaction_reservation_links and writes journal_entries.document_reservation_id, and does nothing without it.');
    process.exit(2);
  }
  // Imported AFTER the env is loaded: the prisma client reads its configuration at import time.
  const { prisma } = await import('../src/lib/prisma');
  const { Prisma } = await import('@prisma/client');
  const { documentFromLinks } = await import('../src/lib/posting/documentGate');

  const entries = await prisma.journal_entries.findMany({
    where: { source_type: 'plaid_txn', status: 'posted', document_reservation_id: null, source_id: { not: null } },
    orderBy: { created_at: 'asc' },
    select: { id: true, userId: true, source_id: true, date: true, description: true },
  });
  console.log(`POST-01 retro — ${entries.length} posted plaid_txn entr${entries.length === 1 ? 'y' : 'ies'} without a document${dryRun ? ' (DRY RUN: nothing will be written)' : ''}\n`);

  let set = 0; let noLink = 0; let leftAsIs = 0; let noBankRow = 0;
  for (const e of entries) {
    const head = `${e.id} · ${e.date.toISOString().slice(0, 10)} · ${e.description}`;
    const txn = await prisma.transactions.findUnique({
      where: { transactionId: e.source_id as string },
      select: { id: true },
    });
    if (!txn) {
      noBankRow += 1;
      console.log(`· no bank row ${head}\n    source_id ${e.source_id} names no transactions row — left as is`);
      continue;
    }
    const links = await prisma.transaction_reservation_links.findMany({
      where: { transactionId: txn.id, userId: e.userId },
      select: { id: true, transactionId: true, reservationId: true, moneyEventId: true, status: true },
    });
    const decision = documentFromLinks(links);
    if (decision.kind === 'none') { noLink += 1; continue; }
    if (decision.kind === 'proposed') {
      leftAsIs += 1;
      console.log(`· left as is  ${head}\n    a proposed link is undecided (link${decision.linkIds.length === 1 ? '' : 's'} ${decision.linkIds.join(', ')}) — review it first; nothing set`);
      continue;
    }
    if (decision.kind === 'many_accepted') {
      leftAsIs += 1;
      console.log(`✖ left as is  ${head}\n    TWO ACCEPTED LINKS (${decision.linkIds.join(', ')}) — a posting documents one booking; this script never picks`);
      continue;
    }
    if (decision.document.moneyEventId !== null) {
      leftAsIs += 1;
      console.log(`· left as is  ${head}\n    the accepted link ${decision.linkId} is a REFUND (money event ${decision.document.moneyEventId}) — a refund document is set by the writer at posting, never here`);
      continue;
    }
    const reservationId = decision.document.reservationId;
    if (dryRun) {
      set += 1;
      console.log(`✔ would set   ${head}\n    document_reservation_id = ${reservationId} (link ${decision.linkId})`);
      continue;
    }
    try {
      await prisma.journal_entries.update({
        where: { id: e.id },
        data: { document_reservation_id: reservationId, document_money_event_id: null },
      });
      set += 1;
      console.log(`✔ SET         ${head}\n    document_reservation_id = ${reservationId} (link ${decision.linkId})`);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        leftAsIs += 1;
        const holder = await prisma.journal_entries.findFirst({
          where: { document_reservation_id: reservationId, document_money_event_id: null, status: 'posted' },
          select: { id: true },
        });
        console.log(`✖ left as is  ${head}\n    booking ${reservationId} already has a posted charge entry ${holder?.id ?? '(not found on re-read)'} — the database refused a second (journal_entries_document_charge_key)`);
        continue;
      }
      throw err;
    }
  }
  console.log(`\n${set} ${dryRun ? 'would be set' : 'set'} · ${noLink} with no accepted link · ${leftAsIs} left as is (named above) · ${noBankRow} with no bank row`);
  await prisma.$disconnect();
}

void main();
