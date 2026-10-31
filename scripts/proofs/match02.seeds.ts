/**
 * The refund-match law's seeded regressions (MATCH-02, 2026-09-26).
 *
 * The ruling says one thing: REFUNDS COME HOME — an inflow is proposed against the
 * refund the vendor stated, a human accepts, the money event settles. These seeds
 * put back, one at a time, each shape the ruling forbids:
 *
 *   · the refund function reaches for the clock (clause 1);
 *   · a voucher becomes a bank-reachable destination (clause 2);
 *   · an inflow dated before statedAt is proposed (clause 3);
 *   · a cross-currency amount is converted by a rate (clause 4);
 *   · an unquantified refund gets an invented amount (clause 4);
 *   · the propose route writes 'settled' (clause 5);
 *   · the review route settles without its evidence (clause 5);
 *   · the review route accepts an already-settled event (clause 5);
 *   · the writer accepts a charge document on an inflow (clause 6);
 *   · the outflow pass selects amount >= 0 (clause 7);
 *   · the refund events load without the guest fence (clause 7);
 *   · the component types the refund words (clause 8);
 *   · the migration loses its CHECK (clause 9).
 *
 * Each must fail THE REFUND-MATCH LAW by name. The anchors occur exactly once in
 * their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const MATCHER = 'src/lib/runway/reservationMatcher.ts';
const PROPOSE = 'src/app/api/runway/match/propose/route.ts';
const REVIEW = 'src/app/api/runway/match/review/route.ts';
const REVIEW_UI = 'src/components/hub/MatchReviewSection.tsx';
const WRITER = 'src/lib/journal-entry-service.ts';
const MIGRATION = 'prisma/migrations/20260926210000_match_02_refund_settlement/migration.sql';

const SEEDS: Seed[] = [
  {
    name: 'match02-a the refund function reaches for the clock (clause 1)',
    file: MATCHER,
    find: '    const statedDay = utcDay(e.statedAt);',
    replace: '    const statedDay = utcDay(e.statedAt);\n    void Date.now();',
    expect: 'reads the clock',
  },
  {
    name: 'match02-b a voucher becomes a bank-reachable destination (clause 2)',
    file: MATCHER,
    find: "export const BANK_REACHABLE_REFUND_DESTINATIONS: ReadonlyArray<string | null> = [null, 'original_payment'];",
    replace: "export const BANK_REACHABLE_REFUND_DESTINATIONS: ReadonlyArray<string | null> = [null, 'original_payment', 'voucher'];",
    expect: 'a candidate requires a bank-reachable destination',
  },
  {
    name: 'match02-c an inflow dated before statedAt is proposed (clause 3)',
    file: MATCHER,
    find: '      if (dateDay < statedDay) {\n        skipped.push(',
    replace: '      if (dateDay < statedDay - 30) {\n        skipped.push(',
    expect: 'an inflow before statedAt is never proposed',
  },
  {
    name: 'match02-d a cross-currency amount is converted by a rate (clause 4)',
    file: MATCHER,
    find: "  const account = accountCurrency === null ? null : accountCurrency.toUpperCase();",
    replace: "  const account = accountCurrency === null ? null : accountCurrency.toUpperCase();\n  const fxRate = 1;\n  void fxRate;",
    expect: 'converts by a guessed rate',
  },
  {
    name: 'match02-e an unquantified refund gets an invented amount (clause 4)',
    file: MATCHER,
    find: '    const refundDollars = e.amountCents === null ? null : e.amountCents / 100;',
    replace: '    const refundDollars = (e.amountCents ?? 0) / 100;',
    expect: 'an unquantified refund is proposed with the amount EXCLUDED',
  },
  {
    name: 'match02-f the propose route writes settled (clause 5)',
    file: PROPOSE,
    find: "            moneyEventId: p.moneyEventId,\n            userId: user.id,\n            status: 'proposed',",
    replace: "            moneyEventId: p.moneyEventId,\n            userId: user.id,\n            status: 'settled',",
    expect: 'the review route is the only writer of settled',
  },
  {
    name: 'match02-g the review route settles without its evidence (clause 5)',
    file: REVIEW,
    find: "          data: { status: 'settled', settledTransactionId: link.transactionId, settledAt: reviewedAt },",
    replace: "          data: { status: 'settled', settledAt: reviewedAt },",
    expect: 'the review route writes it with its evidence',
  },
  {
    name: 'match02-h the review route accepts an already-settled event (clause 5)',
    file: REVIEW,
    find: "        if (event.status !== 'stated') {\n          throw new ValidationError(",
    replace: "        if (event.status !== 'stated' && event.status !== 'settled') {\n          throw new ValidationError(",
    expect: 'a 409 by name',
  },
  {
    name: 'match02-i the writer accepts a charge document on an inflow (clause 6)',
    file: WRITER,
    find: '  if (document && document.moneyEventId === null && amount < 0) {',
    replace: '  if (document && document.moneyEventId === null && amount < -1e12) {',
    expect: 'refuses a charge document on an inflow',
  },
  {
    name: 'match02-j the outflow pass selects amount >= 0 (clause 7)',
    file: PROPOSE,
    find: '        amount: { gt: 0 },',
    replace: '        amount: { gte: 0 },',
    expect: 'the outflow pass is untouched',
  },
  {
    name: 'match02-k the refund events load without the guest fence (clause 7)',
    file: PROPOSE,
    find: "      where: { kind: 'refund', status: 'stated', reservation: { userId: user.id } },",
    replace: "      where: { kind: 'refund', status: 'stated' },",
    expect: 'the guest fence',
  },
  {
    name: 'match02-l the component types the refund words (clause 8)',
    file: REVIEW_UI,
    find: '                    ↔ {refundProposalLine(resLabel, refund)}',
    replace: "                    ↔ {'Refund of ' + resLabel}",
    expect: 'types "Refund of',
  },
  {
    name: 'match02-m the migration loses its CHECK (clause 9)',
    file: MIGRATION,
    find: '    CHECK (("status" = \'settled\') = ("settledTransactionId" IS NOT NULL));',
    replace: '    CHECK ("status" IN (\'stated\', \'settled\'));',
    expect: 'settled means evidence, and evidence means settled',
  },
];

export default SEEDS;
