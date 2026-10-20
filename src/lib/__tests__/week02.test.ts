/**
 * WEEK-02 (2026-09-30) — THIS WEEK FOR THE VIDEO: Time is its own column and
 * filters the rows (from–to, both ends included, nothing hidden silently), and a
 * done's note can be edited through the one writer and an owned, audited PATCH.
 *
 * The filter and the note rule are pure and DRIVEN over fixtures; the writer's
 * edit is driven over a stubbed fetch; the route, the table and the cell are
 * anchored to their source with comments stripped (TEST-TRUTH-01); the route's
 * writes are judged by the SEC-02 ownership reader itself.
 *
 * TASKS-ONE-02 (2026-10-14) — Alex's ruling: the day card replaces the week grid.
 * The week's Time column and filter (weekPlan filterByStart / filterWindow /
 * hiddenLine, WeekSection, WeekCell), the note rule (completionNote.ts), the
 * writer's edit (completeRoutine.ts editCompletionNote) and the note PATCH
 * (completions/[completionId]/route.ts) are DELETED — the PATCH's one caller was
 * the week's cell, and a write route with no caller is attack surface. T1–T6
 * pinned that code and went with it; T0 pins that it is gone and that nothing
 * imports it. T7 stays: the migration is applied history, and the enum value and
 * its audit-log entry stay so the rows written before still read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';

const RULES = 'src/components/workbench/operations/week/weekPlan.ts';
const WEEK = 'src/components/workbench/operations/week/WeekSection.tsx';
const CELL = 'src/components/workbench/operations/week/WeekCell.tsx';
const WRITER = 'src/components/workbench/operations/routines/completeRoutine.ts';
const NOTE_RULE = 'src/lib/operations/completionNote.ts';
const POST = 'src/app/api/operations/routines/[id]/completions/route.ts';
const PATCH = 'src/app/api/operations/routines/[id]/completions/[completionId]/route.ts';
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20260930210000_week_02_completion_note_edited';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;

// ── T0 · TASKS-ONE-02: THE FILTER, THE NOTE RULE, THE WRITER AND THE PATCH ARE GONE ──

test('T0 the week, the note rule, the writer and both completions routes are deleted — and no file names them', () => {
  for (const f of [RULES, WEEK, CELL, WRITER, NOTE_RULE, POST, PATCH]) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is deleted`);
  assert.ok(!existsSync(resolve(process.cwd(), 'src/app/api/operations/routines/[id]/completions')), 'the completions directory is gone with its routes');
  const walk = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  for (const f of [...walk('src'), ...walk('scripts')]) {
    assert.doesNotMatch(code(f), /operations\/completionNote'|\/completeRoutine'|\/weekPlan'|editCompletionNote|filterByStart|filterWindow/, `${f} imports or calls deleted code`);
  }
});

// ── T7 · THE ENUM AND THE MIGRATION ─────────────────────────────────────────

test('T7 the migration: the one ADD VALUE line and nothing else, after the last applied one', () => {
  assert.equal(code(MIGRATION).trim(), `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_completion_note_edited';`);
  assert.equal(comments(MIGRATION).trim(), '', 'not even a comment');
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.ok(MIGRATION_DIR.slice(0, 14) > '20260929190000');
  // STAY-01 (2026-10-12): the stays migration is newer — this one is the one before it. STOP-01 (2026-10-12): the stop records
  // migration is newer still. The pin moved twice; the order holds.
  // ROLE-01 (2026-10-13) followed too; JOURNAL-01 (2026-10-13) after it.
  // JOURNAL-02 (2026-10-13): the simple journal's migration is newer still — every index moved one; the order holds.
  // TASKS-ONE-02 (2026-10-14): the completion audit types' migration is newer still — every index moved one; the order holds.
  // RETRO-01 (Alex, 2026-10-16): the stop-moved audit type's migration is newer still — every index moved one; the order holds.
  // ROUTINE-02b (2026-10-18): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 16], MIGRATION_DIR, 'the migration eight before the newest (STAY-01, STOP-01, ROLE-01, JOURNAL-01, JOURNAL-02, TASKS-ONE-02, then RETRO-01, ROUTINE-02b followed)');
  assert.equal(dirs[dirs.length - 15], '20261012090000_stay_01_operations_stays');
  assert.equal(dirs[dirs.length - 14], '20261012140000_stop_01_operations_stop_records');
  assert.equal(dirs[dirs.length - 13], '20261013030000_role_01_routine_role');
  assert.equal(dirs[dirs.length - 12], '20261013120000_journal_01_day_journals');
  assert.equal(dirs[dirs.length - 11], '20261013200000_journal_02_the_simple_journal');
  assert.equal(dirs[dirs.length - 10], '20261014090000_tasks_one_02_completion_audit_types');
  assert.equal(dirs[dirs.length - 9], '20261016120000_retro_01_stop_moved_audit_type', 'the migration before the newest (ROUTINE-02b followed)');
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
});

test('T7 the schema’s enum holds the value, last; the client knows it; the audit log lists it under operations_', () => {
  const schema = code(SCHEMA);
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum[1].split(/\s+/).filter(Boolean);
  // STAY-01 (2026-10-12): two values follow it in ALTER TYPE order; STOP-01 (2026-10-12): two more; JOURNAL-01 (2026-10-13): two more — the pin moved from "last" to "seventh from last".
  // TASKS-ONE-02 (2026-10-14): two more — "ninth from last". The value STAYS though its PATCH is deleted: the rows it wrote still read.
  // RETRO-01 (2026-10-16): one more follows — the nine before the last one. ROUTINE-02b (2026-10-18): one more — the nine before the last two.
  // MOVE-01 (2026-10-19): one more value follows (operations_routines_moved) — the tail moved by one.
  // LEDGER-03 (Alex, 2026-10-19): planned_item_linked and planned_item_unlinked were appended after MOVE-01's value — every position below moved by two.
  assert.deepEqual(values.slice(-14, -5), ['operations_routine_completion_note_edited', 'operations_stay_set', 'operations_stay_deleted', 'operations_stop_set', 'operations_stop_cleared', 'operations_journal_set', 'operations_journal_cleared', 'operations_routine_uncompleted', 'operations_routine_completion_updated']);
  assert.equal(values.filter((v) => v === 'operations_routine_completion_note_edited').length, 1);
  assert.equal(AuditActionType.operations_routine_completion_note_edited, 'operations_routine_completion_note_edited', 'prisma generate ran');
  // ROUTINE-02b (2026-10-18): the rekeyed type follows the stop-moved type in the list.
  // MOVE-01 (2026-10-19): the moved type follows the rekeyed type in the list.
  assert.match(code(AUDIT_LOG), /'operations_plan_vendor_cleared',\s*'operations_routine_completion_note_edited',\s*'operations_stay_set',\s*'operations_stay_deleted',\s*'operations_stop_set',\s*'operations_stop_cleared',\s*'operations_journal_set',\s*'operations_journal_cleared',\s*'operations_routine_uncompleted',\s*'operations_routine_completion_updated',\s*'operations_stop_moved',\s*'operations_routine_rekeyed',\s*'operations_routines_moved',\s*\],/);
});
