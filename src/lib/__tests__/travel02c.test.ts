/**
 * TRAVEL-02c (Alex, 2026-11-03, rulings 0 and A–H) — a stay's cost per day against the LA baseline: any charge linked
 * by hand to the stay it paid for (a seventh planned_item_links kind, 'stay'), the books' own figures over the stay's
 * days beside a dated, frozen baseline (living_baselines) — calculated, rounded once, every figure opening to its lines.
 *
 * The leaves (src/lib/operations/stayCosts.ts, src/lib/travel/livingBaseline.ts) are pure and driven over the fixtures
 * below — every expected figure is written out from integer arithmetic (BigInt), never from the leaf. The migration, the
 * schema, the routes, the links route, the stays DELETE, the screen and the laws are read through code() / comments()
 * (the reader law). H (2026-11-03 — a line-number pin across two threads broke main): no pin here names a line number
 * of any file; every pin finds its line by content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { LINKABLE_KINDS, isLinkableKind, requiresInstant, targetOwnerQuery } from '../calendar/linkKeys';
import { AMOUNT_REQUIRED_WORDS, amountNotWholeWords } from '../travel/travelExpense';
import {
  BASELINE_LIVE_WORDS, EVEN_WORDS, NO_CHARGE_WORDS, REVERSED_PAYS_NOTHING_WORDS, STAYS_COST_HEADING, STAY_COST_COLUMNS, STAY_COST_TABLE,
  baselineInForce, baselineViewsOf, chargesWords, divideRoundedOnce, noBaselineWords, notComparedWords, notComputedWords, stayCostOf, stayCostsOf,
  stayHoldsLinksWords, stayLinksWhere, stayWords, type LivingBaselineRow, type StayPostingIn,
} from '../operations/stayCosts';
import { tableCsv } from '../table/csv';
import {
  BASELINE_CURRENCY_REQUIRED_WORDS, BASELINE_NOT_AN_OBJECT_WORDS, BASELINE_REASON_REQUIRED_WORDS, EFFECTIVE_FROM_REQUIRED_WORDS, LABEL_BLANK_WORDS,
  LABEL_CONTROL_WORDS, LABEL_REQUIRED_WORDS, MONTHLY_REQUIRED_WORDS, baselineAlreadyVoidedWords, baselineCurrencyNotACodeWords, baselineVoidBodyRule,
  baselineVoidStateRule, effectiveFromNotADayWords, labelTooLongWords, livingBaselineBodyRule, monthlyNotAboveZeroWords, monthlyNotWholeWords,
  monthlyTooLargeWords, sameDayLiveBaselineWords, unknownBaselineFieldWords, unknownBaselineVoidFieldWords,
} from '../travel/livingBaseline';

const MIGRATION = 'prisma/migrations/20261103200000_travel_02c_stay_link_living_baselines/migration.sql';
const SCHEMA = 'prisma/schema.prisma';
const LEAF = 'src/lib/operations/stayCosts.ts';
const RULES = 'src/lib/travel/livingBaseline.ts';
const BASELINES_ROUTE = 'src/app/api/living-baselines/route.ts';
const VOID_ROUTE = 'src/app/api/living-baselines/[id]/void/route.ts';
const COSTS_ROUTE = 'src/app/api/operations/stays/costs/route.ts';
const STAY_ID_ROUTE = 'src/app/api/operations/stays/[id]/route.ts';
const LINKS = 'src/app/api/calendar/links/route.ts';
const LINK_KEYS = 'src/lib/calendar/linkKeys.ts';
const EXPENSE_RULES = 'src/lib/travel/travelExpense.ts';
const VIEW = 'src/components/trips/StayCosts.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SELF = 'src/lib/__tests__/travel02c.test.ts';

const B = (n: number): bigint => BigInt(n);
/** n ÷ d rounded half away from zero, written out here (d > 0) — the expected figure, never the leaf's. */
const roundedOnce = (n: bigint, d: bigint): number => {
  const negative = n < B(0);
  const q = ((negative ? -n : n) * B(2) + d) / (B(2) * d);
  return Number(negative ? -q : q);
};

// ── THE FIXTURES ────────────────────────────────────────────────────────────

const STAY = { id: '00000000-0000-4000-8000-000000000a01', place: 'Chiang Mai, Thailand', starts_on: '2026-10-22', ends_on: '2026-11-19' };
const BANK = { code: '1010', name: 'Chase Checking', entity_id: 'ent-personal' };
const LODGING_ACCOUNT = { code: '6420', name: 'Travel — Lodging', entity_id: 'ent-personal' };
const AIRFARE_ACCOUNT = { code: '6410', name: 'Travel — Airfare', entity_id: 'ent-personal' };

function posting(id: string, day: string, description: string, cents: number, account: { code: string; name: string; entity_id: string }, state: Partial<StayPostingIn> = {}): StayPostingIn {
  return {
    id,
    date: new Date(`${day}T00:00:00.000Z`),
    description,
    status: 'posted',
    is_reversal: false,
    reversed_by_entry_id: null,
    ledger_entries: [
      { entry_type: 'D', amount: B(cents), account },
      { entry_type: 'C', amount: B(cents), account: BANK },
    ],
    ...state,
  };
}

const LODGING = posting('je-lodging', '2026-10-01', 'Airbnb Chiang Mai', 120000, LODGING_ACCOUNT);
const FLIGHT = posting('je-flight', '2026-10-05', 'Thai Airways BKK–CNX', 18950, AIRFARE_ACCOUNT);
const REVERSED = posting('je-reversed', '2026-10-06', 'Duplicate hotel charge', 50000, LODGING_ACCOUNT, { status: 'reversed', reversed_by_entry_id: 'je-reversal' });

function baseline(id: string, label: string, effectiveFrom: string, monthly: number, currency: string, voided: { at: string; reason: string } | null = null): LivingBaselineRow {
  return {
    id, label, effective_from: effectiveFrom, monthly_minor: monthly, currency,
    voided_at: voided === null ? null : voided.at, void_reason: voided === null ? null : voided.reason, created_at: '2026-11-03T12:00:00.000Z',
  };
}
const LA_RENT = baseline('b-la-1', 'LA rent', '2026-01-01', 250000, 'USD');

// ── 0 · ONE WORD FOR THE UNIT ───────────────────────────────────────────────

test('0 item 0 — the travel expense\'s whole-number refusal says hundredths, as AMOUNT_REQUIRED_WORDS declares; the old words are gone', () => {
  assert.equal(amountNotWholeWords(3500.5), 'amount_minor 3500.5 is not a whole number of hundredths');
  assert.equal(amountNotWholeWords('350000'), 'amount_minor "350000" is not a whole number of hundredths');
  assert.match(AMOUNT_REQUIRED_WORDS, /hundredths of the currency/);
  assert.doesNotMatch(code(EXPENSE_RULES), /whole number of minor units/);
  // The living baseline says hundredths from the start.
  assert.equal(monthlyNotWholeWords(2500.5), 'monthly_minor 2500.5 is not a whole number of hundredths');
  assert.match(MONTHLY_REQUIRED_WORDS, /hundredths of the currency/);
});

// ── D · THE LEAF ────────────────────────────────────────────────────────────

test('D the 29-day stay (2026-10-22 → 2026-11-19): TOTAL $1,389.50, PER DAY $47.91 — the baseline $2,500.00 a month, $82.19 a day, $2,383.56 for the stay — under by $994.06; every figure from integers, rounded once', () => {
  const s = stayCostOf(STAY, [FLIGHT, LODGING], [LA_RENT]);
  assert.equal(s.days, 29, 'both ends counted: 10 days of October (22–31) and 19 of November');
  // TOTAL: the two debits, as the books hold them.
  assert.equal(s.totalCents, 120000 + 18950);
  assert.equal(s.totalWords, '$1,389.50');
  // PER DAY: 138950 ÷ 29 = 4791.37… → 4791.
  assert.equal(s.perDayCents, roundedOnce(B(138950), B(29)));
  assert.equal(s.perDayCents, 4791);
  assert.equal(s.perDayWords, '$47.91');
  assert.equal(s.perDayFormula, '$1,389.50 ÷ 29 days');
  // THE BASELINE: 250000 × 12 ÷ 365 = 8219.17… → 8219.
  assert.ok(s.baseline !== null);
  assert.equal(s.baseline.perDayMinor, roundedOnce(B(250000) * B(12), B(365)));
  assert.equal(s.baseline.perDayMinor, 8219);
  assert.equal(s.baseline.perDayWords, '$82.19');
  assert.equal(s.baseline.perDayFormula, '$2,500.00 × 12 ÷ 365');
  assert.equal(s.baselineWords, 'LA rent · $2,500.00 a month · $82.19 a day');
  // FOR THE STAY: 250000 × 12 × 29 ÷ 365 = 238356.16… → 238356 — the product first, ONE division.
  assert.equal(s.forTheStayMinor, roundedOnce(B(250000) * B(12) * B(29), B(365)));
  assert.equal(s.forTheStayMinor, 238356);
  assert.equal(s.forTheStayWords, '$2,383.56');
  assert.equal(s.forTheStayFormula, '$2,500.00 × 12 × 29 days ÷ 365');
  assert.notEqual(s.forTheStayMinor, 8219 * 29, 'never per day × days (that is 238351 — five cents off)');
  // UNDER / OVER: 138950 − 238356 = −99406.
  assert.deepEqual(s.underOver, { kind: 'under', cents: 138950 - 238356, words: 'under by $994.06' });
  // The lines, in date order, and BY ACCOUNT — each debit line's account with its sum.
  assert.deepEqual(s.charges.map((c) => [c.date, c.description, c.accountWords, c.amountWords, c.reversedWords]), [
    ['2026-10-01', 'Airbnb Chiang Mai', '6420 · Travel — Lodging', '$1,200.00', null],
    ['2026-10-05', 'Thai Airways BKK–CNX', '6410 · Travel — Airfare', '$189.50', null],
  ]);
  assert.deepEqual(s.byAccount.map((a) => [a.words, a.cents, a.amountWords]), [
    ['6410 · Travel — Airfare', 18950, '$189.50'],
    ['6420 · Travel — Lodging', 120000, '$1,200.00'],
  ]);
  assert.equal(s.byAccountWords, null, 'BY ACCOUNT sums to TOTAL');
  assert.equal(s.chargesWords, '2 charges');
});

test('D a reversed charge pays nothing: counted out by name — out of TOTAL and BY ACCOUNT, its line marked', () => {
  const s = stayCostOf(STAY, [LODGING, FLIGHT, REVERSED], [LA_RENT]);
  assert.equal(s.totalCents, 138950, 'the reversed $500.00 is not summed');
  assert.equal(s.reversed, 1);
  assert.equal(s.paying, 2);
  assert.equal(s.chargesWords, `2 charges · 1 ${REVERSED_PAYS_NOTHING_WORDS} (counted out)`);
  const line = s.charges.find((c) => c.journalEntryId === 'je-reversed');
  assert.ok(line);
  assert.equal(line.reversed, true);
  assert.equal(line.reversedWords, 'reversed — pays nothing');
  assert.equal(s.byAccount.find((a) => a.words === '6420 · Travel — Lodging')?.cents, 120000);
  assert.deepEqual(s.underOver, { kind: 'under', cents: -99406, words: 'under by $994.06' });
});

test('D a stay with no paying charge: "no charge linked — link the stay\'s lodging and flights" — never a $0 TOTAL; FOR THE STAY still stands', () => {
  const none = stayCostOf(STAY, [], [LA_RENT]);
  assert.equal(NO_CHARGE_WORDS, "no charge linked — link the stay's lodging and flights");
  assert.equal(none.chargesWords, NO_CHARGE_WORDS);
  assert.equal(none.totalCents, null);
  assert.equal(none.perDayCents, null);
  assert.equal(none.perDayFormula, null);
  assert.deepEqual(none.underOver, { kind: 'no-charge', cents: null, words: NO_CHARGE_WORDS });
  assert.equal(none.forTheStayMinor, 238356);
  // Only a reversed one linked: still no paying charge — and the reversed one named.
  const onlyReversed = stayCostOf(STAY, [REVERSED], [LA_RENT]);
  assert.equal(onlyReversed.chargesWords, `${NO_CHARGE_WORDS} · 1 reversed — pays nothing (counted out)`);
  assert.equal(onlyReversed.totalCents, null);
});

test('D a baseline stated in EUR is shown and NOT compared (FX-02) — its own figures in its own code', () => {
  const eur = baseline('b-eur', 'Berlin rent', '2026-01-01', 230000, 'EUR');
  const s = stayCostOf(STAY, [LODGING, FLIGHT], [eur]);
  // 230000 × 12 ÷ 365 = 7561.64… → 7562; 230000 × 12 × 29 ÷ 365 = 219287.67… → 219288.
  assert.equal(s.baseline?.perDayMinor, roundedOnce(B(230000) * B(12), B(365)));
  assert.equal(s.baselineWords, 'Berlin rent · 2300.00 EUR a month · 75.62 EUR a day');
  assert.equal(s.forTheStayMinor, roundedOnce(B(230000) * B(12) * B(29), B(365)));
  assert.equal(s.forTheStayWords, '2192.88 EUR');
  assert.equal(notComparedWords('EUR'), 'the baseline is stated in EUR; the books are kept in USD — not compared (FX-02)');
  assert.deepEqual(s.underOver, { kind: 'not-compared', cents: null, words: notComparedWords('EUR') });
  assert.equal(s.totalWords, '$1,389.50', 'the books\' TOTAL stands in USD');
});

test('D two baselines: the later one in force on the stay\'s first day; one effective after it is not; a voided one is skipped; none → "no baseline in force on <day>"', () => {
  const later = baseline('b-la-2', 'LA rent', '2026-09-01', 280000, 'USD');
  const future = baseline('b-la-3', 'LA rent', '2026-11-01', 310000, 'USD');
  assert.equal(baselineInForce([LA_RENT, later, future], '2026-10-22')?.id, 'b-la-2', 'the latest effective_from on or before the day');
  assert.equal(baselineInForce([LA_RENT, later, future], '2026-08-01')?.id, 'b-la-1');
  assert.equal(baselineInForce([LA_RENT, later], '2026-09-01')?.id, 'b-la-2', 'in force ON its own day');
  const s = stayCostOf(STAY, [LODGING, FLIGHT], [LA_RENT, later, future]);
  assert.equal(s.forTheStayMinor, roundedOnce(B(280000) * B(12) * B(29), B(365)));
  // A voided baseline is never in force.
  const voided = baseline('b-void', 'LA rent', '2026-09-01', 999900, 'USD', { at: '2026-11-03T13:00:00.000Z', reason: 'typed the wrong month' });
  assert.equal(baselineInForce([LA_RENT, voided], '2026-10-22')?.id, 'b-la-1');
  // None in force.
  const bare = stayCostOf(STAY, [LODGING, FLIGHT], []);
  assert.equal(noBaselineWords('2026-10-22'), 'no baseline in force on 2026-10-22');
  assert.equal(bare.baselineWords, 'no baseline in force on 2026-10-22');
  assert.equal(bare.forTheStayMinor, null);
  assert.deepEqual(bare.underOver, { kind: 'no-baseline', cents: null, words: 'no baseline in force on 2026-10-22' });
  // Two live baselines on one day cannot both be in force — the partial unique holds one; the leaf refuses, never picks.
  assert.throws(() => baselineInForce([LA_RENT, baseline('b-twin', 'LA rent', '2026-01-01', 1, 'USD')], '2026-10-22'), /2 live baselines start on 2026-01-01/);
});

test('D a one-day stay: DAYS 1, PER DAY the TOTAL, FOR THE STAY one day of the year\'s twelve months', () => {
  const day = { id: '00000000-0000-4000-8000-000000000a02', place: 'Bangkok', starts_on: '2026-12-01', ends_on: '2026-12-01' };
  const s = stayCostOf(day, [posting('je-day', '2026-12-01', 'Hotel', 5000, LODGING_ACCOUNT)], [LA_RENT]);
  assert.equal(s.days, 1);
  assert.equal(s.perDayCents, 5000);
  assert.equal(s.perDayFormula, '$50.00 ÷ 1 day');
  assert.equal(s.forTheStayMinor, roundedOnce(B(250000) * B(12), B(365)));
  assert.deepEqual(s.underOver, { kind: 'under', cents: 5000 - 8219, words: 'under by $32.19' });
});

test('D even, over, a charge with no readable amount (never a zero summed in), and BY ACCOUNT\'s disagreement said', () => {
  const evenStay = { id: 'x1', place: 'P', starts_on: '2026-03-01', ends_on: '2026-03-01' };
  const s = stayCostOf(evenStay, [posting('je-even', '2026-03-01', 'Hotel', 8219, LODGING_ACCOUNT)], [LA_RENT]);
  assert.deepEqual(s.underOver, { kind: 'even', cents: 0, words: EVEN_WORDS });
  const over = stayCostOf(evenStay, [posting('je-over', '2026-03-01', 'Hotel', 10000, LODGING_ACCOUNT)], [LA_RENT]);
  assert.deepEqual(over.underOver, { kind: 'over', cents: 1781, words: 'over by $17.81' });
  // No debit line: the books' amount is NULL — the stay's figures are not computed, by name.
  const noDebit: StayPostingIn = { ...posting('je-nodebit', '2026-03-01', 'Odd entry', 100, LODGING_ACCOUNT), ledger_entries: [{ entry_type: 'C', amount: B(100), account: BANK }] };
  const unreadable = stayCostOf(evenStay, [posting('je-ok', '2026-03-01', 'Hotel', 5000, LODGING_ACCOUNT), noDebit], [LA_RENT]);
  assert.equal(unreadable.totalCents, null);
  assert.equal(unreadable.chargesWords, '1 charge · 1 with no readable debit amount');
  assert.deepEqual(unreadable.underOver, { kind: 'not-computed', cents: null, words: notComputedWords(1) });
  // Two debit lines on one posting: the books' amount reads the first; BY ACCOUNT reads each — the difference is said.
  const split: StayPostingIn = {
    ...posting('je-split', '2026-03-01', 'Split', 3000, LODGING_ACCOUNT),
    ledger_entries: [
      { entry_type: 'D', amount: B(3000), account: LODGING_ACCOUNT },
      { entry_type: 'D', amount: B(2000), account: AIRFARE_ACCOUNT },
      { entry_type: 'C', amount: B(5000), account: BANK },
    ],
  };
  const disagree = stayCostOf(evenStay, [split], [LA_RENT]);
  assert.equal(disagree.totalCents, 3000);
  assert.match(disagree.byAccountWords ?? '', /BY ACCOUNT sums to \$50\.00; TOTAL is \$30\.00/);
});

test('D the rounding: half away from zero, once — and a divisor that is not a count of days refused', () => {
  assert.equal(divideRoundedOnce(B(5), B(2)), B(3));
  assert.equal(divideRoundedOnce(B(-5), B(2)), B(-3));
  assert.equal(divideRoundedOnce(B(7), B(2)), B(4));
  assert.equal(divideRoundedOnce(B(1), B(3)), B(0));
  assert.equal(divideRoundedOnce(B(2), B(3)), B(1));
  assert.throws(() => divideRoundedOnce(B(1), B(0)), /a divisor of 0/);
  // A long stay's product passes 2^53 in floats' terms only through BigInt: 2147483647 × 12 × 400 days stays exact.
  const huge = divideRoundedOnce(B(2147483647) * B(12) * B(400), B(365));
  assert.equal(huge, (B(2147483647) * B(12) * B(400) * B(2) + B(365)) / (B(2) * B(365)));
});

test('D every stay with only its own postings, first day first; the baselines under the table, newest first, voided marked', () => {
  const second = { id: '00000000-0000-4000-8000-000000000a03', place: 'Siargao', starts_on: '2026-11-20', ends_on: '2026-12-10' };
  const all = stayCostsOf([STAY, second], new Map([[STAY.id, [LODGING, FLIGHT]]]), [LA_RENT]);
  assert.deepEqual(all.map((s) => [s.id, s.totalCents, s.chargesWords]), [[STAY.id, 138950, '2 charges'], [second.id, null, NO_CHARGE_WORDS]]);
  const voided = baseline('b-void', 'LA rent', '2026-09-01', 280000, 'USD', { at: '2026-11-03T13:00:00.000Z', reason: 'wrong month' });
  const views = baselineViewsOf([LA_RENT, voided]);
  assert.deepEqual(views.map((v) => [v.id, v.effectiveFrom, v.monthlyWords, v.perDayWords, v.statusWords]), [
    ['b-void', '2026-09-01', '$2,800.00', '$92.05', 'voided 2026-11-03 — "wrong month"'],
    ['b-la-1', '2026-01-01', '$2,500.00', '$82.19', BASELINE_LIVE_WORDS],
  ]);
  assert.equal(chargesWords(1, 0, 0), '1 charge');
});

// ── E · THE TABLE ───────────────────────────────────────────────────────────

test('E the column order is Alex\'s, exactly; every calculated column names its rule; the CSV writes the facts bare', () => {
  assert.deepEqual([...STAY_COST_COLUMNS], ['stay', 'place', 'days', 'charges', 'total', 'perDay', 'baseline', 'forTheStay', 'underOver', 'id']);
  assert.deepEqual(STAY_COST_TABLE.map((c) => c.label), ['STAY', 'PLACE', 'DAYS', 'CHARGES', 'TOTAL', 'PER DAY', 'BASELINE', 'FOR THE STAY', 'UNDER / OVER', 'ID']);
  for (const c of STAY_COST_TABLE.filter((x) => ['days', 'charges', 'total', 'perDay', 'baseline', 'forTheStay', 'underOver'].includes(x.key))) {
    assert.match(c.title ?? '', /^CALCULATED — /, `${c.key} names its rule`);
  }
  assert.deepEqual(STAY_COST_TABLE.filter((c) => c.kind === 'money').map((c) => c.key), ['total', 'perDay', 'underOver']);
  assert.equal(STAYS_COST_HEADING, 'STAYS · CALCULATED');
  const s = stayCostOf(STAY, [LODGING, FLIGHT], [LA_RENT]);
  const csv = tableCsv(STAY_COST_TABLE, [s]).split('\r\n');
  assert.equal(csv[0], 'STAY,PLACE,DAYS,CHARGES,TOTAL,PER DAY,BASELINE,FOR THE STAY,UNDER / OVER,ID');
  assert.equal(csv[1], `2026-10-22 → 2026-11-19,"Chiang Mai, Thailand",29,2 charges,1389.50,47.91,LA rent · $2,500.00 a month · $82.19 a day,2383.56,-994.06,${STAY.id}`.replace('LA rent · $2,500.00 a month · $82.19 a day', '"LA rent · $2,500.00 a month · $82.19 a day"'));
});

// ── C · THE LIVING BASELINE'S RULES ─────────────────────────────────────────

test('C the body rule: every field refused by name, an unknown one too; the label trimmed (1–80); a DAY; whole hundredths above 0; three ISO capitals — nothing defaulted', () => {
  const good = { label: '  LA rent  ', effective_from: '2026-01-01', monthly_minor: 250000, currency: 'USD' };
  assert.deepEqual(livingBaselineBodyRule(good), { ok: true, value: { label: 'LA rent', effective_from: '2026-01-01', monthly_minor: 250000, currency: 'USD' } });
  const refused = (body: unknown, field: string, words: string) => assert.deepEqual(livingBaselineBodyRule(body), { ok: false, field, words });
  refused([], 'body', BASELINE_NOT_AN_OBJECT_WORDS);
  refused({ ...good, note: 'x' }, 'note', unknownBaselineFieldWords('note'));
  refused({ ...good, label: undefined }, 'label', LABEL_REQUIRED_WORDS);
  refused({ ...good, label: '   ' }, 'label', LABEL_BLANK_WORDS);
  refused({ ...good, label: 'LA\u0007rent' }, 'label', LABEL_CONTROL_WORDS);
  refused({ ...good, label: 'x'.repeat(81) }, 'label', labelTooLongWords(81));
  assert.equal(livingBaselineBodyRule({ ...good, label: 'x'.repeat(80) }).ok, true);
  refused({ ...good, effective_from: null }, 'effective_from', EFFECTIVE_FROM_REQUIRED_WORDS);
  refused({ ...good, effective_from: '2026-02-30' }, 'effective_from', effectiveFromNotADayWords('2026-02-30'));
  refused({ ...good, monthly_minor: undefined }, 'monthly_minor', MONTHLY_REQUIRED_WORDS);
  refused({ ...good, monthly_minor: 2500.5 }, 'monthly_minor', 'monthly_minor 2500.5 is not a whole number of hundredths');
  refused({ ...good, monthly_minor: '250000' }, 'monthly_minor', monthlyNotWholeWords('250000'));
  refused({ ...good, monthly_minor: 0 }, 'monthly_minor', monthlyNotAboveZeroWords(0));
  refused({ ...good, monthly_minor: 2147483648 }, 'monthly_minor', monthlyTooLargeWords(2147483648));
  refused({ ...good, currency: undefined }, 'currency', BASELINE_CURRENCY_REQUIRED_WORDS);
  refused({ ...good, currency: 'usd' }, 'currency', baselineCurrencyNotACodeWords('usd'));
  assert.equal(sameDayLiveBaselineWords('2026-01-01', 'LA rent'), 'a live baseline already starts on 2026-01-01 ("LA rent") — two live baselines never start the same day; void it first');
});

test('C the void rule: a reason, required, never blank; an unknown field refused; voided once — the second named', () => {
  assert.deepEqual(baselineVoidBodyRule({ reason: 'typed the wrong month' }), { ok: true, reason: 'typed the wrong month' });
  assert.deepEqual(baselineVoidBodyRule({}), { ok: false, field: 'reason', words: BASELINE_REASON_REQUIRED_WORDS });
  assert.deepEqual(baselineVoidBodyRule({ reason: '  ' }), { ok: false, field: 'reason', words: BASELINE_REASON_REQUIRED_WORDS });
  assert.deepEqual(baselineVoidBodyRule({ reason: 'x', why: 'y' }), { ok: false, field: 'why', words: unknownBaselineVoidFieldWords('why') });
  assert.deepEqual(baselineVoidStateRule({ voided_at: null, void_reason: null }), { ok: true });
  const at = new Date('2026-11-03T13:00:00.000Z');
  assert.deepEqual(baselineVoidStateRule({ voided_at: at, void_reason: 'wrong month' }), { ok: false, words: baselineAlreadyVoidedWords(at, 'wrong month') });
  assert.equal(baselineAlreadyVoidedWords(at, 'wrong month'), 'this baseline was voided on 2026-11-03 — "wrong month"; a baseline is voided once');
  assert.throws(() => baselineVoidStateRule({ voided_at: at, void_reason: null }), /half a void/);
});

// ── A · B · THE MIGRATION AND THE SCHEMA ────────────────────────────────────

test('A the seventh kind: the kind CHECK dropped and re-added with seven kinds, \'stay\' last; the instant CHECK untouched; no row written', () => {
  const sql = code(MIGRATION);
  const drop = sql.indexOf('ALTER TABLE "planned_item_links" DROP CONSTRAINT IF EXISTS "planned_item_links_kind";');
  const add = sql.indexOf('ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"');
  assert.ok(drop > -1 && add > drop, 'the 02b idiom: drop, then re-add');
  assert.match(sql, /CHECK \("target_kind" IN \('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item', 'travel_expense', 'stay'\)\);/);
  assert.doesNotMatch(sql, /target_instant/, 'the instant rule (LINES-01) is not touched — a stay carries none');
  assert.doesNotMatch(sql, /\bINSERT\b|\bUPDATE "|\bDELETE FROM\b/, 'no row written');
  assert.match(comments(MIGRATION), /AUTHORED, NOT APPLIED to any shared database\. Claude Code cannot reach Azure Postgres/);
});

test('B living_baselines: column for column, its CHECKs, RESTRICT, the index, the partial unique\'s exact WHERE', () => {
  const sql = code(MIGRATION);
  for (const col of [
    /"id"\s+UUID\s+NOT NULL DEFAULT gen_random_uuid\(\),/, /"user_id"\s+TEXT\s+NOT NULL,/, /"label"\s+VARCHAR\(80\)\s+NOT NULL,/,
    /"effective_from"\s+DATE\s+NOT NULL,/, /"monthly_minor"\s+INTEGER\s+NOT NULL,/, /"currency"\s+VARCHAR\(3\)\s+NOT NULL,/,
    /"voided_at"\s+TIMESTAMPTZ\(6\),/, /"void_reason"\s+TEXT,/, /"created_at"\s+TIMESTAMPTZ\(6\) NOT NULL DEFAULT now\(\),/, /"created_by"\s+TEXT\s+NOT NULL,/,
  ]) assert.match(sql, col);
  assert.doesNotMatch(sql, /"currency"[^\n]*DEFAULT/, 'no currency is assumed (FX-01)');
  assert.match(sql, /CHECK \(char_length\(btrim\("label"\)\) BETWEEN 1 AND 80\)/);
  assert.match(sql, /CHECK \("monthly_minor" > 0\)/);
  assert.match(sql, /CHECK \(char_length\("currency"\) = 3\)/);
  assert.match(sql, /CHECK \(\("voided_at" IS NULL AND "void_reason" IS NULL\)\n\s*OR \("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL AND char_length\(btrim\("void_reason"\)\) > 0\)\)/);
  assert.match(sql, /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.match(sql, /CREATE INDEX "living_baselines_user_id_effective_from_idx" ON "living_baselines" \("user_id", "effective_from"\);/);
  assert.match(sql, /CREATE UNIQUE INDEX "living_baselines_one_live_per_day" ON "living_baselines" \("user_id", "effective_from"\)\n\s*WHERE "voided_at" IS NULL;/);
});

test('B the triggers (the 02b precedent): FREEZE — every column but the void pair named, a void once from NULL; NO DELETE — and no TRUNCATE', () => {
  const sql = code(MIGRATION);
  const freeze = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION prevent_living_baseline_mutation()'), sql.indexOf('CREATE TRIGGER protect_living_baseline_fields'));
  for (const col of ['id', 'user_id', 'label', 'effective_from', 'monthly_minor', 'currency', 'created_at', 'created_by']) {
    assert.match(freeze, new RegExp(`NEW\\.${col} IS DISTINCT FROM OLD\\.${col}`), col);
  }
  assert.doesNotMatch(freeze, /NEW\.voided_at IS DISTINCT FROM|NEW\.void_reason IS DISTINCT FROM/, 'the void pair is the one change');
  assert.match(freeze, /IF OLD\.voided_at IS NOT NULL OR OLD\.void_reason IS NOT NULL THEN/);
  assert.match(freeze, /IF NEW\.voided_at IS NULL OR NEW\.void_reason IS NULL THEN/);
  assert.match(sql, /CREATE TRIGGER protect_living_baseline_fields\nBEFORE UPDATE ON "living_baselines"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_living_baseline_mutation\(\);/);
  assert.match(sql, /CREATE TRIGGER no_living_baseline_deletes\nBEFORE DELETE ON "living_baselines"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_living_baseline_delete\(\);/);
  assert.match(sql, /CREATE TRIGGER no_living_baseline_truncate\nBEFORE TRUNCATE ON "living_baselines"\nFOR EACH STATEMENT\nEXECUTE FUNCTION prevent_living_baseline_delete\(\);/);
});

test('B the schema: living_baselines column for column with the SQL, RESTRICT to users, the plain index modeled; users names the relation', () => {
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model living_baselines {'), schema.indexOf('@@map("living_baselines")'));
  for (const field of [
    /id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid/, /user_id\s+String\n/, /label\s+String\s+@db\.VarChar\(80\)/,
    /effective_from DateTime\s+@db\.Date/, /monthly_minor\s+Int\n/, /currency\s+String\s+@db\.VarChar\(3\)/, /voided_at\s+DateTime\? @db\.Timestamptz\(6\)/,
    /void_reason\s+String\?/, /created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)/, /created_by\s+String\n/,
    /user users @relation\(fields: \[user_id\], references: \[id\], onDelete: Restrict\)/, /@@index\(\[user_id, effective_from\]\)/,
  ]) assert.match(model, field);
  assert.match(schema, /living_baselines\s+living_baselines\[\]/, 'users names the relation');
  assert.match(comments(SCHEMA), /HELD BY THE DATABASE \(prisma\/migrations\/20261103200000_travel_02c_stay_link_living_baselines/);
});

// ── A · THE LINK ────────────────────────────────────────────────────────────

test('A the seventh kind in the key leaf: \'stay\' last, no instant, the owner query scoped by user_id on operations_stays; a non-UUID id names no row', () => {
  assert.deepEqual([...LINKABLE_KINDS], ['calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item', 'travel_expense', 'stay']);
  assert.ok(isLinkableKind('stay'));
  assert.equal(requiresInstant('stay'), false);
  assert.deepEqual(targetOwnerQuery('stay', STAY.id, 'u1'), { table: 'operations_stays', where: { id: STAY.id, user_id: 'u1' } });
  assert.equal(targetOwnerQuery('stay', 'not-a-uuid', 'u1'), null);
  assert.match(code(LINK_KEYS), /if \(kind === 'stay'\) return \{ table: 'operations_stays', where: \{ id, user_id: userId \} \};/);
});

test('A the links POST: the stay read user-scoped after the ownership read, before the posting read and the write; its audit words name the stay; a reversed posting and a second item refused as before', () => {
  const r = code(LINKS);
  assert.match(r, /case 'operations_stays': return \(await prisma\.operations_stays\.findFirst\(\{ where: q\.where, select \}\)\) !== null;/);
  const post = r.slice(r.indexOf('export async function POST('), r.indexOf('export async function DELETE('));
  const owner = post.indexOf('if (!(await ownsTarget(targetOwnerQuery(t.kind, t.id, user.id)))) {');
  const stay = post.indexOf("if (t.kind === 'stay') {");
  const entry = post.indexOf('const entry = await prisma.journal_entries.findFirst({');
  const reversed = post.indexOf('if (isReversedPosting(entry)) return NextResponse.json({ error: reversedRefusalWords(entry) }, { status: 409 });');
  const taken = post.indexOf('const taken = await prisma.planned_item_links.findUnique({ where: { journal_entry_id: entry.id } });');
  const write = post.indexOf('const link = await prisma.planned_item_links.create({');
  assert.ok(owner > -1 && owner < stay && stay < entry && entry < reversed && reversed < taken && taken < write, 'ownership → the stay → the posting → reversed → one item → the write');
  assert.match(post, /const stay = await prisma\.operations_stays\.findFirst\(\{ where: \{ id: t\.id, user_id: user\.id \}, select: \{ id: true, place: true, starts_on: true, ends_on: true \} \}\);/);
  assert.match(post, /stayNamed = stayWords\(stayRowOf\(stay\)\);/);
  assert.match(post, /\$\{stayNamed === null \? '' : ` — \$\{stayNamed\}`\}/, 'the audit description names the stay');
  assert.equal(stayWords(STAY), 'Chiang Mai, Thailand 2026-10-22 → 2026-11-19');
});

test('A the stays DELETE refuses a stay that holds links — counted inside the transaction, before the delete, 409 by name; unlink first', () => {
  const r = code(STAY_ID_ROUTE);
  const del = r.slice(r.indexOf('export async function DELETE('));
  const count = del.indexOf('const n = await tx.planned_item_links.count({ where: stayLinksWhere(user.id, row.id) });');
  const held = del.indexOf('if (n > 0) return n;');
  const remove = del.indexOf('await tx.operations_stays.delete({ where: { id: row.id } });');
  assert.ok(count > -1 && count < held && held < remove, 'counted, refused, then deleted — in the transaction');
  assert.match(del, /if \(held > 0\) return NextResponse\.json\(\{ error: 'Conflict', message: stayHoldsLinksWords\(held, before\) \}, \{ status: 409 \}\);/);
  assert.ok(del.indexOf('if (held > 0)') < del.indexOf('await writeAuditLog('), 'nothing audited on a refusal');
  assert.doesNotMatch(del, /prisma\.operations_stays\.delete\(/, 'no delete outside the transaction');
  assert.deepEqual(stayLinksWhere('u1', STAY.id), { user_id: 'u1', target_kind: 'stay', target_id: STAY.id });
  assert.equal(stayHoldsLinksWords(2, STAY), 'the stay Chiang Mai, Thailand 2026-10-22 → 2026-11-19 has 2 postings linked in Books — unlink them first');
  assert.equal(stayHoldsLinksWords(1, STAY), 'the stay Chiang Mai, Thailand 2026-10-22 → 2026-11-19 has 1 posting linked in Books — unlink it first');
  // The PATCH that moves the stay's days updates the row in place — the link is to the stay, not its dates.
  const patch = r.slice(r.indexOf('export async function PATCH('), r.indexOf('export async function DELETE('));
  assert.match(patch, /prisma\.operations_stays\.update\(\{\n\s*where: \{ id: row\.id \},/);
  assert.doesNotMatch(patch, /planned_item_links/);
});

// ── C · THE ROUTES ──────────────────────────────────────────────────────────

test('C the baseline routes: the gate first, every query the caller\'s, the same day refused before the write (the partial unique the backstop), no PUT, no DELETE, no edit', () => {
  const r = code(BASELINES_ROUTE);
  assert.match(r, /export async function GET\(\)/);
  assert.match(r, /export async function POST\(request: NextRequest\)/);
  assert.doesNotMatch(r, /export async function (PUT|PATCH|DELETE)/);
  const post = r.slice(r.indexOf('export async function POST('));
  const gate = post.indexOf("if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });");
  const rule = post.indexOf('const read = livingBaselineBodyRule(body);');
  const same = post.indexOf('const standing = await prisma.living_baselines.findFirst({ where: { user_id: user.id, effective_from: effectiveFrom, voided_at: null }');
  const create = post.indexOf('row = await prisma.living_baselines.create({');
  assert.ok(gate > -1 && gate < rule && rule < same && same < create);
  assert.match(post, /if \(error instanceof Prisma\.PrismaClientKnownRequestError && error\.code === 'P2002'\)/);
  assert.match(post, /status: 409/);
  for (const m of r.matchAll(/prisma\.living_baselines\.(findMany|findFirst)\(\{ where: \{([^}]*)\}/g)) assert.match(m[2], /user_id: user\.id/);
  const v = code(VOID_ROUTE);
  assert.doesNotMatch(v, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.match(v, /if \(!isValidUuid\(id\)\) return NextResponse\.json\(\{ error: NO_SUCH_BASELINE_WORDS \}, \{ status: 404 \}\);/);
  assert.match(v, /prisma\.living_baselines\.updateMany\(\{\n\s*where: \{ id, user_id: user\.id, voided_at: null \},/);
  assert.match(v, /const state = baselineVoidStateRule\(row\);/);
  for (const f of [BASELINES_ROUTE, VOID_ROUTE, COSTS_ROUTE]) assert.doesNotMatch(code(f), /\bfetch\s*\(|anthropic|openai|stripe/i, `${f} makes no paid call`);
});

test('C the costs route: the gate, the caller\'s stays, links of kind \'stay\' through BILL_POSTING_SELECT with the posting\'s state, the baselines voided included; both lists always', () => {
  const r = code(COSTS_ROUTE);
  assert.match(r, /if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(r, /prisma\.operations_stays\.findMany\(\{ where: \{ user_id: user\.id \}, orderBy: \{ starts_on: 'asc' \} \}\)/);
  assert.match(r, /where: \{ user_id: user\.id, target_kind: 'stay', target_id: \{ in: stays\.map\(\(s\) => s\.id\) \}, journal_entry: \{ userId: user\.id \} \},/);
  assert.match(r, /const POSTING_SELECT = \{ id: true, date: true, description: true, \.\.\.BILL_POSTING_SELECT \} as const;/);
  assert.match(r, /prisma\.living_baselines\.findMany\(\{ where: \{ user_id: user\.id \}, select: LIVING_BASELINE_SELECT \}\)/);
  assert.match(r, /return NextResponse\.json\(\{ stays: stayCostsOf\(stays, postingsOf, baselines\), baselines: baselineViewsOf\(baselines\) \}\);/);
  assert.doesNotMatch(r, /\.(create|update|upsert|delete)\w*\(/, 'read-only');
});

// ── E · THE SCREEN ──────────────────────────────────────────────────────────

test('E the screen: STAYS · CALCULATED after the TRAVEL LEDGER and before the unattached; the one read through listOf (no silent empty); the link door kind \'stay\', no instant, near the first day; nothing preselected', () => {
  const launcher = code(LAUNCHER);
  const bookings = launcher.indexOf('data-travel-section="bookings"');
  const stays = launcher.indexOf('data-travel-section="stays"');
  const unattached = launcher.indexOf('data-travel-section="unattached"');
  assert.ok(bookings > -1 && bookings < stays && stays < unattached);
  const section = launcher.slice(stays, launcher.indexOf('</section>', stays));
  assert.match(section, /<TravelHeading>\{STAYS_COST_HEADING\}<\/TravelHeading>/);
  assert.match(section, /<StayCosts key=\{`stays-\$\{tripsRefresh\}`\} \/>/);
  const view = code(VIEW);
  assert.match(view, /const stays = listOf<StayCost>\(data, STAY_COSTS_ROUTE, 'stays'\);/);
  assert.match(view, /const baselines = listOf<BaselineView>\(data, STAY_COSTS_ROUTE, 'baselines'\);/);
  assert.match(view, /<LinkPicker kind="stay" id=\{s\.id\} instant=\{null\} near=\{s\.starts_on\} onChanged=\{readAgain\} onClose=\{closePicker\} \/>/);
  assert.match(view, /<option value="" disabled>\{CHOOSE_CURRENCY_WORDS\}<\/option>/, 'the currency starts unchosen');
  assert.match(view, /useState\(''\)/);
  assert.doesNotMatch(view, /useState\('USD'\)|defaultValue=|selected=/, 'nothing preselected');
  // A typed word is text after a tag's closing '>'; an arrow function's '=>' is code, not markup — so the '>' of '=>' is not read as one.
  assert.doesNotMatch(view, /(?<!=)>\s*[A-Za-z][^<{]*</, 'no typed word — every one is the leaves\'');
  assert.doesNotMatch(view, /localStorage|sessionStorage|document\.cookie/);
  assert.match(view, /fetch\('\/api\/living-baselines', \{ method: 'POST'/);
  assert.match(view, /fetch\(`\/api\/living-baselines\/\$\{encodeURIComponent\(id\)\}\/void`/);
});

// ── G · THE DOES-NOTS ───────────────────────────────────────────────────────

test('G no || and no ?? default, no $ outside the three formatters, no figure formatted by hand, in every file this PR writes; the leaves are pure; nothing links by date or place', () => {
  for (const f of [LEAF, RULES, BASELINES_ROUTE, VOID_ROUTE, COSTS_ROUTE, VIEW]) {
    const src = code(f);
    assert.doesNotMatch(src, /\|\||\?\? /, `${f} has no || and no ?? default`);
    assert.doesNotMatch(src, /\$(?!\{)/, `${f} writes no $ of its own`);
    assert.doesNotMatch(src, /Intl\.NumberFormat|toLocaleString|formatCents|planDollars|toFixed\(/, `${f} formats no figure of its own`);
  }
  for (const f of [LEAF, RULES]) assert.doesNotMatch(code(f), /prisma\.|PrismaClient|\bfetch\s*\(|Date\.now|new Date\(\)|process\.env|from 'react'/, `${f} is pure`);
  // No conversion, no matching: nothing in the leaf or the routes proposes a stay for a charge.
  for (const f of [LEAF, COSTS_ROUTE, VIEW]) assert.doesNotMatch(code(f), /convert|exchangeRate|fxRate|guess|suggest|autoLink/i, `${f} converts and links nothing on its own`);
  // The added links-route lines carry no default either.
  const r = code(LINKS);
  const added = r.slice(r.indexOf("if (t.kind === 'stay') {"), r.indexOf('const entry = await prisma.journal_entries.findFirst({'));
  assert.doesNotMatch(added, /\|\||\?\? /);
});

// ── THE LAWS ────────────────────────────────────────────────────────────────

test('the laws: the travel sections hold \'stays\' between \'bookings\' and \'unattached\'; the link law names \'stay\' as a kind of its own migration', () => {
  const law = code(LAW);
  assert.match(law, /const TRAVEL_SECTIONS = \['header', 'trips', 'itinerary', 'search', 'booked', 'ledger', 'bookings', 'stays', 'unattached'\];/);
  assert.match(law, /LINKABLE_KINDS\.filter\(\(k\) => k !== 'routine_line' && k !== 'trip_item' && k !== 'travel_expense' && k !== 'stay'\)/);
});

// ── H · TESTS FIND LINES ────────────────────────────────────────────────────

test('H this file pins no line number: no "file:NN" anchor, no line index — every pin finds its line by content', () => {
  const self = code(SELF);
  assert.doesNotMatch(self, /\.(?:ts|tsx|prisma|sql):\d+/, 'no file:line pin');
  assert.doesNotMatch(self, /split\('\\n'\)\[\d+\]|lines\[\d+\]/, 'no line index');
});
