/**
 * RETRO-01 (Alex, 2026-10-16) — THE EXPENSE LEDGER: only stops that take money;
 * a stranded record re-attaches to its stop; "+ expense" on the ledger adds a
 * one-off stop (and its record) to a day.
 *
 * "The ledger is an expense ledger. The journal is not an expense. Records he
 * typed before routines were changed (time, start date) match no stop any
 * more, so their rows show no COA, vendor or budget, and the day card offers
 * no way to fix them. He also wants to add an expense straight from the ledger
 * and have it land on that day's card."
 *
 * The rules are DRIVEN (ledgerOf over Budget-built fixtures; moveInput;
 * attachableStops; expenseInput and the three bodies; the words); the routes,
 * the reads, the writers, the card, the form, the section, the enum, the
 * migration and the audit list are anchored to their source with comments
 * stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { RoutineWords } from '../budget/planLines';
import {
  AMOUNT_ZERO_WORDS, EMPTY_EXPENSE, EXPENSE_FIELDS, EXPENSE_FIELD_WORDS, EXPENSE_STEPS, EXPENSE_WORDS, NO_MONEY_ROLES, NOT_ASKED_WORDS, NOT_TRIED_WORDS, STEP_WORDS, VENDOR_BOTH_WORDS, WRITTEN_WORDS,
  dayTypedWords, expenseInput, expenseLandedWords, ledgerOf, ledgerTotals, leftOutWords, lineCountWords, oneOffBody, outcomeWords, recordBody, requiredWords, starsTypedWords, timeTypedWords, vendorBody, withNotTried, zoneWords,
  type ExpenseDraft, type ExpenseValues, type LedgerInput, type LedgerRecordInput,
} from '../operations/ledger';
import { MOVE_BODY_WORDS, moveInput, movedWords, recordThereWords, type StopRecordRow } from '../operations/stopRecord';
import { asksAmount, attachWords, attachableStops, noStopToAttachWords, planStops, recordWithoutStopWords, recordsWithoutStopHead, stopTakenWords, type Stop } from '@/components/workbench/operations/day/dayCard';
import { moveStopRecord } from '@/components/workbench/operations/stops/stopWrites';
import { addVendor, createOneOff, readOneOffLine, setVendor } from '@/components/workbench/operations/ledger/ledgerWrites';
import { DAY_WRITTEN_EVENT } from '@/components/workbench/operations/dayWritten';

const RULES = 'src/lib/operations/ledger.ts';
const RECORD_RULES = 'src/lib/operations/stopRecord.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const ROUTE = 'src/app/api/operations/stops/route.ts';
const ROUTE_ID = 'src/app/api/operations/stops/[id]/route.ts';
const WRITES = 'src/components/workbench/operations/stops/stopWrites.ts';
const ATTACH = 'src/components/workbench/operations/stops/AttachRecord.tsx';
const SIGNAL = 'src/components/workbench/operations/dayWritten.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const LEDGER_WRITES = 'src/components/workbench/operations/ledger/ledgerWrites.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261016120000_retro_01_stop_moved_audit_type';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';

function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── FIXTURES (the Budget's own shapes, as ledger01's) ───────────────────────

const BKK = 'Asia/Bangkok';
const DAY = '2026-10-13';
/** Oct 13, 23:00 Bangkok — every Oct 13 stop is past. */
const NOW = new Date('2026-10-13T16:00:00.000Z');
const BRUNCH_13 = '2026-10-13T04:00:00.000Z';
const JOURNAL_13 = '2026-10-12T23:00:00.000Z';
const PLAN_13 = '2026-10-13T01:00:00.000Z';
const GYM_13 = '2026-10-13T13:00:00.000Z';

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: BKK, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  routine({ id: 'brunch', name: 'Brunch', scheduleRrule: 'FREQ=DAILY;BYHOUR=11;BYMINUTE=0', budgetAmount: 25, coaCode: '6150' }),
  routine({ id: 'journal', name: 'Vision journal', scheduleRrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0', budgetAmount: 5, coaCode: '6150' }),
  routine({ id: 'plan', name: 'Plan', scheduleRrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0' }),
  routine({ id: 'gym', name: 'Gym', scheduleRrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0', budgetAmount: 20, coaCode: '6200' }),
];
const ROLES = new Map([['brunch', 'place'], ['journal', 'journal'], ['plan', 'plan'], ['gym', 'none']]);
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r) => [r.id, { name: r.name, timezone: BKK, steps: new Map() }]));
const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const stop = (id: string, name: string, role: string, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId: id, routineName: name, zone: BKK, role, activity: null, timeOfDay: null });
const RECORDS: LedgerRecordInput[] = [
  stop('brunch', 'Brunch', 'place', record({ id: 'r-brunch', kind: 'routine', target_id: 'brunch', occurrence_at: BRUNCH_13, actual_cents: 2200, rating: 4 })),
  stop('journal', 'Vision journal', 'journal', record({ id: 'r-journal', kind: 'routine', target_id: 'journal', occurrence_at: JOURNAL_13, actual_minutes: 12 })),
  stop('plan', 'Plan', 'plan', record({ id: 'r-plan', kind: 'routine', target_id: 'plan', occurrence_at: PLAN_13 })),
  stop('gym', 'Gym', 'none', record({ id: 'r-gym', kind: 'routine', target_id: 'gym', occurrence_at: GYM_13, actual_cents: 0 })),
];
const built = buildRoutineBudgetLines(ROUTINES, DAY, DAY);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: DAY, to: DAY, now: NOW, records: RECORDS, links: [], lines: built.lines, notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, vendors: [], stays: [],
  accounts: [{ entityId: 'P', code: '6150', name: 'Food & drink' }], books: [{ id: 'P', entityType: 'personal' }], ...over,
});

// ── T1 · R1 EXPENSES ONLY ───────────────────────────────────────────────────

test('T1 ledgerOf lists a record only when its plan’s role takes money (asksAmount); the others leave the rows and the totals, counted by role; a priced journal stop past with no record is not "not recorded"', () => {
  assert.deepEqual(NO_MONEY_ROLES, ['journal', 'plan', 'execute', 'all_day']);
  for (const role of ['place', 'none'] as const) assert.equal(asksAmount(role), true);
  for (const role of NO_MONEY_ROLES) assert.equal(asksAmount(role), false);
  const ledger = ledgerOf(input());
  assert.deepEqual(ledger.rows.map((r) => r.id), ['r-brunch', 'r-gym'], 'the place stop and the plain stop — the journal and the plan left out');
  assert.deepEqual(ledger.said.leftOut, { journal: 1, plan: 1, execute: 0, all_day: 0 });
  assert.equal(ledgerTotals(ledger.rows).actualCents, 2200, 'the totals are the rows shown — a journal’s minutes never summed, a plan never counted');
  assert.equal(ledger.rows.find((r) => r.id === 'r-brunch')!.coa!.account, 'P-6150', 'the kept rows are matched as before');
  // The journal stop is priced ($5) and past with no record on a day the journal was NOT recorded: never "not recorded" — it takes no money.
  const noJournal = ledgerOf(input({ records: RECORDS.filter((r) => r.record.id !== 'r-journal') }));
  assert.equal(noJournal.said.notRecorded, 0, 'the priced journal stop is not an expense missing');
  assert.deepEqual(noJournal.said.leftOut, { journal: 0, plan: 1, execute: 0, all_day: 0 });
  const noBrunch = ledgerOf(input({ records: RECORDS.filter((r) => r.record.id !== 'r-brunch') }));
  assert.equal(noBrunch.said.notRecorded, 1, 'the priced brunch, past with no record, still is');
  assert.throws(() => ledgerOf(input({ records: [stop('gym', 'Gym', 'sometimes', RECORDS[3].record)] })), /not one of the six/, 'a role that is not one of the six is the route’s error, never guessed');
  // The rule in the source: the filter before the lines are read, the count by role, the missing loop's gate.
  const r = code(RULES);
  inOrder(r, ['const leftOut: Record<NoMoneyRole, number> = { journal: 0, plan: 0, execute: 0, all_day: 0 };', 'const expenses = placed.filter((p) => {', 'if (!isStopRole(role)) throw', 'if (asksAmount(role)) return true;', 'leftOut[role as NoMoneyRole] += 1;', 'for (const day of new Set(expenses.map((p) => p.day)))', 'const rows: LedgerRow[] = expenses.map(', 'if (!isStop(role)) continue;', 'if (!asksAmount(role)) continue;', 'leftOut,'], 'expenses only, in the rule');
  // LEDGER-02 (Alex, 2026-10-19): rowActualWords left the import — the ACTUAL cell is the amount alone (planDollars).
  assert.match(r, /import \{ asksAmount, dayShortWords, dayTotals, deltaWords, planDollars, stopName \} from '@\/components\/workbench\/operations\/day\/dayCard';/, 'the card’s own rule for which stops take money');
  // The words.
  assert.equal(leftOutWords({ journal: 1, plan: 1, execute: 0, all_day: 0 }), '2 records left out — not expenses (no money at a journal, plan or execute stop): journal 1 · plan 1');
  assert.equal(leftOutWords({ journal: 0, plan: 0, execute: 0, all_day: 0 }), '0 records left out — not expenses (no money at a journal, plan or execute stop)');
  assert.equal(leftOutWords({ journal: 0, plan: 0, execute: 1, all_day: 0 }), '1 record left out — not expenses (no money at a journal, plan or execute stop): execute 1');
  assert.equal(leftOutWords({ journal: 0, plan: 0, execute: 0, all_day: 2 }), '2 records left out — not expenses (no money at a journal, plan or execute stop): all day 2');
  // The section says it, under the not-recorded line, from the rules file.
  const s = code(SECTION);
  inOrder(s, ['notRecordedWords(answer.read.value.said.notRecorded)', '<p data-ledger-said-left-out>{leftOutWords(answer.read.value.said.leftOut)}</p>'], 'said, by role, under the table');
  assert.match(comments(RULES), /RETRO-01 \(Alex, 2026-10-16\) — EXPENSES ONLY/);
});

// ── T2 · R2 THE MOVE'S RULE AND THE CARD'S PAIRING ──────────────────────────

const stopOf = (over: Partial<Stop> & { key: string }): Stop => ({
  kind: 'routine', time: '11:00', label: 'Brunch', line: null, vendor: null, location: null, minutes: null, cents: 2500, status: 'open', statusSource: 'routine', role: 'place',
  planLine: null, planLineState: 'none', address: { kind: 'routine', id: 'brunch', instant: BRUNCH_13 }, zone: BKK, record: null, actualCents: null, actualSource: null, doneAt: null, lateMinutes: null, actualMinutes: null,
  ...over,
} as Stop);

test('T2 moveInput: { instant } an ISO instant, nothing else read; attachableStops: the day’s stops of the record’s own plan with no record; the words', () => {
  assert.deepEqual(moveInput({ instant: '2026-10-13T05:00:00.000Z' }), { ok: true, instant: new Date('2026-10-13T05:00:00.000Z') });
  assert.deepEqual(moveInput({ instant: '2026-10-13T12:00:00+07:00', outcome: 'skipped' }), { ok: true, instant: new Date('2026-10-13T05:00:00.000Z') }, 'an offset is an instant; outcome is not read');
  assert.deepEqual(moveInput(null), { ok: false, field: 'instant', message: MOVE_BODY_WORDS });
  assert.deepEqual(moveInput([]), { ok: false, field: 'instant', message: MOVE_BODY_WORDS });
  assert.deepEqual(moveInput({}), { ok: false, field: 'instant', message: 'instant undefined is not an ISO instant' });
  assert.deepEqual(moveInput({ instant: '2026-10-13 12:00' }), { ok: false, field: 'instant', message: 'instant "2026-10-13 12:00" is not an ISO instant' });
  assert.deepEqual(moveInput({ instant: '2026-02-30T00:00:00Z' }), { ok: false, field: 'instant', message: 'instant "2026-02-30T00:00:00Z" is not an ISO instant' }, 'a date that rolls is not an instant');
  assert.equal(recordThereWords('2026-10-13T05:00:00.000Z'), 'a record of this stop already sits at 2026-10-13T05:00:00.000Z — clear one of the two first');
  assert.equal(movedWords({ kind: 'routine', target_id: 'brunch' }, BRUNCH_13, '2026-10-13T05:00:00.000Z'), `Moved the record of a stop: routine brunch from ${BRUNCH_13} to 2026-10-13T05:00:00.000Z`);
  // The pairing: the same plan (kind and id), no record; a line's record pairs with the line's stop, not the routine's; a task has no address.
  const stranded = record({ id: 'r-old', kind: 'routine', target_id: 'brunch', occurrence_at: BRUNCH_13 });
  const brunchNow = stopOf({ key: `routine:brunch:2026-10-13T05:00:00.000Z`, time: '12:00', address: { kind: 'routine', id: 'brunch', instant: '2026-10-13T05:00:00.000Z' } });
  const brunchTaken = stopOf({ key: 'taken', address: { kind: 'routine', id: 'brunch', instant: '2026-10-13T06:00:00.000Z' }, record: record({ id: 'r-there', kind: 'routine', target_id: 'brunch', occurrence_at: '2026-10-13T06:00:00.000Z' }) });
  const other = stopOf({ key: 'gym', label: 'Gym', address: { kind: 'routine', id: 'gym', instant: GYM_13 } });
  const line = stopOf({ key: 'line', kind: 'line', label: 'Morning', line: 'Coffee', address: { kind: 'routine_line', id: 'brunch', instant: GYM_13 } });
  const task = stopOf({ key: 'task:1', kind: 'task', address: null });
  assert.deepEqual(attachableStops(stranded, [brunchTaken, other, brunchNow, line, task]).map((s) => s.key), [brunchNow.key], 'one target: the same plan, empty');
  assert.deepEqual(attachableStops({ kind: 'routine_line', target_id: 'brunch' }, [brunchNow, line]).map((s) => s.key), ['line'], 'a line’s record pairs with the line');
  assert.deepEqual(attachableStops(stranded, []), []);
  assert.deepEqual(planStops(stranded, [brunchTaken, other, brunchNow, line, task]).map((s) => s.key), ['taken', brunchNow.key], 'the plan’s stops, taken or not — so a taken one is said as taken, not as absent');
  assert.equal(stopTakenWords('Brunch'), 'the Brunch stop on this day already has a record — clear one of the two first');
  assert.equal(attachWords(brunchNow), 'attach to Brunch 12:00');
  assert.equal(attachWords(line), 'attach to Coffee 11:00', 'a line’s bold name is its activity');
  assert.equal(attachWords(stopOf({ key: 'x', time: null })), 'attach to Brunch', 'no clock, no clock printed');
  assert.equal(noStopToAttachWords('Brunch'), 'no Brunch stop on this day — extend the routine\'s start date, then attach');
  assert.equal(recordsWithoutStopHead(1), '1 record of the day matches no stop');
  assert.equal(recordWithoutStopWords(record({ id: 'r', kind: 'routine', target_id: 'brunch', occurrence_at: BRUNCH_13, actual_cents: 2200 }), { routine_name: 'Brunch', activity: null, timezone: BKK }), 'Brunch · 11:00 Tue Oct 13: done, $22.00', 'the instant in the routine’s own zone');
  assert.equal(recordWithoutStopWords(record({ id: 'r', kind: 'routine_line', target_id: 'coffee', occurrence_at: BRUNCH_13, outcome: 'skipped', note: 'x' }), { routine_name: 'Morning', activity: 'Coffee', timezone: 'America/Los_Angeles' }), 'Coffee · 21:00 Mon Oct 12: skipped');
  assert.match(code(CARD_RULES), /export const planStops = \(r: Pick<StopRecordRow, 'kind' \| 'target_id'>, stops: readonly Stop\[\]\): Stop\[\] =>\n\s*stops\.filter\(\(s\) => s\.address !== null && s\.address\.kind === r\.kind && s\.address\.id === r\.target_id\);/);
  assert.match(code(CARD_RULES), /export const attachableStops = \(r: Pick<StopRecordRow, 'kind' \| 'target_id'>, stops: readonly Stop\[\]\): Stop\[\] =>\n\s*planStops\(r, stops\)\.filter\(\(s\) => s\.record === null\);/);
  assert.doesNotMatch(code(CARD_RULES), /recordsWithoutStopWords/, 'the one sentence for all is gone');
});

// ── T3 · R2 THE PATCH ───────────────────────────────────────────────────────

test('T3 the record’s PATCH: owner-checked, the instant proven by routineDay, a taken target refused by name, the move and the mirror at both instants in ONE transaction, audited operations_stop_moved before → after; nothing else on the record changes', () => {
  const i = code(ROUTE_ID);
  for (const method of ['DELETE', 'PATCH']) assert.match(i, new RegExp(`export async function ${method}\\(`));
  assert.doesNotMatch(i, /export (const|function) (?!DELETE|PATCH)/, 'a route file exports its handlers only');
  const patch = i.slice(i.indexOf('export async function PATCH('));
  inOrder(patch, [
    'getVerifiedEmail()', "{ error: 'Unauthorized' }, { status: 401 }", 'prisma.users.findFirst(', "if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    'raw = await request.json();', 'BODY_NOT_JSON_WORDS', 'const read = moveInput(raw);', "if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });",
    'prisma.operations_stop_records.findFirst({ where: { id, user_id: user.id }, include: { step: { select: { routine_id: true, is_active: true } } } })', "if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    'const before = stopRecordRowOf(row);', 'const routineId = row.step !== null ? row.step.routine_id : row.routine_id;',
    'prisma.operations_routines.findFirst({ where: { id: routineId, user_id: user.id }, select: { id: true, timezone: true, schedule_rrule: true, start_date: true, end_date: true, is_active: true } })',
    'ARCHIVED_LINE_WORDS', 'INACTIVE_ROUTINE_WORDS',
    'const now = new Date();', 'if (read.instant.getTime() === row.occurrence_at.getTime()) return NextResponse.json({ record: before, moved: false });',
    'localDay = instantToZoned(read.instant, routine.timezone).date;', "refusedWords('timezone not recognised'", 'const that = routineDay(routine, localDay, now);',
    "if (that.kind === 'refused')", "if (that.kind === 'none')", 'noStopWords(instant, localDay, null)', 'if (that.expectedAt.getTime() !== read.instant.getTime())', 'noStopWords(instant, localDay, that.expectedAt.toISOString())',
    'prisma.$transaction(async (tx) => {', 'await lockRoutine(tx, routine.id, user.id);',
    'tx.operations_stop_records.findFirst({ where: { user_id: user.id, routine_id: row.routine_id, step_id: row.step_id, occurrence_at: read.instant } })', 'if (there !== null) return { there: instant };',
    'tx.operations_stop_records.update({ where: { id: row.id }, data: { occurrence_at: read.instant } })',
    'syncCompletion(tx, { userId: user.id, routineId: routine.id, expectedAt: row.occurrence_at, now })', 'syncCompletion(tx, { userId: user.id, routineId: routine.id, expectedAt: read.instant, now })',
    "error.code === 'P2002'", "{ error: 'Conflict', message: recordThereWords(instant) }, { status: 409 }", "if ('there' in moved) return NextResponse.json({ error: 'Conflict', message: recordThereWords(moved.there) }, { status: 409 });",
    "type: 'operations_stop_moved', description: movedWords(before, before.occurrence_at, moved.after.occurrence_at)", "target: { table: 'operations_stop_records', id: row.id }", 'payload: { before, after: moved.after, metadata: { from: before.occurrence_at, to: moved.after.occurrence_at, routine_id: routine.id } }',
    'for (const change of moved.changes) await auditCompletionChange(change, { user_id: user.id, email: userEmail });', 'return NextResponse.json({ record: moved.after, moved: true });',
    "failClosedResponse('Stop PATCH'",
  ], 'PATCH, in order');
  assert.equal((patch.match(/\.update\(/g) ?? []).length, 1, 'one write: the instant');
  assert.equal((patch.match(/data: \{ occurrence_at: read\.instant \}/g) ?? []).length, 1, 'nothing else on the record changes');
  assert.equal((patch.match(/new Date\(\)/g) ?? []).length, 1, 'one clock for the rule and the mirror');
  assert.doesNotMatch(patch, /\.delete\(|\.create\(|done_at|actual_cents|rating|note|\$queryRaw|\$executeRaw/, 'no other column, no raw SQL');
  assert.match(i, /import \{ auditCompletionChange, lockRoutine, syncCompletion, type CompletionChange \} from '@\/lib\/operations\/routineCompletion';/);
  assert.match(i, /import \{ routineDay \} from '@\/lib\/operations\/routineDay';/, 'the stops POST’s own rule');
  assert.match(comments(ROUTE_ID), /RETRO-01 \(Alex, 2026-10-16\)/);
  // The DELETE stands as it was (stop01 and tasksOne02 pin it whole).
  assert.match(i, /tx\.operations_stop_records\.delete\(\{ where: \{ id: row\.id \} \}\)/);
});

// ── T4 · R2 THE READ, THE WRITER, THE CARD ──────────────────────────────────

test('T4 the stops GET hands each record’s plan words; the read requires them; the writer’s PATCH; the card’s foot: one row per record, through AttachRecord — the day folder writes nothing', async () => {
  const r = code(ROUTE);
  assert.match(r, /const plans: Record<string, StopRecordPlan> = \{\};/);
  assert.match(r, /if \(localDay === day\) \{ records\.push\(record\); plans\[record\.id\] = plan; \}/);
  assert.match(r, /return NextResponse\.json\(\{ day, records, unplaced, plans \}\);/);
  const d = code(READS);
  assert.match(d, /readonly plans: Readonly<Record<string, StopRecordPlan>>;/);
  assert.match(d, /if \(typeof read\.value\.plans !== 'object' \|\| read\.value\.plans === null \|\| Array\.isArray\(read\.value\.plans\)\) return \{ ok: false, words: stopRecordsFailedWords\('the records came back without their plans'\) \};/);
  assert.match(code(RECORD_RULES), /export interface StopRecordPlan \{\n\s*readonly routine_name: string;\n\s*readonly activity: string \| null;\n\s*readonly timezone: string;\n\}/);
  // The writer: PATCH /api/operations/stops/[id] { instant }, the answer read as the set and the clear are.
  const sent: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  let answer: () => Response = () => new Response(JSON.stringify({ record: { id: 'r1' }, moved: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  try {
    assert.deepEqual(await moveStopRecord('r1', '2026-10-13T05:00:00.000Z'), { ok: true });
    answer = () => new Response(JSON.stringify({ error: 'Conflict', message: recordThereWords('2026-10-13T05:00:00.000Z') }), { status: 409, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await moveStopRecord('r1', '2026-10-13T05:00:00.000Z'), { ok: false, message: recordThereWords('2026-10-13T05:00:00.000Z') });
    answer = () => new Response(JSON.stringify({}), { status: 500, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await moveStopRecord('r1', '2026-10-13T05:00:00.000Z'), { ok: false, message: 'failed to move the stop record' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => [s.url, s.init?.method, s.init?.body]), [
    ['/api/operations/stops/r1', 'PATCH', JSON.stringify({ instant: '2026-10-13T05:00:00.000Z' })], ['/api/operations/stops/r1', 'PATCH', JSON.stringify({ instant: '2026-10-13T05:00:00.000Z' })], ['/api/operations/stops/r1', 'PATCH', JSON.stringify({ instant: '2026-10-13T05:00:00.000Z' })],
  ]);
  assert.match(code(WRITES), /export async function moveStopRecord\(id: string, instant: string\): Promise<StopAnswer> \{\n\s*const res = await fetch\(`\/api\/operations\/stops\/\$\{id\}`, \{\n\s*method: 'PATCH',/);
  // The card: the head, one AttachRecord per record with its plan words, the records read again after a move; the day folder names no writer.
  const c = code(CARD);
  assert.match(c, /\{result\.recordsWithoutStop\.length > 0 && recordsRead !== null && recordsRead\.ok && \(\n\s*<div className="text-brand-amber space-y-1" data-day-records-without-stop>\n\s*<p>\{recordsWithoutStopHead\(result\.recordsWithoutStop\.length\)\}<\/p>\n\s*\{result\.recordsWithoutStop\.map\(\(r\) => \(\n\s*<AttachRecord key=\{r\.id\} record=\{r\} plan=\{planOfRecord\(recordsRead\.value\.plans, r\)\} stops=\{result\.stops\} onChanged=\{\(\) => setRecordReads\(\(n\) => n \+ 1\)\} \/>/);
  assert.match(c, /const planOfRecord = \(plans: StopRecordsAnswer\['plans'\], r: StopRecordRow\): StopRecordPlan => \{\n\s*const plan = plans\[r\.id\];\n\s*if \(plan === undefined\) throw new Error\(`dayCard: record \$\{r\.id\} came without its plan words`\);\n\s*return plan;\n\};/, 'a listed record without its plan words is the route’s error, never a nameless line');
  assert.match(c, /import AttachRecord from '\.\.\/stops\/AttachRecord';/);
  assert.doesNotMatch(c, /moveStopRecord|stopWrites|recordsWithoutStopWords/, 'the day folder writes nothing of its own');
  const a = code(ATTACH);
  assert.match(a, /^'use client';/m);
  assert.match(a, /import \{ moveStopRecord \} from '\.\/stopWrites';/, 'the one writer');
  assert.match(a, /const targets = attachableStops\(record, stops\);/);
  assert.match(a, /const answer = await moveStopRecord\(record\.id, stop\.address\.instant\);\n\s*if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}\n\s*onChanged\(\);/, 'the stop’s own instant; a refusal is the route’s words; then the records again');
  assert.match(a, /<span>\{recordWithoutStopWords\(record, plan\)\}<\/span>/);
  assert.match(a, /onClick=\{\(\) => attach\(s\)\} data-day-attach=\{s\.key\}>\{attachWords\(s\)\}<\/button>/);
  assert.match(a, /const taken = targets\.length === 0 && planStops\(record, stops\)\.length > 0;/);
  assert.match(a, /\{targets\.length === 0 && <span data-day-no-attach=\{taken \? 'taken' : 'none'\}>\{taken \? stopTakenWords\(plan\.routine_name\) : noStopToAttachWords\(plan\.routine_name\)\}<\/span>\}/);
  assert.match(a, /\{words !== null && <span className="text-brand-red" data-day-attach-failed>\{words\}<\/span>\}/);
  assert.doesNotMatch(a, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|method:/, 'names no route, stores nothing');
  assert.doesNotMatch(a, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
});

// ── T5 · THE AUDIT TYPE ─────────────────────────────────────────────────────

test('T5 the audit type: the enum value last, the one ADD VALUE line applied at deploy (the STOP-01 precedent), the client knows it, the audit log lists it', () => {
  const values = /enum AuditActionType \{([\s\S]*?)\}/.exec(code(SCHEMA))![1].split(/\s+/).filter(Boolean);
  // ROUTINE-02b (2026-10-18): operations_routine_rekeyed follows it in ALTER TYPE order — the pin moved from last to one before last.
  // MOVE-01 (2026-10-19): one more value follows (operations_routines_moved) — the tail moved by one.
  // LEDGER-03 (Alex, 2026-10-19): planned_item_linked and planned_item_unlinked were appended after MOVE-01's value — every position below moved by two.
  assert.equal(values[values.length - 5], 'operations_stop_moved');
  assert.equal(values.filter((v) => v === 'operations_stop_moved').length, 1);
  assert.equal(AuditActionType.operations_stop_moved, 'operations_stop_moved', 'prisma generate ran');
  assert.equal(code(MIGRATION).trim(), `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stop_moved';`, 'the one line and nothing else');
  assert.match(comments(MIGRATION), /AUTHORED here, applied at deploy/);
  assert.match(comments(SCHEMA), /RETRO-01 \(Alex, 2026-10-16\): a stop's record moved/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // ROUTINE-02b (2026-10-18): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 9], MIGRATION_DIR, 'the migration before the newest (ROUTINE-02b followed)');
  // MOVE-01 (2026-10-19): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 8], '20261018120000_routine_02b_rekeyed_audit_type', 'the migration before the newest (MOVE-01 followed)');
  // JOURNAL-04 (2026-10-19): the evening answers' migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 7], '20261019090000_move_01_moved_audit_type', 'the migration before the newest (JOURNAL-04 followed)');
  assert.equal(dirs[dirs.length - 6], '20261019210000_journal_04_evening_answers', 'the migration before the newest (LEDGER-03 followed)');
  // LEDGER-03 (Alex, 2026-10-19): two audit values for the planned-item link — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 5], '20261019230000_ledger_03_planned_item_link_audit', 'the migration before the newest (BACKLOG-01 followed)');
  // BACKLOG-01 (Alex, 2026-10-20): the capture's columns and the four statuses — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261020120000_backlog_01_capture', 'the migration before the newest (BACKLOG-01b followed)');
  // BACKLOG-01b (Alex, 2026-10-20): the brief's three columns — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 3], '20261020140000_backlog_01b_brief', 'the migration before the newest (JOURNAL-06 followed)');
  // JOURNAL-06 (Alex, 2026-10-20): the evening's five columns, the two CHECKs re-made — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 2], '20261020150000_journal_06_reflection', 'the migration before the newest (BACKLOG-02 followed)');
  // BACKLOG-02 (Alex, 2026-10-20): the reorder route's one audit value — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261020160000_backlog_02_reranked', 'the newest migration');
  assert.equal(dirs[dirs.length - 10], '20261014090000_tasks_one_02_completion_audit_types');
  const ops = code(AUDIT_LOG).slice(code(AUDIT_LOG).indexOf('operations_: ['));
  // ROUTINE-02b (2026-10-18): the rekeyed type follows the stop-moved type in the list.
  // MOVE-01 (2026-10-19): the moved type follows the rekeyed type in the list.
  assert.match(ops.slice(0, ops.indexOf('],')), /'operations_routine_completion_updated',\s*'operations_stop_moved',\s*'operations_routine_rekeyed',\s*'operations_routines_moved',\s*$/);
});

// ── T6 · R3 "+ EXPENSE": THE RULE AND THE BODIES ────────────────────────────

const DRAFT: ExpenseDraft = { ...EMPTY_EXPENSE, day: DAY, time: '12:30', name: 'Khao soi', amount: '7.50', coa: '6150', book: 'P', actual: '7', stars: '4', note: 'Khao soi at Luka' };

test('T6 expenseInput: the first bad field named; the stop is the day and time in the viewer’s zone; the three bodies — a one-off with ONE line carrying the amount and the COA, the vendor on that line’s occurrence, the record done at the stop', () => {
  const read = expenseInput(DRAFT, BKK);
  assert.ok(read.ok);
  const v: ExpenseValues = read.value;
  assert.deepEqual(v, { day: DAY, time: '12:30', zone: BKK, instant: '2026-10-13T05:30:00.000Z', name: 'Khao soi', amount: '7.50', coa: '6150', bookId: 'P', vendor: { kind: 'none' }, actualCents: 700, rating: 4, note: 'Khao soi at Luka' });
  assert.deepEqual(expenseInput({ ...DRAFT, vendorId: 'v1' }, BKK), { ok: true, value: { ...v, vendor: { kind: 'existing', id: 'v1' } } });
  assert.deepEqual(expenseInput({ ...DRAFT, vendorName: '  Luka  Café ' }, BKK), { ok: true, value: { ...v, vendor: { kind: 'new', name: 'Luka Café' } } });
  assert.deepEqual(expenseInput({ ...DRAFT, actual: '', stars: '', note: '  ' }, BKK), { ok: true, value: { ...v, actualCents: null, rating: null, note: null } }, 'blank is not given — never 0, never an empty note');
  assert.deepEqual(expenseInput({ ...DRAFT, time: '12:30' }, 'America/Los_Angeles').ok && expenseInput({ ...DRAFT }, 'America/Los_Angeles'), { ok: true, value: { ...v, zone: 'America/Los_Angeles', instant: '2026-10-13T19:30:00.000Z' } }, 'the zone is the viewer’s');
  const refusals: [Partial<ExpenseDraft>, string, string][] = [
    [{ day: '' }, 'day', requiredWords('day')], [{ day: 'Oct 13' }, 'day', dayTypedWords('Oct 13')],
    [{ time: '' }, 'time', requiredWords('time')], [{ time: '25:00' }, 'time', timeTypedWords('25:00')], [{ time: '9:30' }, 'time', timeTypedWords('9:30')],
    [{ name: '  ' }, 'name', requiredWords('name')], [{ name: 'x'.repeat(201) }, 'name', 'NAME is at most 200 characters'],
    [{ amount: '' }, 'amount', requiredWords('amount')], [{ amount: '0' }, 'amount', AMOUNT_ZERO_WORDS], [{ amount: '-5' }, 'amount', 'an amount is 0 or more'], [{ amount: 'ten' }, 'amount', '"ten" is not an amount (dollars, at most two decimals)'],
    [{ coa: '' }, 'coa', requiredWords('coa')], [{ book: '' }, 'book', requiredWords('book')],
    [{ vendorId: 'v1', vendorName: 'Luka' }, 'vendor', VENDOR_BOTH_WORDS],
    [{ actual: 'lots' }, 'actual', '"lots" is not an amount (dollars, at most two decimals)'], [{ actual: '-1' }, 'actual', 'an amount is 0 or more'],
    [{ stars: '6' }, 'stars', starsTypedWords('6')], [{ stars: 'four' }, 'stars', starsTypedWords('four')],
  ];
  for (const [over, field, message] of refusals) assert.deepEqual(expenseInput({ ...DRAFT, ...over }, BKK), { ok: false, field, message }, `${field}: ${message}`);
  assert.deepEqual(EXPENSE_FIELDS, ['day', 'time', 'name', 'amount', 'coa', 'book', 'vendor', 'actual', 'stars', 'note']);
  assert.deepEqual(Object.keys(EXPENSE_FIELD_WORDS), [...EXPENSE_FIELDS]);
  // The one-off: cadence once on the day at the time in the zone, role place, ONE line — the thing itself, the amount and the COA on it, nothing on the routine.
  const body = oneOffBody(v);
  assert.equal(body.cadence_mode, 'once');
  assert.deepEqual([body.start_date, body.end_date, body.start_time, body.byhour, body.byminute, body.timezone, body.role, body.entity_id, body.name, body.is_active], [DAY, '', '12:30', '12', '30', BKK, 'place', 'P', 'Khao soi', true]);
  assert.deepEqual(body.lines, [{ activity: 'Khao soi', budget_amount: '7.50', coa_code: '6150' }]);
  assert.deepEqual([body.budget_amount, body.coa_code, body.location, body.latitude, body.longitude, body.description, body.custom_rrule, body.weekly_byday], ['', '', '', '', '', '', '', []]);
  assert.deepEqual(vendorBody(v, 'line-1', 'v1'), { kind: 'routine_line', id: 'line-1', instant: '2026-10-13T05:30:00.000Z', vendorId: 'v1' });
  assert.deepEqual(recordBody(v, 'line-1'), { kind: 'routine_line', id: 'line-1', instant: '2026-10-13T05:30:00.000Z', outcome: 'done', done_at: '2026-10-13T05:30:00.000Z', actual_cents: 700, rating: 4, note: 'Khao soi at Luka', actual_minutes: null }, 'done at the stop’s own instant');
  // The outcome: five steps, each said by name; what was not reached is "not tried", what was not given "none given".
  assert.deepEqual(EXPENSE_STEPS, ['stop', 'line', 'directory', 'vendor', 'record']);
  assert.deepEqual(Object.keys(STEP_WORDS), [...EXPENSE_STEPS]);
  assert.equal(outcomeWords({ step: 'stop', state: 'written', words: '' }), `the one-off stop — ${WRITTEN_WORDS}`);
  assert.equal(outcomeWords({ step: 'vendor', state: 'failed', words: 'No such plan' }), 'the vendor, on the stop — not written: No such plan');
  assert.equal(outcomeWords({ step: 'record', state: 'not tried', words: '' }), `the record — ${NOT_TRIED_WORDS}`);
  assert.equal(outcomeWords({ step: 'directory', state: 'not asked', words: '' }), `the vendor, added to the book — ${NOT_ASKED_WORDS}`);
  assert.deepEqual(withNotTried([{ step: 'stop', state: 'written', words: '' }, { step: 'line', state: 'failed', words: 'x' }]).map((o) => `${o.step}:${o.state}`), ['stop:written', 'line:failed', 'directory:not tried', 'vendor:not tried', 'record:not tried']);
  assert.equal(expenseLandedWords(DAY), "the expense is on Tue Oct 13's card and in the ledger");
  assert.equal(EXPENSE_WORDS, '+ expense');
  assert.equal(zoneWords(BKK), "times in Asia/Bangkok — your browser's zone");
  assert.equal(lineCountWords(2), 'the one-off came back with 2 lines — one was written');
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date\(\)|Date\.now\(|from 'react'|@prisma\/client/, 'the rules are pure');
});

// ── T7 · R3 THE WRITES, THE FORM, THE SECTION, THE SIGNAL ───────────────────

test('T7 ledgerWrites: the one-off, its line read back, the vendor added, the vendor set — each answer the route’s own words; the form runs them in order and stops at the first failure, every step said; the ledger and the card read again', async () => {
  const sent: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let answer: () => Response = () => json({ routine: { id: 'rt-1' }, lines: 1, isCreate: true }, 201);
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  const v = (expenseInput(DRAFT, BKK) as { value: ExpenseValues }).value;
  try {
    assert.deepEqual(await createOneOff(oneOffBody(v)), { ok: true, value: { routineId: 'rt-1' } });
    answer = () => json({ error: 'Validation', field: 'lines[0].coa_code', message: 'no such account in this book' }, 400);
    assert.deepEqual(await createOneOff(oneOffBody(v)), { ok: false, words: 'no such account in this book' });
    answer = () => json({ lines: 1 }, 201);
    assert.deepEqual(await createOneOff(oneOffBody(v)), { ok: false, words: 'the routine came back without its id' });
    answer = () => json({ routine: { id: 'rt-1', steps: [{ id: 'st-1', activity: 'Khao soi' }] } });
    assert.deepEqual(await readOneOffLine('rt-1'), { ok: true, value: { lineId: 'st-1' } });
    answer = () => json({ routine: { id: 'rt-1', steps: [] } });
    assert.deepEqual(await readOneOffLine('rt-1'), { ok: false, words: lineCountWords(0) });
    answer = () => json({ id: 'v-9', vendor_name: 'Luka Café', entity_id: 'P' }, 201);
    assert.deepEqual(await addVendor('P', 'Luka Café'), { ok: true, value: { vendorId: 'v-9' } }, 'the directory answers the row itself');
    answer = () => json({ vendor_name: 'Luka Café' }, 201);
    assert.deepEqual(await addVendor('P', 'Luka Café'), { ok: false, words: 'the vendor came back without its id' });
    answer = () => json({ error: 'vendor-exists', message: 'this book already has "Luka Café" — the same vendor, ignoring case and spacing' }, 409);
    assert.deepEqual(await addVendor('P', 'luka cafe'), { ok: false, words: 'this book already has "Luka Café" — the same vendor, ignoring case and spacing' });
    answer = () => json({ outcome: 'set' }, 201);
    assert.deepEqual(await setVendor(vendorBody(v, 'st-1', 'v-9')), { ok: true, value: { outcome: 'set' } });
    answer = () => new Response('', { status: 401 });
    assert.deepEqual(await setVendor(vendorBody(v, 'st-1', 'v-9')), { ok: false, words: 'You are signed out — sign in to add an expense.' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => [s.url, s.init?.method ?? 'GET']), [
    ['/api/operations/routines', 'POST'], ['/api/operations/routines', 'POST'], ['/api/operations/routines', 'POST'],
    ['/api/operations/routines/rt-1', 'GET'], ['/api/operations/routines/rt-1', 'GET'],
    ['/api/operations/vendor-directory', 'POST'], ['/api/operations/vendor-directory', 'POST'], ['/api/operations/vendor-directory', 'POST'],
    ['/api/operations/plan-vendors', 'POST'], ['/api/operations/plan-vendors', 'POST'],
  ]);
  assert.equal(sent[0].init?.body, JSON.stringify(oneOffBody(v)));
  assert.equal(sent[5].init?.body, JSON.stringify({ entityId: 'P', name: 'Luka Café' }));
  const w = code(LEDGER_WRITES);
  assert.equal((w.match(/\bfetch\s*\(/g) ?? []).length, 1, 'one POST helper; the line read goes through readJson');
  assert.match(w, /import \{ readJson \} from '\.\.\/week\/weekReads';/);
  assert.doesNotMatch(w, /\/api\/operations\/stops/, 'the record is the stops’ one writer’s (stopWrites.ts)');
  // The form: the writes in order, stopped at the first failure, every step said; the zone shown; the books from the provider's list, never its selection.
  const f = code(FORM);
  assert.match(f, /^'use client';/m);
  inOrder(f, [
    'const read = expenseInput(draft, zone);', 'if (!read.ok) { setRefusal(read); return; }',
    'const created = await createOneOff(oneOffBody(v));', "if (!created.ok) { failed('stop', created.words); return; }", "done.push({ step: 'stop', state: 'written', words: '' });",
    'const line = await readOneOffLine(created.value.routineId);', "if (!line.ok) { failed('line', line.words); return; }",
    "if (v.vendor.kind === 'new') {", 'const added = await addVendor(v.bookId, v.vendor.name);', "if (!added.ok) { failed('directory', added.words); return; }", "done.push({ step: 'directory', state: 'not asked', words: '' });",
    'const setAnswer = await setVendor(vendorBody(v, line.value.lineId, vendorId));', "if (!setAnswer.ok) { failed('vendor', setAnswer.words); return; }", "done.push({ step: 'vendor', state: 'not asked', words: '' });",
    'record = await setStopRecord(recordBody(v, line.value.lineId));', "if (!record.ok) { failed('record', record.message); return; }", "done.push({ step: 'record', state: 'written', words: '' });",
    'setOutcome(done);', 'setLanded(v.day);', 'onWritten(v.day);',
  ], 'the form, in order');
  assert.match(f, /const failed = \(step: ExpenseOutcome\['step'\], words: string\) => \{ done\.push\(\{ step, state: 'failed', words \}\); setOutcome\(withNotTried\(done\)\); \};/, 'a failure is said with every step after it not tried');
  assert.match(f, /import \{ setStopRecord \} from '\.\.\/stops\/stopWrites';/, 'the record through the one writer');
  assert.match(f, /const \{ entities \} = useOperationsEntity\(\);/);
  assert.doesNotMatch(f, /selectedEntityId|\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|method:/, 'the selector’s choice not read; no route named; nothing stored');
  assert.match(f, /setZone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\);/, 'the viewer’s zone');
  assert.match(f, /data-ledger-expense-zone>\{zoneWords\(zone\)\}/, 'shown');
  for (const attr of ['data-ledger-expense', 'data-ledger-expense-open', 'data-ledger-expense-form', 'data-ledger-expense-day', 'data-ledger-expense-time', 'data-ledger-expense-name', 'data-ledger-expense-amount', 'data-ledger-expense-book', 'data-ledger-expense-vendor', 'data-ledger-expense-vendor-name', 'data-ledger-expense-actual', 'data-ledger-expense-stars', 'data-ledger-expense-note', 'data-ledger-expense-save', 'data-ledger-expense-cancel', 'data-ledger-expense-refused={refusal.field}', 'data-ledger-expense-outcome', 'data-ledger-expense-step={o.step}', 'data-ledger-expense-state={o.state}', 'data-ledger-expense-landed', 'data-ledger-expense-no-book']) {
    assert.ok(f.includes(attr), `the form carries ${attr}`);
  }
  assert.match(f, /<CoaSelect entityId=\{draft\.book\} value=\{draft\.coa\} onChange=\{set\('coa'\)\} className=\{box\} \/>/, 'the book’s chart');
  assert.match(f, /directory\.vendors\.filter\(\(v\) => v\.entity_id === draft\.book\)/, 'the book’s vendors');
  assert.doesNotMatch(f, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  assert.doesNotMatch(f, /\b(bg-black|bg-panel|bg-brand-red|bg-brand-gold|bg-brand-green|bg-brand-purple)\b/, 'no dark fill (the repaint law)');
  // The section mounts it; a written day reads the ledger again and tells the card; the signal.
  const s = code(SECTION);
  assert.match(s, /<ExpenseForm onWritten=\{\(day\) => \{ setWrites\(\(n\) => n \+ 1\); announceDayWritten\(day\); \}\} \/>/);
  assert.match(s, /\}, \[period\?\.from, period\?\.to, writes\]\);/, 'the period read again after a write');
  assert.match(s, /import \{ announceDayWritten \} from '\.\.\/dayWritten';/);
  const g = code(SIGNAL);
  assert.equal(DAY_WRITTEN_EVENT, 'ts-day-written');
  assert.match(g, /export function announceDayWritten\(day: string\): void \{\n\s*window\.dispatchEvent\(new CustomEvent<string>\(DAY_WRITTEN_EVENT, \{ detail: day \}\)\);\n\}/);
  assert.match(g, /export function onDayWritten\(handler: \(day: string\) => void\): \(\) => void \{/);
  assert.doesNotMatch(g, /\bfetch\s*\(|localStorage|sessionStorage|useState|prisma/, 'a signal: no read, no store');
  const c = code(CARD);
  assert.match(c, /return onDayWritten\(\(written\) => \{ if \(written === day\) setDayWrites\(\(n\) => n \+ 1\); \}\);/, 'the card listens for its own day');
  assert.match(c, /\}, \[day, today, dayWrites\]\);/, 'the day, the report and the tasks read again');
  assert.match(c, /\}, \[day, recordReads, dayWrites\]\);/, 'the records too');
});
