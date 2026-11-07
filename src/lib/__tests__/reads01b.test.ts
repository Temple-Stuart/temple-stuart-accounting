/**
 * READS-01b (Alex, 2026-11-07) — THE TASK LEDGER'S BODY LEAVES ITS ROUTE: GET /api/operations/ledger's body after the gate
 * is taskLedgerAnswerOf(db, userId, span, now) in src/lib/operations/ledgerAnswer.ts, RECORD_PLAN with it (ruling A); the
 * route is the gate, the span parse and one return that reads the clock once (ruling B); /api/home-ledger calls the
 * function directly — no route calls a route anywhere now (ruling C). Every pin here finds its line by content; the one
 * line number read is the registry's own citation, read back and checked (ruling D.4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { TOOL_REGISTRY } from '../toolRegistry';
import { taskLedgerAnswerOf } from '../operations/ledgerAnswer';

const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const HOME_LEDGER = 'src/app/api/home-ledger/route.ts';
const THIS = 'src/lib/__tests__/reads01b.test.ts';

const inOrder = (src: string, pieces: readonly string[], label: string) => {
  let at = 0;
  for (const piece of pieces) {
    const i = src.indexOf(piece, at);
    assert.ok(i >= 0, `${label}: ${piece.slice(0, 60)} missing or out of order`);
    at = i + piece.length;
  }
};

// ── A · THE FUNCTION, THE EIGHT READS IN THE ROUTE'S ORDER, RECORD_PLAN WITH ITS TWO CITED LINES ─────────────────────

test('A taskLedgerAnswerOf(db, userId, span, now) holds the route\'s body verbatim — the two windows, the entities, the eight reads in order, the words, the first record, ledgerOf and the exact answer object; the clock is never read inside', () => {
  const a = code(ANSWER);
  assert.match(a, /export async function taskLedgerAnswerOf\(db: Db, userId: string, span: \{ from: string; to: string \}, now: Date\) \{\n\s*const \{ from, to \} = span;/);
  assert.match(a, /type Db = Pick<PrismaClient, 'entities' \| 'chart_of_accounts' \| 'operations_routines' \| 'planned_item_vendors' \| 'operations_stays' \| 'operations_stop_records' \| 'planned_item_links'>;/);
  inOrder(a, [
    'const recordsFrom = new Date(Date.parse(`${from}T00:00:00.000Z`) - 14 * HOUR_MS);',
    'const recordsTo = new Date(Date.parse(`${to}T00:00:00.000Z`) + 36 * HOUR_MS);',
    'const vendorsFrom = new Date(Date.parse(`${from}T00:00:00.000Z`) - DAY_MS);',
    'const vendorsTo = new Date(Date.parse(`${to}T00:00:00.000Z`) + 2 * DAY_MS);',
    "const entities = await db.entities.findMany({ where: { userId: userId }, select: { id: true, name: true, entity_type: true }, orderBy: { name: 'asc' } });",
    'const [chart, routineGroups, roles, planVendors, stayRows, recordRows, firstRow, linkRows] = await Promise.all([',
    'db.chart_of_accounts.findMany({', 'where: { entity_id: { in: entityIds }, entity: { userId: userId } },', 'select: { entity_id: true, code: true, name: true, account_type: true, balance_type: true },',
    'Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(db, userId, e.id) }))),',
    'db.operations_routines.findMany({ where: { user_id: userId }, select: { id: true, role: true } }),',
    'db.planned_item_vendors.findMany({', 'where: { user_id: userId, OR: [{ occurrence_at: null }, { occurrence_at: { gte: vendorsFrom, lt: vendorsTo } }] },',
    'vendor: { select: { id: true, vendor_name: true, entity_id: true } },', 'task: { select: { title: true } },',
    "db.operations_stays.findMany({ where: { user_id: userId }, orderBy: { starts_on: 'asc' } }),",
    'db.operations_stop_records.findMany({', 'where: { user_id: userId, occurrence_at: { gte: recordsFrom, lt: recordsTo } },', 'include: RECORD_PLAN,', "orderBy: { occurrence_at: 'asc' },",
    "db.operations_stop_records.findFirst({ where: { user_id: userId }, include: RECORD_PLAN, orderBy: { occurrence_at: 'asc' } }),",
    'db.planned_item_links.findMany({', "where: { user_id: userId, target_kind: { in: ['routine', 'routine_line'] }, target_instant: { gte: recordsFrom, lt: recordsTo }, journal_entry: { userId: userId } },",
    'select: { target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: { select: LINKED_POSTING_SELECT } },', "orderBy: { linked_at: 'asc' },",
    'const bookOf = (entityId: string, what: string) => {',
    'const built = buildRoutineBudgetLines(routineInputs, from, to);',
    'const routineWords = new Map<string, RoutineWords>(',
    'const accounts = chart.map((row) => toReportAccount(row, bookOf(row.entity_id, `chart row ${JSON.stringify(row.code)}`)));',
    'let firstRecord: { readonly day: string } | { readonly words: string } | null = null;',
    "firstRecord = { words: refusedWords('timezone not recognised', `${JSON.stringify(first.zone)}: ${messageOf(error)}`) };",
    'const ledger = ledgerOf({', 'records: recordRows.map(recordInputOf),', 'links: linkRows.map(linkInputOf),', 'stays: stayRows.map(stayRowOf),',
    'return { from, to, as_of: now.toISOString(), first_record: firstRecord, rows: ledger.rows, said: ledger.said };',
  ], 'the body, in the route\'s order');
  assert.equal((a.match(/db\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 8, 'the eight reads — no query added');
  assert.equal((a.match(/new Date\(\)/g) ?? []).length, 0, 'the clock is a parameter, never read here');
  assert.doesNotMatch(a, /\bprisma\.|user\.id|getVerifiedEmail|NextResponse|NextRequest/, 'the client and the caller are handed in; no gate, no response here — only the PrismaClient type is named');
  // RECORD_PLAN and its helpers moved with the body; the Time row cites its two lines, each what it says.
  assert.match(a, /const RECORD_PLAN = \{\n\s*routine: \{ select: \{ name: true, timezone: true, role: true, start_time: true, end_time: true \} \},\n\s*step: \{ select: \{ activity: true, time_of_day: true, duration_minutes: true, routine_id: true, routine: \{ select: \{ name: true, timezone: true, role: true \} \} \} \},\n\} as const;/);
  for (const helper of ['const HOUR_MS = 3_600_000;', 'const DAY_MS = 86_400_000;', 'const messageOf = (error: unknown): string =>', 'type RecordRow = Parameters<typeof stopRecordRowOf>[0] & {', 'function recordInputOf(row: RecordRow): LedgerRecordInput {']) assert.ok(a.includes(helper), `${helper.slice(0, 40)} moved with the body`);
  const time = TOOL_REGISTRY.find((x) => x.name === 'Time');
  assert.ok(time);
  const lineOf = (n: number): string => code(ANSWER).split('\n')[n - 1] ?? '';
  const step = time.citation.match(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the line's duration\)/);
  const routine = time.citation.match(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the routine's window\)/);
  assert.ok(step && routine, 'the Time row cites the answer file\'s two lines');
  assert.match(lineOf(Number(step[1])), /^\s*step: \{ select: \{ activity: true, time_of_day: true, duration_minutes: true,/);
  assert.match(lineOf(Number(routine[1])), /^\s*routine: \{ select: \{ name: true, timezone: true, role: true, start_time: true, end_time: true \} \},/);
  assert.doesNotMatch(time.citation, /operations\/ledger\/route\.ts:\d+/, 'no cite of the route by line remains');
  assert.match(comments('src/lib/toolRegistry.ts'), /READS-01b \(Alex, 2026-11-07\): the ledger route's body is src\/lib\/operations\/ledgerAnswer\.ts taskLedgerAnswerOf/);
});

// ── B · THE ROUTE = THE GATE, THE SPAN, ONE RETURN, THE SAME CATCH ───────────────────────────────────────────────────

test('B GET /api/operations/ledger is the gate, spanInput, one return that reads the clock once into the function, and the same catch; its header stays with a dated note', () => {
  const r = code(ROUTE);
  inOrder(r, [
    'export async function GET(request: NextRequest) {', 'try {',
    'const userEmail = await getVerifiedEmail();', "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });", "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));",
    "if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });",
    'const { from, to } = span;',
    'return NextResponse.json(await taskLedgerAnswerOf(prisma, user.id, { from, to }, new Date()));',
    '} catch (error) {',
    'if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {', 'return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });',
    "return failClosedResponse('Ledger GET', 'Failed to load the ledger', error);",
  ], 'the gate, the span, the one return, the catch');
  assert.equal((r.match(/new Date\(\)/g) ?? []).length, 1, 'the clock is read once, in the return');
  assert.equal((r.match(/prisma\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 1, 'the users row is the route\'s only read');
  assert.doesNotMatch(r, /RECORD_PLAN|recordInputOf|ledgerOf\(|loadRoutineBudgetInputs|plannedMinutesOf|LINKED_POSTING_SELECT|HOUR_MS/, 'the body and its helpers left the route');
  assert.match(r, /import \{ spanInput \} from '@\/lib\/operations\/ledger';\nimport \{ taskLedgerAnswerOf \} from '@\/lib\/operations\/ledgerAnswer';/);
  assert.doesNotMatch(r, /export (const|function|async function) (?!GET\b)/, 'the handler is the only export');
  assert.match(comments(ROUTE), /LEDGER-01, Alex, 2026-10-16/);
  assert.match(comments(ROUTE), /READS-01b \(Alex, 2026-11-07, ruling B\): the body after the gate and the span/);
});

// ── C · /api/home-ledger CALLS THE FUNCTION — NO ROUTE CALLS A ROUTE ANYWHERE NOW ────────────────────────────────────

test('C /api/home-ledger imports the function, takes the day as its span through spanInput refused by name, reads the clock once and hands it in; no `GET as` from any route, no NextRequest built, no answerOf parse', () => {
  const h = code(HOME_LEDGER);
  assert.match(h, /import \{ spanInput, type LedgerRow \} from '@\/lib\/operations\/ledger';/);
  assert.match(h, /import \{ taskLedgerAnswerOf \} from '@\/lib\/operations\/ledgerAnswer';/);
  assert.doesNotMatch(h, /import \{ GET as |new NextRequest\(|answerOf\(|taskLedgerGet|taskRes\b|\/api\/operations\/ledger\?/, 'no route calls a route');
  inOrder(h, [
    'const span = spanInput(date, date);',
    "if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });",
    'const now = new Date();',
    'const [chart, lineRows, bankRows, taskAnswer, reservationsAnswer, expensesAnswer] = await Promise.all([',
    'taskLedgerAnswerOf(prisma, user.id, { from: span.from, to: span.to }, now),',
    'reservationsAnswerOf(prisma, user.id),', 'travelExpensesAnswerOf(prisma, user.id),',
    'const travel = travelLedgerReadsOf(reservationsAnswer, expensesAnswer);',
    "taskRows: listOf<LedgerRow>(taskAnswer, '/api/operations/ledger', 'rows'),",
  ], 'the span refused by name, the clock once, the three functions, the one reader');
  assert.equal((h.match(/new Date\(\)/g) ?? []).length, 1, 'the clock is read once in the route');
  assert.doesNotMatch(h, /span\.from!|span\.to!|as \{ ok: true/, 'the refusal is written, never a `!`');
  // No route under src/app/api imports another route's handler, and none builds a NextRequest to call one.
});

// ── D · THE WIRE SHAPE: a fixture answer round-trips JSON unchanged ──────────────────────────────────────────────────

type Call = { readonly table: string; readonly method: string; readonly where: unknown };
function fakeDb(rows: Readonly<Record<string, readonly unknown[]>>, calls: Call[]) {
  const db: Record<string, { findMany: (args: { where?: unknown }) => Promise<unknown[]>; findFirst: (args: { where?: unknown }) => Promise<unknown> }> = {};
  for (const table of Object.keys(rows)) {
    db[table] = {
      findMany: async (args) => { calls.push({ table, method: 'findMany', where: args.where }); return [...rows[table]]; },
      findFirst: async (args) => { calls.push({ table, method: 'findFirst', where: args.where }); return rows[table].length === 0 ? null : rows[table][0]; },
    };
  }
  return db as unknown as Parameters<typeof taskLedgerAnswerOf>[0];
}
const at = (iso: string): Date => new Date(iso);
const RECORD = {
  id: 'rec-gym', routine_id: 'r-gym', step_id: null, occurrence_at: at('2026-11-20T12:00:00Z'), outcome: 'done', done_at: at('2026-11-20T12:50:00Z'),
  actual_cents: 500, rating: 4, note: null, actual_minutes: 50,
  routine: { name: 'Gym', timezone: 'Asia/Makassar', role: 'place', start_time: at('1970-01-01T20:00:00Z'), end_time: at('1970-01-01T21:00:00Z') },
  step: null,
} as const;

test('D the answer is wire-shaped as built — fixture rows with Dates in, an object of strings, numbers, booleans, nulls, arrays and plain objects out; JSON round-trips it unchanged; the eight reads run in order, every one with the caller\'s id; the clock is the parameter', async () => {
  const calls: Call[] = [];
  const db = fakeDb({ entities: [], chart_of_accounts: [], operations_routines: [{ id: 'r-gym', role: 'place' }], planned_item_vendors: [], operations_stays: [], operations_stop_records: [RECORD], planned_item_links: [] }, calls);
  const now = at('2026-11-21T00:00:00Z');
  const a = await taskLedgerAnswerOf(db, 'alex', { from: '2026-11-20', to: '2026-11-20' }, now);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a, 'the task ledger answer round-trips');
  assert.deepEqual([a.from, a.to, a.as_of, a.first_record], ['2026-11-20', '2026-11-20', '2026-11-21T00:00:00.000Z', { day: '2026-11-20' }]);
  assert.equal(a.rows.length, 1);
  assert.deepEqual([a.rows[0].id, a.rows[0].day, a.rows[0].description, a.rows[0].actualCents, a.rows[0].plannedMinutes, a.rows[0].loggedMinutes, a.rows[0].outcome, a.rows[0].address.instant], ['rec-gym', '2026-11-20', 'Gym', 500, 60, 50, 'done', '2026-11-20T12:00:00.000Z']);
  assert.deepEqual(a.said.unplaced, []);
  assert.deepEqual(calls.map((c) => `${c.table}.${c.method}`), ['entities.findMany', 'chart_of_accounts.findMany', 'operations_routines.findMany', 'planned_item_vendors.findMany', 'operations_stays.findMany', 'operations_stop_records.findMany', 'operations_stop_records.findFirst', 'planned_item_links.findMany']);
  for (const c of calls) assert.ok(JSON.stringify(c.where).includes('"alex"'), `${c.table}.${c.method} read with the caller's id`);
  const windows = calls[5].where as { occurrence_at: { gte: Date; lt: Date } };
  assert.deepEqual([windows.occurrence_at.gte.toISOString(), windows.occurrence_at.lt.toISOString()], ['2026-11-19T10:00:00.000Z', '2026-11-21T12:00:00.000Z'], 'the any-zone window over the span');
});

// ── THE DOES-NOTS ────────────────────────────────────────────────────────────

test('no `||`, no `?? <default>`, no write, no travel, no paid call in the answer file; this test pins no line number of its own', () => {
  const a = code(ANSWER);
  // The one `||` is recordInputOf's condition (a row naming no plan is the database's error), verbatim from the route — a boolean, never a default.
  assert.doesNotMatch(a, /\|\| *(['"`\d\[{]|null|undefined|false|true|new |\[\])/, 'no || default');
  assert.equal((a.match(/\|\|/g) ?? []).length, 1, 'the one boolean || — row.routine === null || row.routine_id === null');
  assert.match(a, /if \(row\.routine === null \|\| row\.routine_id === null\) throw new Error\(`ledger GET: record \$\{row\.id\} names no plan — the migration's CHECK holds one`\);/);
  assert.doesNotMatch(a, /\?\? /, 'no ?? default');
  assert.doesNotMatch(a, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction|writeAuditLog/, 'writes nothing');
  assert.doesNotMatch(a, /ledger_entries|journal_entries\.|transactions\b|budget_line_items|trip_itinerary|calendar_events|\bfetch\s*\(/, 'nothing of the books but the link, no travel, no paid call');
  assert.doesNotMatch(code(THIS).replace(/ledgerAnswer\\\.ts:\(\\d\+\)/g, ''), /\.tsx?:\d+/, 'no line-number pin beyond the registry\'s own citation, read back');
});
