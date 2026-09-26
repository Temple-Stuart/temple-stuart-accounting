/**
 * The posting-document law's seeded regressions (POST-01, 2026-09-26).
 *
 * The ruling says one thing: A POSTING CARRIES ITS DOCUMENT — the booking behind
 * the bank row, never a posting of its own. These seeds put back, one at a time,
 * each shape the ruling forbids:
 *
 *   · the writer defaults the document (clause 1);
 *   · the reversal carries the original's document (clause 1);
 *   · a second file writes the document — the admin entity fix re-posts it (clause 1);
 *   · the commit route posts past the gate's refusal (clause 2);
 *   · the gate lets a proposed link through (clause 2);
 *   · the gate picks the first of two accepted links (clause 2);
 *   · the route posts an accepted link without its document (clause 3);
 *   · a refund posts without a posted charge (clause 4);
 *   · a refund takes the caller's account (clause 4);
 *   · an outflow documents a refund (clause 4);
 *   · a booking becomes an eighth source kind (clause 5);
 *   · the cell types the document words (clause 6);
 *   · a wire route drops the document (clause 6);
 *   · the migration loses one-posted-charge-per-booking (clause 7);
 *   · the retro picks between two accepted links (clause 8).
 *
 * Each must fail THE POSTING-DOCUMENT LAW by name. The anchors occur exactly once
 * in their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const WRITER = 'src/lib/journal-entry-service.ts';
const GATE = 'src/lib/posting/documentGate.ts';
const ROUTE = 'src/app/api/transactions/commit-to-ledger/route.ts';
const ADMIN_FIX = 'src/app/api/admin/fix-entity-assignment/route.ts';
const LEAF = 'src/lib/books/entrySource.ts';
const CELL = 'src/components/books/EntrySourceCell.tsx';
const JOURNAL_ROUTE = 'src/app/api/journal-transactions/route.ts';
const MIGRATION = 'prisma/migrations/20260926180000_post_01_posting_document/migration.sql';
const RETRO = 'scripts/post-01-retro-documents.ts';

const SEEDS: Seed[] = [
  {
    name: 'post01-a the writer defaults the document (clause 1)',
    file: WRITER,
    find: '          document_reservation_id: document ? document.reservationId : null,',
    replace: '          document_reservation_id: document?.reservationId ?? null,',
    expect: 'defaults a document',
  },
  {
    name: 'post01-b the reversal carries the original’s document (clause 1)',
    file: WRITER,
    find: "        source_type: 'reversal',\n        source_id: null,\n        status: 'posted',\n        is_reversal: true,",
    replace: "        source_type: 'reversal',\n        source_id: null,\n        document_reservation_id: original.document_reservation_id,\n        status: 'posted',\n        is_reversal: true,",
    expect: 'the reversal carries none',
  },
  {
    name: 'post01-c a second file writes the document — the admin entity fix re-posts it (clause 1)',
    file: ADMIN_FIX,
    find: "              source_type: 'plaid_txn',\n              source_id: txn.transactionId,\n              status: 'posted',\n              request_id: `${batchId}-new-${txn.transactionId}`,",
    replace: "              source_type: 'plaid_txn',\n              source_id: txn.transactionId,\n              document_reservation_id: original.document_reservation_id,\n              status: 'posted',\n              request_id: `${batchId}-new-${txn.transactionId}`,",
    expect: 'is the one writer of a posting',
  },
  {
    name: 'post01-d the commit route posts past the gate’s refusal (clause 2)',
    file: ROUTE,
    find: '    if (!gate.ok) {\n      return NextResponse.json(',
    replace: '    if (!gate.ok && transactionIds.length > 50) {\n      return NextResponse.json(',
    expect: 'the gate refuses at 409 before any posting',
  },
  {
    name: 'post01-e the gate lets a proposed link through (clause 2)',
    file: GATE,
    find: "  if (proposed.length > 0) return { kind: 'proposed', linkIds: proposed.map((l) => l.id) };",
    replace: "  if (proposed.length > 0 && links.length > 1) return { kind: 'proposed', linkIds: proposed.map((l) => l.id) };",
    expect: 'lets a proposed link through',
  },
  {
    name: 'post01-f the gate picks the first of two accepted links (clause 2)',
    file: GATE,
    find: "  if (accepted.length > 1) return { kind: 'many_accepted', linkIds: accepted.map((l) => l.id) };\n  if (accepted.length === 1) {",
    replace: "  if (accepted.length >= 1) {",
    expect: 'picks one of two accepted links',
  },
  {
    name: 'post01-g the route posts an accepted link without its document (clause 3)',
    file: ROUTE,
    find: '          document: document === null ? undefined : document,',
    replace: '          document: undefined,',
    expect: 'posts an accepted link without its document',
  },
  {
    name: 'post01-h a refund posts without a posted charge (clause 4)',
    file: WRITER,
    find: '          if (!charge) {\n            throw new ValidationError(\n              `POST-01 the charge is not posted; post it first',
    replace: '          if (!charge && amount > 0) {\n            throw new ValidationError(\n              `POST-01 the charge is not posted; post it first',
    expect: 'a refund entry requires the posted charge',
  },
  {
    name: 'post01-i a refund takes the caller’s account (clause 4)',
    file: WRITER,
    find: '      const expenseOrIncomeAccount = refundAgainst\n        ? refundAgainst.account\n        : await tx.chart_of_accounts.findUnique({',
    replace: '      const expenseOrIncomeAccount = await tx.chart_of_accounts.findUnique({',
    expect: 'derived from the posted charge, never chosen',
  },
  {
    name: 'post01-j an outflow documents a refund (clause 4)',
    file: WRITER,
    find: '          if (!(amount < 0)) {\n            throw new ValidationError(\n              `POST-01 a refund is money that came back',
    replace: '          if (amount === 0) {\n            throw new ValidationError(\n              `POST-01 a refund is money that came back',
    expect: 'an outflow may not document a refund',
  },
  {
    name: 'post01-k a booking becomes an eighth source kind (clause 5)',
    file: LEAF,
    find: 'export const SOURCE_RULES: readonly SourceRule[] = [\n  {\n    type: \'plaid_txn\',',
    replace: "export const SOURCE_RULES: readonly SourceRule[] = [\n  { type: 'booking' as SourceKind, words: 'a booking', idIs: null, opens: false, writtenAt: 'nowhere' },\n  {\n    type: 'plaid_txn',",
    expect: 'KINDS stay seven',
  },
  {
    name: 'post01-l the cell types the document words (clause 6)',
    file: CELL,
    find: '          {document.words}',
    replace: "          {'Booking: ' + document.reservationId}",
    expect: 'types "Booking:"',
  },
  {
    name: 'post01-m a wire route drops the document (clause 6)',
    file: JOURNAL_ROUTE,
    find: '      document_reservation_id: t.document_reservation_id,\n',
    replace: '',
    expect: 'does not put document_reservation_id on the wire',
  },
  {
    name: 'post01-n the migration loses one-posted-charge-per-booking (clause 7)',
    file: MIGRATION,
    find: '    WHERE "document_money_event_id" IS NULL AND "status" = \'posted\';',
    replace: '    WHERE "document_money_event_id" IS NULL;',
    expect: 'one posted charge per booking',
  },
  {
    name: 'post01-o the retro picks between two accepted links (clause 8)',
    file: RETRO,
    find: "    if (decision.kind === 'many_accepted') {\n      leftAsIs += 1;",
    replace: "    if (decision.kind === 'many_accepted' && links.length > 9) {\n      leftAsIs += 1;",
    expect: 'the retro picks between two accepted links',
  },
];

export default SEEDS;
