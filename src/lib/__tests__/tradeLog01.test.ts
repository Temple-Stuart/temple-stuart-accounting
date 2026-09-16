import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildManualTrade, type ManualTradeInput } from '../tradeLog/manualTrade';
import { openCostBasisCents, closeProceedsCents, realizedPlCents, proportionalCostCents, positionTypeOf, OPTION_MULTIPLIER } from '../tradeLog/optionPnl';
import { positionOwnershipWhere, ownsPosition, ownsEveryLeg, isManualSource, MANUAL_SOURCE, MANUAL_BADGE, SELF_REPORTED_BIAS_NOTE } from '../tradeLog/ownership';
import { AVAILABLE_STRATEGIES } from '../convergence/filter-types';
import { countUndefinedRiskPositions, checkUndefinedRiskCap, UNDEFINED_RISK_OPEN_POSITION_CAP, type OpenOptionPosition } from '../convergence/undefined-risk';
import { buildReport, secondaryBookReport, bucketKey, classifyTicket, type Ticket, type ClosedTrade, type TicketPositionLeg } from '../edge-read/report';
import { honestFrame } from '../edge-read/frame';

/**
 * TRADE-LOG-01 — A TRADE CAN BE LOGGED BY HAND.
 *
 * The tradeSplit.test.ts idiom: a source read strips comment lines first, so a
 * citation written in a comment can never satisfy an assertion about the code.
 */
const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

const MANUAL_ROUTE = 'src/app/api/trade-log/manual/route.ts';
const TRACKER = 'src/lib/position-tracker-service.ts';
const LINK_ROUTE = 'src/app/api/trade-card-links/route.ts';
const BOOKS_COMMIT = 'src/app/api/trading/commit-to-ledger/route.ts';
const TRADES_ROUTE = 'src/app/api/trading/trades/route.ts';
const FORM = 'src/components/trading/LogTradeForm.tsx';
const TRADE_LOG_PAGE = 'src/app/trade-log/page.tsx';
const EDGE_READ = 'scripts/edge-read.ts';
const UNDEFINED_RISK_PRISMA = 'src/lib/convergence/undefined-risk.prisma.ts';

const USER_A = 'user-a';
const USER_B = 'user-b';

/** A two-leg SPY put credit spread, closed — the walk's own trade. */
const CREDIT_SPREAD: ManualTradeInput = {
  symbol: 'spy',
  strategy: 'Put Credit Spread',
  openDate: '2026-08-01',
  closeDate: '2026-08-20',
  legs: [
    { side: 'sell', optionType: 'PUT', strike: 540, expiry: '2026-09-18', quantity: 1, openPrice: 4.20, openFees: 1.30, closePrice: 1.10, closeFees: 1.30 },
    { side: 'buy', optionType: 'PUT', strike: 530, expiry: '2026-09-18', quantity: 1, openPrice: 2.10, openFees: 1.30, closePrice: 0.40, closeFees: 1.30 },
  ],
};

const build = (input: ManualTradeInput, tradeNum = 'SPY-0001', userId = USER_A) =>
  buildManualTrade(input, userId, tradeNum, AVAILABLE_STRATEGIES);

// ───────────────────────────────────────────────────────────────────────────
// 1. A hand-entered multi-leg closed trade is ONE trade with the right
//    realized_pl, and the number comes from the SHARED path.
// ───────────────────────────────────────────────────────────────────────────
test('a hand-entered multi-leg closed trade produces one trade whose realized_pl comes from the synced close\'s own code path', () => {
  const built = build(CREDIT_SPREAD);
  assert.equal(built.ok, true);
  if (!built.ok) return;

  // ONE trade: one trade_num over both legs, same grouping a synced trade uses.
  assert.equal(built.rows.length, 2);
  assert.deepEqual([...new Set(built.rows.map((r) => r.trade_num))], ['SPY-0001']);
  assert.equal(built.closed, true);

  // The arithmetic, recomputed leg by leg from the SAME leaf the tracker calls.
  let expected = 0;
  for (const leg of CREDIT_SPREAD.legs) {
    const positionType = positionTypeOf(leg.side);
    const costCents = openCostBasisCents({ action: leg.side, price: leg.openPrice, quantity: leg.quantity, fees: leg.openFees });
    const proceedsCents = closeProceedsCents({
      action: leg.side === 'buy' ? 'sell' : 'buy',
      price: leg.closePrice as number, quantity: leg.quantity, fees: leg.closeFees as number,
    });
    const originalCents = proportionalCostCents({ closeQty: leg.quantity, positionQty: leg.quantity, costBasis: costCents / 100 });
    expected += realizedPlCents({ positionType, proceedsCents, originalCostCents: originalCents }) / 100;
  }
  assert.equal(built.realizedPl, Math.round(expected * 100) / 100);
  assert.equal(built.rows.reduce((s, r) => s + (r.realized_pl ?? 0), 0).toFixed(2), expected.toFixed(2));

  // The short leg took in a credit and bought it back cheaper — a winner; the
  // long leg lost. Signs are the tracker's, not re-derived here.
  assert.equal(built.rows[0].position_type, 'SHORT');
  assert.equal(built.rows[1].position_type, 'LONG');
  assert.ok((built.rows[0].realized_pl as number) > 0);
  assert.ok((built.rows[1].realized_pl as number) < 0);
  assert.equal(OPTION_MULTIPLIER, 100);

  // REUSE, NOT RETYPE: the synced close calls the same leaf, so the two paths
  // cannot drift. The tracker holds no multiplier arithmetic of its own.
  const tracker = code(TRACKER);
  assert.match(tracker, /from '@\/lib\/tradeLog\/optionPnl'/);
  for (const fn of ['openCostBasisCents', 'closeProceedsCents', 'realizedPlCents', 'proportionalCostCents']) {
    assert.ok(tracker.includes(fn), `position-tracker-service must call ${fn} — the manual path uses the same one`);
  }
  const manual = code('src/lib/tradeLog/manualTrade.ts');
  assert.match(manual, /from '\.\/optionPnl'/);
});

test('every column a reader needs is filled, and a CLOSED leg is never handed over with a null realized_pl', () => {
  const built = build(CREDIT_SPREAD);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  for (const r of built.rows) {
    // trade-card-links sums realized_pl and proceeds; commit-to-ledger reads
    // cost_basis, proceeds, realized_pl, symbol, strategy and the dates.
    assert.equal(r.status, 'CLOSED');
    assert.notEqual(r.realized_pl, null);
    assert.notEqual(r.proceeds, null);
    assert.notEqual(r.close_date, null);
    assert.equal(typeof r.cost_basis, 'number');
    assert.equal(r.symbol, 'SPY');
    assert.equal(r.strategy, 'Put Credit Spread');
    assert.equal(r.source, MANUAL_SOURCE);
    assert.equal(r.userId, USER_A);
    // No arrival exists behind a hand-entered row, and none is invented.
    assert.equal(r.open_investment_txn_id, null);
    assert.equal(r.close_investment_txn_id, null);
    assert.equal(r.remaining_quantity, 0);
  }
});

test('nothing is defaulted — a missing price, date, quantity or fee is refused by name, never filled in', () => {
  const missing: Array<[string, ManualTradeInput, RegExp]> = [
    ['no symbol', { ...CREDIT_SPREAD, symbol: '' }, /symbol is required/i],
    ['no open date', { ...CREDIT_SPREAD, openDate: '' }, /open date/i],
    ['no legs', { ...CREDIT_SPREAD, legs: [] }, /at least one leg/i],
    ['no quantity', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], quantity: undefined as unknown as number }] }, /quantity/i],
    ['no open price', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], openPrice: undefined as unknown as number }] }, /open price/i],
    ['no open fee', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], openFees: undefined as unknown as number }] }, /open fee/i],
    ['no close price on a closing trade', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], closePrice: null }] }, /close price is required/i],
    ['no close fee on a closing trade', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], closeFees: null }] }, /close fee/i],
    ['a close price with no close date', { ...CREDIT_SPREAD, closeDate: null }, /close price was given with no close date/i],
    ['a strike of zero', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], strike: 0 }] }, /strike/i],
    ['no expiry', { ...CREDIT_SPREAD, legs: [{ ...CREDIT_SPREAD.legs[0], expiry: '' }] }, /expiry/i],
    ['a close date before the open date', { ...CREDIT_SPREAD, closeDate: '2026-07-01' }, /before the open date/i],
  ];
  for (const [what, input, reason] of missing) {
    const r = build(input);
    assert.equal(r.ok, false, `${what} must be refused, never defaulted`);
    if (!r.ok) assert.match(r.reason, reason, what);
  }
});

test('the strategy is the builders\' own const — never free text', () => {
  const r = build({ ...CREDIT_SPREAD, strategy: 'Reverse Jade Lizard' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /Strategy must be one the scanner builds/);
  for (const s of AVAILABLE_STRATEGIES) {
    assert.equal(build({ ...CREDIT_SPREAD, strategy: s }).ok, true, `${s} is a strategy the scanner builds`);
  }
  // The form renders THAT const and offers no other way to type one.
  const form = code(FORM);
  assert.match(form, /import \{ AVAILABLE_STRATEGIES \} from '@\/lib\/convergence\/filter-types'/);
  assert.match(form, /AVAILABLE_STRATEGIES\.map\(\(s\) => <option/);
  assert.equal(/<input[^>]*strategy/i.test(form), false, 'strategy is a select over the const, never a text input');
  // And the route validates against the same const server-side.
  assert.match(code(MANUAL_ROUTE), /AVAILABLE_STRATEGIES/);
});

// ───────────────────────────────────────────────────────────────────────────
// 2. It links to a card, grades and posts to Books exactly as a synced one.
// ───────────────────────────────────────────────────────────────────────────
test('a hand-entered trade links, grades and posts to Books exactly as a synced one — no reader branches on source for capability', () => {
  const built = build(CREDIT_SPREAD);
  assert.equal(built.ok, true);
  if (!built.ok) return;

  // The link route's own grading arithmetic, over the built rows: all CLOSED,
  // so it computes actual_pl from realized_pl and exit from proceeds.
  const positions = built.rows;
  assert.equal(positions.every((p) => p.status === 'CLOSED'), true);
  const totalPl = positions.reduce((s, p) => s + (p.realized_pl ?? 0), 0);
  const totalProceeds = positions.reduce((s, p) => s + (p.proceeds ?? 0), 0);
  assert.equal(Math.round(totalPl * 100) / 100, built.realizedPl);
  assert.equal(Number.isFinite(totalProceeds / positions.length), true);

  // Every reader scopes by OWNERSHIP, which is provenance-blind.
  for (const f of [LINK_ROUTE, 'src/app/api/trading/route.ts', 'src/app/api/trading-positions/open/route.ts', 'src/app/api/trading/coverage/route.ts', 'src/app/api/positions/summary/route.ts', UNDEFINED_RISK_PRISMA]) {
    assert.match(code(f), /positionOwnershipWhere\(/, `${f} must scope through the one ownership predicate`);
  }
  assert.match(code(BOOKS_COMMIT), /ownsEveryLeg\(/);

  // AND none of them makes a row's CAPABILITY depend on where it came from.
  // The manual writer is the one place `source` is a filter — it is the writer
  // of manual rows and may not touch a broker's record; /api/trading/trades
  // reads the manual legs as their own group because they have no arrival.
  const capabilityReaders = [LINK_ROUTE, 'src/app/api/trading/route.ts', 'src/app/api/trading-positions/open/route.ts', 'src/app/api/trading/coverage/route.ts', 'src/app/api/positions/summary/route.ts', BOOKS_COMMIT, UNDEFINED_RISK_PRISMA];
  for (const f of capabilityReaders) {
    assert.equal(/source:\s*MANUAL_SOURCE|source:\s*'manual'|isManualSource\(/.test(code(f)), false,
      `${f} must not branch on source — provenance is display and the read's split, never capability`);
  }
});

test('the record read unions hand-entered trades, and every trade declares its provenance', () => {
  const trades = code(TRADES_ROUTE);
  // /api/trading/trades builds from investment_transactions; a hand-entered
  // trade has no arrival, so it is read from trading_positions and grouped by
  // trade_num the same way.
  assert.match(trades, /source: MANUAL_SOURCE/);
  assert.match(trades, /manualTrades/);
  assert.match(trades, /handEntered: true/);
  // Every other shape declares itself too — provenance is never absent.
  assert.equal((trades.match(/handEntered: false/g) ?? []).length, 3,
    'the option, legacy-option and stock shapes each declare handEntered: false');
});

// ───────────────────────────────────────────────────────────────────────────
// 3. A second user cannot read, edit or delete it.
// ───────────────────────────────────────────────────────────────────────────
test('a second user cannot read, correct or delete another user\'s hand-entered trade', () => {
  const built = build(CREDIT_SPREAD);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const row = built.rows[0];

  // The predicate: A's hand-entered row is A's and nobody else's, even when B
  // has arrivals of their own.
  assert.equal(ownsPosition(row, USER_A, []), true);
  assert.equal(ownsPosition(row, USER_B, []), false);
  assert.equal(ownsPosition(row, USER_B, ['txn-b-1', 'txn-b-2']), false);
  assert.equal(ownsEveryLeg(built.rows, USER_A, []), true);
  assert.equal(ownsEveryLeg(built.rows, USER_B, []), false);

  // An empty arrival set never widens the read — it is an `in: []`, not "all".
  const where = positionOwnershipWhere(USER_B, []);
  assert.deepEqual(where, { OR: [{ userId: USER_B }, { open_investment_txn_id: { in: [] } }] });

  // A leg with neither an owner nor an arrival belongs to nobody.
  assert.equal(ownsPosition({ userId: null, open_investment_txn_id: null }, USER_A, []), false);
  assert.equal(ownsEveryLeg([], USER_A, []), false);

  // And the route carries userId on EVERY read and EVERY write — including
  // the correction's delete half, which is the one that could reach furthest.
  const route = code(MANUAL_ROUTE);
  // Every trading_positions statement that names a trade_num — the GET's read,
  // the PATCH's read, its deleteMany, and the DELETE's read and deleteMany.
  const scoped = route.match(/trading_positions\.\w+\(\{\s*\n?\s*where: \{[^}]*trade_num: tradeNum[^}]*\}/g) ?? [];
  assert.ok(scoped.length >= 5, `the GET, PATCH and DELETE all scope every trading_positions statement by trade_num (found ${scoped.length})`);
  for (const w of scoped) {
    assert.match(w, /userId: user\.id/, `a trade_num lookup without userId is a cross-user read: ${w}`);
    assert.match(w, /source: MANUAL_SOURCE/, `a write must not reach a synced row: ${w}`);
  }
  for (const verb of ['GET', 'POST', 'PATCH', 'DELETE']) {
    assert.match(route, new RegExp(`export async function ${verb}`));
  }
  assert.equal((route.match(/if \(!user\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/g) ?? []).length, 4,
    'all four verbs answer 401 before touching the store');
});

// ───────────────────────────────────────────────────────────────────────────
// 4. A delete that would orphan a trade_card_link is refused with its reason.
// ───────────────────────────────────────────────────────────────────────────
test('a delete that would orphan a linked card is refused with its reason — never a silent cascade', () => {
  const route = code(MANUAL_ROUTE);
  // The link is looked up BEFORE anything is deleted, and the refusal names it.
  const del = route.slice(route.indexOf('export async function DELETE'));
  const linkAt = del.indexOf('trade_card_links.findFirst');
  const deleteAt = del.indexOf('trading_positions.deleteMany');
  assert.ok(linkAt > -1 && deleteAt > -1);
  assert.ok(linkAt < deleteAt, 'the linked-card check must come before the delete');
  assert.match(del, /status: 409/);
  assert.match(del, /linked_card_id/);
  assert.match(del, /Unlink the card first/);
  // The link is scoped to the caller's own cards, and never deleted for them.
  assert.match(del, /trade_card: \{ userId: user\.id \}/);
  assert.equal(/trade_card_links\.delete|cascade|onDelete/i.test(del), false, 'no cascade — the caller decides');
  // The page shows the refusal rather than swallowing it.
  const page = code(TRADE_LOG_PAGE);
  assert.match(page, /data-delete-refusal/);
  assert.match(page, /setDeleteRefusal\(data\?\.error/);
});

// ───────────────────────────────────────────────────────────────────────────
// 5. edge-read splits by source.
// ───────────────────────────────────────────────────────────────────────────
const posLeg = (over: Partial<TicketPositionLeg> = {}): TicketPositionLeg => ({
  positionType: 'SHORT', openPrice: 4.2, quantity: 1,
  openDate: new Date('2026-08-01T00:00:00Z'), expirationDate: new Date('2026-09-18T00:00:00Z'),
  closeDate: new Date('2026-08-20T00:00:00Z'), status: 'CLOSED', strategyRaw: 'put-credit-spread', ...over,
});

const ticket = (id: number, over: Partial<Ticket> = {}): Ticket => ({
  id: `t${id}`, symbol: 'SPY', generatedAt: new Date('2026-08-01T00:00:00Z'),
  cardStrategyRaw: 'Put Credit Spread', cardLegs: [{ side: 'sell', price: 4.2 }],
  cardExpirationDate: new Date('2026-09-18T00:00:00Z'), positionLegs: [posLeg()],
  compositeScore: 70, volEdgeScore: 70, qualityScore: 70, regimeScore: 70, infoEdgeScore: 70,
  predictedWinRatePct: 70, maxLoss: 600, actualPl: 120, grade: 'B', snapshot: null, ...over,
});

test('edge-read splits every bucket by source — a hand-entered trade is never read as a synced one', () => {
  // The primary book: the split is one more bucket dimension.
  const synced = ticket(1, { split: 'SYNCED' });
  const hand = ticket(2, { split: 'HAND-ENTERED' });
  assert.equal(bucketKey(classifyTicket(synced)), 'SELL × SELL-DEFINED × E6 × SYNCED');
  assert.equal(bucketKey(classifyTicket(hand)), 'SELL × SELL-DEFINED × E6 × HAND-ENTERED');
  const report = buildReport([synced, hand]);
  assert.deepEqual(report.buckets.map((b) => b.key).sort(),
    ['SELL × SELL-DEFINED × E6 × HAND-ENTERED', 'SELL × SELL-DEFINED × E6 × SYNCED']);

  // The secondary book too — every CLOSED trade, split the same way.
  const closed = (tradeNum: string, split: string): ClosedTrade => ({ tradeNum, legs: [posLeg()], realizedPl: 120, linked: false, split });
  const lines = secondaryBookReport([closed('SPY-0001', 'HAND-ENTERED'), closed('2', 'SYNCED')]).join('\n');
  assert.match(lines, /BUCKET SELL × SELL-DEFINED × E6 × HAND-ENTERED/);
  assert.match(lines, /BUCKET SELL × SELL-DEFINED × E6 × SYNCED/);

  // And the script itself declares the split, from the ownership leaf's own
  // predicate — never a second spelling of 'manual'.
  const script = code(EDGE_READ);
  assert.match(script, /positionOwnershipWhere\(user\.id, txnIds\)/);
  assert.match(script, /isManualSource\(/);
  assert.match(script, /'HAND-ENTERED'/);
  assert.match(script, /'MIXED-SOURCE'/);
  assert.match(script, /split: sourceSplit\(legs\)/);
  assert.equal(/source:\s*'manual'/.test(script), false, 'the script asks the leaf, it does not retype the value');
});

test('the honest frame names the self-reported bias in the leaf\'s own words', () => {
  const f = honestFrame().join('\n');
  assert.ok(f.includes(SELF_REPORTED_BIAS_NOTE));
  assert.match(f, /Self-reported entry/);
  assert.match(f, /Four biases/);
  assert.equal(isManualSource('manual'), true);
  assert.equal(isManualSource('MANUAL'), true);
  assert.equal(isManualSource('plaid'), false);
  assert.equal(isManualSource(null), false);
});

// ───────────────────────────────────────────────────────────────────────────
// 6. An OPEN hand-entered trade counts against the undefined-risk cap.
// ───────────────────────────────────────────────────────────────────────────
test('an open hand-entered trade counts against MODEL-01\'s undefined-risk cap — the cap is about risk, not provenance', () => {
  const strangle: ManualTradeInput = {
    symbol: 'TSLA',
    strategy: 'Short Strangle',
    openDate: '2026-08-01',
    legs: [
      { side: 'sell', optionType: 'CALL', strike: 300, expiry: '2026-09-18', quantity: 1, openPrice: 5.10, openFees: 1.30 },
      { side: 'sell', optionType: 'PUT', strike: 220, expiry: '2026-09-18', quantity: 1, openPrice: 4.80, openFees: 1.30 },
    ],
  };
  const built = build(strangle, 'TSLA-0002');
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.closed, false);
  assert.equal(built.realizedPl, null);
  assert.equal(built.rows.every((r) => r.status === 'OPEN' && r.realized_pl === null && r.remaining_quantity === r.quantity), true);

  // Two naked shorts, no long of the same symbol/type/expiry behind either.
  const count = countUndefinedRiskPositions(built.rows as unknown as OpenOptionPosition[]);
  assert.equal(count, 2);
  const check = checkUndefinedRiskCap(true, count);
  assert.equal(check.allowed, false);
  assert.match(check.reason, new RegExp(`≥ cap ${UNDEFINED_RISK_OPEN_POSITION_CAP}`));

  // A defined-risk hand-entered spread does NOT count: the long covers the short.
  const openSpread = build({ ...CREDIT_SPREAD, closeDate: null, legs: CREDIT_SPREAD.legs.map((l) => ({ ...l, closePrice: null, closeFees: null })) });
  assert.equal(openSpread.ok, true);
  if (!openSpread.ok) return;
  assert.equal(countUndefinedRiskPositions(openSpread.rows as unknown as OpenOptionPosition[]), 0);

  // And the loader that feeds the cap reaches hand-entered rows at all.
  const loader = code(UNDEFINED_RISK_PRISMA);
  assert.match(loader, /positionOwnershipWhere\(userId, arrivalTxnIds\)/);
  assert.equal(/source/.test(loader), false, 'the cap never filters on provenance');
});

// ───────────────────────────────────────────────────────────────────────────
// Provenance is VISIBLE.
// ───────────────────────────────────────────────────────────────────────────
test('the positions list and the P&L calendar mark a hand-entered trade', () => {
  const page = code(TRADE_LOG_PAGE);
  assert.match(page, /data-hand-entered/);
  assert.match(page, /trade\.handEntered &&/);
  assert.match(page, /\{MANUAL_BADGE\}/);
  // The calendar's day detail says it too.
  assert.match(page, /t\.handEntered \? ` · \$\{MANUAL_BADGE\}` : ''/);
  // The correction and the delete are offered ONLY on a hand-entered trade.
  assert.match(page, /data-correct-trade/);
  assert.match(page, /data-delete-trade/);
  assert.equal(MANUAL_BADGE, 'hand-entered');
});

test('the form asks for every column it cannot derive, and computes no P&L of its own', () => {
  const form = code(FORM);
  for (const field of ['symbol', 'strategy', 'strike', 'expiry', 'quantity', 'openPrice', 'openFees', 'closePrice', 'closeFees']) {
    assert.ok(form.includes(field), `the form must ask for ${field}`);
  }
  assert.match(form, /openDate/);
  assert.match(form, /closeDate/);
  // An empty box is NOT a zero — that is the whole no-defaulting rule, in one
  // function, and the form never posts Number('') as a price.
  assert.match(form, /if \(s === ''\) return undefined;/);
  // No arithmetic here: realized P&L is the server's, from the shared path.
  assert.equal(/realizedPl\s*=|realized_pl\s*=/.test(form), false, 'the form computes no P&L');
  assert.match(form, /'\/api\/trade-log\/manual'/);
  // The refusal is shown in the server's own words.
  assert.match(form, /setRefusal\(data\?\.error/);
  assert.match(form, /data-log-trade-refusal/);
});
