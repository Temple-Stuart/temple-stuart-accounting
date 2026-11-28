/**
 * EDIT-03 (Alex, 2026-11-29) — DATE ON A ONE-OFF SAVES; ENTITY MOVES A ROW TO ANOTHER BOOK (the vendor law's third exception). EDIT-02's
 * ruling, "they should all be able to be edited, eccept for formula driven cells", met on the two cells it left: DATE on a one-off was refused
 * by the route every time, and ENTITY threw by name.
 *
 * PART 1 — DATE on a one-off sends its end with its day (ledger.ts planCellWrite; the route unchanged). Each part's tests land in the commit
 * that builds it.
 *
 * HERMETIC, on edit02.test.ts's model — no database, no network, the only clock the one handed in. The rules are DRIVEN directly over
 * made-up rows; the routes are anchored to their source with comments stripped (the reader law). Every plan, vendor, book, day, account and
 * amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import { buildRoutineOpenLines } from '../budget/openLines';
import type { RoutineWords } from '../budget/planLines';
import { isOnceRRule } from '../operations/rruleHelpers';
import { cellReachWords, ledgerOf, planCellWrite, planMinutesOf, routineClocksOf, type LedgerEditingPlan, type LedgerInput, type LedgerSheetRow, type LedgerVendorRow } from '../operations/ledger';
import { savePlanCell } from '../../components/workbench/operations/ledger/cellSaves';

const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';

/** A handler's body in a route's source: from its export to the next export. */
const bodyOf = (src: string, verb: string): string => {
  const at = src.indexOf(`export async function ${verb}(`);
  if (at < 0) return assert.fail(`no ${verb} in the route`);
  const next = src.indexOf('\nexport async function ', at + 1);
  return src.slice(at, next < 0 ? undefined : next);
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

// ── THE FIXTURE — every plan, vendor, book, day and amount made up ───────────

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
  // A ONE-OFF, as "+ expense" writes one — Lunch at Harbor Cafe; it ends on its day, as every one-off is stored.
  routine({ id: 'lunch', name: 'Lunch · 2027-03-04 12:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', startDate: THU, endDate: THU, startTime: timeJson('12:00'), steps: [line('lunch-line', 15, '6150', 45)] }),
  // A CHARGE on its date — all day, no clock.
  routine({ id: 'rent', name: 'Rent · 2027-03-05', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=0;BYMINUTE=0', startDate: FRI, endDate: FRI, role: 'all_day', steps: [line('rent-line', 900, '6300', null)] }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]));
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: NBO, steps: new Map(r.steps.map((s) => [s.id, { activity: r.name.split(' · ')[0], timeOfDay: null }])),
}]));
const VENDORS: LedgerVendorRow[] = [
  { id: 'pv-lunch', routine_id: null, step_id: 'lunch-line', task_id: null, occurrence_at: new Date(at(THU, '12:00')), items: 'soup and bread', vendor: { id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: 'harbor.cafe' }, routine: null, step: { activity: 'Lunch', routine_id: 'lunch', routine: { name: 'Lunch · 2027-03-04 12:00', timezone: NBO } }, task: null },
];
const built = buildRoutineBudgetLines(ROUTINES, THU, FRI);
const opened = buildRoutineOpenLines(ROUTINES, THU, FRI);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: THU, to: FRI, now: NOW, records: [], links: [], lines: built.lines, open: opened.open, notPlaced: [...built.notPlaced, ...opened.notPlaced], routines: WORDS, roles: ROLES,
  locations: new Map(ROUTINES.map((r): [string, null] => [r.id, null])), once: new Map(ROUTINES.map((r): [string, boolean] => [r.id, isOnceRRule(r.scheduleRrule)])), clocks: routineClocksOf(ROUTINES),
  subAccounts: [], minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: [],
  accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6300', name: 'Rent' }], books: [{ id: 'P', entityType: 'personal' }], ...over,
});
const ledger = ledgerOf(input());
/** The plan row of a description on a day. */
const rowOf = (description: string, day: string): LedgerSheetRow => {
  const found = ledger.sheet.find((r) => r.description === description && r.day === day && r.id === null);
  return found ?? assert.fail(`no plan row ${description} on ${day}`);
};
const planOf = (row: LedgerSheetRow): LedgerEditingPlan => { const e = ledger.editing[row.key]; if (!e.plan) return assert.fail(`${row.key} has no plan`); return e; };

// ── PART 1 — DATE ON A ONE-OFF SENDS ITS END WITH ITS DAY ────────────────────

/**
 * The routines PATCH's two date rules over a one-off, as its source holds them (pinned in Y2): the dates in effect — the body's, else the
 * stored — in order (the order rule), and a one-off's end its start (the one-off rule). The words are the route's own.
 */
const ORDER_WORDS = 'end_date must be on or after start_date';
const ONE_OFF_END_WORDS = 'a one-off ends on the day it happens — leave end_date empty or equal to start_date';
const patchDatesRefusal = (stored: { readonly start: string; readonly end: string }, body: { readonly start_date?: string; readonly end_date?: string }): string | null => {
  const start = body.start_date ?? stored.start;
  const end = body.end_date ?? stored.end;
  if (start > end) return ORDER_WORDS;
  if (end !== start) return ONE_OFF_END_WORDS;
  return null;
};

// ── Y1 · THE CELL'S BODY (rulings 1.1, 1.2) ──

test('Y1 DATE on a one-off sends its start date AND its end date, the same day, with the one-off’s name for that day — a timed one-off and a charge; through the routines PATCH as one body; reach this row', async () => {
  const lunch = rowOf('Lunch', THU);
  const L = planOf(lunch);
  assert.deepEqual(planCellWrite(lunch, L, 'date', '2027-03-06'), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { start_date: '2027-03-06', end_date: '2027-03-06', name: 'Lunch · 2027-03-06 12:00' } } });
  assert.deepEqual(planCellWrite(lunch, L, 'date', ' 2027-03-02 '), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { start_date: '2027-03-02', end_date: '2027-03-02', name: 'Lunch · 2027-03-02 12:00' } } }, 'earlier, trimmed');
  const rent = rowOf('Rent', FRI);
  assert.deepEqual(planCellWrite(rent, planOf(rent), 'date', '2027-03-08'), { ok: true, write: { to: 'routine', routineId: 'rent', body: { start_date: '2027-03-08', end_date: '2027-03-08', name: 'Rent · 2027-03-08' } } }, 'a charge: its day, and its name for its day alone');
  // Every DATE body's end IS its start.
  for (const [row, day] of [[lunch, '2027-03-06'], [lunch, '2027-03-01'], [rent, '2027-03-08'], [rent, '2027-03-05']] as const) {
    const read = planCellWrite(row, planOf(row), 'date', day);
    if (!read.ok || read.write.to !== 'routine') return assert.fail('a DATE write is the routine’s');
    assert.equal(read.write.body.end_date, read.write.body.start_date, `${row.key} → ${day}`);
  }
  assert.equal(cellReachWords('date', ledger.editing[lunch.key], THU), 'this row');
  // Through the routines PATCH — one request, the two dates and the name in its body.
  const run = await standIn([[200, { routine: {}, rekeyed: {} }]], () => savePlanCell(lunch, L, 'date', '2027-03-06'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/routines/lunch', method: 'PATCH', body: { start_date: '2027-03-06', end_date: '2027-03-06', name: 'Lunch · 2027-03-06 12:00' } }]);
});

// ── Y2 · THE BODY AGAINST THE PATCH'S TWO DATE RULES, READ AS TEXT (rulings 1.1, 1.3) ──

test('Y2 the routines PATCH still holds the two rules the body answers — the order of the dates in effect and a one-off’s end its start, then its end set to its start — and the body meets both, moved later or earlier, where the start alone met the stored end and was refused', () => {
  const patch = bodyOf(code(ROUTINE_ROUTE), 'PATCH');
  // The dates in effect: the body's, else the stored.
  assert.ok(patch.includes('let effectiveStart = existing.start_date;') && patch.includes('let effectiveEnd = existing.end_date;'), 'stored first');
  assert.match(patch, /if \('end_date' in body\) \{\n\s*const r = parseDateOrNull\(body\.end_date, 'end_date'\);\n\s*if \(r\.error\) return r\.error;\n\s*effectiveEnd = r\.value;/, 'the body’s end read by the start’s own parser');
  // The order rule, in the route's words.
  assert.ok(patch.includes(`if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {`));
  assert.ok(patch.includes(`message: '${ORDER_WORDS}'`));
  // The one-off rule, and then the one-off's end set to its start.
  const oneOff = patch.indexOf('if (isOnceRRule(nextRrule)) {');
  assert.ok(oneOff > patch.indexOf(`message: '${ORDER_WORDS}'`), 'the one-off rule after the order rule');
  const refusal = patch.indexOf('if (effectiveEnd && effectiveEnd.getTime() !== effectiveStart.getTime()) {', oneOff);
  assert.ok(refusal > oneOff, 'a one-off whose end is not its start is refused');
  assert.ok(patch.indexOf(`message: '${ONE_OFF_END_WORDS}'`, refusal) > refusal);
  assert.ok(patch.indexOf('data.end_date = effectiveStart;', refusal) > refusal, 'then its end is its start');
  // The cell's body against those two rules — a one-off stored on Thursday, ending Thursday.
  const stored = { start: THU, end: THU };
  const bodyFor = (day: string): { start_date?: string; end_date?: string } => {
    const read = planCellWrite(rowOf('Lunch', THU), planOf(rowOf('Lunch', THU)), 'date', day);
    if (!read.ok || read.write.to !== 'routine') return assert.fail('a DATE write is the routine’s');
    return read.write.body;
  };
  assert.equal(patchDatesRefusal(stored, bodyFor('2027-03-06')), null, 'later: saved');
  assert.equal(patchDatesRefusal(stored, bodyFor('2027-03-02')), null, 'earlier: saved');
  assert.equal(patchDatesRefusal(stored, bodyFor(THU)), null, 'the same day: saved');
  // EDIT-02's body — the start alone — against the stored end: refused both ways, as the chat's run of the real route was.
  assert.equal(patchDatesRefusal(stored, { start_date: '2027-03-06' }), ORDER_WORDS, 'later: the order rule');
  assert.equal(patchDatesRefusal(stored, { start_date: '2027-03-02' }), ONE_OFF_END_WORDS, 'earlier: the one-off rule');
});
