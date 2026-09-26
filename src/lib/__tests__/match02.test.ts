/**
 * MATCH-02 (2026-09-26) — refunds come home: an inflow is proposed against the
 * refund the vendor stated, a human accepts, the money event settles.
 *
 * One test per proof the ruling names. The refund matcher is pure and driven
 * directly; the writer's refusal is driven over a client that throws on any
 * touch (the refusal comes before any lookup); the routes, the component, the
 * migration and the schema are read from source the way this repo proves what it
 * cannot execute without a database. The outflow pass is pinned by the hash of
 * main's code half — byte-identical. No live call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  BANK_REACHABLE_REFUND_DESTINATIONS, MATCH_REFUND_DATE_WINDOW_DAYS, isBankReachableRefund, proposeMatches, proposeRefundMatches,
  type MatcherRefundEvent, type MatcherTransaction,
} from '../runway/reservationMatcher';
import { refundProposalLine, statedRefundAmount } from '../runway/refundWords';
import { commitPlaidTransaction } from '../journal-entry-service';
import { ValidationError } from '../errors/ValidationError';

const MATCHER = 'src/lib/runway/reservationMatcher.ts';
const WORDS = 'src/lib/runway/refundWords.ts';
const PROPOSE = 'src/app/api/runway/match/propose/route.ts';
const QUEUE = 'src/app/api/runway/match/queue/route.ts';
const REVIEW = 'src/app/api/runway/match/review/route.ts';
const REVIEW_UI = 'src/components/hub/MatchReviewSection.tsx';
const WRITER = 'src/lib/journal-entry-service.ts';
const MIGRATION = 'prisma/migrations/20260926210000_match_02_refund_settlement/migration.sql';

/** sha256 and length of code(MATCHER) on main cfe3a9ee — the outflow pass, byte-identical; MATCH-02 only APPENDS after it. */
const MAIN_MATCHER_CODE_SHA256 = '2bd2fb68f1824d3e363fdbc2abe0f6dccb35d34b16c68b5c120d9c30e0bf11ba';
const MAIN_MATCHER_CODE_LENGTH = 11674;

const EVENT: MatcherRefundEvent = {
  id: 'me_1', reservationId: 'res_1', kind: 'refund', status: 'stated', amountCents: 25000, currency: 'USD', refundDestination: null,
  statedAt: '2026-09-10T10:00:00.000Z', provider: 'liteapi', hotelName: 'Hotel Temple', displayName: 'Hotel Temple', chargeTransactionName: 'NUITEE*HOTEL TEMPLE',
};
const INFLOW: MatcherTransaction = { id: 't_in', amount: -250, date: '2026-09-15', name: 'NUITEE*HOTEL TEMPLE REFUND', merchantName: null, pending: false };
const OPTS = { amountTolerancePct: 0.05, refundDateWindowDays: MATCH_REFUND_DATE_WINDOW_DAYS };

function run(event: Partial<MatcherRefundEvent> = {}, inflow: Partial<MatcherTransaction> = {}, accountCurrency: string | null = 'USD', exclude?: ReadonlySet<string>) {
  return proposeRefundMatches({ refunds: [{ ...EVENT, ...event }], transactions: [{ ...INFLOW, ...inflow }], accountCurrency, opts: OPTS, excludeTransactionIds: exclude });
}

// ── the matcher ──────────────────────────────────────────────────────────────

test('inflow 5 days after statedAt, same currency, amount within tolerance, descriptor = the charge’s name → proposed; confidence and rationale name all three signals', () => {
  const out = run();
  assert.equal(out.skipped.length, 0);
  assert.equal(out.proposals.length, 1);
  const p = out.proposals[0];
  assert.equal(p.transactionId, 't_in');
  assert.equal(p.reservationId, 'res_1');
  assert.equal(p.moneyEventId, 'me_1');
  // amount 0 drift → 1.0 × 0.5; date 5/14 → 0.643 × 0.3; descriptor hit → 1 × 0.2 → 0.893
  assert.equal(p.confidence, 0.893);
  assert.match(p.rationale, /^refund: money event me_1 of booking res_1, vendor stated 250\.00 USD at 2026-09-10T10:00:00\.000Z; /);
  assert.match(p.rationale, /amount: inflow 250\.00 vs stated 250\.00 USD \(drift 0\.0% ≤ 5\.0% tolerance\)/);
  assert.match(p.rationale, /date: txn date 5d after statedAt \(window 14d\)/);
  assert.match(p.rationale, /descriptor: "NUITEE\*HOTEL TEMPLE REFUND" matched provider vocab 'nuitee' \+ booking name token 'hotel' \+ the accepted charge's descriptor token 'nuitee' \(charge "NUITEE\*HOTEL TEMPLE"\)/);
});

test('inflow dated BEFORE statedAt → a contradiction: not proposed, named', () => {
  const out = run({}, { date: '2026-09-09' });
  assert.equal(out.proposals.length, 0);
  assert.deepEqual(out.skipped.map((k) => [k.transactionId, k.moneyEventId, k.reason]), [['t_in', 'me_1', 'before_stated']]);
  assert.match(out.skipped[0].detail, /inflow dated 1d BEFORE the vendor stated the refund at 2026-09-10T10:00:00\.000Z — a refund cannot land before it is stated/);
  // The inflow's own date decides: an authorized_date after statedAt does not rescue a date before it.
  const still = run({}, { date: '2026-09-09', authorized_date: '2026-09-12' });
  assert.equal(still.proposals.length, 0);
  assert.equal(still.skipped[0].reason, 'before_stated');
});

test('cross-currency event → amount EXCLUDED, weights re-normalized over date + descriptor, rationale says so', () => {
  const out = run({ currency: 'EUR' });
  assert.equal(out.proposals.length, 1);
  const p = out.proposals[0];
  // date 0.643 × 0.3 + descriptor 1 × 0.2, over 0.5 → 0.786
  assert.equal(p.confidence, 0.786);
  assert.match(p.rationale, /vendor stated 250\.00 EUR at/);
  assert.match(p.rationale, /amount: EXCLUDED — refund currency EUR ≠ account USD \(never converted by guess\); date \+ descriptor carry this proposal/);
  // An account whose currency is not stated: excluded, named, never assumed USD.
  const unstated = run({}, {}, null);
  assert.equal(unstated.proposals.length, 1);
  assert.match(unstated.proposals[0].rationale, /amount: EXCLUDED — the account currency is not stated \(accounts\.isoCurrencyCode NULL\)/);
  assert.equal(unstated.proposals[0].confidence, 0.786);
  // A vendor that stated no currency: excluded, named.
  const noCur = run({ currency: null });
  assert.match(noCur.proposals[0].rationale, /vendor stated 250\.00 \(no currency stated\) at/);
  assert.match(noCur.proposals[0].rationale, /amount: EXCLUDED — refund currency \(not stated\) ≠ account USD/);
});

test('amountCents NULL → proposed on date + descriptor only, named; never an invented amount', () => {
  const out = run({ amountCents: null });
  assert.equal(out.proposals.length, 1);
  assert.equal(out.proposals[0].confidence, 0.786);
  assert.match(out.proposals[0].rationale, /vendor stated no amount stated at 2026-09-10T10:00:00\.000Z/);
  assert.match(out.proposals[0].rationale, /amount: EXCLUDED — the vendor did not quantify this refund \(NULL recorded\); date \+ descriptor carry this proposal/);
  // An inflow of any size is proposed against an unquantified refund — nothing contradicts nothing.
  assert.equal(run({ amountCents: null }, { amount: -12.34 }).proposals.length, 1);
});

test('refundDestination voucher / agency_deposit / bsp_settlement / manual / unknown → never a candidate; NULL and original_payment are', () => {
  assert.deepEqual([...BANK_REACHABLE_REFUND_DESTINATIONS], [null, 'original_payment']);
  for (const d of ['voucher', 'agency_deposit', 'bsp_settlement', 'manual', 'unknown']) {
    assert.equal(isBankReachableRefund(d), false, d);
    const out = run({ refundDestination: d });
    assert.equal(out.proposals.length, 0, d);
    assert.equal(out.skipped.length, 0, `${d}: not a candidate at all, nothing to skip`);
  }
  assert.equal(run({ refundDestination: 'original_payment' }).proposals.length, 1);
  assert.equal(run({ refundDestination: null }).proposals.length, 1);
});

test('an event already settled → never a candidate; a fee is not a refund; an outflow is never a refund; a claimed inflow is excluded', () => {
  assert.equal(run({ status: 'settled' }).proposals.length, 0);
  assert.equal(run({ kind: 'cancellation_fee' }).proposals.length, 0);
  assert.equal(run({}, { amount: 250 }).proposals.length, 0, 'money that left is never a refund');
  assert.equal(run({}, { amount: 0 }).proposals.length, 0);
  assert.equal(run({}, {}, 'USD', new Set(['t_in'])).proposals.length, 0, 'an accepted link already claims it');
});

test('same-currency drift beyond tolerance → contradiction, named; a stated 0 contradicts any non-zero inflow; outside the window → skipped, named', () => {
  const drift = run({}, { amount: -300 });
  assert.equal(drift.proposals.length, 0);
  assert.equal(drift.skipped[0].reason, 'amount_contradiction');
  assert.match(drift.skipped[0].detail, /inflow 300\.00 vs stated 250\.00 USD: drift 20\.0% > 5\.0% tolerance/);
  const zero = run({ amountCents: 0 }, { amount: -1 });
  assert.equal(zero.proposals.length, 0);
  assert.match(zero.skipped[0].detail, /drift total/);
  const late = run({}, { date: '2026-09-30' });
  assert.equal(late.proposals.length, 0);
  assert.equal(late.skipped[0].reason, 'outside_window');
  assert.match(late.skipped[0].detail, /inflow 20d after statedAt 2026-09-10T10:00:00\.000Z, beyond the 14d window/);
  // The authorized date, when not before statedAt, may shorten the distance and is named.
  const auth = run({}, { date: '2026-09-20', authorized_date: '2026-09-12' });
  assert.match(auth.proposals[0].rationale, /date: txn authorized_date 2d after statedAt/);
});

test('same inputs twice → identical ordered output (determinism); ordering is confidence desc, then transactionId, then moneyEventId', () => {
  const refunds: MatcherRefundEvent[] = [EVENT, { ...EVENT, id: 'me_0', amountCents: null }];
  const transactions: MatcherTransaction[] = [{ ...INFLOW, id: 't_b' }, { ...INFLOW, id: 't_a' }];
  const a = proposeRefundMatches({ refunds, transactions, accountCurrency: 'USD', opts: OPTS });
  const b = proposeRefundMatches({ refunds: [...refunds].reverse(), transactions: [...transactions].reverse(), accountCurrency: 'USD', opts: OPTS });
  assert.deepEqual(a, b);
  assert.deepEqual(a.proposals.map((p) => [p.transactionId, p.moneyEventId, p.confidence]), [['t_a', 'me_1', 0.893], ['t_b', 'me_1', 0.893], ['t_a', 'me_0', 0.786], ['t_b', 'me_0', 0.786]]);
});

test('the outflow pass is byte-identical: main’s code half is the prefix of the file, by hash; proposeMatches still proposes outflows only', () => {
  const src = code(MATCHER);
  // Everything main held — the outflow pass and its helpers — is the prefix of the file, byte for byte.
  const prefix = src.slice(0, MAIN_MATCHER_CODE_LENGTH);
  assert.equal(createHash('sha256').update(prefix).digest('hex'), MAIN_MATCHER_CODE_SHA256, 'the outflow pass moved — MATCH-02 only appends after it');
  assert.ok(src.indexOf('export const MATCH_REFUND_DATE_WINDOW_DAYS') >= MAIN_MATCHER_CODE_LENGTH, 'the refund section comes after it');
  assert.ok(src.includes('if (!(t.amount > 0)) continue;'));
  const out = proposeMatches({
    reservations: [{ id: 'res_1', finalPriceCents: 25000, currency: 'USD', provider: 'liteapi', hotelName: 'Hotel Temple', createdAt: '2026-09-01' }],
    transactions: [{ id: 't_out', amount: 250, date: '2026-09-02', name: 'NUITEE*HOTEL TEMPLE' }, INFLOW],
    opts: { amountTolerancePct: 0.05, dateWindowDays: 5 },
  });
  assert.deepEqual(out.map((p) => p.transactionId), ['t_out'], 'the inflow is not an outflow candidate');
  // The pure files stay pure.
  for (const f of [MATCHER, WORDS]) {
    const s = code(f);
    for (const impure of [/\bfetch\s*\(/, /process\.env/, /new Date\s*\(\s*\)|Date\.now\s*\(/, /prisma|PrismaClient/, /from 'react'/]) assert.ok(!impure.test(s), `${f} pure (${impure})`);
  }
  assert.match(comments(MATCHER), /ASSUMPTION, NOT A VENDOR FACT/, 'the 14-day window is named as an assumption');
  assert.equal(MATCH_REFUND_DATE_WINDOW_DAYS, 14);
});

// ── the writer ───────────────────────────────────────────────────────────────

test('commitPlaidTransaction with a charge document on an inflow → refused by name before any lookup', async () => {
  const touched: string[] = [];
  const untouchable = new Proxy({}, {
    get: (_t, prop) => {
      touched.push(String(prop));
      throw new Error(`the database was touched (${String(prop)}) before the refusal`);
    },
  }) as unknown as PrismaClient;
  await assert.rejects(
    commitPlaidTransaction(untouchable, {
      userId: 'u', entityId: 'e', transactionId: 'plaid_in', accountCode: 'P-9200', bankAccountCode: 'P-1000',
      date: new Date('2026-09-15'), amount: -250, description: 'REFUND', document: { reservationId: 'res_1', moneyEventId: null },
    }),
    (err: unknown) => err instanceof ValidationError && /^MATCH-02 a charge document needs an outflow: transaction plaid_in has Plaid amount -250 \(money came in\), so it cannot document the charge of booking res_1/.test(err.message),
  );
  assert.deepEqual(touched, [], 'nothing was read');
  const w = code(WRITER);
  const body = w.slice(w.indexOf('export async function commitPlaidTransaction('));
  assert.ok(body.indexOf('if (document && document.moneyEventId === null && amount < 0) {') < body.indexOf('postJournal(prisma, async (tx, post)'), 'before the transaction opens');
});

// ── the routes, read from source ─────────────────────────────────────────────

test('the propose route: the outflow pass untouched; inflows (amount < 0) from the earliest statement, user-scoped; refund events through reservations.userId; per account currency; claimed inflows excluded; proposals persist with moneyEventId; nothing accepted', () => {
  const r = code(PROPOSE);
  assert.ok(r.includes('amount: { gt: 0 },') && r.includes('proposeMatches({'), 'the outflow pass');
  assert.ok(r.includes("where: { kind: 'refund', status: 'stated', reservation: { userId: user.id } },"), 'the guest fence');
  assert.match(r, /amount: \{ lt: 0 \},\s*date: \{ gte: earliestStatedAt \},\s*accounts: \{ userId: user\.id \},/);
  assert.ok(r.includes('accounts: { select: { isoCurrencyCode: true } }'), 'the account currency');
  assert.ok(r.includes('excludeTransactionIds: claimed,'));
  assert.ok(r.includes('moneyEventId: p.moneyEventId,'));
  assert.ok(r.includes("where: { status: 'accepted', moneyEventId: null },"), 'the accepted charge link for the descriptor');
  assert.ok(!/data:\s*\{[^}]*status:\s*'(accepted|settled)'/.test(r), 'proposing never accepts or settles');
  assert.ok(r.includes('refunds,'), 'the refund pass is counted apart in the response');
  assert.ok(r.indexOf('proposeRefundMatches({') > r.indexOf('for (const r of toRefresh) {'), 'after the outflow pass, not inside it');
});

test('the queue carries moneyEventId and the event’s kind, amount, currency, statedAt and destination', () => {
  const q = code(QUEUE);
  assert.ok(q.includes('select: { kind: true, amountCents: true, currency: true, statedAt: true, refundDestination: true },'));
  assert.ok(q.includes('moneyEventId: l.moneyEventId,') && q.includes('moneyEvent: l.moneyEvent,'));
});

test('the review route: accept with moneyEventId settles the event in the same transaction with its evidence; already settled → 409 by name; reject changes nothing; the only writer of settled', () => {
  const r = code(REVIEW);
  assert.ok(r.includes("const settles = action === 'accept' && link.moneyEventId !== null;"), 'only an ACCEPT of a refund link settles');
  const tx = r.indexOf('prisma.$transaction(async (tx) =>');
  const settle = r.indexOf("data: { status: 'settled', settledTransactionId: link.transactionId, settledAt: reviewedAt },");
  const flip = r.indexOf('tx.transaction_reservation_links.update(');
  assert.ok(tx > 0 && settle > tx && flip > settle, 'settle, then flip, inside one transaction');
  assert.ok(r.includes("where: { id: event.id, status: 'stated' },"), 'the status guard on the write');
  assert.match(r, /if \(event\.status !== 'stated'\) \{\s*throw new ValidationError\(\s*`MATCH-02 money event \$\{event\.id\} is already \$\{event\.status\}[\s\S]{0,200}?\{ status: 409 \}/);
  assert.match(r, /if \(settled\.count !== 1\) \{\s*throw new ValidationError\([^)]*a refund settles once`, \{ status: 409 \}\)/);
  assert.ok(r.includes('moneyEventId: true'), 'the link’s money event is read');
  // The only writer of 'settled' under src.
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !p.includes('__tests__') ? [p] : []; });
  const writers = walk('src').filter((f) => /status:\s*'settled'/.test(code(f)));
  assert.deepEqual(writers, [REVIEW]);
});

test('the component renders a refund proposal as a refund in the leaf’s words, and a charge proposal as before', () => {
  const ui = code(REVIEW_UI);
  assert.ok(ui.includes('refundProposalLine(resLabel, refund)'));
  assert.ok(ui.includes("data-match-kind={refund ? 'refund' : 'charge'}"));
  for (const typed of ["'Refund", '"Refund', '`Refund', 'vendor stated']) assert.ok(!ui.includes(typed), `types nothing (${typed})`);
  assert.match(ui, /q\.reservation\.finalPriceCents === null\s*\? 'price not stated'/, 'the charge row is as it was (SEC-03)');
  assert.ok(ui.includes('moneyEvent: RefundProposalEvent | null;'));
  assert.equal(refundProposalLine('Hotel Temple', { kind: 'refund', amountCents: 25000, currency: 'USD', statedAt: '2026-09-10T10:00:00.000Z', refundDestination: null }), 'Refund of Hotel Temple: vendor stated 250.00 USD on 2026-09-10');
  assert.equal(refundProposalLine('flight booking FH-269', { kind: 'refund', amountCents: null, currency: null, statedAt: new Date('2026-09-10T23:59:59Z'), refundDestination: 'original_payment' }), 'Refund of flight booking FH-269: vendor stated no amount stated on 2026-09-10');
  assert.equal(statedRefundAmount({ amountCents: 1234, currency: null }), '12.34', 'no currency stated → the figure alone, never a guessed currency');
});

// ── the migration and the schema ─────────────────────────────────────────────

test('the migration: settledTransactionId + settledAt nullable, the CHECK (settled ⇔ evidence), the evidence FK RESTRICT, the index; the schema moves with it; nothing defaulted or backfilled', () => {
  const m = code(MIGRATION);
  assert.ok(m.includes('ALTER TABLE "money_events" ADD COLUMN "settledTransactionId" TEXT;'));
  assert.ok(m.includes('ALTER TABLE "money_events" ADD COLUMN "settledAt" TIMESTAMPTZ(6);'));
  assert.ok(m.includes('CHECK (("status" = \'settled\') = ("settledTransactionId" IS NOT NULL));'));
  assert.ok(m.includes('FOREIGN KEY ("settledTransactionId") REFERENCES "transactions"("id")\n    ON DELETE RESTRICT ON UPDATE CASCADE;'));
  assert.ok(m.includes('CREATE INDEX "money_events_settledTransactionId_idx" ON "money_events"("settledTransactionId");'));
  assert.ok(!/DEFAULT|UPDATE "money_events"|ADD COLUMN[^;]*NOT NULL/.test(m));
  assert.match(comments(MIGRATION), /settled means evidence, and evidence means settled/);
  const s = code('prisma/schema.prisma');
  assert.ok(s.includes('settledTransactionId String?') && s.includes('settledAt         DateTime? @db.Timestamptz(6)'));
  assert.ok(s.includes('settledTransaction transactions? @relation("money_event_settlement", fields: [settledTransactionId], references: [id], onDelete: Restrict, onUpdate: Cascade)'));
  assert.ok(s.includes('settled_money_events               money_events[] @relation("money_event_settlement")'));
  assert.ok(s.includes('@@index([settledTransactionId])'));
});
