/**
 * VENDOR-01 (2026-09-29) — THE VENDOR IS PLANNED.
 *
 * T1–T6 drive the pure rule (src/lib/operations/planVendor.ts) with fixtures —
 * the occurrences through /budget's own builder (days.ts buildRoutineBudgetLines),
 * never a second expansion. T7 reads the two routes, the migration and the schema
 * from source, comments stripped — the repo's TEST-TRUTH-01 way. This file
 * imports nothing from @prisma/client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { LINKABLE_KINDS } from '../calendar/linkKeys';
import { closingOf } from '../security/ownershipLaw';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import {
  GRAIN_TAG, PLAN_VENDOR_KINDS, VENDOR_NAME_MAX, grainAllows, isGrainRefusal, moneyIsHere, occurrenceIn, occurrenceSourceId,
  occurrenceWindow, readPlanAddress, readVendorName, routineAsBudgetReads, takenBy, taskAsBudgetReads, vendorFits, vendorNameKey,
  writeFor, type Book, type HeldVendor, type PlanAddress,
} from '../operations/planVendor';

const RULE = 'src/lib/operations/planVendor.ts';
const ROUTE = 'src/app/api/operations/plan-vendors/route.ts';
const DIRECTORY = 'src/app/api/operations/vendor-directory/route.ts';
const MIGRATION = 'prisma/migrations/20260929190000_vendor_01_planned_item_vendors/migration.sql';
const LA = 'America/Los_Angeles';
const PLAN = '11111111-1111-4111-8111-111111111111';
const LUNCH = '22222222-2222-4222-8222-222222222222';
const GYM = '33333333-3333-4333-8333-333333333333';

const routine = (over: Partial<RoutinePlanInput> = {}): RoutinePlanInput => ({
  id: PLAN, name: 'Meals', entityId: 'ent-p', entityType: 'personal', timezone: LA,
  scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0', startDate: null, endDate: null,
  budgetAmount: null, coaCode: null,
  steps: [
    { id: LUNCH, isActive: true, stepOrder: 0, budgetAmount: '20.00', coaCode: 'P-6150' },
    { id: GYM, isActive: true, stepOrder: 1, budgetAmount: null, coaCode: null },
  ],
  ...over,
});
const at = (iso: string) => new Date(iso);
const refusal = (r: { ok: boolean }) => r as unknown as { ok: false; status: number; error: string; message: string };

// ── T1 · THE ADDRESS ─────────────────────────────────────────────────────────

test('T1 the address speaks the link route\'s words: each kind, a bad id not found, a task with an instant and an instant that does not parse refused', () => {
  for (const k of PLAN_VENDOR_KINDS) assert.ok((LINKABLE_KINDS as readonly string[]).includes(k), `${k} is a linkable kind — the vendor and the posting share one key`);
  assert.deepEqual(readPlanAddress('routine', PLAN, null), { ok: true, address: { kind: 'routine', id: PLAN, instant: null } });
  assert.deepEqual(readPlanAddress('project_task', PLAN, undefined), { ok: true, address: { kind: 'project_task', id: PLAN, instant: null } });
  const line = readPlanAddress('routine_line', LUNCH, '2026-09-29T19:00:00.000Z');
  assert.ok(line.ok && line.address.kind === 'routine_line' && line.address.instant?.toISOString() === '2026-09-29T19:00:00.000Z');
  for (const bad of ['calendar_event', 'trip_item', 'ROUTINE', '', null]) {
    const r = refusal(readPlanAddress(bad, PLAN, null));
    assert.deepEqual([r.ok, r.status, r.error], [false, 400, 'bad-kind'], JSON.stringify(bad));
  }
  assert.match(refusal(readPlanAddress('nope', PLAN, null)).message, /^kind must be one of routine_line, routine, project_task$/);
  for (const bad of ['abc', '', 42, null, `${PLAN}x`]) {
    const r = refusal(readPlanAddress('routine', bad, null));
    assert.deepEqual([r.status, r.error], [404, 'not-found'], `${JSON.stringify(bad)} names no row — the link route's posture`);
  }
  for (const bad of ['not a date', '', 1727636400000, {}]) {
    const r = refusal(readPlanAddress('routine', PLAN, bad));
    assert.deepEqual([r.status, r.error, r.message], [400, 'bad-instant', 'instant is not a valid timestamp'], JSON.stringify(bad));
  }
  const task = refusal(readPlanAddress('project_task', PLAN, '2026-09-29T19:00:00.000Z'));
  assert.deepEqual([task.status, task.error], [400, 'bad-instant']);
  assert.match(task.message, /^project_task carries no occurrence instant/);
});

// ── T2 · NAMES ───────────────────────────────────────────────────────────────

test('T2 a name is trimmed, every run of whitespace one space, compared ignoring case; blank refused; 200 characters accepted, 201 refused', () => {
  assert.deepEqual(readVendorName('  Pho   24 '), { ok: true, name: 'Pho 24' });
  assert.deepEqual(readVendorName('\tPho\n\n24 '), { ok: true, name: 'Pho 24' });
  assert.equal(vendorNameKey(' pho  24 '), vendorNameKey('PHO 24'));
  assert.notEqual(vendorNameKey('Pho 24'), vendorNameKey('Pho 42'));
  for (const blank of ['', '   ', '\n\t']) assert.deepEqual(refusal(readVendorName(blank)).message, 'a vendor needs a name');
  assert.equal(refusal(readVendorName(42)).status, 400);
  assert.equal(VENDOR_NAME_MAX, 200);
  assert.deepEqual(readVendorName('x'.repeat(200)), { ok: true, name: 'x'.repeat(200) });
  const long = refusal(readVendorName('x'.repeat(201)));
  assert.deepEqual([long.status, long.message], [400, 'a vendor name is at most 200 characters — this one is 201']);
  // Counted in characters, as Postgres counts VarChar(200) — not UTF-16 units.
  assert.ok(readVendorName('🍜'.repeat(200)).ok);
  assert.ok(readVendorName(`  ${'y'.repeat(200)}  `).ok, 'the spaces around a 200-character name are trimmed first');
});

test('T2 a taken name is found on an archived vendor too — ignoring case and spacing — and a new name is not taken', () => {
  const vendors = [
    { id: 'v-1', vendor_name: 'Netflix', is_active: true },
    { id: 'v-2', vendor_name: 'Pho  24', is_active: false }, // a legacy row, spaced as it was saved
  ];
  assert.deepEqual(takenBy(' pho 24 ', vendors), { id: 'v-2', vendor_name: 'Pho  24', is_active: false });
  assert.deepEqual(takenBy('NETFLIX', vendors), vendors[0]);
  assert.equal(takenBy('Banh Mi 25', vendors), null);
});

// ── T3 · MONEY (e) ───────────────────────────────────────────────────────────

test('T3 the vendor sits where the money sits: a costed line, a routine whose own figure is in force, a task with an estimate — and each without', () => {
  const lined = routine({ budgetAmount: '15.00', coaCode: 'P-6300' }); // the routine-level $15 is set aside by the lines
  assert.deepEqual(moneyIsHere({ kind: 'routine_line', routine: lined, lineId: LUNCH }), { ok: true });
  const gym = refusal(moneyIsHere({ kind: 'routine_line', routine: lined, lineId: GYM }));
  assert.deepEqual([gym.status, gym.message], [409, 'this line carries no amount — a vendor is who a plan\'s money is paid to']);
  const onRoutine = refusal(moneyIsHere({ kind: 'routine', routine: lined }));
  assert.deepEqual([onRoutine.status, onRoutine.error, onRoutine.message], [409, 'money-on-lines', 'this routine\'s figure is the sum of its lines — its vendor goes on the line']);

  const own = routine({ budgetAmount: '9.99', coaCode: 'P-6300', steps: [{ id: GYM, isActive: true, stepOrder: 0, budgetAmount: null, coaCode: null }] });
  assert.deepEqual(moneyIsHere({ kind: 'routine', routine: own }), { ok: true });
  const onLine = refusal(moneyIsHere({ kind: 'routine_line', routine: own, lineId: GYM }));
  assert.equal(onLine.status, 409);
  assert.match(onLine.message, /^this line carries no amount — a vendor is who a plan's money is paid to; this routine's own figure is in force — its vendor goes on the routine$/);

  const none = routine({ steps: [] });
  assert.match(refusal(moneyIsHere({ kind: 'routine', routine: none })).message, /^this routine carries no amount/);
  assert.deepEqual(moneyIsHere({ kind: 'project_task', task: { title: 'Brakes', status: 'open', estimatedCostUsd: '480.00' } }), { ok: true });
  assert.match(refusal(moneyIsHere({ kind: 'project_task', task: { title: 'Brakes', status: 'open', estimatedCostUsd: null } })).message, /^this task carries no estimate/);
  // routinePlanned is called exactly as /budget's builder calls it.
  const call = 'steps: routine.steps.map((s) => ({ id: s.id, is_active: s.isActive, step_order: s.stepOrder, budget_amount: s.budgetAmount, coa_code: s.coaCode })),';
  assert.ok(code(RULE).includes(call) && code('src/lib/budget/days.ts').includes(call));
});

test('T3 (d) the plan as /budget reads it: a routine the loader did not return, an archived line and a task that is not a plan are refused', () => {
  const loaded = [routine()];
  assert.ok(routineAsBudgetReads(loaded, { id: PLAN, name: 'Meals' }, LUNCH).ok);
  assert.match(refusal(routineAsBudgetReads([], { id: PLAN, name: 'Meals' }, null)).message, /^"Meals" is not active — \/budget does not read it$/);
  const archived = [routine({ steps: [{ id: LUNCH, isActive: false, stepOrder: 0, budgetAmount: '20.00', coaCode: 'P-6150' }] })];
  assert.equal(refusal(routineAsBudgetReads(archived, { id: PLAN, name: 'Meals' }, LUNCH)).status, 409);
  assert.equal(refusal(routineAsBudgetReads(loaded, { id: PLAN, name: 'Meals' }, '44444444-4444-4444-8444-444444444444')).error, 'inactive');
  for (const status of ['open', 'in_progress', 'blocked', 'completed']) assert.ok(taskAsBudgetReads({ title: 'T', status, estimatedCostUsd: '1.00' }).ok, status);
  for (const status of ['pending_review', 'cancelled', 'superseded', 'archived']) assert.equal(refusal(taskAsBudgetReads({ title: 'T', status, estimatedCostUsd: '1.00' })).status, 409, status);
});

// ── T4 · OCCURRENCES (f) ─────────────────────────────────────────────────────

const ask = (r: RoutinePlanInput, address: PlanAddress & { instant: Date }) => {
  const w = occurrenceWindow(address.instant);
  return occurrenceIn(buildRoutineBudgetLines([r], w.rangeFrom, w.rangeTo), r, address);
};

test('T4 a real instant is accepted — placed, or not placed because the chart cannot read its account — and one minute off is refused', () => {
  const noon = at('2026-09-29T19:00:00.000Z'); // 12:00 in Los Angeles
  assert.deepEqual(occurrenceWindow(noon), { rangeFrom: '2026-09-27', rangeTo: '2026-10-01' }, 'ruled D1 (b): the UTC day and two either side');
  assert.deepEqual(ask(routine(), { kind: 'routine_line', id: LUNCH, instant: noon }), { ok: true, day: '2026-09-29' });
  assert.equal(occurrenceSourceId(PLAN, { kind: 'routine_line', id: LUNCH, instant: noon }), `routine:${PLAN}:line:${LUNCH}:2026-09-29T19:00:00.000Z`);
  // A B- code on a personal book: /budget lists the occurrence as not placed — still an occurrence it builds.
  const unreadable = routine({ steps: [{ id: LUNCH, isActive: true, stepOrder: 0, budgetAmount: '20.00', coaCode: 'B-6150' }] });
  const w = occurrenceWindow(noon);
  const built = buildRoutineBudgetLines([unreadable], w.rangeFrom, w.rangeTo);
  assert.ok(built.notPlaced.some((n) => n.sourceId === `routine:${PLAN}:line:${LUNCH}:2026-09-29T19:00:00.000Z` && n.reason === 'account code not recognised'));
  assert.deepEqual(ask(unreadable, { kind: 'routine_line', id: LUNCH, instant: noon }), { ok: true, day: '2026-09-29' });
  const off = refusal(ask(routine(), { kind: 'routine_line', id: LUNCH, instant: at('2026-09-29T19:01:00.000Z') }));
  assert.deepEqual([off.status, off.error, off.message], [409, 'not-an-occurrence', '"Meals" has no occurrence at 2026-09-29T19:01:00.000Z — /budget builds none at that instant']);
  // An occurrence after the routine's last day is not one /budget builds.
  assert.equal(refusal(ask(routine({ endDate: '2026-09-28' }), { kind: 'routine_line', id: LUNCH, instant: noon })).error, 'not-an-occurrence');
});

test('T4 a routine /budget cannot place is refused in the builder\'s own words — an unrecognised zone, a schedule that does not parse', () => {
  const instant = at('2026-09-29T19:00:00.000Z');
  for (const bad of [routine({ timezone: 'Mars/Olympus' }), routine({ scheduleRrule: 'FREQ=SOMETIMES' })]) {
    const w = occurrenceWindow(instant);
    const whole = buildRoutineBudgetLines([bad], w.rangeFrom, w.rangeTo).notPlaced.find((n) => n.sourceId === `routine:${PLAN}`);
    assert.ok(whole && whole.detail !== null, 'the builder lists the whole routine as not placed');
    const r = refusal(ask(bad, { kind: 'routine_line', id: LUNCH, instant }));
    assert.deepEqual([r.status, r.error, r.message], [409, 'cannot-place', `/budget cannot place "Meals": ${whole.reason} — ${whole.detail}`]);
  }
  assert.match(refusal(ask(routine({ timezone: 'Mars/Olympus' }), { kind: 'routine_line', id: LUNCH, instant })).message, /: timezone not recognised — "Mars\/Olympus": /);
});

test('T4 a one-off on its day, and the window holds every zone\'s local day — the far east and the far west, near midnight', () => {
  // 19:00 in Los Angeles on 3 October is 02:00 UTC on the 4th: its day is the 3rd.
  const oneOff = routine({ scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=19;BYMINUTE=0;BYSECOND=0', startDate: '2026-10-03', budgetAmount: '45.00', coaCode: 'P-6150', steps: [] });
  assert.deepEqual(ask(oneOff, { kind: 'routine', id: PLAN, instant: at('2026-10-04T02:00:00.000Z') }), { ok: true, day: '2026-10-03' });
  assert.equal(refusal(ask(oneOff, { kind: 'routine', id: PLAN, instant: at('2026-10-05T02:00:00.000Z') })).error, 'not-an-occurrence', 'it happens once');
  // 00:30 on the 30th at UTC+14 is 10:30 UTC on the 29th; 23:30 on the 29th at UTC-11 is 10:30 UTC on the 30th.
  const east = routine({ timezone: 'Pacific/Kiritimati', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=30;BYSECOND=0', budgetAmount: '5.00', coaCode: 'P-6150', steps: [] });
  assert.deepEqual(ask(east, { kind: 'routine', id: PLAN, instant: at('2026-09-29T10:30:00.000Z') }), { ok: true, day: '2026-09-30' });
  const west = routine({ timezone: 'Pacific/Pago_Pago', scheduleRrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0', budgetAmount: '5.00', coaCode: 'P-6150', steps: [] });
  assert.deepEqual(ask(west, { kind: 'routine', id: PLAN, instant: at('2026-09-30T10:30:00.000Z') }), { ok: true, day: '2026-09-29' });
});

// ── T5 · THE VENDOR (g) ──────────────────────────────────────────────────────

test('T5 the vendor: none is 404; archived is refused; another book is refused naming both books', () => {
  const books: Book[] = [{ id: 'ent-p', name: 'Alex', entity_type: 'personal' }, { id: 'ent-b', name: 'Temple Stuart', entity_type: 'sole_prop' }];
  const vendor = { id: 'v-1', vendor_name: 'Pho 24', entity_id: 'ent-p', is_active: true };
  assert.deepEqual(vendorFits(vendor, books[0], books), { ok: true, vendor });
  assert.deepEqual([refusal(vendorFits(null, books[0], books)).status, refusal(vendorFits(null, books[0], books)).error], [404, 'not-found']);
  const archived = refusal(vendorFits({ ...vendor, is_active: false }, books[0], books));
  assert.deepEqual([archived.status, archived.error, archived.message], [409, 'vendor-archived', '"Pho 24" is archived — a plan names an active vendor']);
  const other = refusal(vendorFits({ ...vendor, entity_id: 'ent-b' }, books[0], books));
  assert.deepEqual([other.status, other.error, other.message], [409, 'other-book', '"Pho 24" is a vendor of Temple Stuart; this plan is in Alex — a plan\'s vendor comes from its own book']);
  assert.match(refusal(vendorFits({ ...vendor, entity_id: 'ent-x' }, books[0], books)).message, /a vendor of entity ent-x, which is not one of your books; this plan is in Alex/);
});

// ── T6 · THE GRAIN (h) ───────────────────────────────────────────────────────

test('T6 the grain: every occurrence refuses one occurrence; occurrences refuse every occurrence, naming how many and the first three routine-local days', () => {
  const every: HeldVendor[] = [{ id: 'h-1', occurrenceAt: null, vendorId: 'v-netflix', vendorName: 'Netflix' }];
  const one = refusal(grainAllows({ kind: 'routine', id: PLAN, instant: at('2026-09-29T19:00:00.000Z') }, every, LA));
  assert.deepEqual([one.status, one.error, one.message], [409, 'grain', 'this plan\'s vendor is "Netflix" for every occurrence — clear it before choosing one for a single occurrence']);
  const single = (id: string, iso: string): HeldVendor => ({ id, occurrenceAt: at(iso), vendorId: 'v-pho', vendorName: 'Pho 24' });
  // Out of order, two on one Los Angeles day (02:00 UTC on the 30th is the 29th there).
  const held = [single('s-3', '2026-10-03T19:00:00.000Z'), single('s-1', '2026-09-29T19:00:00.000Z'), single('s-2', '2026-09-30T02:00:00.000Z'), single('s-4', '2026-10-01T19:00:00.000Z'), single('s-5', '2026-10-05T19:00:00.000Z')];
  const all = refusal(grainAllows({ kind: 'routine_line', id: LUNCH, instant: null }, held, LA));
  assert.deepEqual([all.status, all.error, all.message], [409, 'grain', 'this plan holds a vendor for 5 single occurrences (2026-09-29, 2026-10-01, 2026-10-03, …) — clear them before setting one vendor for every occurrence']);
  assert.match(refusal(grainAllows({ kind: 'routine_line', id: LUNCH, instant: null }, [held[0]], LA)).message, /^this plan holds a vendor for 1 single occurrence \(2026-10-03\) —/);
});

test('T6 the same vendor at the same address is unchanged; another replaces it; none creates — at either grain', () => {
  const every: HeldVendor = { id: 'h-1', occurrenceAt: null, vendorId: 'v-netflix', vendorName: 'Netflix' };
  const everyAgain = grainAllows({ kind: 'project_task', id: PLAN, instant: null }, [every], null);
  assert.deepEqual(everyAgain, { ok: true, existing: every });
  assert.equal(writeFor(every, 'v-netflix'), 'unchanged');
  assert.equal(writeFor(every, 'v-hulu'), 'replace');
  assert.equal(writeFor(null, 'v-netflix'), 'create');
  const lunch: HeldVendor = { id: 'h-2', occurrenceAt: at('2026-09-29T19:00:00.000Z'), vendorId: 'v-pho', vendorName: 'Pho 24' };
  assert.deepEqual(grainAllows({ kind: 'routine_line', id: LUNCH, instant: at('2026-09-29T19:00:00.000Z') }, [lunch], LA), { ok: true, existing: lunch }, 'the same instant is the same address');
  assert.deepEqual(grainAllows({ kind: 'routine_line', id: LUNCH, instant: at('2026-09-30T19:00:00.000Z') }, [lunch], LA), { ok: true, existing: null }, 'tomorrow\'s lunch is its own address');
  assert.deepEqual(grainAllows({ kind: 'routine', id: PLAN, instant: null }, [], LA), { ok: true, existing: null });
});

test('T6 the database refuses the same, tagged: the trigger\'s two messages open with the rule\'s tag, which the route recognises', () => {
  const sql = code(MIGRATION);
  const raises = [...sql.matchAll(/RAISE EXCEPTION '([^']*)'/g)].map((m) => m[1]);
  assert.equal(raises.length, 2);
  for (const r of raises) assert.ok(r.startsWith(`${GRAIN_TAG}: `), r);
  assert.equal(isGrainRefusal(new Error(`Raw query failed. Code: 23514. Message: ${raises[0]}`)), true);
  assert.equal(isGrainRefusal(new Error('Unique constraint failed')), false);
  assert.equal(isGrainRefusal(`${GRAIN_TAG}: a string is not an error`), false);
  // A client error that carries the database's words in its meta.
  assert.equal(isGrainRefusal(Object.assign(new Error('A constraint failed on the database'), { meta: { database_error: raises[1] } })), true);
});

// ── T7 · THE PINS ────────────────────────────────────────────────────────────

const fold = (s: string) => s.replace(/\s+/g, ' ');
const handler = (src: string, method: string): string => {
  const at0 = src.indexOf(`export async function ${method}(`);
  assert.ok(at0 >= 0, `${method} is a function`);
  const next = src.indexOf('\nexport async function ', at0 + 1);
  const helper = src.indexOf('\nfunction ', at0 + 1);
  const ends = [next, helper].filter((i) => i > 0);
  return src.slice(at0, ends.length ? Math.min(...ends) : undefined);
};
const GATE = /^export async function (GET|POST|DELETE)\((request: NextRequest)?\) \{ try \{ const userEmail = await getVerifiedEmail\(\); if \(!userEmail\) \{ return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\); \} const user = await prisma\.users\.findFirst\(\{ where: \{ email: \{ equals: userEmail, mode: 'insensitive' \} \}(, select: \{ id: true \},)? \}\); if \(!user\) \{ return NextResponse\.json\(\{ error: 'User not found' \}, \{ status: 404 \}\); \}/;

test('T7 every handler of both routes opens with the gate, and every query in them names the caller; no 403', () => {
  for (const [file, methods] of [[DIRECTORY, ['GET', 'POST']], [ROUTE, ['POST', 'DELETE']]] as const) {
    const src = code(file);
    for (const m of methods) assert.match(fold(handler(src, m)), GATE, `${file} ${m}`);
    assert.doesNotMatch(src, /status: 403/);
    const calls = [...src.matchAll(/\b(prisma|tx)\.(\w+)\.(\w+)\(/g)].filter((m) => !m[2].startsWith('$'));
    assert.ok(calls.length > 0);
    for (const m of calls) {
      const call = src.slice(m.index!, closingOf(src, m.index! + m[0].length - 1) + 1);
      if (m[2] === 'users') { assert.match(fold(call), /^prisma\.users\.findFirst\(\{ where: \{ email: \{ equals: userEmail, mode: 'insensitive' \} \}/); continue; }
      assert.match(call, /\buser\.id\b/, `${file}: ${m[0]} names the caller`);
    }
    for (const m of src.matchAll(/\$queryRaw<[^`]*?>`([^`]*)`/g)) assert.match(m[1], /\$\{user\.id\}/, 'the raw lock names the caller');
  }
});

test('T7 the plan-vendors route reads the routine through the one loader and the occurrence through /budget\'s builder; neither it nor the rule expands a schedule itself', () => {
  const route = code(ROUTE);
  assert.match(route, /const loaded = await loadRoutineBudgetInputs\(prisma, user\.id, planBook\.id\);/);
  assert.match(route, /const entity = toReportEntity\(planBook\);/);
  assert.match(route, /loaded\.map\(\(row\) => toRoutinePlanInput\(row, entity\)\)/);
  assert.match(route, /const window = occurrenceWindow\(address\.instant\);\s*const built = buildRoutineBudgetLines\(\[routineInput\], window\.rangeFrom, window\.rangeTo\);/);
  for (const f of [ROUTE, RULE]) {
    assert.doesNotMatch(code(f), /expandBetween|rruleHelpers|rrule['"]/, `${f} does no second expansion`);
    assert.doesNotMatch(code(f), /new Date\(\s*\)|Date\.now\(/, `${f} reads no clock`);
  }
  // The rule is pure: no client, no request, no environment.
  assert.doesNotMatch(code(RULE), /@prisma\/client|@\/lib\/prisma|next\/server|process\.env/);
  // The checks run in order: address, plan, loader, money, occurrence, vendor, grain — then the write, then the audit.
  const order = ['readPlanAddress(', 'prisma.operations_routines.findFirst(', 'loadRoutineBudgetInputs(', 'moneyIsHere(plan)', 'occurrenceIn(', 'vendorFits(', 'grainAllows(', 'writeFor(', 'planned_item_vendors.create(', "type: 'operations_plan_vendor_set'"];
  const post = handler(route, 'POST');
  const at1 = order.map((s) => post.indexOf(s));
  assert.ok(at1.every((i) => i >= 0), JSON.stringify(at1));
  assert.deepEqual([...at1].sort((a, b) => a - b), at1);
  // Every check's refusal is answered — none is computed and dropped.
  for (const [name, count] of [['read', 2], ['asRead', 2], ['money', 1], ['occurrence', 1], ['fits', 1], ['grain', 1]] as const) {
    assert.equal((route.match(new RegExp(`if \\(!${name}\\.ok\\) return refused\\(${name}\\);`, 'g')) ?? []).length, count, name);
  }
  const del = handler(route, 'DELETE');
  assert.ok(del.indexOf('planned_item_vendors.delete(') < del.indexOf("type: 'operations_plan_vendor_cleared'"), 'write, then audit');
  assert.match(route, /if \(error instanceof BudgetDaysError \|\| error instanceof BudgetInputError\) \{\s*return NextResponse\.json\(\{ error: error\.code, message: error\.message \}, \{ status: 500 \}\);/);
  assert.match(route, /if \(isGrainRefusal\(error\)\) \{[\s\S]{0,200}status: 409/);
  assert.match(route, /error\.code === 'P2002'\) \{[\s\S]{0,200}status: 409/);
});

test('T7 the directory POST locks and reads the book in one read, reads the name through the rule, audits operations_vendor_added — and never updates or deletes a vendor', () => {
  const src = code(DIRECTORY);
  const post = handler(src, 'POST');
  assert.match(post, /await tx\.\$queryRaw<\{ id: string \}\[\]>`SELECT id FROM entities WHERE id = \$\{entityId\} AND "userId" = \$\{user\.id\} FOR NO KEY UPDATE`/);
  assert.match(post, /if \(book\.length === 0\) return \{ kind: 'no-book' \} as const;/);
  assert.match(post, /const name = readVendorName\(body\.name\);/);
  assert.match(post, /const taken = takenBy\(name\.name, vendors\);/);
  assert.match(post, /data: \{ user_id: user\.id, entity_id: entityId, vendor_name: name\.name, created_by: userEmail \}/);
  assert.match(post, /action: \{ type: 'operations_vendor_added',/);
  assert.match(post, /return NextResponse\.json\(outcome\.vendor, \{ status: 201 \}\);/);
  assert.match(post, /vendor: \{ id: v\.id, vendor_name: v\.vendor_name, is_active: v\.is_active \}/, 'the 409 names the vendor, its id and whether it is active');
  assert.doesNotMatch(src, /operations_vendor_directory\.(update|updateMany|upsert|delete|deleteMany)\(/);
  // The GET is as it was.
  const get = handler(src, 'GET');
  assert.match(get, /where: \{ user_id: user\.id, is_active: true \},\s*orderBy: \{ vendor_name: 'asc' \},\s*select: \{ id: true, vendor_name: true, entity_id: true, category: true \},/);
  assert.match(comments(DIRECTORY), /this file now CREATES vendors[\s\S]*never updates or deletes one/);
});

test('T7 the migration holds it: the CHECKs, one vendor per address, the grain trigger locking FOR NO KEY UPDATE, RESTRICT and CASCADE — authored, not applied, no backfill', () => {
  const sql = fold(code(MIGRATION));
  assert.match(sql, /CHECK \(num_nonnulls\("routine_id", "step_id", "task_id"\) = 1\);/);
  assert.match(sql, /CHECK \("task_id" IS NULL OR "occurrence_at" IS NULL\);/);
  for (const [col, table] of [['routine_id', 'operations_routines'], ['step_id', 'operations_routine_steps'], ['task_id', 'operations_project_tasks']]) {
    assert.match(sql, new RegExp(`CREATE UNIQUE INDEX "\\w+" ON "planned_item_vendors"\\("${col}"\\) WHERE "${col}" IS NOT NULL AND "occurrence_at" IS NULL;`), `${col} every`);
    assert.match(sql, new RegExp(`CREATE UNIQUE INDEX "\\w+" ON "planned_item_vendors"\\("${col}", "occurrence_at"\\) WHERE "${col}" IS NOT NULL;`), `${col} occurrence`);
    assert.match(sql, new RegExp(`PERFORM 1 FROM "${table}" WHERE "id" = NEW\\."${col}" FOR NO KEY UPDATE;`), `${table} locked`);
    assert.match(sql, new RegExp(`FOREIGN KEY \\("${col}"\\) REFERENCES "${table}"\\("id"\\) ON DELETE CASCADE ON UPDATE CASCADE;`));
  }
  assert.doesNotMatch(sql, /FOR UPDATE;|FOR SHARE/, 'ruled D3: FOR NO KEY UPDATE, never FOR UPDATE');
  assert.match(sql, /CREATE TRIGGER "planned_item_vendors_one_grain" BEFORE INSERT OR UPDATE ON "planned_item_vendors" FOR EACH ROW EXECUTE FUNCTION "planned_item_vendors_one_grain"\(\);/);
  assert.match(sql, /FOREIGN KEY \("vendor_id"\) REFERENCES "operations_vendor_directory"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE;/);
  assert.match(sql, /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE/);
  assert.match(sql, /CREATE INDEX "planned_item_vendors_user_id_occurrence_at_idx" ON "planned_item_vendors"\("user_id", "occurrence_at"\);/);
  assert.match(sql, /CREATE INDEX "planned_item_vendors_vendor_id_idx" ON "planned_item_vendors"\("vendor_id"\);/);
  assert.match(sql, /ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_plan_vendor_set'; ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_plan_vendor_cleared';/);
  assert.doesNotMatch(sql, /\b(INSERT INTO|UPDATE "|DELETE FROM|lower\()/i, 'no backfill, no lower() index');
  assert.match(comments(MIGRATION), /AUTHORED, NOT APPLIED/);
  assert.match(comments(MIGRATION), /NO BACKFILL/);
});

test('T7 the schema model\'s columns match the migration\'s, and no column of the plan tables or the directory changes', () => {
  const schema = code('prisma/schema.prisma');
  const model = /model planned_item_vendors \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(model);
  const columns = [...model[1].matchAll(/^[ \t]+(\w+)[ \t]+(String|DateTime)(\?)?[ \t]*(.*)$/gm)].map((m) => {
    const type = m[2] === 'DateTime' ? 'TIMESTAMPTZ(6)' : /@db\.Uuid/.test(m[4]) ? 'UUID' : 'TEXT';
    return `${m[1]} ${type}${m[3] ? '' : ' NOT NULL'}`;
  });
  const table = /CREATE TABLE "planned_item_vendors" \(([\s\S]*?)CONSTRAINT/.exec(code(MIGRATION));
  assert.ok(table);
  const sqlColumns = [...table[1].matchAll(/"(\w+)" (UUID|TEXT|TIMESTAMPTZ\(6\))( NOT NULL)?/g)].map((m) => `${m[1]} ${m[2]}${m[3] ?? ''}`);
  assert.deepEqual(columns, sqlColumns);
  assert.match(model[1], /vendor\s+operations_vendor_directory @relation\(fields: \[vendor_id\], references: \[id\], onDelete: Restrict\)/);
  for (const rel of ['user    users', 'routine operations_routines?', 'step    operations_routine_steps?', 'task    operations_project_tasks?']) {
    assert.match(model[1], new RegExp(`${rel.replace(/[?]/g, '\\?')}\\s+@relation\\(fields: \\[\\w+\\], references: \\[id\\], onDelete: Cascade\\)`), rel);
  }
  for (const parent of ['users', 'operations_routines', 'operations_routine_steps', 'operations_project_tasks', 'operations_vendor_directory']) {
    const block = new RegExp(`model ${parent} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
    assert.ok(block && /planned_item_vendors\s+planned_item_vendors\[\]/.test(block[1]), `${parent} carries the back-relation`);
  }
  assert.match(schema, /operations_plan_vendor_set\s+operations_plan_vendor_cleared\s+\}/, 'appended to AuditActionType in ALTER TYPE order');
  assert.match(code('src/app/api/audit-log/route.ts'), /'operations_plan_vendor_set',\s*'operations_plan_vendor_cleared',\s*\],/);
});
