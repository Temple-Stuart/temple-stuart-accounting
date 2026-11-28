/**
 * EDIT-02 (Alex, 2026-11-28) — EVERY CELL OPENS, EXCEPT THE FORMULAS: "only some of the fileds can be edited by clicking on the cell... not
 * all.... they should all be able to be edited, eccept for formula driven cells..."
 *
 * PART 0 — a plan coded on a Books line is refused by name (routines/[id]/route.ts DELETE; src/lib/operations/linkHold.ts).
 * PART 1 — the open rule: every column but the six worked out. PART 2 — the plan's cells on every plan, ITEMS, and the trip's place.
 * PART 3 — DATE: a one-off moves with its rows. Each part's tests land in the commit that builds it.
 *
 * HERMETIC, on edit01.test.ts's model — no database, no network, the only clock the one handed in. The rules are DRIVEN directly over
 * made-up rows; the routes and the screens are anchored to their source with comments stripped (the reader law). Every plan, vendor,
 * place, day, account and amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import { buildRoutineOpenLines } from '../budget/openLines';
import type { RoutineWords } from '../budget/planLines';
import { isOnceRRule } from '../operations/rruleHelpers';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  CELL_REACH_WORDS, CHARGE_TAKES_NO_RECORD_WORDS, ITEMS_CELL_NO_VENDOR_WORDS, LEDGER_COLUMNS, NEVER_OPENS_WORDS, NO_PLAN_LINE_WORDS, PLAN_CELLS, REPEATING_DATE_WORDS, REPEATING_REACH_WORDS, TAG_NEEDS_VENDOR_WORDS, TYPED_COLUMNS,
  boxTextOf, cellOpens, cellReachWords, ledgerOf, nextOpeningColumn, planCellWrite, planMinutesOf, routineClocksOf,
  type LedgerEditingPlan, type LedgerInput, type LedgerRecordInput, type LedgerSheetRow, type LedgerVendorRow,
} from '../operations/ledger';
import { ROUTINE_CODED_ON_BOOKS_WORDS, routineHoldsLinksWords } from '../operations/linkHold';
import { deleteRow } from '../../components/workbench/operations/ledger/cellSaves';

const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const HOLD = 'src/lib/operations/linkHold.ts';
const SHEET_RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';

/** A handler's body in a route's source: from its export to the next export. */
const bodyOf = (src: string, verb: string): string => {
  const at = src.indexOf(`export async function ${verb}(`);
  if (at < 0) return assert.fail(`no ${verb} in the route`);
  const next = src.indexOf('\nexport async function ', at + 1);
  return src.slice(at, next < 0 ? undefined : next);
};
/** Each step found after the one before it. */
const inOrder = (text: string, steps: readonly string[], what: string): void => {
  let from = 0;
  for (const step of steps) {
    const i = text.indexOf(step, from);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(step)} comes after the step before it`);
    from = i + step.length;
  }
};
type Sent = { readonly url: string; readonly method: string; readonly body: unknown };
/** A stand-in fetch: every request recorded, each answered in turn from the queue handed in — and every answer queued is asked for. */
async function standIn<T>(queue: readonly (readonly [number, unknown])[], run: () => Promise<T>): Promise<{ readonly result: T; readonly sent: readonly Sent[] }> {
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const sent: Sent[] = [];
  const left = [...queue];
  g.fetch = async (url: string, init?: RequestInit) => {
    sent.push({ url, method: init?.method ?? 'GET', body: init?.body === undefined ? null : JSON.parse(String(init.body)) });
    const next = left.shift();
    if (next === undefined) throw new Error(`no answer queued for ${url}`);
    return new Response(JSON.stringify(next[1]), { status: next[0], headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await run();
    assert.equal(left.length, 0, 'every queued answer was asked for');
    return { result, sent };
  } finally {
    g.fetch = real;
  }
}

// ── THE FIXTURE — every plan, vendor, place, day and amount made up ──────────

const NBO = 'Africa/Nairobi'; // UTC+3 the year round
const THU = '2027-03-04';
const FRI = '2027-03-05';
/** Thursday 18:00 in the zone: Thursday's stops are past, Friday's ahead. */
const NOW = new Date('2027-03-04T15:00:00.000Z');
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();
/** A routine's clock as the database's @db.Time reads into JSON. */
const timeJson = (clock: string): string => `1970-01-01T${clock}:00.000Z`;
const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: NBO, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
const line = (id: string, budgetAmount: number, coaCode: string, durationMinutes: number | null) => ({ id, stepOrder: 1, budgetAmount, coaCode, durationMinutes, timeOfDay: null });
const ROUTINES: RoutinePlanInput[] = [
  // A ONE-OFF, as "+ expense" writes one, past by the clock — Lunch at Harbor Cafe.
  routine({ id: 'lunch', name: 'Lunch · 2027-03-04 12:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', startDate: THU, endDate: THU, startTime: timeJson('12:00'), steps: [line('lunch-line', 15, '6150', 45)] }),
  // A one-off, past, with no vendor.
  routine({ id: 'snack', name: 'Snack · 2027-03-04 09:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=9;BYMINUTE=0', startDate: THU, endDate: THU, startTime: timeJson('09:00'), steps: [line('snack-line', 4, '6150', null)] }),
  // A one-off ahead, with no vendor.
  routine({ id: 'dinner', name: 'Dinner · 2027-03-05 19:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=19;BYMINUTE=0', startDate: FRI, endDate: FRI, startTime: timeJson('19:00'), steps: [line('dinner-line', 25, '6150', null)] }),
  // A CHARGE on its date — all day, no clock.
  routine({ id: 'rent', name: 'Rent · 2027-03-05', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=0;BYMINUTE=0', startDate: FRI, endDate: FRI, role: 'all_day', steps: [line('rent-line', 900, '6300', null)] }),
  // A one-off with NO LINE of its own — its routine holds the money and the window.
  routine({ id: 'laundry', name: 'Laundry · 2027-03-04 15:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=15;BYMINUTE=0', startDate: THU, endDate: THU, startTime: timeJson('15:00'), endTime: timeJson('16:00'), budgetAmount: 6, coaCode: '6150' }),
  // A REPEATING plan with no line — its own clock 07:00 to 08:00; Iron Works its vendor for EVERY occurrence.
  routine({ id: 'gym', name: 'Morning Gym', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', startTime: timeJson('07:00'), endTime: timeJson('08:00'), budgetAmount: 20, coaCode: '6200' }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]).concat([['kiosk', 'place']]));
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: NBO, steps: new Map(r.steps.map((s) => [s.id, { activity: r.name.split(' · ')[0], timeOfDay: null }])),
}]));
const VENDORS: LedgerVendorRow[] = [
  { id: 'pv-lunch', routine_id: null, step_id: 'lunch-line', task_id: null, occurrence_at: new Date(at(THU, '12:00')), items: 'soup and bread', vendor: { id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: 'harbor.cafe' }, routine: null, step: { activity: 'Lunch', routine_id: 'lunch', routine: { name: 'Lunch · 2027-03-04 12:00', timezone: NBO } }, task: null },
  { id: 'pv-gym', routine_id: 'gym', step_id: null, task_id: null, occurrence_at: null, items: null, vendor: { id: 'v-iron', vendor_name: 'Iron Works', entity_id: 'P', instagram_tag: null }, routine: { name: 'Morning Gym', timezone: NBO }, step: null, task: null },
];
const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
const stop = (routineId: string, routineName: string, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId, routineName, zone: NBO, role: 'place', activity: null, timeOfDay: null, durationMinutes: null });
const RECORDS: LedgerRecordInput[] = [
  // Thursday's gym, recorded on its own line.
  stop('gym', 'Morning Gym', record({ id: 'r-gym', kind: 'routine', target_id: 'gym', occurrence_at: at(THU, '07:00'), actual_cents: 2000 })),
  // A record of a plan the loader no longer lists — no line is joined to it.
  stop('kiosk', 'Kiosk', record({ id: 'r-kiosk', kind: 'routine', target_id: 'kiosk', occurrence_at: at(THU, '10:00'), actual_cents: 150 })),
];
/** The trip: Thursday is in it, Friday is not. */
const HARBOR = { id: 'stay-harbor', place: 'Harbor Town, Coast Province, Examplia', starts_on: '2027-03-02', ends_on: THU };
const built = buildRoutineBudgetLines(ROUTINES, THU, FRI);
const opened = buildRoutineOpenLines(ROUTINES, THU, FRI);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: THU, to: FRI, now: NOW, records: RECORDS, links: [], lines: built.lines, open: opened.open, notPlaced: [...built.notPlaced, ...opened.notPlaced], routines: WORDS, roles: ROLES,
  locations: new Map(ROUTINES.map((r): [string, null] => [r.id, null])), once: new Map(ROUTINES.map((r): [string, boolean] => [r.id, isOnceRRule(r.scheduleRrule)])), clocks: routineClocksOf(ROUTINES),
  subAccounts: [], minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: [HARBOR],
  accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }, { entityId: 'P', code: '6300', name: 'Rent' }], books: [{ id: 'P', entityType: 'personal' }], ...over,
});
const ledger = ledgerOf(input());
/** The rows of a description on a day — recorded or not. */
const rowsOf = (description: string, day: string, recorded: boolean): LedgerSheetRow[] => {
  const found = ledger.sheet.filter((r) => r.description === description && r.day === day && (r.id !== null) === recorded);
  if (found.length === 0) return assert.fail(`no ${recorded ? 'recorded' : 'plan'} row ${description} on ${day}`);
  return found;
};
const rowOf = (description: string, day: string, recorded: boolean): LedgerSheetRow => rowsOf(description, day, recorded)[0];
const planOf = (row: LedgerSheetRow): LedgerEditingPlan => { const e = ledger.editing[row.key]; if (!e.plan) return assert.fail(`${row.key} has no plan`); return e; };
const thrown = (run: () => unknown): string => { try { run(); } catch (error) { return error instanceof Error ? error.message : String(error); } return assert.fail('it did not throw'); };
/** Each typed cell's refusal before any typing, on a row — the cells whose save is refused, and why. */
const refusedOf = (row: LedgerSheetRow): Record<string, string> => Object.fromEntries(TYPED_COLUMNS.flatMap((c) => { const refusal = cellOpens(c, row, ledger.recording[row.key], ledger.editing[row.key]).refusal; return refusal === null ? [] : [[c, refusal]]; }));

// ── PART 0 — A PLAN CODED ON A BOOKS LINE IS REFUSED BY NAME ─────────────────

// ── X1 · THE DELETE COUNTS THE BOOKS LINES CODED TO THE PLAN (ruling 0.1, HARD GATE 3) ──

test('X1 the routine DELETE counts the Books lines coded to the plan inside the transaction that counts its links — any coded refuses 409 by name before the delete, nothing deleted; the ✕’s line says it in those words', async () => {
  // The words, typed whole — one line, and many.
  assert.equal(ROUTINE_CODED_ON_BOOKS_WORDS(1), 'this plan is coded on 1 line in Books — re-code it there first, or deactivate the plan on Expenses');
  assert.equal(ROUTINE_CODED_ON_BOOKS_WORDS(3), 'this plan is coded on 3 lines in Books — re-code them there first, or deactivate the plan on Expenses');
  assert.equal(routineHoldsLinksWords(2), 'this routine has 2 postings linked in Books — deactivate it instead (every record stays)', 'the links’ words stand');
  assert.match(comments(HOLD), /EDIT-02 \(Alex, 2026-11-28\) — A PLAN CODED ON A BOOKS LINE\./);
  // The route: the gates in their order, then ONE transaction — the lines, the links, the Books lines coded to the routine, the delete.
  const route = code(ROUTINE_ROUTE);
  assert.match(route, /import \{ ROUTINE_CODED_ON_BOOKS_WORDS, routineHoldsLinksWords, routineLinksWhere \} from '@\/lib\/operations\/linkHold';/);
  const del = bodyOf(route, 'DELETE');
  inOrder(del, [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    'const existing = await loadAuthorizedRoutine(id, user.id);',
    "if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    'let coded = 0;',
    'const linked = await prisma.$transaction(async (tx) => {',
    'const held = await tx.planned_item_links.count({ where: routineLinksWhere(user.id, id, lineIds) });',
    'if (held > 0) return held;',
    'coded = await tx.ledger_line_links.count({ where: { routine_id: id } });',
    'if (coded > 0) return 0;',
    'await tx.operations_routines.delete({ where: { id } });',
    'return 0;',
    '});',
    'if (linked > 0) return NextResponse.json({ error: routineHoldsLinksWords(linked) }, { status: 409 });',
    'if (coded > 0) return NextResponse.json({ error: ROUTINE_CODED_ON_BOOKS_WORDS(coded) }, { status: 409 });',
    'await writeAuditLog({',
  ], 'the routine DELETE');
  // Nothing deleted: the count and its return stand inside the transaction, before the one delete; the audit and the answer come after both refusals.
  const tx = del.slice(del.indexOf('const linked = await prisma.$transaction(async (tx) => {'), del.indexOf('if (linked > 0) return'));
  assert.ok(tx.indexOf('if (coded > 0) return 0;') < tx.indexOf('await tx.operations_routines.delete({ where: { id } });'), 'refused before the delete, in the same transaction');
  assert.equal((route.match(/operations_routines\.delete\(/g) ?? []).length, 1, 'one delete, inside the transaction');
  assert.equal((route.match(/ledger_line_links\./g) ?? []).length, 1, 'the Books lines are counted — and nothing else is done with them');
  assert.doesNotMatch(route, /ledger_line_links\.(delete|deleteMany|update|updateMany|create|upsert)\(/, 'never written here');
  // The ✕'s line: the route's refusal read the writers' one way — said in its words, nothing else sent.
  const run = await standIn([[409, { error: ROUTINE_CODED_ON_BOOKS_WORDS(2) }]], () => deleteRow({ kind: 'routine', routineId: 'lunch', question: 'delete this row — Lunch on 2027-03-04, with its record and its vendor?' }));
  assert.deepEqual([run.result, ...run.sent], [{ ok: false, words: ROUTINE_CODED_ON_BOOKS_WORDS(2) }, { url: '/api/operations/routines/lunch', method: 'DELETE', body: null }]);
});

// ── PART 1 — THE OPEN RULE: EVERY COLUMN BUT THE SIX ─────────────────────────

// ── X2 · THE COLUMNS (ruling 1.1) ────────────────────────────────────────────

test('X2 the columns he types are every column of the sheet but the six worked out, in the sheet’s order — DATE, CITY, REGION, COUNTRY and ENTITY joined; the six never open, each saying why in its own sentence', () => {
  const SIX = ['day', 'plannedMinutes', 'account', 'variance', 'match', 'underOver'];
  assert.deepEqual([...TYPED_COLUMNS], LEDGER_COLUMNS.filter((c) => !SIX.includes(c)), 'every column but the six, in order');
  assert.deepEqual([...TYPED_COLUMNS], ['date', 'start', 'end', 'city', 'region', 'country', 'location', 'accountName', 'book', 'subAccountName', 'description', 'vendor', 'instagramTag', 'went', 'stars', 'loggedMinutes', 'budget', 'actual', 'notes']);
  assert.deepEqual(Object.keys(NEVER_OPENS_WORDS), SIX, 'the six alone, in the sheet’s order');
  assert.deepEqual(NEVER_OPENS_WORDS, {
    day: 'worked out from DATE',
    plannedMinutes: 'worked out from START and END',
    account: 'worked out from the codes of LOCATION, CATEGORY, ENTITY and TYPE',
    variance: 'worked out — ACTUAL less BUDGET',
    match: 'the postings linked in Books — changed by its "link"',
    underOver: 'worked out from the sign of VARIANCE',
  });
  // Tab walks every typed column in turn.
  assert.equal(nextOpeningColumn('date'), 'start');
  assert.equal(nextOpeningColumn('location'), 'accountName');
  assert.equal(nextOpeningColumn('accountName'), 'book');
  assert.equal(nextOpeningColumn('notes'), null);
  // In the source: the five that joined carry their click and their box, as every typed cell does.
  const s = code(SECTION);
  const row = s.slice(s.indexOf('data-ledger-row={row.key}'), s.indexOf('{open !== null && open.key === row.key && ('));
  assert.deepEqual([...row.matchAll(/onClick=\{\(e\) => clickCell\(e, row, '(\w+)'\)\}/g)].map((m) => m[1]), [...TYPED_COLUMNS]);
  assert.deepEqual([...row.matchAll(/\{boxIn\(row, '(\w+)'\) \?\? /g)].map((m) => m[1]), [...TYPED_COLUMNS]);
  assert.ok(row.includes(`data-ledger-cell="date" title={titleOf(row, 'date')} onClick={(e) => clickCell(e, row, 'date')}>{boxIn(row, 'date') ?? row.day}</td>`));
});

// ── X3 · THE TRIP AND THE PLAN'S OWN CLOCK IN THE ANSWER (ruling 1.2) ────────

test('X3 every row’s entry carries its day’s trip — the stay its CITY · REGION · COUNTRY are read from, on a row with its plan and on one with none — and a row with its plan its routine’s own clock; both built from what the rule already holds, a clock not read thrown by name', () => {
  const trip = { id: 'stay-harbor', place: 'Harbor Town, Coast Province, Examplia', startsOn: '2027-03-02', endsOn: THU };
  // Thursday is in the trip — a plan row, a recorded row with its plan, a recorded row with none; Friday is not.
  assert.deepEqual(ledger.editing[rowOf('Lunch', THU, false).key].trip, trip);
  assert.deepEqual(ledger.editing[rowOf('Morning Gym', THU, true).key].trip, trip);
  assert.deepEqual(ledger.editing[rowOf('Kiosk', THU, true).key], { plan: false, words: NO_PLAN_LINE_WORDS, trip }, 'a row with no plan carries the trip too');
  assert.equal(ledger.editing[rowOf('Dinner', FRI, false).key].trip, null, 'no trip covers Friday');
  // The routine's own clock: START and END as the routine row holds them.
  assert.deepEqual([planOf(rowOf('Morning Gym', FRI, false)).start, planOf(rowOf('Morning Gym', FRI, false)).end], ['07:00', '08:00']);
  assert.deepEqual([planOf(rowOf('Lunch', THU, false)).start, planOf(rowOf('Lunch', THU, false)).end], ['12:00', null]);
  assert.deepEqual([planOf(rowOf('Rent', FRI, false)).start, planOf(rowOf('Rent', FRI, false)).end], [null, null], 'a charge holds no clock');
  assert.deepEqual([...routineClocksOf([routine({ id: 'x', name: 'X', scheduleRrule: 'FREQ=DAILY', startTime: timeJson('06:30'), endTime: null })])], [['x', { start: '06:30', end: null }]]);
  // A routine whose clock was not read is the rule's error, thrown by name — never a guess.
  const clocks = new Map([...routineClocksOf(ROUTINES)].filter(([id]) => id !== 'gym'));
  assert.match(thrown(() => ledgerOf(input({ clocks }))), /^ledger: line \S+ is of routine gym, whose own clock was not read$/);
  assert.deepEqual(JSON.parse(JSON.stringify(ledger.editing)), ledger.editing, 'wire-shaped');
  // Built where it was: the day's stay handed to both entries; the answer reads the clocks from the routines it already holds — no query added.
  const rules = code(SHEET_RULES);
  assert.match(rules, /editingAt\.set\(key, line !== null \? editingOf\(line, key, stay\) : \{ plan: false, words: budgetState === 'doubled' \? TWO_LINES_NO_PLAN_WORDS : NO_PLAN_LINE_WORDS, trip: editingTripOf\(stay\) \}\);/);
  assert.match(rules, /editingAt\.set\(row\.key, lines > 1 \? \{ plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: editingTripOf\(stay\) \} : editingOf\(l, key, stay\)\);/);
  assert.match(rules, /readonly clocks: ReadonlyMap<string, LedgerRoutineClock>;/);
  const answer = code(ANSWER);
  assert.match(answer, /once: new Map\(routineInputs\.map\(\(r\): \[string, boolean\] => \[r\.id, isOnceRRule\(r\.scheduleRrule\)\]\)\),\n\s*clocks: routineClocksOf\(routineInputs\),/);
  assert.equal((answer.match(/\.findMany\(|\.findFirst\(/g) ?? []).length, 9, 'the nine reads as they were — none added');
});

// ── X4 · EVERY CELL OPENS; A REFUSAL IS SAID BEFORE A SAVE (ruling 1.3) ──────

test('X4 every typed cell opens on every kind of row, and every cell that cannot save says why as it opens — a one-off, a repeating plan, a routine with no line, a recorded row with no plan, a charge, a row ahead, ITEMS on a past row', () => {
  // A one-off with its vendor: nothing is refused.
  assert.deepEqual(refusedOf(rowOf('Lunch', THU, false)), {});
  // A one-off ahead, with no vendor: its tag, and its planned items (no record can be written ahead).
  assert.deepEqual(refusedOf(rowOf('Dinner', FRI, false)), { description: ITEMS_CELL_NO_VENDOR_WORDS, instagramTag: TAG_NEEDS_VENDOR_WORDS });
  // A past one-off with no vendor: its tag alone — ITEMS writes its first record.
  assert.deepEqual(refusedOf(rowOf('Snack', THU, false)), { instagramTag: TAG_NEEDS_VENDOR_WORDS });
  // A routine with no line of its own: its line's cells save too (they write the routine's own fields).
  assert.deepEqual(refusedOf(rowOf('Laundry · 2027-03-04 15:00', THU, false)), { instagramTag: TAG_NEEDS_VENDOR_WORDS });
  // A repeating plan — its row ahead and its recorded row: every cell saves but DATE (its days are how it repeats).
  for (const row of [rowOf('Morning Gym', FRI, false), rowOf('Morning Gym', THU, true)]) assert.deepEqual(refusedOf(row), { date: REPEATING_DATE_WORDS('Morning Gym') }, row.key);
  // A charge: its record's cells say it needs a START; its items and its tag ask for a vendor.
  const record = ['went', 'stars', 'loggedMinutes', 'actual', 'notes'];
  assert.deepEqual(refusedOf(rowOf('Rent', FRI, false)), { ...Object.fromEntries(record.map((c) => [c, CHARGE_TAKES_NO_RECORD_WORDS])), description: ITEMS_CELL_NO_VENDOR_WORDS, instagramTag: TAG_NEEDS_VENDOR_WORDS });
  // A recorded row with no plan: its plan's cells, VENDOR, TAG, ENTITY and DATE in its entry's own words; its record's and its trip's save.
  assert.deepEqual(refusedOf(rowOf('Kiosk', THU, true)), Object.fromEntries(['date', ...PLAN_CELLS, 'book', 'vendor', 'instagramTag'].map((c) => [c, NO_PLAN_LINE_WORDS])));
  // The trip's cells save on every row — plan or no plan, trip or none.
  for (const row of ledger.sheet) for (const c of ['city', 'region', 'country'] as const) assert.equal(cellOpens(c, row, ledger.recording[row.key], ledger.editing[row.key]).refusal, null, `${row.key} ${c}`);
  // The words, typed whole.
  assert.equal(CHARGE_TAKES_NO_RECORD_WORDS, 'a charge takes no record — give it a START first');
  assert.equal(REPEATING_DATE_WORDS('Morning Gym'), 'a day of the plan "Morning Gym" — its days are how it repeats; that is changed on Expenses');
  // In the source: every typed cell opens with the refusal the rule knows; a changed text on a refused cell is refused in its words, nothing sent.
  const s = code(SECTION);
  const frame = s.slice(s.indexOf('function useCellFrame('));
  assert.match(frame, /const refusalOf = \(row: LedgerSheetRow, column: TypedColumn\): string \| null => cellOpens\(column, row, recording\[row\.key\], editing\[row\.key\]\)\.refusal;/);
  assert.match(frame, /setOpenCell\(\{ key: row\.key, column \}, boxTextOf\(row, column, editing\[row\.key\]\), refusalOf\(row, column\)\);/, 'opened with its refusal, said on the line at once');
  assert.match(frame, /openRef\.current = next; textRef\.current = opened; heldRef\.current = opened; refusedRef\.current = null;\n\s*setOpen\(next\); setText\(opened\); setCellRefusal\(ruled\); setClearing\(false\);/);
  assert.match(frame, /const ruled = refusalOf\(row, at\.column\);\n\s*if \(ruled !== null\) \{ setCellRefusal\(ruled\); return Promise\.resolve\(false\); \}/, 'Enter refused in those words');
  assert.doesNotMatch(frame, /\.opens\b/, 'no cell is kept shut');
  // ENTITY's box: the provider's books — its list, never its selection; the blank row's no-book words while it has none.
  assert.match(s, /import \{ useOperationsEntity \} from '\.\.\/EntitySelector';/);
  assert.match(frame, /const \{ entities \} = useOperationsEntity\(\);/);
  assert.doesNotMatch(s, /selectedEntityId|setSelectedEntityId|selectedEntity\b/, 'the selection is never read');
  assert.match(frame, /if \(column === 'book'\) return \{ books: entities \};/);
  assert.match(frame, /if \(column === 'book' && entities\.length === 0\) return <span className="text-brand-amber" data-ledger-cell-no-book>\{NO_BOOK_WORDS\}<\/span>;/);
  // The box opens with the cell's value: DATE the day; CITY · REGION · COUNTRY the trip's parts; ENTITY the plan's book.
  const lunch = rowOf('Lunch', THU, false);
  assert.deepEqual(['date', 'city', 'region', 'country', 'book'].map((c) => boxTextOf(lunch, c as typeof TYPED_COLUMNS[number], ledger.editing[lunch.key])), [THU, 'Harbor Town', 'Coast Province', 'Examplia', 'P']);
  const dinner = rowOf('Dinner', FRI, false);
  assert.deepEqual(['city', 'region', 'country'].map((c) => boxTextOf(dinner, c as typeof TYPED_COLUMNS[number], ledger.editing[dinner.key])), ['', '', ''], 'no trip: blank');
  assert.equal(boxTextOf(rowOf('Kiosk', THU, true), 'book', ledger.editing[rowOf('Kiosk', THU, true).key]), '', 'a row with no plan has no book');
  // Between this commit and the one that writes them: a repeating plan's own cell is refused by name — never sent a one-off's body.
  assert.match(thrown(() => planCellWrite(rowOf('Morning Gym', FRI, false), planOf(rowOf('Morning Gym', FRI, false)), 'start', '06:30')), /^ledger: START on a day of the plan "Morning Gym" is not written yet$/);
});

// ── X5 · WHAT A CHANGE REACHES (ruling 1.3) ──────────────────────────────────

test('X5 the line under an open cell says what the change reaches before a save: this row; a repeating plan’s own cell and its ENTITY — every row of the plan; the tag — every row with its vendor', () => {
  const gym = ledger.editing[rowOf('Morning Gym', FRI, false).key];
  for (const c of [...PLAN_CELLS, 'book'] as const) assert.equal(cellReachWords(c, gym), 'every row of the plan "Morning Gym" — every day it repeats, past days too', c);
  assert.equal(REPEATING_REACH_WORDS('Morning Gym'), 'every row of the plan "Morning Gym" — every day it repeats, past days too');
  for (const c of ['vendor', 'description', 'went', 'notes'] as const) assert.equal(cellReachWords(c, gym), CELL_REACH_WORDS, `${c}: this row`);
  assert.equal(cellReachWords('instagramTag', gym), 'the tag of Iron Works — every row with Iron Works');
  const lunch = ledger.editing[rowOf('Lunch', THU, false).key];
  for (const c of [...PLAN_CELLS, 'book', 'date'] as const) assert.equal(cellReachWords(c, lunch), 'this row', `a one-off’s ${c}: this row`);
  assert.equal(cellReachWords('instagramTag', ledger.editing[rowOf('Dinner', FRI, false).key]), 'this row', 'a tag with no vendor saves nothing — its line says why');
  assert.equal(cellReachWords('start', ledger.editing[rowOf('Kiosk', THU, true).key]), 'this row', 'a row with no plan');
});
