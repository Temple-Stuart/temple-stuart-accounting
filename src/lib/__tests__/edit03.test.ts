/**
 * EDIT-03 (Alex, 2026-11-29) — DATE ON A ONE-OFF SAVES; ENTITY MOVES A ROW TO ANOTHER BOOK (the vendor law's third exception). EDIT-02's
 * ruling, "they should all be able to be edited, eccept for formula driven cells", met on the two cells it left: DATE on a one-off was refused
 * by the route every time, and ENTITY threw by name.
 *
 * PART 1 — DATE on a one-off sends its end with its day (ledger.ts planCellWrite; the route unchanged). PART 2 — the vendor law's third
 * exception (scripts/assert-tool-registry.ts clause 1), read from its source. PART 3 — ENTITY moves a row to another book: the move's plan
 * (src/lib/operations/bookMove.ts), the routines PATCH read as text, and the cell. Each part's tests land in the commit that builds it.
 *
 * HERMETIC, on edit02.test.ts's model — no database, no network, the only clock the one handed in. The rules are DRIVEN directly over
 * made-up rows; the routes are anchored to their source with comments stripped (the reader law). Every plan, vendor, book, day, account and
 * amount below is invented. No pin here names a line number.
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
  ENTITY_VENDOR_REACH_WORDS, REPEATING_REACH_WORDS, boxTextOf, cellOpens, cellReachWords, ledgerOf, planCellWrite, planMinutesOf, routineClocksOf,
  type LedgerEditingPlan, type LedgerInput, type LedgerRecordInput, type LedgerSheetRow, type LedgerVendorRow,
} from '../operations/ledger';
import { BOOKS_CODED_MOVE_WORDS, BOOKS_LINK_MOVE_WORDS, MOVE_OTHER_BOOK_ROWS_WORDS, MOVE_PICK_ACCOUNT_WORDS } from '../operations/linkHold'; // EDIT-04 (2026-11-29): MOVE_ACCOUNTS_MISSING_WORDS went with (c); the CATEGORY's own words (edit04.test.ts)
import { ENTITY_MOVES_ALONE_WORDS, MOVE_VENDOR_NAME_TWICE_WORDS, MOVE_VENDOR_RACE_WORDS, bookMove, type BookMoveInput, type BookMoveVendor } from '../operations/bookMove'; // EDIT-04 (2026-11-29): codesNotHeld went with (c)
import { savePlanCell } from '../../components/workbench/operations/ledger/cellSaves';

const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const PLAN_VENDORS_ROUTE = 'src/app/api/operations/plan-vendors/route.ts';
const DIRECTORY_ROUTE = 'src/app/api/operations/vendor-directory/route.ts';

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
  // EDIT-03 (PART 3): a one-off with no vendor, and a REPEATING plan with no line — Iron Works its vendor for every occurrence.
  routine({ id: 'snack', name: 'Snack · 2027-03-04 09:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=9;BYMINUTE=0', startDate: THU, endDate: THU, startTime: timeJson('09:00'), steps: [line('snack-line', 4, '6150', null)] }),
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
/** A record of a plan the loader no longer lists — a row with no plan. */
const RECORDS: LedgerRecordInput[] = [
  { record: record({ id: 'r-kiosk', kind: 'routine', target_id: 'kiosk', occurrence_at: at(THU, '10:00'), actual_cents: 150 }), routineId: 'kiosk', routineName: 'Kiosk', zone: NBO, role: 'place', activity: null, timeOfDay: null, durationMinutes: null },
];
const built = buildRoutineBudgetLines(ROUTINES, THU, FRI);
const opened = buildRoutineOpenLines(ROUTINES, THU, FRI);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: THU, to: FRI, now: NOW, records: RECORDS, links: [], lines: built.lines, open: opened.open, notPlaced: [...built.notPlaced, ...opened.notPlaced], routines: WORDS, roles: ROLES,
  locations: new Map(ROUTINES.map((r): [string, null] => [r.id, null])), once: new Map(ROUTINES.map((r): [string, boolean] => [r.id, isOnceRRule(r.scheduleRrule)])), clocks: routineClocksOf(ROUTINES),
  subAccounts: [], minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: [],
  accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }, { entityId: 'P', code: '6300', name: 'Rent' }], books: [{ id: 'P', entityType: 'personal' }], ...over,
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

// ── PART 2 — THE VENDOR LAW'S THIRD EXCEPTION ────────────────────────────────

// ── Y3 · CLAUSE 1, READ FROM ITS SOURCE (rulings 2.1, 2.2) ──

test('Y3 the vendor law, read from its source: clause 1’s third exception — in routines/[id] alone, the book move’s re-point (vendor_id alone, by id) and its copy of a vendor (the source’s own name and tag, the caller, the target book), each held to one in its pinned shape; every other write of either table refused, there and anywhere', () => {
  const lawLines = code(LAW).split('\n').map((l) => l.trimEnd());
  // Edited in place: tests and laws read the law's lines by number, so it keeps every one where it stood.
  assert.equal(lawLines.length - 1, 11254, 'the law keeps its 11,254 lines');
  /** A pinned shape, read from the law's own line: the regex after `const NAME = /`, to its closing `/;`. */
  const shapeOf = (name: string): { readonly line: number; readonly re: RegExp } => {
    const head = `const ${name} = /`;
    const line = lawLines.findIndex((l) => l.includes(head));
    assert.ok(line >= 0, name);
    const from = lawLines[line].indexOf(head) + head.length;
    return { line, re: new RegExp(lawLines[line].slice(from, lawLines[line].indexOf('/;', from))) };
  };
  // The two shapes, beside the rekey's — on its own line, as ruled.
  const REKEY = shapeOf('PV_REKEY_WRITE');
  const MOVE = shapeOf('PV_MOVE_WRITE');
  const COPY = shapeOf('PV_MOVE_CREATE');
  assert.ok(lawLines[REKEY.line].startsWith('const PV_REKEY_WRITE = /'), 'the rekey’s line');
  assert.equal(MOVE.line, REKEY.line, 'the re-point’s const beside PV_REKEY_WRITE');
  assert.equal(COPY.line, REKEY.line, 'and the copy’s');
  assert.equal(REKEY.re.source, String.raw`\.planned_item_vendors\.update\(\{ where: \{ id: v\.id \}, data: \{ occurrence_at: to \} \}\)`, 'the rekey’s shape unchanged');
  assert.equal(MOVE.re.source, String.raw`\.planned_item_vendors\.update\(\{ where: \{ id: p\.id \}, data: \{ vendor_id: to \} \}\)`, 'an update by id of vendor_id and nothing else');
  assert.equal(COPY.re.source, String.raw`\.operations_vendor_directory\.create\(\{ data: \{ user_id: user\.id, entity_id: target\.id, vendor_name: add\.source\.vendor_name, instagram_tag: add\.source\.instagram_tag \}, select: \{ id: true, vendor_name: true, instagram_tag: true, entity_id: true \} \}\)`, 'the source vendor’s own name and tag, the caller, the target book — nothing else');
  const MOVE_RE = MOVE.re;
  const COPY_RE = COPY.re;
  const REKEY_RE = REKEY.re;
  // The routine route's branch runs it, in place: its vendor rows' writes, then its creates of the directory — one line.
  const branch = lawLines.indexOf('  if (file === PV_REKEY_ROUTE) {');
  assert.ok(branch > 0, 'the routine route’s branch');
  let check = branch + 1;
  while (lawLines[check] === '') check += 1;
  assert.ok(lawLines[check].startsWith("    const rekeys = (src.match(new RegExp(PV_REKEY_WRITE.source, 'g')) ?? []).length; const moves = (src.match(new RegExp(PV_MOVE_WRITE.source, 'g')) ?? []).length; if (rekeys !== 1 || moves > 1 || pvWrites.length !== rekeys + moves || pvWrites.some((m) => m[1] !== 'update')) pvFail("), 'every write of the routine route an update in one of the two shapes — the rekey’s once, the re-point at most once');
  assert.ok(lawLines[check].includes("const creates = (src.match(/\\.operations_vendor_directory\\s*\\.\\s*create\\s*\\(/g) ?? []).length; const copies = (src.match(new RegExp(PV_MOVE_CREATE.source, 'g')) ?? []).length; if (creates > 1 || creates !== copies) pvFail("), 'its creates held to the one copy in its shape');
  assert.equal(lawLines[check + 1], '  } else {');
  // The directory loop lets the routine route's create through — its check above holds it.
  assert.ok(lawLines.includes("    if (((m[1] === 'create' || m[1] === 'update') && file === PV_DIRECTORY) || (m[1] === 'create' && file === PV_REKEY_ROUTE)) continue;"), 'the loop’s first line');

  // Clause 1 as those lines run it, over a file's source: whether its vendor rows' writes stand, and the directory writes refused.
  const count = (src: string, re: RegExp): number => (src.match(new RegExp(re.source, 'g')) ?? []).length;
  const judge = (file: string, src: string): { readonly rows: boolean; readonly directory: readonly string[] } => {
    const writes = [...src.matchAll(/\.planned_item_vendors\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\s*\(/g)].map((m) => m[1]);
    const rekeys = count(src, REKEY_RE);
    const moves = count(src, MOVE_RE);
    const rows = file === ROUTINE_ROUTE
      ? rekeys === 1 && moves <= 1 && writes.length === rekeys + moves && writes.every((w) => w === 'update')
      : file === PLAN_VENDORS_ROUTE || writes.length === 0;
    const refused = [...src.matchAll(/\.operations_vendor_directory\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\s*\(/g)].map((m) => m[1])
      .filter((op) => !(op === 'create' && file === ROUTINE_ROUTE) && !((op === 'create' || op === 'update') && file === DIRECTORY_ROUTE));
    const creates = count(src, /\.operations_vendor_directory\s*\.\s*create\s*\(/);
    const copyHeld = file !== ROUTINE_ROUTE || (creates <= 1 && creates === count(src, COPY_RE));
    return { rows, directory: copyHeld ? refused : [...refused, 'create (not the copy)'] };
  };
  const route = code(ROUTINE_ROUTE);
  assert.deepEqual(judge(ROUTINE_ROUTE, route), { rows: true, directory: [] }, 'the routine route as it stands');
  const REPOINT = 'await tx.planned_item_vendors.update({ where: { id: p.id }, data: { vendor_id: to } });';
  const COPY_CALL = 'await tx.operations_vendor_directory.create({ data: { user_id: user.id, entity_id: target.id, vendor_name: add.source.vendor_name, instagram_tag: add.source.instagram_tag }, select: { id: true, vendor_name: true, instagram_tag: true, entity_id: true } });';
  const without = (src: string): string => src.replace(REPOINT, '').replace(COPY_CALL, '');
  // The exception's own two writes, alone, stand.
  assert.deepEqual(judge(ROUTINE_ROUTE, `${without(route)}\n${REPOINT}\n${COPY_CALL}`), { rows: true, directory: [] }, 'the re-point and the copy, each once in its shape');
  const broken: ReadonlyArray<readonly [string, string, string, { readonly rows: boolean; readonly directory: readonly string[] }]> = [
    ['the re-point twice', ROUTINE_ROUTE, `${without(route)}\n${REPOINT}\n${REPOINT}`, { rows: false, directory: [] }],
    ['a second re-point shape — vendor_id with its items', ROUTINE_ROUTE, `${without(route)}\nawait tx.planned_item_vendors.update({ where: { id: p.id }, data: { vendor_id: to, items: null } });`, { rows: false, directory: [] }],
    ['a re-point by another key', ROUTINE_ROUTE, `${without(route)}\nawait tx.planned_item_vendors.update({ where: { id: body.id }, data: { vendor_id: to } });`, { rows: false, directory: [] }],
    ['a planned_item_vendors delete', ROUTINE_ROUTE, `${route}\nawait tx.planned_item_vendors.delete({ where: { id: p.id } });`, { rows: false, directory: [] }],
    ['a planned_item_vendors create', ROUTINE_ROUTE, `${route}\nawait tx.planned_item_vendors.create({ data: {} });`, { rows: false, directory: [] }],
    ['a copy whose name is not the source vendor’s', ROUTINE_ROUTE, `${without(route)}\n${COPY_CALL.replace('vendor_name: add.source.vendor_name', 'vendor_name: body.vendor_name')}`, { rows: true, directory: ['create (not the copy)'] }],
    ['a copy with a field more', ROUTINE_ROUTE, `${without(route)}\n${COPY_CALL.replace('instagram_tag: add.source.instagram_tag }', 'instagram_tag: add.source.instagram_tag, is_active: false }')}`, { rows: true, directory: ['create (not the copy)'] }],
    ['the copy twice', ROUTINE_ROUTE, `${without(route)}\n${COPY_CALL}\n${COPY_CALL}`, { rows: true, directory: ['create (not the copy)'] }],
    ['a directory update in routines/[id]', ROUTINE_ROUTE, `${route}\nawait tx.operations_vendor_directory.update({ where: { id: x.id, user_id: user.id }, data: { instagram_tag: null } });`, { rows: true, directory: ['update'] }],
    ['a directory delete in routines/[id]', ROUTINE_ROUTE, `${route}\nawait tx.operations_vendor_directory.delete({ where: { id: x.id } });`, { rows: true, directory: ['delete'] }],
    ['the re-point copied into the plan-vendors route’s neighbour', 'src/lib/operations/bookMove.ts', `${REPOINT}`, { rows: false, directory: [] }],
    ['the copy made in another file', 'src/lib/operations/bookMove.ts', `${COPY_CALL}`, { rows: true, directory: ['create'] }],
  ];
  for (const [why, file, src, expected] of broken) assert.deepEqual(judge(file, src), expected, why);

  // The law's own words: three exceptions, the third quoting Alex, and its ✔ line naming the third.
  assert.match(comments(LAW), /through a relation\. THREE exceptions, each pinned to its shape:/);
  assert.match(comments(LAW), /\/\/ {6}archived or deleted, anywhere\. EDIT-03 \(Alex, 2026-11-28 — "they should all be able to be edited, eccept for formula driven cells"; this exception his yes, 2026-11-29\): a plan moves to another book with its vendors/, 'the third, on clause 1’s last line (in place)');
  assert.match(comments(LAW), /never a typed name\. Each pinned to its shape; the file then holds exactly two planned_item_vendors writes, each in its pinned shape, no create and no delete of them, and no other write of the directory\. The directory is still updated only by its route's one tag write, and never deleted anywhere\.\n\/\/ {3}2\. THE CALLER FIRST\./);
  assert.ok(code(LAW).includes("its vendor re-pointed, by id and nothing else, by the same route's book move alone — EDIT-03)"));
  assert.ok(code(LAW).includes("(and, in a plan's book move, the target book's copy of a vendor the plan names — its own name and tag — by ${PV_REKEY_ROUTE} alone, EDIT-03)"));
  // Clauses 2–4 hold their words.
  for (const clause of ['//   2. THE CALLER FIRST.', '//   3. THE DATABASE HOLDS IT.', '//   4. THE RULE, PROBED at build time:']) assert.ok(comments(LAW).includes(clause), clause);
});

// ── PART 3 — ENTITY: A ROW MOVES TO ANOTHER BOOK ─────────────────────────────

/** The move's plan over a made-up plan: Lunch at Harbor Cafe, moving from the personal book to the business one. */
const HARBOR_P: BookMoveVendor = { id: 'v-harbor-p', vendor_name: 'Harbor Cafe', instagram_tag: 'harbor.cafe' };
// EDIT-04 (2026-11-29): the plan carries no account here — its CATEGORY's move is EDIT-04's (edit04.test.ts); the inputs gain the source book's
// type, the target book as the money rule reads it and the pick, each row its amount. Lines on 6150 and 6200 against a chart holding both, until then.
const MOVE_BASE: BookMoveInput = {
  routine: { coa_code: null, budget_amount: null },
  lines: [{ id: 'lunch-line', coa_code: null, budget_amount: null }, { id: 'lunch-old-line', coa_code: null, budget_amount: null }],
  vendorRows: [{ id: 'pv-lunch', vendor_id: 'v-harbor-p', vendor: HARBOR_P }],
  source: { entityType: 'personal' },
  target: { word: 'Business', book: { id: 'B', name: 'Business', entityType: 'sole_prop', chart: [] }, vendors: [] },
  picked: null,
  counts: { links: 0, coded: 0, otherBook: 0 },
};
const moveWith = (over: Partial<BookMoveInput>): BookMoveInput => ({ ...MOVE_BASE, ...over });
const refusedWith = (over: Partial<BookMoveInput>): string => { const plan = bookMove(moveWith(over)); return plan.ok ? assert.fail('it moved') : plan.words; };

// ── Y4 · THE MOVE'S REFUSALS, (a) TO (e), IN THEIR WORDS AND ORDER (rulings 3.2, 3.3) ──

test('Y4 bookMove refuses by name, in order, nothing moved: (a) a posting linked to the plan, (b) Books lines coded to it, the account — EDIT-04, where (c) stood — (d) other records that keep their own book, (e) two of the target book’s vendors answering one name', () => { // EDIT-04 (2026-11-29): (c) — an account the target chart did not hold by its number — went; the account is picked in the new book
  // The words, as ruled.
  assert.equal(BOOKS_LINK_MOVE_WORDS, 'a posting in Books is linked to this plan — unlink it there before moving the plan to another book');
  assert.equal(BOOKS_CODED_MOVE_WORDS(1), 'this plan is coded on 1 line in Books — re-code it there before moving the plan to another book');
  assert.equal(BOOKS_CODED_MOVE_WORDS(3), 'this plan is coded on 3 lines in Books — re-code them there before moving the plan to another book');
  // EDIT-04 (2026-11-29): MOVE_ACCOUNTS_MISSING_WORDS went with (c) — the CATEGORY's words are edit04.test.ts's.
  assert.equal(MOVE_OTHER_BOOK_ROWS_WORDS(1), "1 other record of this plan — on the hub's schedule or in Content — keeps its book; nothing was moved");
  assert.equal(MOVE_OTHER_BOOK_ROWS_WORDS(2), "2 other records of this plan — on the hub's schedule or in Content — keep their book; nothing was moved");
  assert.equal(MOVE_VENDOR_NAME_TWICE_WORDS('Business', 'Harbor Cafe'), 'Business holds two vendors named "Harbor Cafe" — nothing was moved');
  assert.equal(ENTITY_MOVES_ALONE_WORDS, 'ENTITY moves alone — save the other change first');
  assert.equal(MOVE_VENDOR_RACE_WORDS('Business'), 'a vendor of that name was added to Business while this edit ran — try again');
  // (a)
  assert.equal(refusedWith({ counts: { links: 2, coded: 0, otherBook: 0 } }), BOOKS_LINK_MOVE_WORDS);
  // (b)
  assert.equal(refusedWith({ counts: { links: 0, coded: 1, otherBook: 0 } }), BOOKS_CODED_MOVE_WORDS(1));
  // The account — EDIT-04 (2026-11-29), where (c) stood: a plan with one, and none picked, is refused (edit04.test.ts holds the rest).
  assert.equal(refusedWith({ routine: { coa_code: '6300', budget_amount: '20.00' } }), MOVE_PICK_ACCOUNT_WORDS('Business'), 'the routine’s own account, none picked');
  // (d)
  assert.equal(refusedWith({ counts: { links: 0, coded: 0, otherBook: 2 } }), MOVE_OTHER_BOOK_ROWS_WORDS(2));
  // (e) — case and spaces differing are one name.
  const twice = [{ id: 'v-harbor-b', vendor_name: 'Harbor Cafe' }, { id: 'v-harbor-b2', vendor_name: '  harbor   CAFE ' }];
  assert.equal(refusedWith({ target: { ...MOVE_BASE.target, vendors: twice } }), MOVE_VENDOR_NAME_TWICE_WORDS('Business', 'Harbor Cafe'));
  assert.equal(bookMove(moveWith({ vendorRows: [], target: { ...MOVE_BASE.target, vendors: twice } })).ok, true, 'two of a name the plan does not carry refuse nothing');
  // In order: each refusal before the ones after it.
  const all: Partial<BookMoveInput> = { routine: { coa_code: '6300', budget_amount: '20.00' }, target: { ...MOVE_BASE.target, vendors: twice } }; // EDIT-04 (2026-11-29): an account, none picked — (c)'s 6300 not in the chart until then
  assert.equal(refusedWith({ ...all, counts: { links: 1, coded: 1, otherBook: 1 } }), BOOKS_LINK_MOVE_WORDS, '(a) first');
  assert.equal(refusedWith({ ...all, counts: { links: 0, coded: 1, otherBook: 1 } }), BOOKS_CODED_MOVE_WORDS(1), '(b) before the account');
  assert.equal(refusedWith({ ...all, counts: { links: 0, coded: 0, otherBook: 1 } }), MOVE_PICK_ACCOUNT_WORDS('Business'), 'the account before (d)'); // EDIT-04 (2026-11-29): the account where (c) stood
  assert.equal(refusedWith({ target: { ...MOVE_BASE.target, vendors: twice }, counts: { links: 0, coded: 0, otherBook: 1 } }), MOVE_OTHER_BOOK_ROWS_WORDS(1), '(d) before (e)');
});

// ── Y5 · THE MOVE: EVERY LINE, EACH VENDOR ROW TO THE BOOK'S VENDOR OF THE NAME (rulings 3.3, 3.4) ──

test('Y5 bookMove’s move: every line, active or not; each vendor row re-pointed to the target book’s vendor of the same name (case and spaces differing), or to one added there with the source vendor’s own name and tag — once for a name, whatever rows carry it; a row already on the book’s vendor left', () => {
  // A vendor of the name in the target book — written differently.
  const held = bookMove(moveWith({ target: { ...MOVE_BASE.target, vendors: [{ id: 'v-harbor-b', vendor_name: '  harbor   CAFE ' }, { id: 'v-iron-b', vendor_name: 'Iron Works' }] } }));
  assert.deepEqual(held, { ok: true, lines: ['lunch-line', 'lunch-old-line'], money: null, adds: [], repoints: [{ id: 'pv-lunch', from: HARBOR_P, to: { kind: 'held', vendorId: 'v-harbor-b' } }] }); // EDIT-04 (2026-11-29): the plan names its account (money) — none here
  // None of the name: added with the source's own name and tag, and the row points at it.
  const added = bookMove(MOVE_BASE);
  assert.deepEqual(added, { ok: true, lines: ['lunch-line', 'lunch-old-line'], money: null, adds: [{ key: 'harbor cafe', source: HARBOR_P }], repoints: [{ id: 'pv-lunch', from: HARBOR_P, to: { kind: 'added', key: 'harbor cafe' } }] });
  // Two rows of one name — a repeating plan's occurrences — one add; and a second vendor of another name, its own.
  const IRON: BookMoveVendor = { id: 'v-iron-p', vendor_name: 'Iron Works', instagram_tag: null };
  const many = bookMove(moveWith({ vendorRows: [
    { id: 'pv-1', vendor_id: 'v-harbor-p', vendor: HARBOR_P },
    { id: 'pv-2', vendor_id: 'v-harbor-p2', vendor: { id: 'v-harbor-p2', vendor_name: 'HARBOR cafe', instagram_tag: 'other.tag' } },
    { id: 'pv-3', vendor_id: 'v-iron-p', vendor: IRON },
  ] }));
  if (!many.ok) return assert.fail('it refused');
  assert.deepEqual(many.adds, [{ key: 'harbor cafe', source: HARBOR_P }, { key: 'iron works', source: IRON }], 'one add a name — the first row’s vendor gives its name and tag');
  assert.deepEqual(many.repoints.map((r) => [r.id, r.to]), [['pv-1', { kind: 'added', key: 'harbor cafe' }], ['pv-2', { kind: 'added', key: 'harbor cafe' }], ['pv-3', { kind: 'added', key: 'iron works' }]]);
  // A row that names the target book's vendor already: nothing to re-point.
  const already = bookMove(moveWith({ vendorRows: [{ id: 'pv-lunch', vendor_id: 'v-harbor-b', vendor: { id: 'v-harbor-b', vendor_name: 'Harbor Cafe', instagram_tag: null } }], target: { ...MOVE_BASE.target, vendors: [{ id: 'v-harbor-b', vendor_name: 'Harbor Cafe' }] } }));
  assert.deepEqual(already, { ok: true, lines: ['lunch-line', 'lunch-old-line'], money: null, adds: [], repoints: [] });
  // No vendor rows, no lines: the routine alone moves.
  assert.deepEqual(bookMove(moveWith({ lines: [], vendorRows: [] })), { ok: true, lines: [], money: null, adds: [], repoints: [] });
  // The plan names ids and targets only — what a row holds besides its vendor is not the plan's to write.
  for (const r of added.ok ? added.repoints : []) assert.deepEqual(Object.keys(r).sort(), ['from', 'id', 'to']);
});

// ── Y6 · THE ROUTE, READ AS TEXT (rulings 3.1, 3.2, 3.4, 3.5; HARD GATE 2) ──

test('Y6 the routines PATCH moves the routine to another book: after the gate, the book by id and the caller (404); the same book nothing; another, alone (400) — then ONE transaction, every read and check before the first write, the writes as the plan returns them (items and occurrence untouched), the clash 409, and the audit after the commit', () => {
  const route = code(ROUTINE_ROUTE);
  const patch = bodyOf(route, 'PATCH');
  // The gate first, as it stood: the verified cookie, the user, the row by id AND the caller, else 404 — then the body.
  inOrder(patch, [
    'const userEmail = await getVerifiedEmail();', "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "where: { email: { equals: userEmail, mode: 'insensitive' } },", "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    'const existing = await loadAuthorizedRoutine(id, user.id);', "if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    'const body = (await request.json()) as Partial<RoutineForm>;',
    // The book named: the caller's, by id — the defensive 404.
    "if ('entity_id' in body) {",
    "? await prisma.entities.findFirst({ where: { id: body.entity_id, userId: user.id }, select: { id: true, entity_type: true } })",
    "if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    // Another book: alone, else 400 — before anything of the move is read.
    'if (target.id !== existing.entity_id) {',
    "if (Object.keys(body).some((key) => key !== 'entity_id' && key !== 'coa_code')) {", // EDIT-04 (2026-11-29): the CATEGORY picked beside the book
    "return NextResponse.json({ error: 'Validation', field: 'entity_id', message: ENTITY_MOVES_ALONE_WORDS }, { status: 400 });",
    'const word = bookWordOf(target.entity_type);',
    // ONE transaction: locked, every read, the plan's checks…
    'const move = () => prisma.$transaction(async (tx) => {',
    'await lockRoutine(tx, id, user.id);',
    "const lines = await tx.operations_routine_steps.findMany({ where: { routine_id: id, user_id: user.id }, select: { id: true, coa_code: true, budget_amount: true }, orderBy: { step_order: 'asc' } });", // EDIT-04 (2026-11-29): each line's amount, for the money rule
    'const linked = await tx.planned_item_links.count({ where: routineLinksWhere(user.id, id, lineIds) });',
    'const coded = await tx.ledger_line_links.count({ where: { routine_id: id } });',
    'const scheduled = await tx.hub_scheduled_items.count({ where: { user_id: user.id, OR: [{ routine_id: id }, ...(lineIds.length > 0 ? [{ routine_step_id: { in: lineIds } }] : [])] } });',
    'const scenes = await tx.operations_content_scene_groups.count({ where: { user_id: user.id, routine_id: id } });',
    'const targetBook = await loadPlanBook(tx, user.id, target.id);', "if (!targetBook) throw new MoveRefused(404, 'entity_id', 'Not found');", // EDIT-04 (2026-11-29): the target book as the money rule reads it — its chart's codes alone until then
    'const held = await tx.operations_vendor_directory.findMany({ where: { user_id: user.id, entity_id: target.id }, select: { id: true, vendor_name: true } });',
    'const vendorRows = await tx.planned_item_vendors.findMany({',
    "where: { user_id: user.id, OR: [{ routine_id: id }, ...(lineIds.length > 0 ? [{ step_id: { in: lineIds } }] : [])] },",
    'const plan = bookMove({ routine: existing, lines, vendorRows, source: { entityType: source.entity_type }, target: { word, book: targetBook, vendors: held }, picked, counts: { links: linked, coded, otherBook: scheduled + scenes } });',
    'if (!plan.ok) throw new MoveRefused(plan.status, plan.field, plan.words);', // EDIT-04 (2026-11-29): the source book, the pick, the refusal's status and field
    // …then the writes, as the plan returns them.
    'for (const add of plan.adds) {',
    'await tx.operations_vendor_directory.create({ data: { user_id: user.id, entity_id: target.id, vendor_name: add.source.vendor_name, instagram_tag: add.source.instagram_tag }, select: { id: true, vendor_name: true, instagram_tag: true, entity_id: true } });',
    'for (const p of vendorRows) {',
    'await tx.planned_item_vendors.update({ where: { id: p.id }, data: { vendor_id: to } });',
    'await tx.operations_routine_steps.updateMany({ where: { id: { in: plan.lines.filter((l) => !carried.has(l)) }, user_id: user.id }, data: { entity_id: target.id } });',
    'if (money !== null && money.lines.length > 0) await tx.operations_routine_steps.updateMany({ where: { id: { in: [...money.lines] }, user_id: user.id }, data: { entity_id: target.id, coa_code: money.coaCode } });',
    'const routine = await tx.operations_routines.update({ where: { id }, data: money !== null && money.routine ? { entity_id: target.id, coa_code: money.coaCode } : { entity_id: target.id } });', // EDIT-04 (2026-11-29): the account beside the book
    '}, { timeout: 60000 });',
    // Refused by name, the clash by the directory's key — 409, nothing written.
    'moved = await move();',
    "if (error instanceof MoveRefused) return NextResponse.json({ error: error.status === 409 ? 'Conflict' : error.status === 404 ? 'Not found' : 'Validation', field: error.field, message: error.words }, { status: error.status });", // EDIT-04 (2026-11-29): each refusal's own status and field
    "if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {",
    "return NextResponse.json({ error: 'Conflict', field: 'entity_id', message: MOVE_VENDOR_RACE_WORDS(word) }, { status: 409 });",
    // Audited after the commit: the routine, each vendor added, each vendor row re-pointed.
    "action: { type: 'operations_routine_updated', description: `Moved routine \"${existing.name}\" to ${word}` },",
    'payload: { before: existing, after: moved.routine, metadata: { book: { from: existing.entity_id, to: target.id }, lines_moved: moved.lines, account: moved.account } },', // EDIT-04 (2026-11-29): and the account
    'for (const v of moved.added) {', "action: { type: 'operations_vendor_added',", "target: { table: 'operations_vendor_directory', id: v.id },",
    'for (const r of moved.repointed) {', "action: { type: 'operations_plan_vendor_set',", "target: { table: 'planned_item_vendors', id: r.after.id },",
    'metadata: { from: r.before.vendor_id, to: r.after.vendor_id, routine_id: id, moved_with: \'operations_routine_updated\' } },',
    // The answer names each vendor added.
    'vendors_added: moved.added.map((v) => v.vendor_name), account: moved.account } });', // EDIT-04 (2026-11-29): and the account
    // The routine's own book: nothing moved, nothing logged.
    'if (Object.keys(body).length === 1) return NextResponse.json({ routine: existing, rekeyed: null });',
    // Then the PATCH as it was.
    'const data: Prisma.operations_routinesUpdateInput = {};',
  ], 'the routines PATCH');
  // Every read and check before the first write, inside the one transaction.
  const tx = patch.slice(patch.indexOf('const move = () => prisma.$transaction(async (tx) => {'), patch.indexOf('}, { timeout: 60000 });', patch.indexOf('const move = () => prisma.$transaction(')));
  const firstWrite = tx.search(/\.(create|update|updateMany|upsert|delete|deleteMany)\(/);
  assert.ok(firstWrite > tx.indexOf('if (!plan.ok) throw new MoveRefused(plan.status, plan.field, plan.words);'), 'nothing written before the plan’s every check');
  assert.equal(tx.slice(0, firstWrite).match(/await tx\.\w+\.(findMany|count)\(/g)?.length, 7, 'seven reads, all before the first write'); // EDIT-04 (2026-11-29): the chart's read became loadPlanBook — eight until then
  assert.ok(tx.indexOf('const targetBook = await loadPlanBook(tx, user.id, target.id);') < firstWrite, 'and the target book, read before it');
  // The move writes these four, and nothing else: no vendor row created or deleted, no directory row updated or deleted, no link written.
  assert.deepEqual(tx.match(/tx\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g), ['tx.operations_vendor_directory.create(', 'tx.planned_item_vendors.update(', 'tx.operations_routine_steps.updateMany(', 'tx.operations_routine_steps.updateMany(', 'tx.operations_routines.update(']);
  // The re-point: vendor_id alone — the row's items and occurrence untouched; the file's two vendor-row writes each in its pinned shape.
  assert.deepEqual(route.match(/\.planned_item_vendors\.update\(\{[^)]*\}\)/g), ['.planned_item_vendors.update({ where: { id: p.id }, data: { vendor_id: to } })', '.planned_item_vendors.update({ where: { id: v.id }, data: { occurrence_at: to } })']);
  assert.equal((route.match(/\.operations_vendor_directory\.create\(/g) ?? []).length, 1, 'one copy, in the move');
  // The rows read for the plan are the caller's: every read names the caller or the routine proven the caller's.
  for (const read of tx.match(/await tx\.\w+\.(findMany|count)\(\{ where: [^\n]*/g) ?? []) assert.match(read, /user_id: user\.id|userId: user\.id|routine_id: id \}|routineLinksWhere\(user\.id, id, lineIds\)/, read);
  // The money rule's book stays the routine's own, read once (INTAKE-01), and the move is not it.
  assert.equal((patch.match(/book = await loadPlanBook\(prisma, user\.id, existing\.entity_id\);/g) ?? []).length, 1);
  assert.equal((patch.match(/loadPlanBook\(tx, user\.id, target\.id\)/g) ?? []).length, 1, 'the move reads the target book once, with the same loader, inside its transaction'); // EDIT-04 (2026-11-29): the move reads the target as the money rule does — never read with loadPlanBook until then
});

// ── Y7 · THE ENTITY CELL (ruling 3.6) ──

test('Y7 the ENTITY cell sends the book picked, alone, to the routines PATCH; its line says what it reaches before the save — on a row with a vendor, that the vendor goes with it as that book’s own; each refusal said in its words; a row with no plan refuses as EDIT-02 ruled', async () => {
  const lunch = rowOf('Lunch', THU);
  const L = planOf(lunch);
  assert.deepEqual(planCellWrite(lunch, L, 'book', 'B'), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { entity_id: 'B' } } });
  // The box opens on the row's own book, from the provider's books (ColumnBox's book select — EDIT-02).
  assert.equal(boxTextOf(lunch, 'book', ledger.editing[lunch.key]), 'P');
  // The reach, before the save.
  assert.equal(ENTITY_VENDOR_REACH_WORDS, ' — its vendor goes with it: that book\'s vendor of the same name, added there when it has none');
  assert.equal(cellReachWords('book', ledger.editing[lunch.key], THU), `this row${ENTITY_VENDOR_REACH_WORDS}`, 'a one-off with a vendor');
  assert.equal(cellReachWords('book', ledger.editing[rowOf('Snack', THU).key], THU), 'this row', 'a one-off with none');
  assert.equal(cellReachWords('book', ledger.editing[rowOf('Morning Gym', FRI).key], FRI), `${REPEATING_REACH_WORDS('Morning Gym')}${ENTITY_VENDOR_REACH_WORDS}`, 'a repeating plan with a vendor: every row of it, and its vendor');
  assert.equal(cellReachWords('book', ledger.editing[rowOf('Rent', FRI).key], FRI), 'this row', 'a charge with none');
  // Through the routines PATCH — the book alone.
  let run = await standIn([[200, { routine: {}, moved: { vendors_added: ['Harbor Cafe'] } }]], () => savePlanCell(lunch, L, 'book', 'B'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/routines/lunch', method: 'PATCH', body: { entity_id: 'B' } }]);
  // Each refusal said on the line in its words — nothing moved.
  for (const words of [BOOKS_LINK_MOVE_WORDS, BOOKS_CODED_MOVE_WORDS(2), MOVE_PICK_ACCOUNT_WORDS('Business'), MOVE_OTHER_BOOK_ROWS_WORDS(1), MOVE_VENDOR_NAME_TWICE_WORDS('Business', 'Harbor Cafe'), MOVE_VENDOR_RACE_WORDS('Business')]) {
    run = await standIn([[409, { error: 'Conflict', field: 'entity_id', message: words }]], () => savePlanCell(lunch, L, 'book', 'B'));
    assert.deepEqual(run.result, { ok: false, words });
  }
  run = await standIn([[404, { error: 'Not found' }]], () => savePlanCell(lunch, L, 'book', 'someone-else'));
  assert.deepEqual(run.result, { ok: false, words: 'Not found' });
  // A row with no plan: ENTITY refused before any typing, in the entry's own words (EDIT-02) — never sent.
  const kiosk = ledger.sheet.find((r) => r.description === 'Kiosk' && r.day === THU) ?? assert.fail('no Kiosk row');
  const entry = ledger.editing[kiosk.key];
  assert.equal(entry.plan, false);
  assert.equal(cellOpens('book', kiosk, ledger.recording[kiosk.key], entry).refusal, entry.plan ? null : entry.words);
});
