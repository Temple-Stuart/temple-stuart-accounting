/**
 * LEDGER-01 (Alex, 2026-10-16) — THE CITY LEDGER ON THE TASKS PAGE: every stop
 * recorded, by date, city, country, COA and vendor, with totals and a summary
 * over time and by place.
 *
 * The rule (src/lib/operations/ledger.ts ledgerOf), the period, the filters,
 * the totals (the card's dayTotals, reused) and the summary are pure and DRIVEN
 * over fixtures built the Budget's own way (buildRoutineBudgetLines, the plan's
 * vendor rows, the stays); the one place split (stay.ts placeParts) is driven
 * with captionTags; the route, the reads, the section, the page and the law are
 * anchored to their source with comments stripped (TEST-TRUTH-01).
 *
 * LEDGER-02 (Alex, 2026-10-19): the city ledger is the TASK LEDGER — sixteen
 * columns, one fact each; the ACTUAL cell the amount alone (the delta is the
 * VARIANCE column's); a BOOK group; a CSV. The pins below that moved say so,
 * dated; ledger02.test.ts drives the new rules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { buildRoutineBudgetLines, occurrenceKey, type RoutinePlanInput } from '../budget/days';
import type { BudgetLine } from '../budget/report';
import type { PlanVendorRow, RoutineWords } from '../budget/planLines';
import { placeParts, type StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  ALL_WORDS, EVERY_BOOK_WORDS, GROUP_KEYS, GROUP_WORDS, LEDGER_HEAD_WORDS, LEDGER_LOADING_WORDS, LEDGER_SPAN_MAX_DAYS, LEDGER_TITLE_WORDS,
  NO_FIRST_RECORD_WORDS, NO_ROWS_SHOWN_WORDS, PERIOD_KINDS, PERIOD_WORDS, SUMMARY_HEAD_WORDS, SUMMARY_TITLE_WORDS, TODAY_RULE_WORDS, TOTAL_WORDS,
  actualCellWords, averageStarsWords, budgetCellWords, coaWords, daysWords, dayParamWords, firstRecordUnplacedWords, ledgerFailedWords, ledgerOf,
  ledgerStarsWords, ledgerSummary, ledgerTotals, mondayOf, monthOf, monthWords, noLineWords, noRowsWords, noStayWords, notPlacedWords, notRecordedWords, orderWords,
  perDayWords, periodOf, periodWords, spanDays, spanInput, spanWords, starsCellWords, stepAnchor, unplacedWords, weekWords,
  type LedgerInput, type LedgerRecordInput, type LedgerRow,
} from '../operations/ledger';
import { captionTags, CAPTION_TAGS, dayTotals } from '@/components/workbench/operations/day/dayCard';
import { readLedger } from '@/components/workbench/operations/ledger/ledgerReads';

const RULES = 'src/lib/operations/ledger.ts';
const STAY = 'src/lib/operations/stay.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const PAGE = 'src/app/tasks/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const MIDDLEWARE = 'src/middleware.ts';
// IDIOM-01 (Alex, 2026-10-24): the shared table the section renders through — the pins on the headers, the table element, the CSV button
// and the empty state moved here from the section (behaviour identical, proven by the DOM and CSV byte proofs in the PR).
const TABLE = 'src/components/table/DataTable.tsx';

// ── FIXTURES (the Budget's own shapes) ──────────────────────────────────────

const BKK = 'Asia/Bangkok';
const FROM = '2026-10-12';
const TO = '2026-10-13';
/** Oct 12, 19:00 Bangkok — the morning's Oct 12 stop is past, the gym's (20:00) and every Oct 13 stop are not. */
const NOW = new Date('2026-10-12T12:00:00.000Z');
const MORNING_12 = '2026-10-12T00:00:00.000Z';
const MORNING_13 = '2026-10-13T00:00:00.000Z';
const GYM_12 = '2026-10-12T13:00:00.000Z';
const GYM_13 = '2026-10-13T13:00:00.000Z';

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: BKK, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  routine({ id: 'morning', name: 'Morning', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', steps: [
    { id: 'coffee', stepOrder: 1, budgetAmount: 10, coaCode: '5100' },
    { id: 'stretch', stepOrder: 2, budgetAmount: 8, coaCode: '5100' },
    { id: 'lunch', stepOrder: 3, budgetAmount: 15, coaCode: '5200' },
  ] }),
  routine({ id: 'gym', name: 'Gym', scheduleRrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0', budgetAmount: 20, coaCode: '5300' }),
  routine({ id: 'netflix', name: 'Netflix', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=0', budgetAmount: 5, coaCode: '5400' }),
];
const ROLES = new Map([['morning', 'place'], ['gym', 'place'], ['netflix', 'all_day'], ['yoga', 'place']]);
const WORDS = new Map<string, RoutineWords>([
  ['morning', { name: 'Morning', timezone: BKK, steps: new Map([['coffee', { activity: 'Coffee', timeOfDay: '07:30' }], ['stretch', { activity: 'Stretch', timeOfDay: '06:30' }], ['lunch', { activity: 'Lunch', timeOfDay: '12:00' }]]) }],
  ['gym', { name: 'Gym', timezone: BKK, steps: new Map() }],
  ['netflix', { name: 'Netflix', timezone: BKK, steps: new Map() }],
]);
const VENDORS: PlanVendorRow[] = [
  { id: 'pv-every', routine_id: null, step_id: 'coffee', task_id: null, occurrence_at: null, vendor: { id: 'v1', vendor_name: 'Luka Café', entity_id: 'P' }, routine: null, step: { activity: 'Coffee', routine_id: 'morning', routine: { name: 'Morning', timezone: BKK } }, task: null },
  { id: 'pv-once', routine_id: 'gym', step_id: null, task_id: null, occurrence_at: new Date(GYM_13), vendor: { id: 'v2', vendor_name: 'Fitness First', entity_id: 'P' }, routine: { name: 'Gym', timezone: BKK }, step: null, task: null },
];
const STAYS: StayRow[] = [{ id: 'cnx', place: 'Chiang Mai, Thailand 🇹🇭', starts_on: '2026-10-13', ends_on: '2026-10-20' }];
const ACCOUNTS = [{ entityId: 'P', code: '5100', name: 'Meals' }, { entityId: 'P', code: '5300', name: 'Fitness' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: `${over.occurrence_at.slice(0, 11)}00:41:00.000Z`, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const morningLine = (r: StopRecordRow, activity: string, timeOfDay: string): LedgerRecordInput => ({ record: r, routineId: 'morning', routineName: 'Morning', zone: BKK, role: 'place', activity, timeOfDay });
const gymStop = (r: StopRecordRow, zone = BKK): LedgerRecordInput => ({ record: r, routineId: 'gym', routineName: 'Gym', zone, role: 'place', activity: null, timeOfDay: null });

const RECORDS: LedgerRecordInput[] = [
  morningLine(record({ id: 'r-coffee-13', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_13, actual_cents: 1200, rating: 4, note: 'khao soi' }), 'Coffee', '07:30'),
  morningLine(record({ id: 'r-stretch-13', kind: 'routine_line', target_id: 'stretch', occurrence_at: MORNING_13, outcome: 'skipped', done_at: null, note: 'rain' }), 'Stretch', '06:30'),
  gymStop(record({ id: 'r-gym-13', kind: 'routine', target_id: 'gym', occurrence_at: GYM_13, rating: 3 })),
  morningLine(record({ id: 'r-coffee-12', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_12, actual_cents: 900, rating: 5, note: 'latte' }), 'Coffee', '07:30'),
  gymStop(record({ id: 'r-gym-12', kind: 'routine', target_id: 'gym', occurrence_at: GYM_12, actual_cents: 2000 })),
  // A routine the loader no longer lists (inactive now): its record stays, with no line.
  { record: record({ id: 'r-yoga-12', kind: 'routine', target_id: 'yoga', occurrence_at: '2026-10-12T10:00:00.000Z', actual_cents: 500, rating: 2 }), routineId: 'yoga', routineName: 'Yoga', zone: BKK, role: 'place', activity: null, timeOfDay: null },
  // A zone the clock cannot read: named, never placed in UTC.
  gymStop(record({ id: 'r-mars', kind: 'routine', target_id: 'gym', occurrence_at: '2026-10-12T05:00:00.000Z', actual_cents: 100 }), 'Mars/Olympus'),
  // In the any-zone window the route reads, but on Oct 11 in Bangkok: dropped by the placing, not a row.
  morningLine(record({ id: 'r-coffee-11', kind: 'routine_line', target_id: 'coffee', occurrence_at: '2026-10-11T16:30:00.000Z', actual_cents: 100 }), 'Coffee', '07:30'),
];

const built = buildRoutineBudgetLines(ROUTINES, FROM, TO);
/** The gym's Oct 12 line twice — two plan lines at one stop, which the card names and never picks from. */
const doubled: BudgetLine[] = [...built.lines, built.lines.find((l) => l.sourceId === occurrenceKey({ routineId: 'gym', lineId: null, instant: new Date(GYM_12) })) as BudgetLine];

const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: FROM, to: TO, now: NOW, records: RECORDS, links: [], lines: doubled, notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS, ...over,
});

const ledger = ledgerOf(input());
const rowOf = (id: string): LedgerRow => {
  const row = ledger.rows.find((r) => r.id === id);
  assert.ok(row !== undefined, `row ${id}`);
  return row;
};

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── T1 · THE ONE PLACE SPLIT ────────────────────────────────────────────────

test('T1 placeParts: the city before the first comma, the country after, trimmed; no comma — the whole place, no country; captionTags reads it and is unchanged', () => {
  assert.deepEqual(placeParts('Chiang Mai, Thailand 🇹🇭'), { city: 'Chiang Mai', country: 'Thailand 🇹🇭' });
  assert.deepEqual(placeParts('Bali'), { city: 'Bali', country: null }, 'no comma: no country, never a guessed one');
  assert.deepEqual(placeParts('Ho Chi Minh City, Vietnam, Asia'), { city: 'Ho Chi Minh City', country: 'Vietnam, Asia' }, 'only the first comma splits');
  assert.deepEqual(placeParts('  Lisbon ,  Portugal  '), { city: 'Lisbon', country: 'Portugal' }, 'each part trimmed');
  assert.deepEqual(placeParts('🇹🇭, Thailand'), { city: '🇹🇭', country: 'Thailand' });
  // REEL-01's tags, word for word (reel01.test.ts pins them too) — the split moved, the output did not.
  assert.deepEqual(captionTags('Chiang Mai, Thailand 🇹🇭'), ['#chiangmai', '#thailand', ...CAPTION_TAGS]);
  assert.deepEqual(captionTags('Bali'), ['#bali', ...CAPTION_TAGS]);
  assert.deepEqual(captionTags('Ho Chi Minh City, Vietnam, Asia'), ['#hochiminhcity', '#vietnamasia', ...CAPTION_TAGS]);
  assert.deepEqual(captionTags('🇹🇭, Thailand'), ['#thailand', ...CAPTION_TAGS]);
  const card = code(CARD_RULES);
  assert.match(card, /export function captionTags\(stayPlace: string\): string\[\] \{\n\s*const place = placeParts\(stayPlace\);\n\s*const parts = place\.country === null \? \[place\.city\] : \[place\.city, place\.country\];/, 'the caption reads the one split');
  assert.doesNotMatch(card, /indexOf\(','\)/, 'no second split on the card');
  assert.doesNotMatch(code(RULES), /indexOf\(','\)|split\(','\)/, 'no second split in the ledger');
  assert.match(code(STAY), /export function placeParts\(place: string\): PlaceParts \{\n\s*const comma = place\.indexOf\(','\);\n\s*if \(comma < 0\) return \{ city: place\.trim\(\), country: null \};\n\s*return \{ city: place\.slice\(0, comma\)\.trim\(\), country: place\.slice\(comma \+ 1\)\.trim\(\) \};\n\}/);
});

// ── T2 · THE RULE ───────────────────────────────────────────────────────────

test('T2 ledgerOf: one row per record in the span, newest day first then the card’s clock; the record outside the span dropped, the unreadable zone named', () => {
  assert.deepEqual(ledger.rows.map((r) => r.id), ['r-stretch-13', 'r-coffee-13', 'r-gym-13', 'r-coffee-12', 'r-yoga-12', 'r-gym-12'], 'Oct 13 first; within a day 06:30, 07:30, 20:00 — a stop with no line keeps its occurrence’s clock (17:00)');
  assert.deepEqual(ledger.rows.map((r) => r.time), ['06:30', '07:30', '20:00', '07:30', '17:00', '20:00']);
  assert.deepEqual(ledger.rows.map((r) => r.day), ['2026-10-13', '2026-10-13', '2026-10-13', '2026-10-12', '2026-10-12', '2026-10-12']);
  assert.equal(ledger.rows.some((r) => r.id === 'r-coffee-11'), false, 'Oct 11 in Bangkok, though in the window — not in the span');
  assert.equal(ledger.rows.some((r) => r.id === 'r-mars'), false);
  assert.equal(ledger.said.unplaced.length, 1);
  assert.equal(ledger.said.unplaced[0].record.id, 'r-mars');
  assert.match(ledger.said.unplaced[0].detail, /^the routine's day cannot be read — timezone not recognised: "Mars\/Olympus": /, 'the stops GET’s own words (stopRecord.ts refusedWords)');
  assert.deepEqual([ledger.from, ledger.to], [FROM, TO]);
  assert.equal(rowOf('r-coffee-13').key, `line:coffee:${MORNING_13}`, 'the card’s key (recordKey)');
});

test('T2 each row: BUDGET the card’s matched line (one, at the exact instant), COA with the chart’s name, VENDOR by the plan’s grain, DESCRIPTION the card’s bold name, STARS, NOTES, ACTUAL', () => {
  const coffee = rowOf('r-coffee-13');
  assert.equal(coffee.cents, 1000, 'the matched line’s cents — the card’s BUDGET cell');
  assert.equal(coffee.budgetState, 'matched');
  assert.deepEqual(coffee.coa, { account: 'P-5100', name: 'Meals' }, 'the code with its book’s letter, and the chart’s name');
  assert.equal(coffee.vendor, 'Luka Café', 'the every-occurrence vendor');
  assert.equal(coffee.description, 'Coffee', 'the line’s activity');
  assert.deepEqual([coffee.rating, coffee.note, coffee.actualCents, coffee.outcome], [4, 'khao soi', 1200, 'done']);
  assert.deepEqual(coffee.place, { city: 'Chiang Mai', country: 'Thailand 🇹🇭' });
  const gym13 = rowOf('r-gym-13');
  assert.equal(gym13.cents, 2000);
  assert.deepEqual(gym13.coa, { account: 'P-5300', name: 'Fitness' });
  assert.equal(gym13.vendor, 'Fitness First', 'the occurrence vendor at the exact instant');
  assert.equal(gym13.description, 'Gym', 'a stepless routine’s name');
  assert.equal(gym13.actualCents, null, 'done without an amount');
  const stretch = rowOf('r-stretch-13');
  assert.deepEqual([stretch.cents, stretch.vendor, stretch.outcome, stretch.note], [800, null, 'skipped', 'rain']);
  const lunchless = rowOf('r-coffee-12');
  assert.deepEqual([lunchless.cents, lunchless.vendor, lunchless.place], [1000, 'Luka Café', null], 'Oct 12: no stay covers it');
  const gym12 = rowOf('r-gym-12');
  assert.deepEqual([gym12.cents, gym12.budgetState, gym12.coa, gym12.vendor], [null, 'doubled', null, null], 'two plan lines at one stop: neither taken — BUDGET "—", never one picked');
  assert.equal(gym12.description, 'Gym');
  const yoga = rowOf('r-yoga-12');
  assert.deepEqual([yoga.cents, yoga.budgetState, yoga.coa, yoga.vendor, yoga.description, yoga.actualCents], [null, 'none', null, null, 'Yoga', 500], 'no line: the routine’s own name from the record, BUDGET "—"');
  // A line of the user's whose code the chart has no name for prints the account alone.
  const unnamed = ledgerOf(input({ accounts: [] }));
  assert.deepEqual(unnamed.rows.find((r) => r.id === 'r-coffee-13')?.coa, { account: 'P-5100', name: null });
});

test('T2 the cells’ words: the ACTUAL amount alone (LEDGER-02; the delta was in it until then), "skipped" adds nothing, "—" for the unknown; ★ × rating; the place cells', () => {
  // LEDGER-02 (Alex, 2026-10-19): the ACTUAL cell is the amount alone — the delta moved to the VARIANCE column (one fact per cell); until then '$12 ▲ $2' and '$9 ▼ $1' (rowActualWords).
  assert.equal(actualCellWords(rowOf('r-coffee-13')), '$12', 'the amount alone (planDollars) — the delta is the VARIANCE cell’s since LEDGER-02');
  assert.equal(actualCellWords(rowOf('r-coffee-12')), '$9');
  assert.equal(actualCellWords(rowOf('r-stretch-13')), 'skipped');
  assert.equal(actualCellWords(rowOf('r-gym-13')), '—', 'done without an amount');
  assert.equal(actualCellWords(rowOf('r-gym-12')), '$20', 'an actual with no budget to compare: the amount alone');
  assert.equal(starsCellWords(4), '★★★★');
  assert.equal(starsCellWords(null), '—');
  assert.equal(ledgerStarsWords(1), '★');
  assert.throws(() => ledgerStarsWords(6), /a rating is 1 to 5/);
  assert.equal(budgetCellWords(1000), '$10');
  assert.equal(budgetCellWords(null), '—');
  assert.equal(coaWords(rowOf('r-coffee-13')), 'P-5100 · Meals');
  assert.equal(coaWords(rowOf('r-yoga-12')), '—');
  // LEDGER-04 (Alex, 2026-10-20): FILTER_KEYS went with the three dropdowns — every column filters now (ledger04.test.ts). The place cells stand.
  const [city, country] = [rowOf('r-coffee-13'), rowOf('r-coffee-12')];
  assert.deepEqual([city.place?.city, country.place], ['Chiang Mai', null]);
});

test('T2 said, not hidden: no line (the doubled named), no stay, the zone, the priced stops past with no record (an all-day line is not a stop), the lines not placed', () => {
  // RETRO-01 (Alex, 2026-10-16): what is said gains the records left out by role (none here — every fixture is a place stop; retro01.test.ts drives it).
  assert.deepEqual(ledger.said, {
    noLine: 2, doubled: 1, noStay: 3, unplaced: ledger.said.unplaced, notRecorded: 2, notPlaced: 0, leftOut: { journal: 0, plan: 0, execute: 0, all_day: 0 },
  });
  // Past NOW (Oct 12, 19:00 Bangkok): the morning's Oct 12 stops — coffee recorded, stretch and lunch not; the gym at 20:00 and every
  // Oct 13 stop are not past; Netflix's line is all day — in the plan, not a stop, never counted.
  const later = ledgerOf(input({ now: new Date('2026-10-14T00:00:00.000Z') }));
  assert.equal(later.said.notRecorded, 3, 'by Oct 14 the lunch on both days and the stretch on Oct 12 are missing; the gym on neither (both recorded) and the Oct 13 stretch is recorded (skipped is a record)');
  const allDayOnly = ledgerOf(input({ now: new Date('2026-10-14T00:00:00.000Z'), roles: new Map([...ROLES].map(([id]) => [id, 'all_day'])) }));
  assert.equal(allDayOnly.said.notRecorded, 0, 'an all-day routine takes no record');
  assert.throws(() => ledgerOf(input({ roles: new Map([['morning', 'place']]) })), /whose role was not read/, 'a line whose routine’s role was not read is the route’s error, never guessed');
  assert.throws(() => ledgerOf(input({ roles: new Map([...ROLES, ['gym', 'sometimes']]) })), /not one of the six/);
  assert.throws(() => ledgerOf(input({ books: [] })), /not one of the user's books/);
  assert.throws(() => ledgerOf(input({ records: [...RECORDS, RECORDS[0]] })), /two records at line:coffee/);
  assert.throws(() => ledgerOf(input({ from: TO, to: FROM })), /is not a span of days/);
  assert.equal(noLineWords(2, 1), '2 records no budget line matches (1 with two plan lines at one stop — neither taken)');
  assert.equal(noLineWords(1, 0), '1 record no budget line matches');
  assert.equal(noStayWords(3), '3 records on days no stay covers');
  assert.equal(unplacedWords([]), '0 records whose routine\'s zone could not be read');
  assert.match(unplacedWords(ledger.said.unplaced), /^1 record whose routine's zone could not be read — r-mars: the routine's day cannot be read — timezone not recognised/);
  assert.equal(notRecordedWords(2), '2 priced stops planned in the period, already past, with no record');
  assert.equal(notRecordedWords(1), '1 priced stop planned in the period, already past, with no record');
  assert.equal(notPlacedWords(1), '1 routine line the Budget could not place in the period (no budget here for its stops)');
  assert.equal(TODAY_RULE_WORDS, "budgets and COAs are the routines' as they stand today — editing a routine changes past rows until budget history exists");
  assert.equal(EVERY_BOOK_WORDS, 'every book — the COA says which; the entity selector does not filter the ledger');
});

// ── T3 · THE TOTALS AND THE SUMMARY ─────────────────────────────────────────

test('T3 ledgerTotals is the card’s TOTAL-row rule (dayTotals) over the rows shown: the BUDGET cells summed, the actuals summed, the tone and the words against the recorded rows’ budgets', () => {
  const t = ledgerTotals(ledger.rows);
  assert.equal(t.budgetCents, 4800, '$10 + $8 + $20 (Oct 13) + $10 (Oct 12) — the doubled and the lineless rows add nothing');
  assert.equal(t.actualCents, 4600, '$12 + $9 + $20 + $5');
  assert.equal(t.over, true);
  assert.equal(t.words, '▲ $26 over', 'against the budgets of the rows that carry an actual: $10 + $10');
  // LEDGER-02 (Alex, 2026-10-19): the totals carry varianceCents — null whenever either total is, never 0 (ledger02.test.ts drives it).
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): varianceCents is the column's sum over the rows that carry both, with withVariance counting them.
  // LEDGER-03 (Alex, 2026-10-19): the totals carry matchCents and withMatch — the MATCH column's sum over the rows with a readable sum (ledger03.test.ts drives it).
  assert.deepEqual(ledgerTotals([]), { budgetCents: null, actualCents: null, over: null, words: '—', varianceCents: null, withVariance: 0, matchCents: null, withMatch: 0 }, 'unknown is "—", never $0');
  assert.deepEqual(ledgerTotals([rowOf('r-gym-13')]), { budgetCents: 2000, actualCents: null, over: null, words: '—', varianceCents: null, withVariance: 0, matchCents: null, withMatch: 0 }, 'a budget with no actual');
  assert.deepEqual(ledgerTotals([rowOf('r-yoga-12')]), { budgetCents: null, actualCents: 500, over: null, words: '—', varianceCents: null, withVariance: 0, matchCents: null, withMatch: 0 }, 'an actual with no budget');
  assert.deepEqual(ledgerTotals([rowOf('r-coffee-12')]).words, '▼ $1 under');
  // The same numbers the card's own rule gives these rows — one rule, reused.
  const mirror = dayTotals({ stops: ledger.rows, spentCents: 4600, withActual: 4 }, null);
  assert.deepEqual([mirror.budgetCents, mirror.actualCents, mirror.over, mirror.recordedBudgetCents], [4800, 4600, true, 2000]);
  const rules = code(RULES);
  // LEDGER-02 (Alex, 2026-10-19): the return gained varianceCents — the four fields the card's, as before.
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): varianceCents is the column's sum (and withVariance its count), not the two totals' difference.
  assert.match(rules, /const totals = dayTotals\(\{ stops: rows, spentCents: actuals\.reduce\(\(sum, c\) => sum \+ c, 0\), withActual: actuals\.length \}, null\);\n\s*const variances = rows\.map\(\(r\) => r\.varianceCents\)\.filter\(\(c\): c is number => c !== null\);\n\s*const matches = rows\.map\(\(r\) => readableMatchCents\(r\.match\)\)\.filter\(\(c\): c is number => c !== null\);\n\s*return \{\n\s*budgetCents: totals\.budgetCents,\n\s*actualCents: totals\.actualCents,\n\s*over: totals\.over,\n\s*words: deltaWords\(totals\.actualCents, totals\.recordedBudgetCents\)\.text,\n\s*varianceCents: variances\.length === 0 \? null : variances\.reduce\(\(sum, c\) => sum \+ c, 0\),\n\s*withVariance: variances\.length,\n\s*matchCents: matches\.length === 0 \? null : matches\.reduce\(\(sum, c\) => sum \+ c, 0\),\n\s*withMatch: matches\.length,\n\s*\};/, 'reused, not rewritten');
  assert.doesNotMatch(rules.slice(rules.indexOf('export function ledgerTotals'), rules.indexOf('export const GROUP_KEYS')), /filter\(\(s\) => s\.actualCents !== null\)/, 'the recorded budget is the card’s, not summed again here');
  // LEDGER-01: the card's rule reads what it reads (TotalsInput) and returns the recorded budget — the arithmetic unchanged (totals01 drives it).
  const card = code(CARD_RULES);
  assert.match(card, /export function dayTotals\(result: TotalsInput, plannedCents: number \| null\): DayTotals \{/);
  assert.match(card, /export interface TotalsInput \{\n\s*readonly stops: readonly Pick<Stop, 'cents' \| 'actualCents'>\[\];\n\s*readonly spentCents: number \| null;\n\s*readonly withActual: number;\n\}/);
  assert.match(card, /over: deltaWords\(actualCents, recordedBudget\)\.over,\n\s*recordedBudgetCents: recordedBudget,/);
  assert.match(code('src/components/workbench/operations/day/DayCard.tsx'), /const totals = dayTotals\(result, plannedCents\);/, 'the card still hands it a DayStops');
});

test('T3 ledgerSummary: one group per selector value — the days it has records on, the totals by the same rule, the actual per recorded day, the average stars with how many were rated', () => {
  const byCity = ledgerSummary(ledger.rows, 'city');
  assert.deepEqual(byCity.map((g) => g.key), ['—', 'Chiang Mai'], 'the words’ order');
  const cnx = byCity[1];
  assert.deepEqual([cnx.label, cnx.days, cnx.totals.budgetCents, cnx.totals.actualCents, cnx.totals.words, cnx.perDayCents, cnx.stars], ['Chiang Mai', 1, 3800, 1200, '▲ $2 over', 1200, { average: 3.5, rated: 2 }]);
  const none = byCity[0];
  assert.deepEqual([none.label, none.days, none.totals.budgetCents, none.totals.actualCents, none.totals.words, none.perDayCents, none.stars], ['—', 1, 1000, 3400, '▲ $24 over', 3400, { average: 3.5, rated: 2 }]);
  const byWeek = ledgerSummary(ledger.rows, 'week');
  assert.equal(byWeek.length, 1);
  assert.deepEqual([byWeek[0].key, byWeek[0].label, byWeek[0].days, byWeek[0].perDayCents], ['2026-10-12', 'week of Mon Oct 12', 2, 2300], '$46 over 2 recorded days');
  const byDay = ledgerSummary(ledger.rows, 'day');
  assert.deepEqual(byDay.map((g) => [g.key, g.label, g.days]), [['2026-10-13', 'Tue Oct 13', 1], ['2026-10-12', 'Mon Oct 12', 1]], 'newest first');
  const byMonth = ledgerSummary(ledger.rows, 'month');
  assert.deepEqual(byMonth.map((g) => [g.key, g.label]), [['2026-10', 'Oct 2026']]);
  const byCoa = ledgerSummary(ledger.rows, 'coa');
  assert.deepEqual(byCoa.map((g) => g.key), ['—', 'P-5100 · Meals', 'P-5300 · Fitness']);
  assert.deepEqual(byCoa[1].stars, { average: 4.5, rated: 2 }, 'the coffees: 4 and 5');
  assert.deepEqual(ledgerSummary(ledger.rows, 'country').map((g) => g.key), ['—', 'Thailand 🇹🇭']);
  assert.deepEqual(ledgerSummary([], 'city'), []);
  const noActual = ledgerSummary([rowOf('r-gym-13')], 'city')[0];
  assert.deepEqual([noActual.perDayCents, noActual.stars], [null, { average: 3, rated: 1 }], 'no actual: per day unknown — never $0');
  assert.equal(averageStarsWords({ average: 3.5, rated: 2 }), '★ 3.5 (2 rated)');
  assert.equal(averageStarsWords({ average: 3, rated: 1 }), '★ 3.0 (1 rated)');
  assert.equal(perDayWords(2300), '$23');
  assert.equal(perDayWords(null), '—');
  assert.equal(daysWords(1), '1 day');
  assert.equal(daysWords(2), '2 days');
  assert.equal(weekWords('2026-10-12'), 'week of Mon Oct 12');
  assert.equal(monthWords('2026-10'), 'Oct 2026');
  assert.equal(monthOf('2026-10-13'), '2026-10');
  // LEDGER-02 (Alex, 2026-10-19): a seventh group, BOOK, after COA (ledger02.test.ts drives it).
  assert.deepEqual(GROUP_KEYS, ['day', 'week', 'month', 'city', 'country', 'coa', 'book']);
  assert.deepEqual(GROUP_WORDS, { day: 'Day', week: 'Week', month: 'Month', city: 'City', country: 'Country', coa: 'COA', book: 'Book' });
});

// ── T4 · THE PERIOD AND THE FILTERS ─────────────────────────────────────────

test('T4 periodOf: the calendar month, Monday to Sunday, the day, ALL from the first record to today (none: null); ‹ › steps; the span cap, refused by name', () => {
  assert.deepEqual(periodOf('month', '2026-10-16', '2026-10-16', null), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(periodOf('month', '2026-02-10', '2026-10-16', null), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(periodOf('week', '2026-10-16', '2026-10-16', null), { from: '2026-10-12', to: '2026-10-18' }, 'Friday Oct 16: Mon Oct 12 to Sun Oct 18');
  assert.deepEqual(periodOf('week', '2026-10-18', '2026-10-16', null), { from: '2026-10-12', to: '2026-10-18' }, 'a Sunday ends its week');
  assert.deepEqual(periodOf('week', '2026-10-12', '2026-10-16', null), { from: '2026-10-12', to: '2026-10-18' }, 'a Monday starts it');
  assert.deepEqual(periodOf('day', '2026-10-16', '2026-10-16', null), { from: '2026-10-16', to: '2026-10-16' });
  assert.deepEqual(periodOf('all', '2026-10-16', '2026-10-16', '2026-10-02'), { from: '2026-10-02', to: '2026-10-16' });
  assert.equal(periodOf('all', '2026-10-16', '2026-10-16', null), null, 'nothing recorded: no first day to start from');
  assert.throws(() => periodOf('day', 'today', '2026-10-16', null), /is not a 'YYYY-MM-DD' day/);
  assert.deepEqual([mondayOf('2026-10-16'), mondayOf('2026-10-18'), mondayOf('2026-10-12')], ['2026-10-12', '2026-10-12', '2026-10-12']);
  assert.equal(stepAnchor('day', '2026-10-16', 1), '2026-10-17');
  assert.equal(stepAnchor('day', '2026-10-01', -1), '2026-09-30');
  assert.equal(stepAnchor('week', '2026-10-16', 1), '2026-10-19', 'the next Monday');
  assert.equal(stepAnchor('week', '2026-10-16', -1), '2026-10-05');
  assert.equal(stepAnchor('month', '2026-10-16', 1), '2026-11-01');
  assert.equal(stepAnchor('month', '2026-01-16', -1), '2025-12-01');
  assert.equal(stepAnchor('all', '2026-10-16', 1), '2026-10-16', 'ALL does not step');
  assert.deepEqual(PERIOD_KINDS, ['month', 'week', 'day', 'all']);
  assert.deepEqual(PERIOD_WORDS, { month: 'Month', week: 'Week', day: 'Day', all: 'All' });
  assert.equal(periodWords({ from: '2026-10-01', to: '2026-10-31' }), 'Thu Oct 1 – Sat Oct 31');
  assert.equal(periodWords({ from: '2026-10-16', to: '2026-10-16' }), 'Fri Oct 16');
  assert.equal(noRowsWords({ from: '2026-10-16', to: '2026-10-16' }), 'no stop recorded Fri Oct 16');
  // The route's two parameters.
  assert.equal(LEDGER_SPAN_MAX_DAYS, 400);
  assert.equal(spanDays('2026-10-01', '2026-10-31'), 31);
  assert.deepEqual(spanInput('2026-10-01', '2026-10-31'), { ok: true, from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(spanInput('2025-09-27', '2026-10-31'), { ok: true, from: '2025-09-27', to: '2026-10-31' }, '400 days exactly');
  assert.deepEqual(spanInput('2025-09-26', '2026-10-31'), { ok: false, field: 'to', message: 'from and to span 401 days — at most 400' });
  assert.deepEqual(spanInput(null, '2026-10-31'), { ok: false, field: 'from', message: dayParamWords('from', null) });
  assert.deepEqual(spanInput('2026-10-01', '2026-13-01'), { ok: false, field: 'to', message: dayParamWords('to', '2026-13-01') });
  assert.deepEqual(spanInput('2026-10-31', '2026-10-01'), { ok: false, field: 'to', message: orderWords('2026-10-31', '2026-10-01') });
  assert.equal(dayParamWords('from', null), "from null is not a 'YYYY-MM-DD' day");
  assert.equal(orderWords('2026-10-31', '2026-10-01'), 'to 2026-10-01 is before from 2026-10-31');
  assert.equal(spanWords(401), 'from and to span 401 days — at most 400');
  assert.equal(NO_FIRST_RECORD_WORDS, 'no stop recorded yet — ALL starts at the first record');
  assert.equal(firstRecordUnplacedWords('x'), 'ALL has no first day — x');
});

test('T4 the filters: LEDGER-04 (Alex, 2026-10-20) retired the three dropdowns and their rule — every column filters and sorts now; ledger04.test.ts drives applyColumnFilters, columnValues and sortRows', () => {
  // Until LEDGER-04: FILTER_KEYS ['city', 'country', 'coa'], NO_FILTERS, choicesOf (the values present, "—" among them) and filterRows (every set filter must match) — pinned here, now gone.
  const rules = code(RULES);
  for (const name of ['FILTER_KEYS', 'NO_FILTERS', 'choicesOf', 'filterRows', 'FILTER_WORDS']) assert.doesNotMatch(rules, new RegExp(`export (const|type|function) ${name}\\b`), `${name} is gone`);
  assert.doesNotMatch(code(SECTION), /<select|choicesOf|filterRows|FILTER_KEYS|FILTER_WORDS/, 'no dropdown on the section');
  // The cell words the summary groups by stand — the column filters match the same words (ledger04.test.ts).
  assert.deepEqual([coaWords(rowOf('r-coffee-13')), coaWords(rowOf('r-yoga-12'))], ['P-5100 · Meals', '—']);
  assert.equal(ALL_WORDS, 'all');
});

// ── T5 · THE ROUTE ──────────────────────────────────────────────────────────

test('T5 the route: GET only, the stops GET’s gate first, from and to by the one rule, every read by user_id, the one loader and the day rules, nothing written, not public', () => {
  const r = code(ROUTE);
  assert.match(r, /export async function GET\(request: NextRequest\)/);
  assert.doesNotMatch(r, /export (const|function|async function) (?!GET\b)/, 'a route file exports its handler only');
  inOrder(r, [
    'const userEmail = await getVerifiedEmail();', "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });", "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));",
    "if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });",
    'const now = new Date();',
    'prisma.entities.findMany({ where: { userId: user.id }',
    'prisma.chart_of_accounts.findMany({', 'where: { entity_id: { in: entityIds }, entity: { userId: user.id } }',
    'await loadRoutineBudgetInputs(prisma, user.id, e.id)',
    'prisma.operations_routines.findMany({ where: { user_id: user.id }, select: { id: true, role: true } })',
    'prisma.planned_item_vendors.findMany({', 'where: { user_id: user.id, OR: [{ occurrence_at: null }, { occurrence_at: { gte: vendorsFrom, lt: vendorsTo } }] }',
    'prisma.operations_stays.findMany({ where: { user_id: user.id }',
    'prisma.operations_stop_records.findMany({', 'where: { user_id: user.id, occurrence_at: { gte: recordsFrom, lt: recordsTo } }', 'include: RECORD_PLAN,',
    'prisma.operations_stop_records.findFirst({ where: { user_id: user.id }, include: RECORD_PLAN, orderBy: { occurrence_at: \'asc\' } })',
    'const built = buildRoutineBudgetLines(routineInputs, from, to);',
    'toReportAccount(row, bookOf(row.entity_id',
    'const ledger = ledgerOf({',
    'return NextResponse.json({ from, to, as_of: now.toISOString(), first_record: firstRecord, rows: ledger.rows, said: ledger.said });',
  ], 'the cookie, the user, the span, the clock once, the reads, the rules, the answer');
  assert.doesNotMatch(r, /\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(|\$executeRaw|\$queryRaw|writeAuditLog/, 'read only: nothing is written');
  // LEDGER-03 (Alex, 2026-10-19): the route reads the caller's planned_item_links — the books' link, by ruling — and the postings' lines through the one leaf (postingAmount.ts); nothing else of the books, no travel, no paid call.
  assert.doesNotMatch(r, /ledger_entries|journal_entries\.|transactions\b|budget_line_items|trip_itinerary|calendar_events|fetch\(/, 'nothing of the books but the link, no travel, no paid call');
  assert.equal((r.match(/prisma\.planned_item_links\.findMany\(/g) ?? []).length, 1, 'the one read of the link (LEDGER-03)');
  assert.match(r, /const recordsFrom = new Date\(Date\.parse\(`\$\{from\}T00:00:00\.000Z`\) - 14 \* HOUR_MS\);\n\s*const recordsTo = new Date\(Date\.parse\(`\$\{to\}T00:00:00\.000Z`\) \+ 36 \* HOUR_MS\);/, 'the any-zone window (recordWindow’s rule) over the span');
  assert.match(r, /const vendorsFrom = new Date\(Date\.parse\(`\$\{from\}T00:00:00\.000Z`\) - DAY_MS\);\n\s*const vendorsTo = new Date\(Date\.parse\(`\$\{to\}T00:00:00\.000Z`\) \+ 2 \* DAY_MS\);/, 'the vendors’ window (vendorWindow’s rule) over the span');
  assert.match(r, /if \(error instanceof BudgetDaysError \|\| error instanceof BudgetInputError\) \{\n\s*return NextResponse\.json\(\{ error: error\.code, message: error\.message \}, \{ status: 500 \}\);/, 'the day rules’ and the inputs’ refusals, by code — as the report answers them');
  assert.match(r, /return failClosedResponse\('Ledger GET', 'Failed to load the ledger', error\);/);
  assert.match(r, /firstRecord = \{ words: refusedWords\('timezone not recognised'/, 'ALL’s first day: its zone unreadable is said, never UTC');
  assert.doesNotMatch(r, /requireTier|selectedEntityId|entity_id: selected/, 'every entity of the caller — the COA says which book');
  const mw = code(MIDDLEWARE);
  const publicList = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw);
  assert.ok(publicList !== null);
  for (const m of publicList![1].matchAll(/'([^']+)'/g)) assert.ok(!('/api/operations/ledger' === m[1] || '/api/operations/ledger'.startsWith(`${m[1]}/`)), `not public (${m[1]})`);
  assert.match(comments(ROUTE), /LEDGER-01, Alex, 2026-10-16/);
});

// ── T6 · THE READ, THE SECTION, THE PAGE, THE LAW ───────────────────────────

test('T6 the read: one URL through the one reader; an answer without its rows is a failure in words', async () => {
  const reads = code(READS);
  assert.match(reads, /import \{ readJson, type Read \} from '\.\.\/week\/weekReads';/);
  assert.match(reads, /await readJson\(`\/api\/operations\/ledger\?\$\{new URLSearchParams\(\{ from, to \}\)\.toString\(\)\}`\)/);
  assert.equal((reads.match(/\bfetch\s*\(/g) ?? []).length, 0);
  const calls: string[] = [];
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  g.fetch = async (url: string) => { calls.push(url); return new Response(JSON.stringify({ from: '2026-10-01', to: '2026-10-31', as_of: 'x', first_record: null, rows: [], said: {} }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const read = await readLedger('2026-10-01', '2026-10-31');
    assert.ok(read.ok);
    assert.deepEqual(calls, ['/api/operations/ledger?from=2026-10-01&to=2026-10-31']);
    g.fetch = async () => new Response(JSON.stringify({ hello: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
    const bad = await readLedger('2026-10-01', '2026-10-31');
    assert.deepEqual(bad, { ok: false, words: ledgerFailedWords('the ledger came back without its rows') });
    g.fetch = async () => new Response(JSON.stringify({ error: 'Validation', message: spanWords(401) }), { status: 400, headers: { 'content-type': 'application/json' } });
    const refused = await readLedger('2025-09-26', '2026-10-31');
    assert.deepEqual(refused, { ok: false, words: ledgerFailedWords(`Validation: ${spanWords(401)}`) }, 'the route’s own words');
  } finally {
    g.fetch = real;
  }
});

test('T6 the section: the sixteen columns (LEDGER-02; ten until then), the period and the filters, the TOTAL row, what is said, the summary — every sentence the rules file’s; reads through the one read; no entity, nothing written, nothing stored', () => {
  const s = code(SECTION);
  assert.match(s, /^'use client';/m);
  assert.match(s, /import \{ readLedger, type LedgerAnswer \} from '\.\/ledgerReads';/);
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|useOperationsEntity|selectedEntityId|method:/, 'no fetch of its own, nothing stored, the entity selector not read, nothing written');
  assert.match(s, /const \[kind, setKind\] = useState<PeriodKind>\('month'\);/, 'Month is the default');
  assert.match(s, /setToday\(t\);\n\s*setAnchor\(t\);/, 'anchored today (localToday, on mount)');
  assert.match(s, /const period = today === null \|\| anchor === null \? null : periodOf\(kind, anchor, today, firstRecordDay\);/);
  assert.match(s, /const read = await readLedger\(period\.from, period\.to\);/);
  // LEDGER-04 (Alex, 2026-10-20): the rows filtered by every column (applyColumnFilters) then sorted (sortRows) — the totals and the summary still follow the rows shown.
  assert.match(s, /const shown = sortRows\(applyColumnFilters\(rows, filters\), sort\);\n\s*const totals = ledgerTotals\(shown\);\n\s*const groups = ledgerSummary\(shown, by\);/, 'the totals and the summary follow the rows shown');
  // IDIOM-01 (Alex, 2026-10-24): the headers are the shared DataTable's — one per column of the spec the section hands it (ledger.ts LEDGER_TABLE, the sixteen).
  const t = code(TABLE);
  assert.match(t, /\{columns\.map\(\(c\) => \{/, 'LEDGER-04 → IDIOM-01: one header per column, each with its sort and its filter');
  assert.match(s, /<DataTable\n\s*name="ledger"\n\s*columns=\{LEDGER_TABLE\}/, 'the section hands the shared table its name and its sixteen columns');
  // LEDGER-02 (Alex, 2026-10-19): sixteen columns in Alex's order — one fact each; until then the ten: DATE · CITY · COUNTRY · COA · VENDOR · DESCRIPTION · STARS · NOTES · BUDGET · ACTUAL.
  // LEDGER-04 (Alex, 2026-10-20): the stop's name is the SUB ACCOUNT NAME (was DESCRIPTION) and the note is the DESCRIPTION (was NOTES).
  assert.deepEqual(LEDGER_HEAD_WORDS, ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'STARS', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION']);
  // IDIOM-01 (Alex, 2026-10-24): eight attributes left for the shared table — written there with the caller's name (dataAttr), "ledger" here; the loop after this one holds them there.
  for (const attr of ['data-ledger', 'data-ledger-period={k}', 'data-ledger-previous', 'data-ledger-anchor', 'data-ledger-next', 'data-ledger-notes-toggle', 'data-ledger-row={row.key}', 'data-ledger-cell="day"', 'data-ledger-cell="date"', 'data-ledger-cell="city"', 'data-ledger-cell="country"', 'data-ledger-cell="book"', 'data-ledger-cell="account"', 'data-ledger-cell="account-name"', 'data-ledger-cell="vendor"', 'data-ledger-cell="sub-account-name"', 'data-ledger-cell="stars"', 'data-ledger-cell="description"', 'data-ledger-cell="budget"', 'data-ledger-cell="actual"', 'data-ledger-cell="variance"', 'data-ledger-cell="match"', 'data-ledger-cell="under-over"', 'data-ledger-total', 'data-ledger-total-budget', 'data-ledger-total-actual', 'data-ledger-total-variance', 'data-ledger-total-match', 'data-ledger-total-under-over', 'data-ledger-said', 'data-ledger-said-variance', 'data-ledger-said-match', 'data-ledger-said-no-line', 'data-ledger-said-no-stay', 'data-ledger-said-unplaced', 'data-ledger-said-not-recorded', 'data-ledger-said-not-placed', 'data-ledger-said-today-rule', 'data-ledger-said-every-book', 'data-ledger-summary', 'data-ledger-by={g}', 'data-ledger-group={g.key}', 'data-ledger-group-per-day', 'data-ledger-group-stars', 'data-ledger-none', 'data-ledger-loading', 'data-ledger-failed', 'data-ledger-no-first']) {
    assert.ok(s.includes(attr), `the section carries ${attr}`);
  }
  for (const attr of [`dataAttr(name, 'controls')`, `dataAttr(name, 'filter', c.key)`, `dataAttr(name, 'sort', c.key)`, `dataAttr(name, 'clear-filters')`, `dataAttr(name, 'table')`, `dataAttr(name, 'csv')`, `dataAttr(name, 'csv-why')`, `dataAttr(name, 'none-shown')`]) {
    assert.ok(t.includes(`{...${attr}}`), `the shared table carries ${attr}`);
  }
  // LEDGER-02 (Alex, 2026-10-19): sixteen cells in the head's order (ledger02.test.ts holds each against LEDGER_HEAD_WORDS); until then ten, DATE printing dayShortWords and COA the combined cell.
  inOrder(s, ['data-ledger-cell="day">{dayLongWords(row.day)}', 'data-ledger-cell="date">{row.day}', 'data-ledger-cell="city">{CELL_WORDS.city(row)}', 'data-ledger-cell="country">{CELL_WORDS.country(row)}', 'data-ledger-cell="book">{bookCellWords(row)}', 'data-ledger-cell="account">{accountCellWords(row)}', 'data-ledger-cell="account-name">{accountNameCellWords(row)}', 'data-ledger-cell="sub-account-name">{row.description}', 'data-ledger-cell="vendor">{vendorCellWords(row.vendor)}', 'data-ledger-cell="stars">{starsCellWords(row.rating)}', 'data-ledger-cell="budget">{budgetCellWords(row.cents)}', 'data-ledger-cell="actual">{actualCellWords(row)}', 'data-ledger-cell="variance">{varianceCellWords(row.varianceCents)}', 'data-ledger-cell="match" title={matchCellTitle(row.match) ?? undefined}>', '<span data-ledger-match>{matchCellWords(row.match)}</span>', 'data-ledger-link={row.key}', 'data-ledger-cell="under-over">{underOverWords(row.varianceCents)}', 'data-ledger-cell="description">{noteCellWords(row.note)}'], 'the sixteen cells, each its words'); // LEDGER-04: row.description under SUB ACCOUNT NAME, row.note under DESCRIPTION
  assert.match(s, /actualTone\(delta\.over\)/, 'the ACTUAL cell in the row’s tone (deltaWords), as the card');
  // LEDGER-02 (Alex, 2026-10-19): the TOTAL row's ACTUAL cell is the amount alone — the words span (totals.words, against the recorded rows' budgets) left it; VARIANCE and UNDER / OVER follow, from the two totals.
  inOrder(s, ['<tfoot>', '{TOTAL_WORDS}', 'budgetCellWords(totals.budgetCents)', 'budgetCellWords(totals.actualCents)}</td>', 'varianceCellWords(totals.varianceCents)', 'data-ledger-total-match', 'underOverWords(totals.varianceCents)'], 'the TOTAL row under the table');
  assert.doesNotMatch(s, /data-ledger-total-words|\{totals\.words\}/, 'the TOTAL row prints no delta words since LEDGER-02 (the summary still prints each group’s)');
  // LEDGER-04 (Alex, 2026-10-20): the lines sit inside the notes toggle's open state (data-ledger-notes-toggle, then {notesOpen && (), each shown when its count is above 0 — the same words, in the same order. Moved, not loosened.
  inOrder(s, ['data-ledger-notes-toggle', '{notesOpen && (', 'data-ledger-said', 'noLineWords(answer.read.value.said.noLine, answer.read.value.said.doubled)', 'noStayWords(answer.read.value.said.noStay)', 'unplacedWords(answer.read.value.said.unplaced)', 'notRecordedWords(answer.read.value.said.notRecorded)', 'answer.read.value.said.notPlaced > 0 && <p', 'notPlacedWords(answer.read.value.said.notPlaced)', '{TODAY_RULE_WORDS}', '{EVERY_BOOK_WORDS}'], 'said, by name and count, under the table');
  inOrder(s, ['{SUMMARY_TITLE_WORDS}', 'GROUP_KEYS.map((g)', '<th className={head}>{GROUP_WORDS[by]}</th>', 'SUMMARY_HEAD_WORDS.map', 'daysWords(g.days)', 'budgetCellWords(g.totals.budgetCents)', 'budgetCellWords(g.totals.actualCents)', '{g.totals.words}', 'perDayWords(g.perDayCents)', 'averageStarsWords(g.stars)'], 'the summary, grouped by one selector');
  assert.match(s, /const \[by, setBy\] = useState<GroupKey>\('city'\);/, 'the summary opens by City — the question the ledger answers');
  assert.match(s, /\{PERIOD_KINDS\.map\(\(k\) => \(/);
  // LEDGER-04 (Alex, 2026-10-20): the three dropdowns are gone — a ▾ on every header opens the column's popover (ledger04.test.ts); a new period still starts with every filter off.
  assert.doesNotMatch(s, /<select|<option/, 'no dropdown');
  assert.match(s, /useEffect\(\(\) => \{\n\s*setFilters\(NO_COLUMN_FILTERS\);\n\s*setOpenFilter\(null\);\n\s*\}, \[period\?\.from, period\?\.to\]\);/, 'a new period starts with every filter off');
  assert.match(s, /disabled=\{kind === 'all' \|\| anchor === null\}/, 'ALL does not step');
  // No sentence of its own: every string the section prints is a constant or a words function of the rules file, or the card's own day words.
  const printed = [...s.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.ok(printed.length > 20);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(s, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  assert.doesNotMatch(s, /<StageStrip|<ProofStrip|HubCalendar/, 'no strip, no grid (the two-lists law walks this tree)');
  assert.equal(LEDGER_TITLE_WORDS, 'Task ledger'); // LEDGER-02 (Alex, 2026-10-19): 'City ledger' until then — "it's really a Task Ledger, not a City Ledger"
  assert.equal(LEDGER_LOADING_WORDS, 'reading the ledger…');
  assert.equal(ledgerFailedWords('x'), 'The ledger could not be read — x');
  assert.equal(NO_ROWS_SHOWN_WORDS, 'no row matches the filters');
  assert.equal(SUMMARY_TITLE_WORDS, 'over time, by place and by book'); // LEDGER-02: 'over time and by place' until then
  assert.deepEqual(SUMMARY_HEAD_WORDS, ['DAYS', 'BUDGET', 'ACTUAL', 'UNDER / OVER', 'ACTUAL PER RECORDED DAY', 'STARS']);
  assert.equal(TOTAL_WORDS, 'TOTAL');
  assert.doesNotMatch(s, /\b(bg-black|bg-panel|bg-brand-red|bg-brand-gold|bg-brand-green)\b/, 'no dark fill (the repaint law)');
});

// TIME-01 (Alex, 2026-10-19): the ledger moved to /time with the day card — under the card, above the pipeline; the Tasks page
// keeps the LEDGER-01 ruling in its history and mounts it no more (time01.test.ts holds the split).
// TIME-02 (2026-10-19): the content pipeline beneath the ledger is retired — the ledger is the last section of /time.
test('T6 the ledger mounts on /time under the day card; the two-lists law holds both containers, with the dated rulings', () => {
  const page = code('src/app/time/page.tsx');
  assert.match(page, /import LedgerSection from '@\/components\/workbench\/operations\/ledger\/LedgerSection';/);
  // JOURNAL-07 (Alex, 2026-10-24): the two journal tables mount under the ledger — the /time container is four (TIME_MOUNTS), the ledger still the section after the card.
  assert.match(page, /<\/Suspense>\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>/);
  assert.equal((page.match(/<LedgerSection \/>/g) ?? []).length, 1, 'mounted once');
  assert.match(comments(PAGE), /LEDGER-01 \(Alex, 2026-10-16\) — THE CITY LEDGER is the fourth section, under\s*\n\s*\* Routines/);
  assert.doesNotMatch(code(PAGE), /LedgerSection/, 'the Tasks page mounts it no more');
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>'\];/);
  assert.match(law, /const TIME_MOUNTS = \['<DayCard \/>', '<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  // JOURNAL-07 (Alex, 2026-10-24): TIME_MOUNTS is the four — the day card, the ledger, then the morning and the evening journal tables.
  assert.match(law, /timeMounts\.join\(' '\) !== 'DayCard LedgerSection MorningJournalTable EveningJournalTable'/, 'exactly the four on /time (TIME-02; JOURNAL-07)');
  assert.match(comments(LAW), /LEDGER-01 — the ruling \(Alex, 2026-10-16\): the city ledger is a fourth section, under Routines/);
  // The rules file is pure: no fetch, no clock of its own, no Prisma, no React; the clock is handed in.
  const rules = code(RULES);
  assert.doesNotMatch(rules, /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|from 'next/, 'pure');
  assert.match(rules, /readonly now: Date;/);
  assert.match(rules, /if \(read\.address\.instant\.getTime\(\) >= input\.now\.getTime\(\)\) continue;/, '"already past" against the clock handed in');
  assert.match(rules, /if \(!isStop\(role\)\) continue;/, 'an all-day line is in the plan, not a stop');
  assert.match(rules, /const plan = dayPlanOf\(\{ view: \{ kind: 'day', day \}, lines: input\.lines, notPlaced: input\.notPlaced, routines: input\.routines, tasks: new Map\(\), vendors: input\.vendors \}\);/, 'the vendor by the plan’s grain — planLines.ts’s rule, reused');
  assert.match(rules, /const exact = linesByDay\.get\(day\)\?\.get\(key\) \?\? \[\];\n\s*const line = exact\.length === 1 \? exact\[0\] : null;/, 'the card’s match: one line at the exact instant');
  assert.match(rules, /description: line !== null \? stopName\(\{ line: line\.line, label: line\.label \}\) : stopName\(\{ line: r\.activity, label: r\.routineName \}\),/, 'the card’s bold name, either way');
  assert.match(rules, /place: stay === null \? null : placeParts\(stay\.place\),/);
  // LEDGER-02 (Alex, 2026-10-19): the ACTUAL cell is the amount alone (planDollars) — until then rowActualWords(row.actualCents, row.cents), the card's words with the delta.
  assert.match(rules, /row\.actualCents === null \? BLANK : planDollars\(row\.actualCents\)/, 'the ACTUAL amount in the card’s dollars');
  assert.doesNotMatch(rules, /rowActualWords\(/, 'no delta in the ACTUAL cell since LEDGER-02');
});
