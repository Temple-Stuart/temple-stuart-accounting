/**
 * ARCHIVE-01 (Alex, 2026-10-25/27) — unarchive restores exactly what the cascade archived, provably.
 *
 *   A. The archive cascade (projects/[id]/route.ts PATCH → archived) writes one operations_task_status_history row per
 *      cascaded task — previous_status the status it had, new_status 'archived', reason 'project archived', changed_by the
 *      actor — in the same transaction as the task's update, as it has since the cascade was built (recordTaskStatusChange).
 *      Nothing there changed; the audit entry still carries cascade_archived_task_ids.
 *   B. The row's "unarchive" (archived → not_started) restores, in the same transaction, exactly the tasks the LATEST cascade
 *      archived: the ids from that cascade's audit entry (ONE SOURCE — the project's latest operations_project_status_changed
 *      entry with status_to 'archived'), each still archived by it, to its previous_status from its cascade history row;
 *      a history row each (reason 'project unarchived — cascade restored'); the audit entry carries cascade_restored_task_ids
 *      and cascade_left_archived_task_ids. A task archived on its own, or by an earlier cascade, stays and is listed. No
 *      cascade on record → nothing restored, said in the entry and in the response's words.
 *   C. The task PATCH, the per-task unarchive and every read are unchanged. No schema, no route, no migration.
 *
 * The rule and the words are pure (src/lib/operations/archiveCascade.ts) and driven here; the route is read through code().
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  CASCADE_ARCHIVE_REASON, CASCADE_RESTORE_REASON, LEFT_ARCHIVED_WHYS, NO_CASCADE_ON_RECORD,
  cascadeIdsOf, isCascadeRow, restorePlanOf, unarchiveWords, type ArchivedTaskFacts,
} from '../operations/archiveCascade';
import { unarchivedLineOf } from '../operations/projectsTable';

const ROUTE = 'src/app/api/operations/projects/[id]/route.ts';
const TASK_ROUTE = 'src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts';
const HISTORY_ROUTE = 'src/app/api/operations/projects/[id]/tasks/[taskId]/history/route.ts';
const UNCOMPLETE_ROUTE = 'src/app/api/operations/projects/[id]/tasks/[taskId]/uncomplete/route.ts';
const RECORD = 'src/lib/operations/recordTaskStatusChange.ts';
const RULE = 'src/lib/operations/archiveCascade.ts';
const ROW = 'src/components/workbench/operations/projects/ProjectRow.tsx';
const VIEW = 'src/components/workbench/operations/projects/ProjectRowView.tsx';
const TASK_ACTIONS = 'src/components/workbench/operations/projects/useTaskActions.ts';
const TABLE_ROWS = 'src/components/workbench/operations/projects/ProjectTableRows.tsx';
const TABLE = 'src/components/workbench/operations/projects/ProjectsTable.tsx';

const cascadeRow = (previous_status: 'open' | 'in_progress' | 'blocked' | null) => ({ new_status: 'archived' as const, previous_status, reason: CASCADE_ARCHIVE_REASON });
const handRow = { new_status: 'archived' as const, previous_status: 'open' as const, reason: null };

// ── A · THE CASCADE WRITES THE HISTORY ────────────────────────────────────────

test('A the cascade writes each task\'s history row in its transaction — previous_status the status it had, new_status archived, reason "project archived", changed_by the actor — before the task\'s update; nothing there changed', () => {
  const r = code(ROUTE);
  assert.equal(CASCADE_ARCHIVE_REASON, 'project archived');
  const txAt = r.indexOf('await prisma.$transaction(async (tx) => {');
  const archivingAt = r.indexOf('if (isArchiving) {', txAt);
  const historyAt = r.indexOf("await recordTaskStatusChange(tx, t.id, user.id, t.status, 'archived', userEmail, CASCADE_ARCHIVE_REASON);", archivingAt);
  const updateAt = r.indexOf("data: { status: 'archived' },", historyAt);
  const txEndAt = r.indexOf('return { updated, cascadeRestore: restoreInTx };', txAt);
  assert.ok(txAt > -1 && archivingAt > txAt && historyAt > archivingAt && updateAt > historyAt && txEndAt > updateAt, 'the history row, then the task, inside the one transaction');
  assert.match(r, /const activeTasks = await tx\.operations_project_tasks\.findMany\(\{\n\s*where: \{ project_id: id, status: \{ in: \[\.\.\.ARCHIVABLE_TASK_STATUSES\] \} \},\n\s*select: \{ id: true, status: true \},/);
  assert.match(r, /const ARCHIVABLE_TASK_STATUSES = \['open', 'in_progress', 'blocked'\] as const;/);
  assert.match(r, /for \(const t of activeTasks\) \{/);
  // The history writer: previous_status, new_status, changed_by and reason land in operations_task_status_history, inside the caller's tx.
  const rec = code(RECORD);
  assert.match(rec, /await tx\.operations_task_status_history\.create\(\{\n\s*data: \{\n\s*task_id: taskId,\n\s*user_id: userId,\n\s*previous_status: previousStatus,\n\s*new_status: newStatus,\n\s*changed_by: changedBy,\n\s*reason: reason \?\? null,/);
  // The audit entry still carries the cascade's ids, as before.
  assert.match(r, /cascade_archived_task_ids: archivedTaskIds,\n\s*cascade_removed_future_item_count: removedItemCount,/);
  assert.match(comments(ROUTE), /ARCHIVE-01 \(ruling A\): this row — previous_status the status it had, new_status 'archived', reason\s*\n\s*\/\/ CASCADE_ARCHIVE_REASON \('project archived', the word written here since the cascade was built\)/);
});

// ── B · THE RULE ──────────────────────────────────────────────────────────────

test('B restorePlanOf: only the cascade\'s ids still archived by it restore, each to its cascade row\'s previous_status; a task archived on its own stays and is listed', () => {
  const archived: ArchivedTaskFacts[] = [
    { id: 'a', latest: cascadeRow('open') },
    { id: 'b', latest: cascadeRow('in_progress') },
    { id: 'c', latest: cascadeRow('blocked') },
    { id: 'hand', latest: handRow },
  ];
  const plan = restorePlanOf(['a', 'b', 'c'], archived);
  assert.deepEqual(plan.restore, [{ id: 'a', status: 'open' }, { id: 'b', status: 'in_progress' }, { id: 'c', status: 'blocked' }]);
  assert.deepEqual(plan.left, [{ id: 'hand', why: 'archived on its own' }]);
  assert.deepEqual(plan.noLongerArchived, []);
  assert.equal(unarchiveWords(plan, true), '3 tasks restored · 1 left archived (archived on its own)');
});

test('B a cascaded task unarchived by hand and archived again since is archived on its own — its latest row is not the cascade\'s; one no longer archived is neither restored nor left', () => {
  const plan = restorePlanOf(['a', 'b', 'gone'], [
    { id: 'a', latest: cascadeRow('open') },
    { id: 'b', latest: { new_status: 'archived', previous_status: 'open', reason: 'done with it' } },
  ]);
  assert.deepEqual(plan.restore, [{ id: 'a', status: 'open' }]);
  assert.deepEqual(plan.left, [{ id: 'b', why: 'archived on its own' }]);
  assert.deepEqual(plan.noLongerArchived, ['gone']);
  assert.equal(unarchiveWords(plan, true), '1 task restored · 1 left archived (archived on its own)');
});

test('B a second cascade after the first: only the latest\'s ids restore; a task the earlier cascade archived stays, listed as such', () => {
  // Cascade 1 archived x (never restored); the project was unarchived and later archived again: cascade 2 listed a and b only.
  const plan = restorePlanOf(['a', 'b'], [
    { id: 'x', latest: cascadeRow('open') },
    { id: 'a', latest: cascadeRow('in_progress') },
    { id: 'b', latest: cascadeRow('open') },
  ]);
  assert.deepEqual(plan.restore, [{ id: 'a', status: 'in_progress' }, { id: 'b', status: 'open' }]);
  assert.deepEqual(plan.left, [{ id: 'x', why: 'archived by an earlier cascade' }]);
  assert.equal(unarchiveWords(plan, true), '2 tasks restored · 1 left archived (archived by an earlier cascade)');
});

test('B no cascade on record: nothing restored, said in words; every archived task is left with its why', () => {
  const plan = restorePlanOf(null, [{ id: 'h', latest: handRow }, { id: 'c', latest: cascadeRow('open') }, { id: 'n', latest: null }]);
  assert.deepEqual(plan.restore, []);
  assert.deepEqual(plan.left, [{ id: 'h', why: 'archived on its own' }, { id: 'c', why: 'archived by a cascade not on record' }, { id: 'n', why: 'archived on its own' }]);
  assert.equal(NO_CASCADE_ON_RECORD, 'no cascade on record');
  assert.equal(unarchiveWords(plan, false), 'no cascade on record — nothing restored · 3 left archived (2 archived on its own · 1 archived by a cascade not on record)');
  assert.equal(unarchiveWords(restorePlanOf(null, []), false), 'no cascade on record — nothing restored');
  // A cascade on record that listed nothing (no active task at the time) — nothing to restore, said plainly.
  assert.equal(unarchiveWords(restorePlanOf([], []), true), 'nothing restored');
});

test('B never a guessed status: a cascade row with no previous_status, or a listed task with no history, is left and says so', () => {
  const plan = restorePlanOf(['a', 'b'], [{ id: 'a', latest: cascadeRow(null) }, { id: 'b', latest: null }]);
  assert.deepEqual(plan.restore, []);
  assert.deepEqual(plan.left, [{ id: 'a', why: 'no previous status on record' }, { id: 'b', why: 'no previous status on record' }]);
  assert.equal(unarchiveWords(plan, true), 'nothing restored · 2 left archived (no previous status on record)');
  assert.deepEqual([...LEFT_ARCHIVED_WHYS], ['archived on its own', 'archived by an earlier cascade', 'archived by a cascade not on record', 'no previous status on record']);
  assert.ok(isCascadeRow(cascadeRow('open')) && !isCascadeRow(handRow) && !isCascadeRow(null));
  assert.ok(!isCascadeRow({ new_status: 'open', previous_status: 'archived', reason: CASCADE_ARCHIVE_REASON }), 'a row that archives, not one that restores');
});

test('B cascadeIdsOf reads cascade_archived_task_ids from an audit entry\'s metadata — an array of strings, or null', () => {
  assert.deepEqual(cascadeIdsOf({ status_to: 'archived', cascade_archived_task_ids: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(cascadeIdsOf({ status_to: 'archived', cascade_archived_task_ids: [] }), []);
  assert.equal(cascadeIdsOf({ status_to: 'archived' }), null);
  assert.equal(cascadeIdsOf({ cascade_archived_task_ids: ['a', 1] }), null);
  assert.equal(cascadeIdsOf(null), null);
  assert.equal(cascadeIdsOf(['a']), null);
  assert.equal(cascadeIdsOf('a'), null);
});

// ── B · THE ROUTE ─────────────────────────────────────────────────────────────

test('B the route: archived → not_started reads the latest cascade entry (one source: the audit log), the archived tasks and their latest history rows, restores inside the one transaction with a history row each, then answers and audits what it did', () => {
  const r = code(ROUTE);
  assert.match(r, /import \{ CASCADE_ARCHIVE_REASON, CASCADE_RESTORE_REASON, NO_CASCADE_ON_RECORD, cascadeIdsOf, restorePlanOf, unarchiveWords, type ArchivedTaskFacts, type RestorePlan \} from '@\/lib\/operations\/archiveCascade';/);
  assert.match(r, /const isUnarchiving = statusChange\?\.from === 'archived' && statusChange\?\.to === 'not_started';/);
  const txAt = r.indexOf('const { updated: project, cascadeRestore } = await prisma.$transaction(async (tx) => {');
  const updateAt = r.indexOf('const updated = await tx.operations_projects.update({ where: { id }, data });', txAt);
  const unarchivingAt = r.indexOf('if (isUnarchiving) {', txAt);
  const entryAt = r.indexOf('const cascadeEntry = await tx.audit_log.findFirst({', unarchivingAt);
  const tasksAt = r.indexOf("where: { project_id: id, status: 'archived' },", entryAt);
  const rowsAt = r.indexOf('await tx.operations_task_status_history.findMany({', tasksAt);
  const planAt = r.indexOf('const plan = restorePlanOf(cascadeIds, facts);', rowsAt);
  const historyAt = r.indexOf("await recordTaskStatusChange(tx, r.id, user.id, 'archived', r.status, userEmail, CASCADE_RESTORE_REASON);", planAt);
  const restoreAt = r.indexOf("await tx.operations_project_tasks.update({ where: { id: r.id, project_id: id, status: 'archived' }, data: { status: r.status } });", historyAt);
  const txEndAt = r.indexOf('return { updated, cascadeRestore: restoreInTx };', restoreAt);
  assert.ok(txAt > -1 && updateAt > txAt && unarchivingAt > updateAt && entryAt > unarchivingAt && tasksAt > entryAt && rowsAt > tasksAt && planAt > rowsAt && historyAt > planAt && restoreAt > historyAt && txEndAt > restoreAt,
    'the project update, the cascade entry, the archived tasks, their latest rows, the plan, then each restore (history row, then the task) — all inside the one transaction');
  // ONE SOURCE: the project's latest status_changed entry with status_to 'archived' — by sequence number, the newest cascade.
  assert.match(r, /const cascadeEntry = await tx\.audit_log\.findFirst\(\{\n\s*where: \{\n\s*target_table: 'operations_projects',\n\s*target_id: id,\n\s*action_type: 'operations_project_status_changed',\n\s*payload_metadata: \{ path: \['status_to'\], equals: 'archived' \},\n\s*\},\n\s*orderBy: \{ sequence_number: 'desc' \},/);
  assert.match(r, /const cascadeIds = cascadeEntry === null \? null : cascadeIdsOf\(cascadeEntry\.payload_metadata\);/);
  // The previous status: each archived task's LATEST history row (newest first, one per task).
  assert.match(r, /where: \{ task_id: \{ in: archivedTasks\.map\(\(t\) => t\.id\) \} \},\n\s*orderBy: \{ changed_at: 'desc' \},\n\s*distinct: \['task_id'\],\n\s*select: \{ task_id: true, new_status: true, previous_status: true, reason: true \},/);
  assert.match(r, /const facts: ArchivedTaskFacts\[\] = archivedTasks\.map\(\(t\) => \(\{ id: t\.id, latest: latestByTask\.get\(t\.id\) \?\? null \}\)\);/);
  assert.match(r, /for \(const r of plan\.restore\) \{/);
  // SEC-02: the write names the proven project and the still-archived guard — a task not this project's, or changed under the read, throws and rolls the restore back.
  assert.match(r, /update\(\{ where: \{ id: r\.id, project_id: id, status: 'archived' \}, data: \{ status: r\.status \} \}\)/);
  assert.equal(CASCADE_RESTORE_REASON, 'project unarchived — cascade restored');
  // The source named in what the route keeps, with the entry's id and sequence number.
  assert.match(r, /source: cascadeEntry === null \? null : \{ audit_log_id: cascadeEntry\.id, sequence_number: cascadeEntry\.sequence_number\.toString\(\) \},/);
  // The words, then the audit entry (its own serializable transaction, after the change — the sibling pattern) and the response.
  assert.match(r, /const restoreWords = cascadeRestore === null \? null : unarchiveWords\(cascadeRestore\.plan, cascadeRestore\.source !== null\);/);
  assert.match(r, /\(restoreWords !== null \? ` \(\$\{restoreWords\}\)` : ''\)/, 'the description carries the words');
  assert.match(r, /cascade_source: cascadeRestore\.source,\n\s*\.\.\.\(cascadeRestore\.source === null \? \{ cascade_note: NO_CASCADE_ON_RECORD \} : \{\}\),\n\s*cascade_restored_task_ids: cascadeRestore\.plan\.restore\.map\(\(r\) => r\.id\),\n\s*cascade_restored: cascadeRestore\.plan\.restore,\n\s*cascade_left_archived_task_ids: cascadeRestore\.plan\.left\.map\(\(l\) => l\.id\),\n\s*cascade_left_archived: cascadeRestore\.plan\.left,\n\s*cascade_no_longer_archived_task_ids: cascadeRestore\.plan\.noLongerArchived,/);
  assert.match(r, /return NextResponse\.json\(\{\n\s*project,\n\s*cascade: \{\n\s*source: cascadeRestore\.source,\n\s*restored: cascadeRestore\.plan\.restore,\n\s*left_archived: cascadeRestore\.plan\.left,\n\s*no_longer_archived: cascadeRestore\.plan\.noLongerArchived,\n\s*words: restoreWords,\n\s*\},\n\s*\}\);/);
  assert.match(r, /return NextResponse\.json\(\{ project \}\);/, 'every other PATCH answers as before');
  assert.match(comments(ROUTE), /ARCHIVE-01 \(Alex, 2026-10-27\): archived → not_started \(the row's\s*\n\s*\*\s*"unarchive"\) restores, in the same transaction/);
});

test('B user A cannot unarchive user B\'s project: the PATCH loads the project by id AND user before any write and answers 404 — the restore\'s reads sit inside the transaction after that', () => {
  const r = code(ROUTE);
  assert.match(r, /async function loadAuthorizedProject\(projectId: string, userId: string\) \{\n\s*return prisma\.operations_projects\.findFirst\(\{\n\s*where: \{ id: projectId, user_id: userId \},/);
  const patchAt = r.indexOf('export async function PATCH(');
  const ownedAt = r.indexOf('const existing = await loadAuthorizedProject(id, user.id);', patchAt);
  const notFoundAt = r.indexOf("if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });", ownedAt);
  const txAt = r.indexOf('await prisma.$transaction(async (tx) => {', patchAt);
  assert.ok(patchAt > -1 && ownedAt > patchAt && notFoundAt > ownedAt && txAt > notFoundAt, 'the defensive 404, then the transaction');
  assert.match(r, /where: \{ project_id: id, status: 'archived' \},/, 'the archived tasks are the project\'s own');
  assert.match(r, /const verified = await getVerifiedEmail\(\);|const userEmail = await getVerifiedEmail\(\);/);
});

// ── C · UNCHANGED ─────────────────────────────────────────────────────────────

test('C the task PATCH, the per-task unarchive and the reads are unchanged', () => {
  const t = code(TASK_ROUTE);
  assert.match(t, /if \(statusTransition\) \{\n\s*await recordTaskStatusChange\(\n\s*tx,\n\s*taskId,\n\s*user\.id,\n\s*current\.status,\n\s*statusTransition\.to,\n\s*userEmail,\n\s*reason\n\s*\);\n\s*\}/);
  assert.doesNotMatch(t, /archiveCascade|CASCADE_/);
  assert.match(code(TASK_ACTIONS), /const handleUnarchive = async \(e: React\.MouseEvent\) => \{[\s\S]*?body: JSON\.stringify\(\{ status: 'open' \}\),/);
  assert.match(code(HISTORY_ROUTE), /const history = await prisma\.operations_task_status_history\.findMany\(\{/);
  assert.doesNotMatch(code(HISTORY_ROUTE) + code(UNCOMPLETE_ROUTE), /archiveCascade/);
  assert.doesNotMatch(code(RULE), /from '@\/lib\/prisma'|\bprisma\.|\btx\.|fetch\(|NextResponse/, 'the rule is pure — it reads no row and answers no request');
  assert.match(code(RULE), /^import type \{ OperationsTaskStatus \} from '@prisma\/client';/, 'its one import is the status type');
});

test('C the row: "unarchive" PATCHes not_started as before, hands the route\'s words up, and tells THE WORK; the table prints the line above its rows (the detail closes with the re-read); the line is a pure rule', () => {
  const row = code(ROW);
  assert.match(row, /onUnarchived: \(words: string\) => void;/);
  assert.match(row, /const handleUnarchive = async \(\) => \{\n\s*setArchiving\(true\);\n\s*setError\(null\);[\s\S]*?body: JSON\.stringify\(\{ status: 'not_started' \}\),[\s\S]*?onUnarchived\(typeof body\?\.cascade\?\.words === 'string' \? body\.cascade\.words : 'the route said nothing about its tasks'\);\n\s*onUpdate\(\);\n\s*onTasksChanged\?\.\(\);/);
  assert.doesNotMatch(row, /unarchiveWords|setUnarchiveWords/, 'no local words — the detail unmounts on the re-read');
  assert.match(comments(ROW), /ARCHIVE-01 \(Alex, 2026-10-27\):/);
  const view = code(VIEW);
  assert.doesNotMatch(view, /unarchiveWords|data-project-unarchive-words/, 'the view prints no words of its own');
  assert.match(view, /\{archiving \? 'unarchiving…' : 'unarchive'\}/, 'the button as before');
  const rows = code(TABLE_ROWS);
  assert.match(rows, /onUnarchived: \(title: string, words: string\) => void;/);
  assert.match(rows, /onUnarchived=\{\(words\) => onUnarchived\(project\.title, words\)\}/);
  const table = code(TABLE);
  assert.match(table, /const \[unarchived, setUnarchived\] = useState<\{ title: string; words: string \} \| null>\(null\);/);
  assert.match(table, /onUnarchived=\{\(title, words\) => setUnarchived\(\{ title, words \}\)\}/);
  assert.match(table, /\{unarchived && \(\n\s*<p className="[^"]*" \{\.\.\.dataAttr\(name, 'unarchived'\)\}>\n\s*<span \{\.\.\.dataAttr\(name, 'unarchived-words'\)\}>\{unarchivedLineOf\(unarchived\.title, unarchived\.words\)\}<\/span>\n\s*<button type="button" [^>]*onClick=\{\(\) => setUnarchived\(null\)\} aria-label="dismiss" \{\.\.\.dataAttr\(name, 'unarchived-dismiss'\)\}>\{CLEAR_CHIP_MARK\}<\/button>\n\s*<\/p>\n\s*\)\}/);
  assert.ok(table.indexOf("dataAttr(name, 'unarchived')") > table.indexOf("dataAttr(name, 'count')"), 'under the count line, above nothing else');
  assert.doesNotMatch(table, /localStorage|sessionStorage|document\.cookie/, 'React state only');
  assert.equal(unarchivedLineOf('Alpha', '2 tasks restored · 1 left archived (archived on its own)'), 'Alpha unarchived — 2 tasks restored · 1 left archived (archived on its own)');
  assert.match(comments(TABLE), /ARCHIVE-01 \(Alex, 2026-10-27\): the last "unarchive"/);
});
