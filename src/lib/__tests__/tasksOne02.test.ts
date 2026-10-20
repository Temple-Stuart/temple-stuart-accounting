/**
 * TASKS-ONE-02 (2026-10-14) — ONE DONE: the day card's done is the routine's
 * done; the week grid, the Today strip and the Daily plan go.
 *
 * The rule (routineDone.ts) is pure and DRIVEN over fixtures. The one writer
 * (routineCompletion.ts syncCompletion) is DRIVEN over a fake transaction that
 * records every call, so the fields each move writes are asserted, not read off
 * the source. The routes, the evaluator, the page, the laws and the migration are
 * anchored to their source with comments stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import { completionMove, deltaMinutes, occurrenceDone, type DoneLine, type DoneRecord } from '../operations/routineDone';
import { lockRoutine, nextDueAfter, syncCompletion } from '../operations/routineCompletion';
import type { StopRecordDbRow } from '../operations/stopRecord';

const DONE_RULE = 'src/lib/operations/routineDone.ts';
const WRITER = 'src/lib/operations/routineCompletion.ts';
const STOPS = 'src/app/api/operations/stops/route.ts';
const STOPS_ID = 'src/app/api/operations/stops/[id]/route.ts';
const EVALUATOR = 'src/inngest/functions/routine-evaluator.ts';
const PAGE = 'src/app/tasks/page.tsx';
const SECTION_E = 'src/components/workbench/operations/SectionE_Routines.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SCHEMA = 'prisma/schema.prisma';
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261014090000_tasks_one_02_completion_audit_types';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const DELETED = [
  'src/components/workbench/operations/week/WeekSection.tsx',
  'src/components/workbench/operations/week/WeekCell.tsx',
  'src/components/workbench/operations/week/weekPlan.ts',
  'src/components/workbench/operations/SectionC_DailyPlan.tsx',
  'src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx',
  'src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx',
  'src/components/workbench/operations/routines/TodaysStrip.tsx',
  'src/components/workbench/operations/routines/completeRoutine.ts',
  'src/app/api/operations/routines/[id]/completions/route.ts',
  'src/app/api/operations/routines/[id]/completions/[completionId]/route.ts',
  'src/lib/operations/completionNote.ts',
];

const walk = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));

// ── T1 · THE RULE (PURE) ─────────────────────────────────────────────────────

const ROUTINE = 'r-gym';
const AT = '2026-10-13T00:00:00.000Z'; // 07:00 in Bangkok
const rec = (kind: DoneRecord['kind'], target_id: string, outcome: DoneRecord['outcome'], done_at: string | null): DoneRecord => ({ kind, target_id, outcome, done_at });
const stop = (id: string): DoneLine => ({ id, role: 'execute' });

test('T1 a stepless routine: a done record is done at its done_at; a skipped record, or none (cleared), is not done', () => {
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines: [], records: [rec('routine', ROUTINE, 'done', '2026-10-13T00:12:00.000Z')] }), { done: true, completedAt: new Date('2026-10-13T00:12:00.000Z') });
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines: [], records: [rec('routine', ROUTINE, 'skipped', null)] }), { done: false }, 'a skipped record is not done');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines: [], records: [] }), { done: false }, 'cleared — no record');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines: [], records: [rec('routine', 'r-other', 'done', AT)] }), { done: false }, 'another routine’s record is not this one’s');
  assert.throws(() => occurrenceDone({ routineId: ROUTINE, lines: [], records: [rec('routine', ROUTINE, 'done', null)] }), /has no done_at — the migration's CHECK sets it exactly when done/, 'a done record without its instant is the database’s error, named');
});

test('T1 a routine with lines: done when EVERY stop line has a done record; one not done, or one cleared, is not done', () => {
  const lines = [stop('l-stretch'), stop('l-coffee')];
  const both = [rec('routine_line', 'l-stretch', 'done', '2026-10-13T00:05:00.000Z'), rec('routine_line', 'l-coffee', 'done', '2026-10-13T00:20:00.000Z')];
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines, records: both }), { done: true, completedAt: new Date('2026-10-13T00:20:00.000Z') }, 'completed_at is the LATEST done_at among the lines');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines, records: [...both].reverse() }), { done: true, completedAt: new Date('2026-10-13T00:20:00.000Z') }, 'whatever the records’ order');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines, records: [both[0], rec('routine_line', 'l-coffee', 'skipped', null)] }), { done: false }, 'one line skipped');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines, records: [both[0]] }), { done: false }, 'one line cleared — no record');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines, records: [rec('routine', ROUTINE, 'done', AT)] }), { done: false }, 'a routine-level record does not stand in for its lines');
});

test('T1 a line that is not a stop is ignored; a routine none of whose lines is a stop is never done by records', () => {
  const lines: DoneLine[] = [stop('l-stretch'), { id: 'l-gym-membership', role: 'all_day' }];
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines, records: [rec('routine_line', 'l-stretch', 'done', '2026-10-13T00:05:00.000Z')] }), { done: true, completedAt: new Date('2026-10-13T00:05:00.000Z') }, 'the all-day line asks no record');
  assert.deepEqual(occurrenceDone({ routineId: ROUTINE, lines: [{ id: 'l-a', role: 'all_day' }], records: [rec('routine_line', 'l-a', 'done', AT)] }), { done: false });
  for (const role of ['journal', 'plan', 'execute', 'place', 'none'] as const) {
    assert.equal(occurrenceDone({ routineId: ROUTINE, lines: [{ id: 'l', role }], records: [rec('routine_line', 'l', 'done', AT)] }).done, true, `${role} is a stop`);
  }
});

test('T1 the completion’s one move: create, update (done_at moved), delete, or nothing; delta_minutes rounded', () => {
  const t = new Date('2026-10-13T00:12:00.000Z');
  assert.deepEqual(completionMove({ done: true, completedAt: t }, null), { kind: 'create', completedAt: t });
  assert.deepEqual(completionMove({ done: true, completedAt: t }, { completedAt: new Date(t) }), { kind: 'none' });
  assert.deepEqual(completionMove({ done: true, completedAt: t }, { completedAt: new Date(AT) }), { kind: 'update', completedAt: t });
  assert.deepEqual(completionMove({ done: false }, { completedAt: t }), { kind: 'delete' });
  assert.deepEqual(completionMove({ done: false }, null), { kind: 'none' });
  assert.equal(deltaMinutes(t, new Date(AT)), 12);
  assert.ok(deltaMinutes(new Date('2026-10-12T23:59:31.000Z'), new Date(AT)) === 0, '−29 s rounds to 0 (Math.round gives −0, which is 0)');
  assert.equal(deltaMinutes(new Date('2026-10-12T23:30:00.000Z'), new Date(AT)), -30, 'early is negative');
  assert.doesNotMatch(code(DONE_RULE), /\bfetch\s*\(|prisma|Date\.now|new Date\(\)/, 'pure: no client, no request, no clock');
});

// ── T2 · THE ONE WRITER, DRIVEN OVER A FAKE TRANSACTION ─────────────────────

type Call = { readonly op: string; readonly args: Record<string, unknown> };
interface Completion { id: string; routine_id: string; user_id: string; expected_at: Date; completed_at: Date; delta_minutes: number; notes: string | null; created_at: Date }

const USER = 'u-alex';
function fakeTx(opts: { lines?: string[]; records?: StopRecordDbRow[]; completions?: Completion[]; rrule?: string; streak?: number; lockRows?: number }) {
  const calls: Call[] = [];
  const completions = [...(opts.completions ?? [])];
  // A UTC routine at 00:00 — AT is its occurrence. UTC so the next occurrence is exact: expandForward compares a real
  // instant with rrule's floating times (rruleHelpers.ts:218), which is off by the zone's offset elsewhere — a defect
  // that predates this PR, shared by the evaluator, and reported with it rather than pinned here.
  const routine = { id: ROUTINE, name: 'Gym', role: 'execute', schedule_rrule: opts.rrule ?? 'FREQ=DAILY;BYHOUR=0;BYMINUTE=0', timezone: 'UTC', start_date: null, consecutive_completion_streak: opts.streak ?? 3 };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { calls.push({ op: '$queryRaw', args: { sql: strings.join('?'), values } }); return Array.from({ length: opts.lockRows ?? 1 }, () => ({ id: ROUTINE })); },
    operations_routines: {
      findFirst: async (args: Record<string, unknown>) => { calls.push({ op: 'routines.findFirst', args }); return routine; },
      update: async (args: Record<string, unknown>) => { calls.push({ op: 'routines.update', args }); return routine; },
    },
    operations_routine_steps: {
      findMany: async (args: Record<string, unknown>) => { calls.push({ op: 'steps.findMany', args }); return (opts.lines ?? []).map((id) => ({ id })); },
    },
    operations_stop_records: {
      findMany: async (args: Record<string, unknown>) => { calls.push({ op: 'records.findMany', args }); return opts.records ?? []; },
    },
    operations_routine_completions: {
      findFirst: async (args: { where: { expected_at?: Date } }) => {
        calls.push({ op: 'completions.findFirst', args });
        if (args.where.expected_at !== undefined) {
          const found = completions.find((c) => c.expected_at.getTime() === args.where.expected_at!.getTime());
          return found === undefined ? null : { ...found };
        }
        const latest = [...completions].sort((a, b) => b.completed_at.getTime() - a.completed_at.getTime())[0];
        return latest === undefined ? null : { completed_at: latest.completed_at };
      },
      create: async (args: { data: Omit<Completion, 'id' | 'created_at'> }) => {
        calls.push({ op: 'completions.create', args });
        const row = { id: 'c-new', created_at: new Date('2026-10-13T00:30:00.000Z'), ...args.data };
        completions.push(row);
        return row;
      },
      update: async (args: { where: { id: string }; data: Partial<Completion> }) => {
        calls.push({ op: 'completions.update', args });
        const row = completions.find((c) => c.id === args.where.id)!;
        Object.assign(row, args.data);
        return { ...row };
      },
      delete: async (args: { where: { id: string } }) => {
        calls.push({ op: 'completions.delete', args });
        const i = completions.findIndex((c) => c.id === args.where.id);
        return completions.splice(i, 1)[0];
      },
    },
  };
  return { tx: tx as never, calls, completions };
}
const record = (over: Partial<StopRecordDbRow>): StopRecordDbRow => ({ id: 'rec-1', routine_id: ROUTINE, step_id: null, occurrence_at: new Date(AT), outcome: 'done', done_at: new Date('2026-10-13T00:12:00.000Z'), actual_cents: null, rating: null, note: null, actual_minutes: null, ...over });
const completion = (over: Partial<Completion> = {}): Completion => ({ id: 'c-old', routine_id: ROUTINE, user_id: USER, expected_at: new Date(AT), completed_at: new Date('2026-10-13T00:12:00.000Z'), delta_minutes: 12, notes: null, created_at: new Date(AT), ...over });
const NOW = new Date('2026-10-15T05:00:00.000Z'); // two days on — so "from completed_at" and "from now" answer differently
const sync = (tx: never) => syncCompletion(tx, { userId: USER, routineId: ROUTINE, expectedAt: new Date(AT), now: NOW });
const writesOf = (calls: Call[]) => calls.filter((c) => /\.(create|update|delete)$/.test(c.op));

test('T2 create: a stepless routine recorded done — the completions POST’s row and routine update, exactly', async () => {
  const { tx, calls } = fakeTx({ records: [record({})], streak: 3 });
  const change = await sync(tx);
  assert.equal(change?.kind, 'created');
  assert.equal(change?.before, null);
  const writes = writesOf(calls);
  assert.deepEqual(writes.map((c) => c.op), ['completions.create', 'routines.update']);
  assert.deepEqual(writes[0].args, { data: { routine_id: ROUTINE, user_id: USER, expected_at: new Date(AT), completed_at: new Date('2026-10-13T00:12:00.000Z'), delta_minutes: 12, notes: null } });
  assert.deepEqual(writes[1].args, {
    where: { id: ROUTINE, user_id: USER },
    data: { last_completed_at: new Date('2026-10-13T00:12:00.000Z'), next_due_at: new Date('2026-10-14T00:00:00.000Z'), consecutive_completion_streak: 4, consecutive_miss_streak: 0 },
  }, 'last_completed_at = completed_at; next_due_at the next occurrence from completed_at (not now); streak + 1; miss streak → 0');
});

test('T2 delete: the record skipped or cleared — the completion goes; the routine un-completed as Alex ruled', async () => {
  for (const records of [[record({ outcome: 'skipped', done_at: null })], []]) {
    const earlier = completion({ id: 'c-earlier', expected_at: new Date('2026-10-12T00:00:00.000Z'), completed_at: new Date('2026-10-12T00:03:00.000Z') });
    const { tx, calls, completions } = fakeTx({ records, completions: [earlier, completion()], streak: 4 });
    const change = await sync(tx);
    assert.equal(change?.kind, 'deleted');
    assert.equal(change?.after, null);
    assert.equal(change?.before?.id, 'c-old');
    const writes = writesOf(calls);
    assert.deepEqual(writes.map((c) => c.op), ['completions.delete', 'routines.update']);
    assert.deepEqual(writes[0].args, { where: { id: 'c-old', user_id: USER } });
    assert.deepEqual(writes[1].args, {
      where: { id: ROUTINE, user_id: USER },
      data: { last_completed_at: new Date('2026-10-12T00:03:00.000Z'), next_due_at: new Date('2026-10-16T00:00:00.000Z'), consecutive_completion_streak: 3 },
    }, 'the latest remaining completion; the next occurrence at or after now; streak − 1; the miss streak NOT written');
    assert.deepEqual(completions.map((c) => c.id), ['c-earlier']);
  }
  // No completion remains → last_completed_at null; the streak never goes below 0.
  const { tx, calls } = fakeTx({ records: [], completions: [completion()], streak: 0 });
  await sync(tx);
  assert.deepEqual((writesOf(calls)[1].args as { data: unknown }).data, { last_completed_at: null, next_due_at: new Date('2026-10-16T00:00:00.000Z'), consecutive_completion_streak: 0 });
});

test('T2 update: still done, done_at moved — completed_at, delta_minutes and last_completed_at follow; nothing else', async () => {
  const { tx, calls } = fakeTx({ records: [record({ done_at: new Date('2026-10-13T00:40:00.000Z') })], completions: [completion()] });
  const change = await sync(tx);
  assert.equal(change?.kind, 'updated');
  assert.equal(change?.before?.completed_at.toISOString(), '2026-10-13T00:12:00.000Z');
  const writes = writesOf(calls);
  assert.deepEqual(writes.map((c) => c.op), ['completions.update', 'routines.update']);
  assert.deepEqual(writes[0].args, { where: { id: 'c-old', user_id: USER }, data: { completed_at: new Date('2026-10-13T00:40:00.000Z'), delta_minutes: 40 } });
  assert.deepEqual(writes[1].args, { where: { id: ROUTINE, user_id: USER }, data: { last_completed_at: new Date('2026-10-13T00:40:00.000Z') } }, 'no streak and no next_due change');
});

test('T2 lines: one of two done → nothing; both done → created at the later done_at; nothing changed → no write at all', async () => {
  const line = (id: string, step: string, done: string) => record({ id, routine_id: null, step_id: step, done_at: new Date(done) });
  const one = fakeTx({ lines: ['l-stretch', 'l-coffee'], records: [line('a', 'l-stretch', '2026-10-13T00:05:00.000Z')] });
  assert.equal(await sync(one.tx), null);
  assert.deepEqual(writesOf(one.calls), []);
  const both = fakeTx({ lines: ['l-stretch', 'l-coffee'], records: [line('a', 'l-stretch', '2026-10-13T00:05:00.000Z'), line('b', 'l-coffee', '2026-10-13T00:20:00.000Z')] });
  const change = await sync(both.tx);
  assert.equal(change?.kind, 'created');
  assert.equal((writesOf(both.calls)[0].args as { data: { completed_at: Date } }).data.completed_at.toISOString(), '2026-10-13T00:20:00.000Z');
  const same = fakeTx({ records: [record({})], completions: [completion()] });
  assert.equal(await sync(same.tx), null);
  assert.deepEqual(writesOf(same.calls), []);
});

test('T2 every read is the caller’s: the routine, its ACTIVE lines, the records at the occurrence, the completion', async () => {
  const { tx, calls } = fakeTx({ lines: ['l-stretch'], records: [], completions: [completion()] });
  await sync(tx);
  const by = (op: string) => calls.find((c) => c.op === op)!.args as { where: Record<string, unknown> };
  assert.deepEqual(by('routines.findFirst').where, { id: ROUTINE, user_id: USER });
  assert.deepEqual(by('steps.findMany').where, { routine_id: ROUTINE, user_id: USER, is_active: true });
  assert.deepEqual(by('records.findMany').where, { user_id: USER, occurrence_at: new Date(AT), OR: [{ routine_id: ROUTINE }, { step_id: { in: ['l-stretch'] } }] });
  assert.deepEqual(by('completions.findFirst').where, { routine_id: ROUTINE, user_id: USER, expected_at: new Date(AT) });
  for (const c of calls.filter((x) => x.op.endsWith('.findFirst') || x.op.endsWith('.findMany'))) {
    assert.equal((c.args as { where: { user_id?: string } }).where.user_id, USER, `${c.op} is scoped to the caller`);
  }
});

test('T2 no fallback: a schedule that cannot be read throws, so the transaction rolls back — never next_due_at = null', async () => {
  const { tx, calls } = fakeTx({ records: [record({})], rrule: 'NOT A RULE' });
  await assert.rejects(sync(tx), /Unknown RRULE property/);
  assert.deepEqual(writesOf(calls).map((c) => c.op), ['completions.create'], 'the throw comes before the routine update — the route’s transaction undoes the create');
  // ROUTINE-02a (2026-10-18): a Schedule carries its end_date too (none here).
  assert.throws(() => nextDueAfter({ schedule_rrule: 'FREQ=DAILY', timezone: 'Not/AZone', start_date: null, end_date: null }, NOW), /Invalid time zone/);
  // A schedule with no occurrence left is not a failure: it has none (a one-off after its day).
  assert.equal(nextDueAfter({ schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=7;BYMINUTE=0', timezone: 'Asia/Bangkok', start_date: new Date('2026-10-13T00:00:00.000Z'), end_date: null }, new Date('2026-10-14T00:10:00.000Z')), null);
  const w = code(WRITER);
  assert.doesNotMatch(w, /\bcatch\b|\?\? null\b/, 'the writer catches nothing and stands nothing in');
  assert.match(comments(WRITER), /No fallback \(Alex, 2026-10-14\)/);
});

test('T2 the lock: the routine row held FOR NO KEY UPDATE, scoped to the caller; a row that is not theirs throws', async () => {
  const held = fakeTx({});
  await lockRoutine(held.tx, ROUTINE, USER);
  assert.deepEqual(held.calls[0].args, { sql: 'SELECT id FROM operations_routines WHERE id = ?::uuid AND user_id = ? FOR NO KEY UPDATE', values: [ROUTINE, USER] });
  await assert.rejects(lockRoutine(fakeTx({ lockRows: 0 }).tx, ROUTINE, USER), /is not the caller's/);
});

test('T2 the miss streak is left as it is on un-complete, and the comment says why', () => {
  assert.match(comments(WRITER), /consecutive_miss_streak is left as it is: creating this completion zeroed it, and the value it held\s*\n\s*\/\/ before is stored nowhere, so it cannot be restored/);
  const del = code(WRITER).slice(code(WRITER).indexOf("if (move.kind === 'delete'"));
  assert.doesNotMatch(del.slice(0, del.indexOf('return {')), /consecutive_miss_streak/);
});

// ── T3 · THE STOPS ROUTES KEEP THE COMPLETION IN STEP ───────────────────────

test('T3 POST: the record and the completion in ONE transaction, the routine held first; each audited after it commits', () => {
  const post = code(STOPS).slice(code(STOPS).indexOf('export async function POST('));
  const steps = [
    'written = await prisma.$transaction(async (tx) => {', 'await lockRoutine(tx, routine.id, user.id);',
    'tx.operations_stop_records.findFirst(', 'tx.operations_stop_records.update(', 'tx.operations_stop_records.create(',
    'const change = await syncCompletion(tx, { userId: user.id, routineId: routine.id, expectedAt: v.instant, now });',
    'return { before, after, change };', '});',
    "type: 'operations_stop_set'", 'if (change !== null) await auditCompletionChange(change, { user_id: user.id, email: userEmail });',
  ];
  let at = -1;
  for (const s of steps) { const i = post.indexOf(s, at + 1); assert.ok(i > at, `POST: ${s} (at ${i}, after ${at})`); at = i; }
  const inTx = post.slice(post.indexOf('prisma.$transaction('), post.indexOf("if ('unchanged' in written)"));
  assert.doesNotMatch(inTx, /prisma\.operations_/, 'inside the transaction every write is tx.');
  assert.doesNotMatch(inTx, /writeAuditLog|auditCompletionChange/, 'no audit inside — writeAuditLog runs its own transaction');
});

test('T3 DELETE: the owned row, its occurrence’s routine, the clear and the completion in ONE transaction; each audited after', () => {
  const del = code(STOPS_ID);
  const steps = [
    'prisma.operations_stop_records.findFirst({ where: { id, user_id: user.id }, include: { step: { select: { routine_id: true } } } })',
    'const routineId = row.step !== null ? row.step.routine_id : row.routine_id;', 'if (routineId === null) throw',
    'const change = await prisma.$transaction(async (tx) => {', 'await lockRoutine(tx, routineId, user.id);',
    'await tx.operations_stop_records.delete({ where: { id: row.id } });',
    'return syncCompletion(tx, { userId: user.id, routineId, expectedAt: row.occurrence_at, now: new Date() });',
    "type: 'operations_stop_cleared'", 'if (change !== null) await auditCompletionChange(change, { user_id: user.id, email: userEmail });',
  ];
  let at = -1;
  for (const s of steps) { const i = del.indexOf(s, at + 1); assert.ok(i > at, `DELETE: ${s} (at ${i}, after ${at})`); at = i; }
  assert.doesNotMatch(del, /\$queryRaw|\$executeRaw/, 'the route holds no raw SQL — the lock is the writer’s');
});

test('T3 each change audited by its own type, before → after, with the routine and the occurrence', () => {
  const w = code(WRITER);
  assert.match(w, /type: change\.kind === 'created' \? 'operations_routine_completed' : change\.kind === 'updated' \? 'operations_routine_completion_updated' : 'operations_routine_uncompleted',/);
  assert.match(w, /target: \{ table: 'operations_routine_completions', id: completion\.id \},/);
  assert.match(w, /before: change\.before,\s*after: change\.after,/);
  assert.match(w, /routine_id: change\.routine\.id,\s*routine_name: change\.routine\.name,\s*expected_at: change\.expectedAt\.toISOString\(\),/);
  assert.match(code(STOPS), /import \{ auditCompletionChange, lockRoutine, syncCompletion, type CompletionChange \} from '@\/lib\/operations\/routineCompletion';/);
  // RETRO-01 (2026-10-16): the [id] route's PATCH collects the two changes of a move (its type imported with them).
  assert.match(code(STOPS_ID), /import \{ auditCompletionChange, lockRoutine, syncCompletion, type CompletionChange \} from '@\/lib\/operations\/routineCompletion';/);
  // One writer: no other file creates, moves or deletes a completion, or writes the completion streak.
  const writers = walk('src').filter((f) => /operations_routine_completions\.(create|update|delete|upsert)/.test(code(f)));
  assert.deepEqual(writers, [WRITER]);
  assert.match(comments(STOPS), /NOT backfilled|not backfilled|No backfill|no backfill/i);
});

// ── T4 · THE EVALUATOR SKIPS ALL-DAY ROUTINES ───────────────────────────────

test('T4 the evaluator: all_day takes no miss check — no miss row, no streak change; last_evaluated_at and next_due_at still move', () => {
  const e = code(EVALUATOR);
  assert.match(e, /import \{ isStop, isStopRole \} from '@\/lib\/operations\/stopRole';/);
  assert.match(e, /consecutive_miss_streak: true,\s*role: true,/, 'the role is read');
  assert.match(e, /if \(!isStopRole\(r\.role\)\) throw new Error\(/, 'a role outside the six is named, into the routine’s own catch');
  // ROUTINE-02a (2026-10-18): the window is the pure evaluateWindow — the misses, the expected, the next (routine02a T2).
  assert.match(e, /const misses = !isStop\(r\.role\) \? \[\] : expected\.filter\(/);
  // The miss row and the streak are written only per eligible miss; the cursor update is unconditional.
  assert.ok(e.indexOf("type: 'operations_routine_missed'") > e.indexOf('for (const expectedAt of window.misses)'));
  assert.match(e, /data: \{\n\s*last_evaluated_at: now,\n\s*next_due_at: window\.nextDueAt,\n\s*\.\.\.\(routineMissCount > 0/);
  assert.match(comments(EVALUATOR), /An all-day routine \(role all_day — a subscription, a membership\) is a CHARGE,/);
});

// ── T5 · /tasks MOUNTS EXACTLY THE THREE; THE REMOVED ARE GONE ──────────────

// LEDGER-01 (Alex, 2026-10-16): the three became four — the city ledger mounts LAST, under Routines. Every pin below moved to
// four; the three that TASKS-ONE-02 removed are still gone, and the law still holds the container to exactly its list.
// TIME-01 (Alex, 2026-10-19): the day card and the ledger moved to /time — /tasks is exactly Projects and Routines; the three
// that TASKS-ONE-02 removed are still gone, and the law still holds the container to exactly its list (time01.test.ts).
test('T5 /tasks mounts exactly Projects and Routines — and the law says so with the dated rulings', () => {
  const page = code(PAGE);
  const box = page.slice(page.indexOf('data-tool-page="Tasks"'), page.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...box.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['SectionD_ProjectBacklog', 'SectionE_Routines']);
  assert.doesNotMatch(page, /WeekSection|SectionC_DailyPlan|TodaysStrip/);
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionD_ProjectBacklog \/>', '<SectionE_Routines \/>'\];/);
  assert.match(comments(LAW), /TASKS-ONE-02 — the ruling \(Alex, 2026-10-14\): the day card replaces the week grid, the Daily plan and the\s*\n\s*\/\/ Today strip\./);
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionD_ProjectBacklog SectionE_Routines'/, 'the law holds the container to exactly two');
});

test('T5 the routines section drops Today — on /tasks and in the cockpit that mounts it', () => {
  const e = code(SECTION_E);
  assert.doesNotMatch(e, /TodaysStrip/);
  assert.match(e, /<RoutineList entities=\{entities\} \/>/);
  assert.match(code(LAUNCHER), /<SectionE_Routines \/>/, 'the cockpit mounts the same section — Today is gone there too');
  assert.doesNotMatch(code(LAUNCHER), /TodaysStrip/);
});

test('T5 the deleted files and both completions routes are gone, and nothing imports or calls them', () => {
  for (const f of DELETED) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is deleted`);
  for (const f of [...walk('src'), ...walk('scripts')]) {
    const body = code(f);
    assert.doesNotMatch(body, /\/(WeekSection|WeekCell|weekPlan|SectionC_DailyPlan|DailyPlanItemRow|DailyPlanRoutineRow|TodaysStrip|completeRoutine|completionNote)'/, `${f} imports a deleted file`);
    assert.doesNotMatch(body, /\/completions(`|'|\/\$\{)/, `${f} calls a completions route`);
  }
  // What stays: the week's reads (the day card reads through them) and the Daily plan's types.
  for (const f of ['src/components/workbench/operations/week/weekReads.ts', 'src/components/workbench/operations/dailyplan/types.ts']) assert.ok(existsSync(resolve(process.cwd(), f)), `${f} stays`);
});

test('T5 the laws moved with the code: lines readers, one-off callers, streak writers, the mark-done control', () => {
  const law = code(LAW);
  const list = (name: string) => law.slice(law.indexOf(`const ${name} = [`), law.indexOf('];', law.indexOf(`const ${name} = [`)));
  assert.doesNotMatch(list('LINES_READERS'), /TodaysStrip|WeekSection/);
  assert.match(list('ONEOFF_CALLERS'), /'src\/lib\/operations\/routineCompletion\.ts'/);
  assert.doesNotMatch(list('ONEOFF_CALLERS'), /completions/);
  assert.match(list('STREAK_WRITERS'), /'src\/lib\/operations\/routineCompletion\.ts',\s*'src\/inngest\/functions\/routine-evaluator\.ts',/);
  assert.match(law, /\['src\/components\/workbench\/operations\/stops\/StopForm\.tsx', \/data-stop-done-now\[\\s\\S\]\*✓ done now\//);
  assert.doesNotMatch(law, /'src\/components\/workbench\/operations\/routines\/TodaysStrip\.tsx'/);
});

// ── T6 · THE MIGRATION, THE ENUM AND THE AUDIT LOG ──────────────────────────

test('T6 the migration: two ADD VALUE IF NOT EXISTS lines and nothing else; the newest; no backfill', () => {
  const sql = code(MIGRATION).trim();
  assert.equal(sql, `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_uncompleted';\nALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_completion_updated';`);
  assert.match(comments(MIGRATION), /Neither value is used in this migration/);
  assert.match(comments(MIGRATION), /NO BACKFILL, no row written/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // RETRO-01 (Alex, 2026-10-16): the stop-moved audit type's migration is newer still — every index moved one; the order holds.
  // ROUTINE-02b (2026-10-18): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 7], MIGRATION_DIR, 'the migration two before the newest (RETRO-01, ROUTINE-02b followed)');
  assert.equal(dirs[dirs.length - 6], '20261016120000_retro_01_stop_moved_audit_type', 'the migration before the newest (ROUTINE-02b followed)');
  // MOVE-01 (2026-10-19): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 5], '20261018120000_routine_02b_rekeyed_audit_type', 'the migration before the newest (MOVE-01 followed)');
  // JOURNAL-04 (2026-10-19): the evening answers' migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 4], '20261019090000_move_01_moved_audit_type', 'the migration before the newest (JOURNAL-04 followed)');
  assert.equal(dirs[dirs.length - 3], '20261019210000_journal_04_evening_answers', 'the migration before the newest (LEDGER-03 followed)');
  // LEDGER-03 (Alex, 2026-10-19): two audit values for the planned-item link — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 2], '20261019230000_ledger_03_planned_item_link_audit', 'the migration before the newest (BACKLOG-01 followed)');
  // BACKLOG-01 (Alex, 2026-10-20): the capture's columns and the four statuses — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261020120000_backlog_01_capture', 'the newest migration');
  assert.equal(dirs[dirs.length - 8], '20261013200000_journal_02_the_simple_journal');
});

test('T6 the schema’s enum ends with the two, the client knows them, the audit log lists them under operations_', () => {
  const values = /enum AuditActionType \{([\s\S]*?)\}/.exec(code(SCHEMA))![1].split(/\s+/).filter(Boolean);
  // RETRO-01 (2026-10-16): one more follows — "the two before the last one".
  // ROUTINE-02b (2026-10-18): one more value follows in ALTER TYPE order (operations_routine_rekeyed) — the pin moved by one.
  // MOVE-01 (2026-10-19): one more value follows (operations_routines_moved) — the tail moved by one.
  // LEDGER-03 (Alex, 2026-10-19): planned_item_linked and planned_item_unlinked were appended after MOVE-01's value — every position below moved by two.
  assert.deepEqual(values.slice(-7, -5), ['operations_routine_uncompleted', 'operations_routine_completion_updated']);
  assert.equal(values.filter((v) => v === 'operations_routine_completed').length, 1, 'creation keeps the POST’s type');
  assert.equal(AuditActionType.operations_routine_uncompleted, 'operations_routine_uncompleted', 'prisma generate ran');
  assert.equal(AuditActionType.operations_routine_completion_updated, 'operations_routine_completion_updated');
  const ops = code(AUDIT_LOG).slice(code(AUDIT_LOG).indexOf('operations_: ['));
  // RETRO-01 (2026-10-16): the stop-moved type follows them in the list.
  // ROUTINE-02b (2026-10-18): the rekeyed type follows the stop-moved type in the list.
  // MOVE-01 (2026-10-19): the moved type follows the rekeyed type in the list.
  assert.match(ops.slice(0, ops.indexOf('],')), /'operations_journal_cleared',\s*'operations_routine_uncompleted',\s*'operations_routine_completion_updated',\s*'operations_stop_moved',\s*'operations_routine_rekeyed',\s*'operations_routines_moved',\s*$/);
});
