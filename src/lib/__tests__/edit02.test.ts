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
  CELL_REACH_WORDS, CHARGE_TAKES_NO_RECORD_WORDS, END_AT_START_WORDS, ITEMS_CELL_NO_VENDOR_WORDS, NEW_TRIP_REACH_WORDS, PLACE_NEEDS_CITY_WORDS, REGION_NEEDS_COUNTRY_WORDS, TRIP_REACH_WORDS, itemsWritesRecord, requiredWords, timeTypedWords, tripCellWrite, LEDGER_COLUMNS, NEVER_OPENS_WORDS, NO_PLAN_LINE_WORDS, PLAN_CELLS, REPEATING_DATE_WORDS, REPEATING_REACH_WORDS, TAG_NEEDS_VENDOR_WORDS, TYPED_COLUMNS,
  boxTextOf, cellOpens, cellReachWords, ledgerOf, nextOpeningColumn, planCellWrite, planMinutesOf, routineClocksOf,
  type LedgerEditingPlan, type LedgerInput, type LedgerRecordInput, type LedgerSheetRow, type LedgerVendorRow,
} from '../operations/ledger';
import { ROUTINE_CODED_ON_BOOKS_WORDS, routineHoldsLinksWords } from '../operations/linkHold';
import { deleteRow, saveCell, savePlanCell, saveTripCell } from '../../components/workbench/operations/ledger/cellSaves';

const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const HOLD = 'src/lib/operations/linkHold.ts';
const SHEET_RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const SAVES = 'src/components/workbench/operations/ledger/cellSaves.ts';

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
  // A REPEATING plan with a line — its own clock 06:00 to 06:45.
  routine({ id: 'swim', name: 'Pool Swim', scheduleRrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0', startTime: timeJson('06:00'), endTime: timeJson('06:45'), steps: [line('swim-line', 8, '6200', 45)] }),
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
  // EDIT-02 (2026-11-28) (PART 2): a repeating plan's own cell is written now (X6) — PART 1 refused it by name here until then, never sending a one-off's body.
  assert.deepEqual(planCellWrite(rowOf('Morning Gym', FRI, false), planOf(rowOf('Morning Gym', FRI, false)), 'start', '06:30'), { ok: true, write: { to: 'routine', routineId: 'gym', body: { start_time: '06:30', end_time: '08:00' } } });
});

// ── X5 · WHAT A CHANGE REACHES (ruling 1.3) ──────────────────────────────────

test('X5 the line under an open cell says what the change reaches before a save: this row; a repeating plan’s own cell and its ENTITY — every row of the plan; the tag — every row with its vendor', () => {
  const gym = ledger.editing[rowOf('Morning Gym', FRI, false).key];
  for (const c of [...PLAN_CELLS, 'book'] as const) assert.equal(cellReachWords(c, gym, FRI), 'every row of the plan "Morning Gym" — every day it repeats, past days too', c);
  assert.equal(REPEATING_REACH_WORDS('Morning Gym'), 'every row of the plan "Morning Gym" — every day it repeats, past days too');
  for (const c of ['vendor', 'description', 'went', 'notes'] as const) assert.equal(cellReachWords(c, gym, FRI), CELL_REACH_WORDS, `${c}: this row`);
  assert.equal(cellReachWords('instagramTag', gym, FRI), 'the tag of Iron Works — every row with Iron Works');
  const lunch = ledger.editing[rowOf('Lunch', THU, false).key];
  for (const c of [...PLAN_CELLS, 'book', 'date'] as const) assert.equal(cellReachWords(c, lunch, THU), 'this row', `a one-off’s ${c}: this row`);
  assert.equal(cellReachWords('instagramTag', ledger.editing[rowOf('Dinner', FRI, false).key], FRI), 'this row', 'a tag with no vendor saves nothing — its line says why');
  assert.equal(cellReachWords('start', ledger.editing[rowOf('Kiosk', THU, true).key], THU), 'this row', 'a row with no plan');
});

// ── PART 2 — THE PLAN'S CELLS ON EVERY PLAN, ITEMS, AND THE TRIP'S CELLS ─────

const OK: readonly [number, unknown] = [200, {}];

// ── X6 · A REPEATING PLAN'S OWN CELLS (ruling 2.1) ───────────────────────────

test('X6 a repeating plan’s own cells: START sends the routine’s own END with it and no name; TYPE the line’s alone; END, CATEGORY and BUDGET the line’s writers; LOCATION the routine’s — each body as the route takes it, each refusal said', async () => {
  const swim = rowOf('Pool Swim', FRI, false);
  const S = planOf(swim);
  assert.deepEqual([S.once, S.lineId, S.start, S.end], [false, 'swim-line', '06:00', '06:45']);
  const write = (c: typeof TYPED_COLUMNS[number], text: string) => planCellWrite(swim, S, c, text);
  // START: the clock, with the routine's own END as it stands — the route asks for both on a routine that is no one-off; no name.
  assert.deepEqual(write('start', '05:30'), { ok: true, write: { to: 'routine', routineId: 'swim', body: { start_time: '05:30', end_time: '06:45' } } });
  assert.deepEqual(planCellWrite(swim, { ...S, end: null }, 'start', '05:30'), { ok: true, write: { to: 'routine', routineId: 'swim', body: { start_time: '05:30', end_time: null } } }, 'no END held: sent as none — the route’s refusal is said');
  assert.deepEqual(write('start', ''), { ok: false, words: timeTypedWords('') }, 'a repeating plan’s START cleared is no clock — it does not become a charge here');
  assert.deepEqual(write('start', '6am'), { ok: false, words: timeTypedWords('6am') });
  // TYPE: the line's alone — a repeating plan's name is its own.
  assert.deepEqual(write('subAccountName', '  Lap   Swim '), { ok: true, write: { to: 'line', lineId: 'swim-line', body: { activity: 'Lap Swim' } } });
  assert.deepEqual(write('subAccountName', ' '), { ok: false, words: requiredWords('name') });
  // END, CATEGORY, BUDGET: the line's writers, as on a one-off; LOCATION the routine's.
  assert.deepEqual(write('end', '07:00'), { ok: true, write: { to: 'minutes', lineId: 'swim-line', minutes: 60 } });
  assert.deepEqual(write('end', '06:00'), { ok: false, words: END_AT_START_WORDS });
  assert.deepEqual(write('accountName', '6150'), { ok: true, write: { to: 'line', lineId: 'swim-line', body: { coa_code: '6150' } } });
  assert.deepEqual(write('budget', '9.50'), { ok: true, write: { to: 'line', lineId: 'swim-line', body: { budget_amount: '9.50' } } });
  assert.deepEqual(write('location', 'travel'), { ok: true, write: { to: 'routine', routineId: 'swim', body: { location_class: 'travel' } } });
  // Through the writers: each request and its body; a refusal is the route's own words.
  let run = await standIn([OK], () => savePlanCell(swim, S, 'start', '05:30'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/routines/swim', method: 'PATCH', body: { start_time: '05:30', end_time: '06:45' } }]);
  run = await standIn([[400, { error: 'Validation', field: 'end_time', message: 'the route’s window refusal' }]], () => savePlanCell(swim, S, 'start', '07:00'));
  assert.deepEqual(run.result, { ok: false, words: 'the route’s window refusal' }, 'a start at or after its end: the route’s refusal, said');
  run = await standIn([OK], () => savePlanCell(swim, S, 'subAccountName', 'Lap Swim'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/routines/steps/swim-line', method: 'PATCH', body: { activity: 'Lap Swim' } }], 'one write — the line’s TYPE; the routine’s name untouched');
  run = await standIn([OK], () => savePlanCell(swim, S, 'end', '07:00'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/routines/steps/swim-line', method: 'PATCH', body: { duration_minutes: 60 } }]);
  // The recorded day of a repeating plan writes the same plan — every row of it.
  const gymThu = rowOf('Morning Gym', THU, true);
  assert.deepEqual(planCellWrite(gymThu, planOf(gymThu), 'start', '06:15'), { ok: true, write: { to: 'routine', routineId: 'gym', body: { start_time: '06:15', end_time: '08:00' } } });
});

// ── X7 · A ROUTINE WITH NO LINE OF ITS OWN (ruling 2.2) ──────────────────────

test('X7 a routine with no line of its own takes its line’s four on itself: END its end time, CATEGORY its account, BUDGET its amount, TYPE its name — one-off or repeating, each read and refused by the route', async () => {
  const laundry = rowOf('Laundry · 2027-03-04 15:00', THU, false);
  const W = planOf(laundry);
  assert.deepEqual([W.once, W.lineId, laundry.time], [true, null, '15:00']);
  const write = (c: typeof TYPED_COLUMNS[number], text: string) => planCellWrite(laundry, W, c, text);
  assert.deepEqual(write('end', '16:30'), { ok: true, write: { to: 'routine', routineId: 'laundry', body: { end_time: '16:30' } } });
  assert.deepEqual(write('end', ''), { ok: true, write: { to: 'routine', routineId: 'laundry', body: { end_time: null } } }, 'cleared: no end');
  assert.deepEqual(write('end', '15:00'), { ok: false, words: END_AT_START_WORDS });
  assert.deepEqual(write('end', 'late'), { ok: false, words: timeTypedWords('late') });
  assert.deepEqual(write('accountName', '6200'), { ok: true, write: { to: 'routine', routineId: 'laundry', body: { coa_code: '6200' } } });
  assert.deepEqual(write('budget', '7'), { ok: true, write: { to: 'routine', routineId: 'laundry', body: { budget_amount: '7' } } });
  assert.deepEqual(write('budget', ''), { ok: true, write: { to: 'routine', routineId: 'laundry', body: { budget_amount: '' } } }, 'blank names no amount — the route reads it');
  assert.deepEqual(write('subAccountName', ' Wash   Day '), { ok: true, write: { to: 'routine', routineId: 'laundry', body: { name: 'Wash Day' } } });
  assert.deepEqual(write('subAccountName', ''), { ok: false, words: requiredWords('name') });
  // A repeating plan with no line: the same four on the routine.
  const gym = rowOf('Morning Gym', FRI, false);
  assert.deepEqual(planCellWrite(gym, planOf(gym), 'budget', '22'), { ok: true, write: { to: 'routine', routineId: 'gym', body: { budget_amount: '22' } } });
  assert.deepEqual(planCellWrite(gym, planOf(gym), 'subAccountName', 'Evening Gym'), { ok: true, write: { to: 'routine', routineId: 'gym', body: { name: 'Evening Gym' } } });
  assert.deepEqual(planCellWrite(gym, planOf(gym), 'end', '08:30'), { ok: true, write: { to: 'routine', routineId: 'gym', body: { end_time: '08:30' } } });
  // Through the routines PATCH; the route's refusal said.
  let run = await standIn([OK], () => savePlanCell(laundry, W, 'accountName', '6200'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/routines/laundry', method: 'PATCH', body: { coa_code: '6200' } }]);
  run = await standIn([[400, { error: 'Validation', field: 'coa_code', message: 'P-9999 is not an account in the book’s chart' }]], () => savePlanCell(laundry, W, 'accountName', '9999'));
  assert.deepEqual(run.result, { ok: false, words: 'P-9999 is not an account in the book’s chart' });
  run = await standIn([[409, { error: 'Duplicate', field: 'name', message: 'a routine with this name already exists' }]], () => savePlanCell(laundry, W, 'subAccountName', 'Wash Day'));
  assert.deepEqual(run.result, { ok: false, words: 'a routine with this name already exists' });
});

// ── X8 · ITEMS: A FIRST RECORD, PLANNED ITEMS, OR THE REFUSAL (ruling 2.3) ───

test('X8 ITEMS with no record held: on a past row that takes one, its first record — the note typed, through the record form’s rule and writer; on a row ahead or a charge, the planned items on its vendor plan; with no vendor there, refused', async () => {
  const snack = rowOf('Snack', THU, false);
  const lunch = rowOf('Lunch', THU, false);
  const gymFri = rowOf('Morning Gym', FRI, false);
  const save = (row: LedgerSheetRow, text: string) => saveCell(row, ledger.recording[row.key], ledger.editing[row.key], 'description', text, { kind: 'reading' }, NOW);
  assert.deepEqual([snack, lunch, gymFri, rowOf('Dinner', FRI, false), rowOf('Rent', FRI, false)].map((r) => itemsWritesRecord(r, ledger.recording[r.key])), [true, true, false, false, false], 'past and taking a record: a first record; ahead, or a charge: not');
  // A past row with no vendor: its first record, the note typed — the record form's own body.
  let run = await standIn([[201, { record: {}, changed: true }]], () => save(snack, 'two apples'));
  assert.equal(run.result.ok, true);
  assert.deepEqual([run.sent[0].url, run.sent[0].method], ['/api/operations/stops', 'POST']);
  const body = run.sent[0].body as Record<string, unknown>;
  assert.deepEqual([body.kind, body.id, body.instant, body.outcome, body.note, body.actual_cents], ['routine_line', 'snack-line', snack.address.instant, 'done', 'two apples', null]);
  // A past row WITH a vendor: its first record too — what was had there.
  run = await standIn([[201, { record: {}, changed: true }]], () => save(lunch, 'soup only'));
  assert.deepEqual([run.sent[0].url, (run.sent[0].body as { note: string }).note], ['/api/operations/stops', 'soup only']);
  // A row ahead with its vendor: the planned items, at the vendor plan's grain (every occurrence — the instant none).
  run = await standIn([OK], () => save(gymFri, 'a towel'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/plan-vendors', method: 'POST', body: { kind: 'routine', id: 'gym', instant: null, vendorId: 'v-iron', items: 'a towel' } }]);
  // Ahead with no vendor, or a charge with none: refused before any typing (X4), in the rule's words — and never written.
  assert.equal(cellOpens('description', rowOf('Dinner', FRI, false), ledger.recording[rowOf('Dinner', FRI, false).key], ledger.editing[rowOf('Dinner', FRI, false).key]).refusal, ITEMS_CELL_NO_VENDOR_WORDS);
  assert.equal(cellOpens('description', rowOf('Rent', FRI, false), ledger.recording[rowOf('Rent', FRI, false).key], ledger.editing[rowOf('Rent', FRI, false).key]).refusal, ITEMS_CELL_NO_VENDOR_WORDS);
  assert.equal(ITEMS_CELL_NO_VENDOR_WORDS, "planned items sit with the stop's vendor — give it a VENDOR first");
  // In the source: the leaf sorts a first record to the record's writer by the rule's own test.
  assert.match(code(SAVES), /if \(isRecordCell\(column, recording\) \|\| \(column === 'description' && itemsWritesRecord\(row, recording\)\)\) \{/);
});

// ── X9 · THE TRIP'S PLACE — CITY · REGION · COUNTRY (ruling 2.4) ─────────────

test('X9 a trip cell writes the trip of the row’s day: the trip’s three parts with the typed one in its place, read by the blank row’s place rule — the trip that covers the day changed whole, a day no trip covers given a new trip of its own; the reach says which', async () => {
  const lunch = rowOf('Lunch', THU, false);
  const kiosk = rowOf('Kiosk', THU, true);
  const dinner = rowOf('Dinner', FRI, false);
  const trip = (row: LedgerSheetRow, c: 'city' | 'region' | 'country', text: string) => tripCellWrite(row, ledger.editing[row.key], c, text);
  const harbor = (place: string) => ({ ok: true, write: { to: 'change', stayId: 'stay-harbor', body: { place, starts_on: '2027-03-02', ends_on: THU } } });
  // A day the trip covers: the trip changed whole — its place, its two days as they stand.
  assert.deepEqual(trip(lunch, 'city', 'Harbor City'), harbor('Harbor City, Coast Province, Examplia'));
  assert.deepEqual(trip(lunch, 'region', 'Bay Province'), harbor('Harbor Town, Bay Province, Examplia'));
  assert.deepEqual(trip(lunch, 'region', ''), harbor('Harbor Town, Examplia'), 'a place of two parts: a city and a country');
  assert.deepEqual(trip(kiosk, 'country', 'Elsewhere'), harbor('Harbor Town, Coast Province, Elsewhere'), 'a row with no plan writes its day’s trip too');
  // The place rule's refusals: no CITY; a REGION without its COUNTRY.
  assert.deepEqual(trip(lunch, 'city', ''), { ok: false, words: PLACE_NEEDS_CITY_WORDS }, 'a trip is removed on Home’s day card — not here');
  assert.deepEqual(trip(lunch, 'country', ''), { ok: false, words: REGION_NEEDS_COUNTRY_WORDS });
  // A day no trip covers: a new trip of that one day; a REGION or a COUNTRY alone has no CITY.
  assert.deepEqual(trip(dinner, 'city', 'Bay Village'), { ok: true, write: { to: 'create', body: { place: 'Bay Village', starts_on: FRI, ends_on: FRI } } });
  assert.deepEqual(trip(dinner, 'region', 'North Coast'), { ok: false, words: PLACE_NEEDS_CITY_WORDS });
  assert.deepEqual(trip(dinner, 'city', '   '), { ok: false, words: PLACE_NEEDS_CITY_WORDS });
  // The reach: the trip and its days, or the new trip of the day.
  assert.equal(cellReachWords('city', ledger.editing[lunch.key], THU), 'the trip "Harbor Town, Coast Province, Examplia" — every row from 2027-03-02 to 2027-03-04');
  assert.equal(TRIP_REACH_WORDS('Harbor Town, Coast Province, Examplia', '2027-03-02', THU), 'the trip "Harbor Town, Coast Province, Examplia" — every row from 2027-03-02 to 2027-03-04');
  assert.equal(cellReachWords('country', ledger.editing[dinner.key], FRI), 'a new trip on 2027-03-05 — the place of every row on it');
  assert.equal(NEW_TRIP_REACH_WORDS(FRI), 'a new trip on 2027-03-05 — the place of every row on it');
  // Through the stays' one writer — the trip's PATCH, or its POST; the route's refusals (an overlap) said in its words.
  let run = await standIn([OK], () => saveTripCell(lunch, ledger.editing[lunch.key], 'city', 'Harbor City'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/stays/stay-harbor', method: 'PATCH', body: { place: 'Harbor City, Coast Province, Examplia', starts_on: '2027-03-02', ends_on: THU } }]);
  run = await standIn([[201, { stay: {} }]], () => saveCell(dinner, ledger.recording[dinner.key], ledger.editing[dinner.key], 'city', 'Bay Village', { kind: 'reading' }, NOW));
  assert.deepEqual(run.sent, [{ url: '/api/operations/stays', method: 'POST', body: { place: 'Bay Village', starts_on: FRI, ends_on: FRI } }]);
  run = await standIn([[409, { error: 'Conflict', message: 'the route’s overlap words' }]], () => saveTripCell(dinner, ledger.editing[dinner.key], 'city', 'Bay Village'));
  assert.deepEqual(run.result, { ok: false, words: 'the route’s overlap words' });
  run = await standIn([], () => saveTripCell(lunch, ledger.editing[lunch.key], 'city', ''));
  assert.deepEqual([run.result, run.sent.length], [{ ok: false, words: PLACE_NEEDS_CITY_WORDS }, 0], 'refused by the rule: nothing sent');
  // In the source: the leaf names no stays route (the stays' one writer does); the line beneath hands the reach the row's day.
  const saves = code(SAVES);
  assert.match(saves, /import \{ changeStay, createStay \} from '\.\.\/stays\/stayWrites';/);
  assert.doesNotMatch(saves, /\/api\//, 'the leaf names no route');
  assert.ok(code(SECTION).includes('<span data-ledger-cell-reach>{cellReachWords(open.column, editing[row.key], row.day)}</span>'));
});
