/**
 * SEC-TASKS-01 (2026-09-28) — what the Tasks census found, closed.
 *
 *   S1 only the owner fires a Claude Code Routine: run-pipe, the pipe's first step,
 *      the task PATCH that accepts a pending_review task, and both fire functions;
 *   S2 only the owner verifies the audit chain, and every screen that asks shows
 *      the refusal in its own words — never "chain INVALID", never dropped;
 *   S3 a link's target must be the caller's own item;
 *   S4 a reversal pair leaves a project's "allocated from ledger" cost.
 *
 * The gate, the target rule and the fire functions are DRIVEN — the fire
 * functions and the pipe handler for real, over a stubbed fetch and a fake step.
 * The routes cannot run outside a Next request scope (getVerifiedEmail reads
 * next/headers cookies), so — the repo's TEST-TRUTH-01 way (audit01b,
 * bookings01) — each route's order is anchored to its source, comments
 * stripped, and its where-clauses are evaluated over fixtures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NonRetriableError } from 'inngest';
import { code, functionBody } from '../sourceText';
import { AdminConfigError } from '../admin';
import {
  AUDIT_CHAIN_OWNER_ONLY_BODY, OWNER_ONLY, ROUTINE_OWNER_ONLY_BODY, RoutineOwnerOnlyError,
  firesBuild, isRoutineOwner, requireRoutineOwner,
} from '../operations/ownerOnly';
import { LINKABLE_KINDS, targetOwnerQuery, type LinkableKind, type TargetOwnerQuery } from '../calendar/linkKeys';
import { fireExecutionRoutine } from '../fireExecutionRoutine';
import { fireAuditRoutine } from '../fireAuditRoutine';
import { operationsPipeRun } from '../../inngest/functions/operations-pipe-run';

const RUN_PIPE = 'src/app/api/operations/projects/[id]/run-pipe/route.ts';
const TASK_PATCH = 'src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts';
const PIPE = 'src/inngest/functions/operations-pipe-run.ts';
const FIRE_EXEC = 'src/lib/fireExecutionRoutine.ts';
const FIRE_AUDIT = 'src/lib/fireAuditRoutine.ts';
const VERIFY = 'src/app/api/audit-log/verify-chain/route.ts';
const SECTION_I = 'src/components/workbench/SectionI_AuditTail.tsx';
const SECTION_K = 'src/components/workbench/operations/SectionK_AuditTail.tsx';
const COMPLIANCE_LOG = 'src/app/compliance/audit-log/page.tsx';
const LINKS = 'src/app/api/calendar/links/route.ts';
const PROJECTS = 'src/app/api/operations/projects/route.ts';
const BUDGET_REPORT = 'src/app/api/budget/report/route.ts';

const OWNER = 'u_owner';
const OTHER = 'u_other';

/** Index of `needle` in `hay`, asserted present exactly once. */
function once(hay: string, needle: string, what: string): number {
  const at = hay.indexOf(needle);
  assert.ok(at >= 0, `${what}: not found — ${needle}`);
  assert.equal(hay.indexOf(needle, at + 1), -1, `${what}: found more than once — ${needle}`);
  return at;
}

/** Run fn with ADMIN_USER_ID set to value (or removed), restored after. */
async function withAdmin<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.ADMIN_USER_ID;
  if (value === undefined) delete process.env.ADMIN_USER_ID;
  else process.env.ADMIN_USER_ID = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = before;
  }
}

// ── THE GATE ─────────────────────────────────────────────────────────────────

test('the gate: only the owner passes; an unset ADMIN_USER_ID fails loud; the refusals say who may', () => {
  assert.equal(isRoutineOwner(OWNER, OWNER), true);
  assert.equal(isRoutineOwner(OTHER, OWNER), false);
  assert.throws(() => isRoutineOwner(OWNER, ''), AdminConfigError);
  assert.doesNotThrow(() => requireRoutineOwner(OWNER, OWNER));
  assert.throws(() => requireRoutineOwner(OTHER, OWNER), (e: unknown) => e instanceof RoutineOwnerOnlyError && e.message === 'Build and audit runs are limited to the platform owner.');
  assert.throws(() => requireRoutineOwner(OTHER, ''), AdminConfigError, 'a gate that cannot decide does not');
  assert.equal(OWNER_ONLY, 'owner_only');
  assert.deepEqual(ROUTINE_OWNER_ONLY_BODY, { error: 'owner_only', message: 'Build and audit runs are limited to the platform owner.' });
  assert.deepEqual(AUDIT_CHAIN_OWNER_ONLY_BODY, { error: 'owner_only', message: 'Audit chain verification is limited to the platform owner.' });
  // The gate asks the ONE admin rule, nothing else.
  const g = code('src/lib/operations/ownerOnly.ts');
  assert.match(g, /import \{ isAdminUser \} from '@\/lib\/admin';/);
  assert.match(g, /return isAdminUser\(userId, adminValue\);/);
});

// ── T1 · RUN-PIPE ────────────────────────────────────────────────────────────

test('T1 run-pipe: user lookup → the owner check → then the project read, the goal check and the event; the route spends no cap', () => {
  const r = code(RUN_PIPE);
  const email = once(r, 'const userEmail = await getVerifiedEmail();', 'run-pipe auth');
  const user = once(r, 'const user = await prisma.users.findFirst({', 'run-pipe user lookup');
  const notFound = once(r, "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });", 'run-pipe 404');
  const gate = once(r, 'if (!isRoutineOwner(user.id)) return NextResponse.json(ROUTINE_OWNER_ONLY_BODY, { status: 403 });', 'run-pipe gate');
  const project = once(r, 'const project = await prisma.operations_projects.findFirst({', 'run-pipe project read');
  const send = once(r, 'await inngest.send({', 'run-pipe event');
  assert.ok(email < user && user < notFound && notFound < gate && gate < project && project < send, 'auth → user → 404 → OWNER → project → event');
  // Nothing before the gate reads env or spends a cap; nothing in the route spends one at all.
  assert.doesNotMatch(r.slice(0, gate), /process\.env|inngest\.send|operations_projects/);
  assert.doesNotMatch(r, /require(Pipe|Routine|Exec)Budget/);
  // The owner's run is today's: the same event, the same 202.
  assert.match(r, /await inngest\.send\(\{\s*name: 'operations\/pipe\.run',\s*data: \{ projectId, userId: user\.id \},\s*\}\);/);
  assert.match(r, /\{ ok: true, message: 'pipe run queued' \},\s*\{ status: 202 \}/);
});

// ── T2 · THE TASK PATCH ──────────────────────────────────────────────────────

test('T2 firesBuild: pending_review → open is the one move that fires a build; every other edit is not', () => {
  assert.equal(firesBuild({ from: 'pending_review', to: 'open' }), true);
  const statuses = ['open', 'in_progress', 'blocked', 'completed', 'cancelled', 'archived', 'superseded', 'pending_review'];
  for (const from of statuses) {
    for (const to of statuses) {
      if (from === 'pending_review' && to === 'open') continue;
      assert.equal(firesBuild({ from, to }), false, `${from} → ${to}`);
    }
  }
  assert.equal(firesBuild(null), false, 'a content edit with no status change');
});

test('T2 the PATCH: the build move is refused for a non-owner BEFORE any write; every other PATCH never asks the admin rule', () => {
  const r = code(TASK_PATCH);
  const transition = once(r, 'statusTransition = { from: existing.status, to: incoming };', 'PATCH transition');
  const gate = once(r, 'if (firesBuild(statusTransition) && !isRoutineOwner(user.id)) {\n      return NextResponse.json(ROUTINE_OWNER_ONLY_BODY, { status: 403 });', 'PATCH gate');
  const write = once(r, 'const task = await prisma.$transaction(async (tx) => {', 'PATCH first write');
  const fire = once(r, 'if (firesBuild(statusTransition)) {', 'PATCH fire');
  assert.ok(transition < gate && gate < write && write < fire, 'transition decided → OWNER → the write → the fire');
  // Nothing between the handler's start and the gate writes.
  const patch = r.slice(r.indexOf('export async function PATCH('), gate);
  assert.doesNotMatch(patch, /\.(update|create|delete|upsert)(Many)?\(|\$transaction|writeAuditLog|recordTaskStatusChange/);
  // The admin rule is asked ONLY on the build move (&& short-circuits) — once in the file.
  assert.equal((r.match(/isRoutineOwner\(/g) ?? []).length, 1);
  assert.equal((r.match(/firesBuild\(/g) ?? []).length, 2, 'the gate and the fire read the same one rule');
  assert.doesNotMatch(r, /statusTransition\.from === 'pending_review' && statusTransition\.to === 'open'/, 'the old inline test is gone');
  // The owner's accept is today's: the fire, the correlation id, 'building'; a failed fire is 'fire_failed' + 502.
  const after = r.slice(fire);
  assert.match(after, /const fired = await fireExecutionRoutine\(\{ taskId, projectId, userId: user\.id, userEmail \}\);/);
  assert.match(after, /data: \{ exec_correlation_id: fired\.correlationId, exec_status: 'building' \},/);
  assert.match(after, /data: \{ exec_status: 'fire_failed' \},/);
  assert.match(after, /\{ status: 502 \}/);
});

test('T2 the gate as the PATCH evaluates it: a non-owner accept is refused; ordinary edits pass even with ADMIN_USER_ID unset', () => {
  // The PATCH expression, evaluated: firesBuild(t) && !isRoutineOwner(userId).
  const refused = (t: { from: string; to: string } | null, userId: string, admin: string | undefined) =>
    firesBuild(t) && !isRoutineOwner(userId, admin);
  assert.equal(refused({ from: 'pending_review', to: 'open' }, OTHER, OWNER), true, 'a non-owner accept → 403');
  assert.equal(refused({ from: 'pending_review', to: 'open' }, OWNER, OWNER), false, 'the owner accept → the fire');
  assert.equal(refused({ from: 'pending_review', to: 'cancelled' }, OTHER, OWNER), false, 'a non-owner may still reject');
  // An unset env throws only on the build move — an ordinary edit never reaches the rule.
  for (const t of [null, { from: 'open', to: 'completed' }, { from: 'pending_review', to: 'cancelled' }, { from: 'archived', to: 'open' }]) {
    assert.doesNotThrow(() => refused(t, OTHER, ''), `ordinary edit ${JSON.stringify(t)}`);
  }
  assert.throws(() => refused({ from: 'pending_review', to: 'open' }, OTHER, ''), AdminConfigError, 'fail loud, never a silent yes or no');
});

// ── T3 · THE FIRE FUNCTIONS ──────────────────────────────────────────────────

test('T3 the fire functions refuse a non-owner by name BEFORE the cap, the env or the network', async () => {
  const realFetch = globalThis.fetch;
  const calls: unknown[] = [];
  globalThis.fetch = (async (...args: unknown[]) => { calls.push(args); throw new Error('no fetch may run'); }) as typeof fetch;
  try {
    await withAdmin(OWNER, async () => {
      await assert.rejects(fireExecutionRoutine({ taskId: 't1', projectId: 'p1', userId: OTHER, userEmail: 'x@example.com' }), RoutineOwnerOnlyError);
      await assert.rejects(fireAuditRoutine({ projectId: 'p1', userId: OTHER, userEmail: 'x@example.com' }), RoutineOwnerOnlyError);
    });
    // Unset → the gate cannot decide, so the fire does not happen (fail loud).
    await withAdmin(undefined, async () => {
      await assert.rejects(fireExecutionRoutine({ taskId: 't1', projectId: 'p1', userId: OTHER, userEmail: 'x@example.com' }), AdminConfigError);
      await assert.rejects(fireAuditRoutine({ projectId: 'p1', userId: OTHER, userEmail: 'x@example.com' }), AdminConfigError);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls.length, 0, 'nothing reached the network');
  // And the order in source: owner → cap → env → the task/project read → fetch.
  for (const [file, cap, env] of [
    [FIRE_EXEC, 'await requireExecBudget(userId);', 'process.env.EXEC_ROUTINE_FIRE_URL'],
    [FIRE_AUDIT, 'await requireRoutineBudget(userId);', 'process.env.ROUTINE_AUDIT_FIRE_URL'],
  ] as const) {
    const s = code(file);
    const owner = once(s, 'requireRoutineOwner(userId);', `${file} owner`);
    const capAt = once(s, cap, `${file} cap`);
    const envAt = once(s, env, `${file} env`);
    const fetchAt = once(s, 'await fetch(fireUrl, {', `${file} fetch`);
    assert.ok(owner < capAt && capAt < envAt && envAt < fetchAt, `${file}: owner → cap → env → fetch`);
    const input = s.indexOf('} = input;');
    assert.ok(input > 0 && input < owner);
    assert.match(s.slice(input + '} = input;'.length, owner), /^\s*$/, `${file}: the owner check is the first statement after the input is read`);
  }
});

// ── THE PIPE'S FIRST STEP ────────────────────────────────────────────────────

type PipeHandler = (ctx: { event: { data: Record<string, unknown> }; step: unknown }) => Promise<unknown>;
const pipeHandler = (operationsPipeRun as unknown as { fn: PipeHandler }).fn;

class StoppedAt extends Error {}

/** A fake Inngest step: records each step's name; runs only owner-check and stops at the next. */
function fakeStep(ran: string[]) {
  return {
    run: async (name: string, cb: () => unknown) => {
      ran.push(name);
      if (name !== 'owner-check') throw new StoppedAt(name);
      return cb();
    },
    waitForEvent: async () => { ran.push('waitForEvent'); throw new StoppedAt('waitForEvent'); },
  };
}

test('the pipe: an event for anyone but the owner fails TERMINAL at its first step — no read, no cap, no paid call', async () => {
  assert.equal(typeof pipeHandler, 'function', 'the handler is reachable');
  const ran: string[] = [];
  await withAdmin(OWNER, () =>
    assert.rejects(
      pipeHandler({ event: { data: { projectId: 'p1', userId: OTHER } }, step: fakeStep(ran) }),
      (e: unknown) => e instanceof NonRetriableError && e.message === ROUTINE_OWNER_ONLY_BODY.message,
    ),
  );
  assert.deepEqual(ran, ['owner-check'], 'nothing after the owner check ran');
  // Unset env → terminal too (a retry cannot change the answer).
  const ran2: string[] = [];
  await withAdmin(undefined, () =>
    assert.rejects(pipeHandler({ event: { data: { projectId: 'p1', userId: OTHER } }, step: fakeStep(ran2) }), NonRetriableError),
  );
  assert.deepEqual(ran2, ['owner-check']);
  // The owner passes the check and the pipe goes on to load its context, as today.
  const ran3: string[] = [];
  await withAdmin(OWNER, () =>
    assert.rejects(pipeHandler({ event: { data: { projectId: 'p1', userId: OWNER } }, step: fakeStep(ran3) }), StoppedAt),
  );
  assert.deepEqual(ran3, ['owner-check', 'load-context']);
  // In source: owner-check is the first step, before load-context, research and the audit fire.
  const p = code(PIPE);
  const owner = once(p, "await step.run('owner-check', async () => {", 'pipe owner step');
  const load = once(p, "step.run('load-context'", 'pipe load');
  const research = once(p, "step.run('research'", 'pipe research');
  const audit = once(p, 'await fireAuditRoutine({', 'pipe audit fire');
  assert.ok(owner < load && load < research && research < audit);
  assert.doesNotMatch(p.slice(p.indexOf('async ({ event, step }) => {'), owner), /prisma\.|step\.run|chargeBudget/);
});

// ── T4 · VERIFY-CHAIN AND ITS THREE SCREENS ──────────────────────────────────

test('T4 verify-chain: no user → 404; not the owner → 403 before verifyAuditChain runs; the owner gets today\'s response', () => {
  const r = code(VERIFY);
  const email = once(r, "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });", 'verify 401');
  const user = once(r, 'const user = await prisma.users.findFirst({', 'verify user lookup');
  const notFound = once(r, "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });", 'verify 404');
  const gate = once(r, 'if (!isAdminUser(user.id)) return NextResponse.json(AUDIT_CHAIN_OWNER_ONLY_BODY, { status: 403 });', 'verify gate');
  const run = once(r, 'const result = await verifyAuditChain();', 'verify run');
  assert.ok(email < user && user < notFound && notFound < gate && gate < run);
  assert.match(r, /where: \{ email: \{ equals: userEmail, mode: 'insensitive' \} \}/, 'the cart-plan lookup');
  // The owner's response is today's contract.
  assert.match(r, /ok: result\.is_valid,\s*rows_checked: result\.total_rows,\s*message: ui_message,/);
  assert.match(r, /return NextResponse\.json\(serialized\);/);
});

test('T4 the three screens show the refusal in its own words — never as "chain INVALID", never dropped', () => {
  // I · Compliance tail: the 403 message becomes the "could not verify" detail.
  const i = code(SECTION_I);
  assert.match(i, /const detail = res\.status === 403\s*\? \(\(await res\.json\(\)\) as \{ message: string \}\)\.message\s*: `request failed \(\$\{res\.status\}\)`;\s*setVerifyResult\(\{ state: 'failed', detail \}\);/);
  // K · the Tasks tab's Audit trail: the refusal has its own line; the INVALID line reads verifyResult only, which the 403 never sets.
  const k = code(SECTION_K);
  const refusal = /\} else if \(res\.status === 403\) \{\s*setVerifyRefusal\(\(\(await res\.json\(\)\) as \{ message: string \}\)\.message\);\s*\} else \{/.exec(k);
  assert.ok(refusal, 'the 403 branch sets the refusal, not a result');
  assert.doesNotMatch(refusal![0], /setVerifyResult/);
  assert.match(k, /\{verifyRefusal && \(\s*<div[^>]*>\s*<span className="font-bold">could not verify<\/span> · \{verifyRefusal\}/);
  assert.match(k, /setVerifyResult\(null\);\s*setVerifyRefusal\(null\);/, 'a new run clears both');
  // The Compliance audit-log page: verified on load; a 403 is SHOWN where the chip would be.
  const c = code(COMPLIANCE_LOG);
  assert.match(c, /\} else if \(res\.status === 403\) \{\s*setChainRefusal\(\(\(await res\.json\(\)\) as \{ message: string \}\)\.message\);\s*\}/);
  assert.match(c, /\) : chainRefusal \? \(\s*<span className="text-terminal-sm font-mono text-text-secondary">\{chainRefusal\}<\/span>\s*\) : null\}/);
  // The route's only 403 is the refusal — what the screens rely on.
  assert.equal((code(VERIFY).match(/status: 403/g) ?? []).length, 1);
});

// ── T5 · A LINK'S TARGET ─────────────────────────────────────────────────────

const U1 = 'u1';
const U2 = 'u2';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface Db {
  calendar_events: { id: string; user_id: string | null }[];
  operations_project_tasks: { id: string; user_id: string }[];
  operations_routines: { id: string; user_id: string }[];
  operations_routine_steps: { id: string; routine_id: string; user_id: string }[];
  trips: { id: string; userId: string }[];
  trip_itinerary: { id: string; tripId: string }[];
  links: { user_id: string; target_kind: string; target_id: string; journal_entry_id: string }[];
}

function db(): Db {
  return {
    calendar_events: [{ id: id(1), user_id: U1 }, { id: id(2), user_id: U2 }],
    operations_project_tasks: [{ id: id(3), user_id: U1 }, { id: id(4), user_id: U2 }],
    operations_routines: [{ id: id(5), user_id: U1 }, { id: id(6), user_id: U2 }],
    operations_routine_steps: [
      { id: id(7), routine_id: id(5), user_id: U1 },
      { id: id(8), routine_id: id(6), user_id: U2 },
      // A line stamped u1 on u2's routine: the ROUTINE decides, so it is not u1's.
      { id: id(9), routine_id: id(6), user_id: U1 },
    ],
    trips: [{ id: 'trip_u1', userId: U1 }, { id: 'trip_u2', userId: U2 }],
    trip_itinerary: [{ id: 'ti_u1', tripId: 'trip_u1' }, { id: 'ti_u2', tripId: 'trip_u2' }],
    links: [],
  };
}

/** The database answering the route's one read, as Prisma would: the where, relations followed. */
function found(d: Db, q: TargetOwnerQuery | null): boolean {
  if (q === null) return false;
  switch (q.table) {
    case 'calendar_events': return d.calendar_events.some((r) => r.id === q.where.id && r.user_id === q.where.user_id);
    case 'operations_project_tasks': return d.operations_project_tasks.some((r) => r.id === q.where.id && r.user_id === q.where.user_id);
    case 'operations_routines': return d.operations_routines.some((r) => r.id === q.where.id && r.user_id === q.where.user_id);
    case 'operations_routine_steps':
      return d.operations_routine_steps.some((s) => s.id === q.where.id && d.operations_routines.some((r) => r.id === s.routine_id && r.user_id === q.where.routine.user_id));
    case 'trip_itinerary':
      return d.trip_itinerary.some((i) => i.id === q.where.id && d.trips.some((t) => t.id === i.tripId && t.userId === q.where.trip.userId));
  }
}

/** The POST's order over the store: target read → 404, else the link is written. */
function post(d: Db, userId: string, kind: LinkableKind, targetId: string): number {
  if (!found(d, targetOwnerQuery(kind, targetId, userId))) return 404;
  d.links.push({ user_id: userId, target_kind: kind, target_id: targetId, journal_entry_id: `je_${d.links.length}` });
  return 201;
}

test('T5 another user\'s calendar event, task, routine, line or trip item → 404 and no row; your own → linked as today', () => {
  const cases: [LinkableKind, string, string][] = [
    ['calendar_event', id(1), id(2)],
    ['project_task', id(3), id(4)],
    ['routine', id(5), id(6)],
    ['routine_line', id(7), id(8)],
    ['trip_item', 'ti_u1', 'ti_u2'],
  ];
  assert.deepEqual(cases.map((c) => c[0]), [...LINKABLE_KINDS], 'every kind is covered');
  for (const [kind, mine, theirs] of cases) {
    const d = db();
    assert.equal(post(d, U1, kind, theirs), 404, `${kind}: someone else's`);
    assert.equal(post(d, U1, kind, id(99)), 404, `${kind}: none at all`);
    assert.equal(d.links.length, 0, `${kind}: nothing written on a refusal`);
    assert.equal(post(d, U1, kind, mine), 201, `${kind}: your own`);
    assert.deepEqual(d.links, [{ user_id: U1, target_kind: kind, target_id: mine, journal_entry_id: 'je_0' }]);
  }
  // A line is yours only through its routine — its own stamp does not decide.
  const d = db();
  assert.equal(post(d, U1, 'routine_line', id(9)), 404);
  // An id that is not a UUID names no row of a uuid-keyed table: the same 404, never a database error.
  for (const kind of ['calendar_event', 'project_task', 'routine', 'routine_line'] as const) {
    assert.equal(targetOwnerQuery(kind, 'not-a-uuid', U1), null, kind);
  }
  assert.deepEqual(targetOwnerQuery('trip_item', 'ti_u1', U1), { table: 'trip_itinerary', where: { id: 'ti_u1', trip: { userId: U1 } } }, 'a trip item id is a cuid');
});

test('T5 the route: the target read comes before the posting read and the write, and runs the kind\'s own where', () => {
  const r = code(LINKS);
  const post = r.slice(r.indexOf('export async function POST('), r.indexOf('export async function DELETE('));
  const target = once(post, "if (!(await ownsTarget(targetOwnerQuery(t.kind, t.id, user.id)))) {\n    return NextResponse.json({ error: 'No such item' }, { status: 404 });", 'links target check');
  const posting = once(post, 'const entry = await prisma.journal_entries.findFirst({', 'links posting read');
  const write = once(post, 'const link = await prisma.planned_item_links.create({', 'links write');
  assert.ok(target < posting && posting < write);
  const owns = r.slice(r.indexOf('async function ownsTarget('), r.indexOf('export async function GET('));
  for (const table of ['calendar_events', 'operations_project_tasks', 'operations_routines', 'operations_routine_steps', 'trip_itinerary']) {
    assert.match(owns, new RegExp(`case '${table}': return \\(await prisma\\.${table}\\.findFirst\\(\\{ where: q\\.where, select \\}\\)\\) !== null;`), table);
  }
  assert.match(owns, /if \(q === null\) return false;/);
  // D2 (a): the trip item is read, never written — no Travel file changes, no Travel write here.
  assert.doesNotMatch(r, /trip_itinerary\.(create|update|delete|upsert)/);
});

// ── T6 · A REVERSED POSTING LEAVES THE ROLLUP ────────────────────────────────

interface Je { id: string; userId: string; is_reversal: boolean; reversed_by_entry_id: string | null }
interface Line { id: string; journal_entry_id: string; entry_type: 'D' | 'C'; amount: number }
interface LinkRow { project_id: string; ledger_entry_id: string; percent: number }

test('T6 the rollup leaves out reversal pairs by name — the budget report\'s own two fields — and nets nothing twice', () => {
  const r = code(PROJECTS);
  once(r, 'ledger_entry: { journal_entry: { userId: user.id, is_reversal: false, reversed_by_entry_id: null } },', 'rollup where');
  // The same two fields, the same values, as the budget report's actuals.
  assert.match(code(BUDGET_REPORT), /is_reversal: false, reversed_by_entry_id: null, source_type: \{ not: 'year_end_close' \}/);
  // The math the route runs (pinned, then evaluated below).
  assert.match(r, /const signed = \(l\.ledger_entry\.entry_type === 'C' \? -1 : 1\) \* Number\(l\.ledger_entry\.amount\);/);
  assert.match(r, /a\.cents \+= \(signed \* pctCenti\) \/ 10_000;/);

  const P = 'proj_1';
  const jes: Je[] = [
    { id: 'je_charge', userId: U1, is_reversal: false, reversed_by_entry_id: 'je_uncommit' }, // committed, then uncommitted
    { id: 'je_uncommit', userId: U1, is_reversal: true, reversed_by_entry_id: null },        // the reversal: no links of its own
    { id: 'je_recommit', userId: U1, is_reversal: false, reversed_by_entry_id: null },       // the same charge, committed again
    { id: 'je_plain', userId: U1, is_reversal: false, reversed_by_entry_id: null },          // never reversed
  ];
  const lines: Line[] = [
    { id: 'l_charge', journal_entry_id: 'je_charge', entry_type: 'D', amount: 10_000 },
    { id: 'l_uncommit', journal_entry_id: 'je_uncommit', entry_type: 'C', amount: 10_000 },
    { id: 'l_recommit', journal_entry_id: 'je_recommit', entry_type: 'D', amount: 10_000 },
    { id: 'l_plain', journal_entry_id: 'je_plain', entry_type: 'D', amount: 5_000 },
  ];
  const links: LinkRow[] = [
    { project_id: P, ledger_entry_id: 'l_charge', percent: 100 },   // the reversal left it in place
    { project_id: P, ledger_entry_id: 'l_recommit', percent: 100 },
    { project_id: P, ledger_entry_id: 'l_plain', percent: 50 },
  ];
  const rollup = (keep: (je: Je) => boolean): number => {
    let cents = 0;
    for (const l of links) {
      const line = lines.find((x) => x.id === l.ledger_entry_id)!;
      const je = jes.find((x) => x.id === line.journal_entry_id)!;
      if (!(je.userId === U1 && keep(je))) continue;
      const pctCenti = Math.round(Number(l.percent) * 100);
      const signed = (line.entry_type === 'C' ? -1 : 1) * Number(line.amount);
      cents += (signed * pctCenti) / 10_000;
    }
    return Math.round(cents);
  };
  // Before: scoped by user only — the uncommitted charge still counted, so the re-commit counted it twice.
  assert.equal(rollup(() => true), 22_500);
  // After: the route's where.
  assert.equal(rollup((je) => je.is_reversal === false && je.reversed_by_entry_id === null), 12_500, 'the charge once, the plain half once');
});

// ── T7 · EVERY FIRE PATH SITS BEHIND THE OWNER ───────────────────────────────

function srcFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) {
      if (name !== '__tests__') out.push(...srcFiles(rel));
    } else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

test('T7 every caller found in STEP 0.2 — and no other — sits behind the owner check', () => {
  const files = srcFiles();
  const where = (re: RegExp) => files.filter((f) => re.test(code(f))).sort();
  // The callers, exactly as STEP 0.2 found them.
  assert.deepEqual(where(/\bfireExecutionRoutine\(\{/), [TASK_PATCH]);
  assert.deepEqual(where(/\bfireAuditRoutine\(\{/), [PIPE]);
  assert.deepEqual(where(/name: 'operations\/pipe\.run'/), [RUN_PIPE]);
  assert.deepEqual(where(/process\.env\.(EXEC_)?ROUTINE_/), [FIRE_AUDIT, FIRE_EXEC].sort());
  assert.deepEqual(where(/experimental-cc-routine/), [FIRE_AUDIT, FIRE_EXEC].sort(), 'no other Routine fire');
  // Each one behind the gate.
  const patch = code(TASK_PATCH);
  assert.ok(patch.indexOf('!isRoutineOwner(user.id)') < patch.indexOf('fireExecutionRoutine({'));
  const pipe = code(PIPE);
  assert.ok(pipe.indexOf("step.run('owner-check'") < pipe.indexOf('fireAuditRoutine({'));
  const run = code(RUN_PIPE);
  assert.ok(run.indexOf('!isRoutineOwner(user.id)') < run.indexOf("name: 'operations/pipe.run'"));
  for (const f of [FIRE_EXEC, FIRE_AUDIT]) {
    const s = code(f);
    const body = functionBody(s, f === FIRE_EXEC ? 'fireExecutionRoutine' : 'fireAuditRoutine');
    assert.ok(body, f);
    assert.ok(body!.indexOf('requireRoutineOwner(userId);') < body!.indexOf('process.env.'), `${f}: owner before env`);
  }
});
