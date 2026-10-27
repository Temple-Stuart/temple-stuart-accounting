/**
 * /api/operations/projects/[id]
 *
 * GET    — return one project (404 if not found or not owned). No audit.
 * PATCH  — update writable fields. Status changes audit-discriminate via
 *          operations_project_status_changed; other content changes audit
 *          as operations_project_updated. SOC 2 evidence-of-state-change
 *          control: status transitions are evidentiarily distinct from
 *          content edits.
 *          BACKLOG-01 (Alex, 2026-10-20): accepts the capture's fields — type
 *          (strict; may not be cleared once set), size (S/M/L or null), why
 *          (≤ 4000 code points; may not be cleared once set),
 *          definition_of_done, notes, links (the *_items shape) — with the
 *          POST's validation, audited as operations_project_updated as today.
 *          BACKLOG-01b (Alex, 2026-10-20): one fact, one home — problem (1) and
 *          goal (3) follow why's rule (≤ 4000 code points; never cleared once
 *          set); diagnosis (THE AUDIT) and design (THE PLAN) are pasted back,
 *          clearable while the row is in the backlog, never once scoped,
 *          scheduled, in progress or completed; rulings (4), open_questions (5)
 *          ≤ 4000; deadline_reason (6) ≤ 500 and required while a target date
 *          is set. "scope it": backlog → scoped only when diagnosis, design and
 *          definition_of_done are all non-empty after the body is applied —
 *          refused by name listing the missing; promoted_at set once. The only
 *          guarded transition; BACKLOG-03 adds the table.
 * DELETE — hard delete: the project, its tasks and its dependencies go in ONE
 *          transaction. TASKS-01 (2026-09-18): NEVER through a live link — the
 *          delete is refused with 409, naming the task and the reason, when a
 *          ledger line is allocated to the project, a posting is linked to a
 *          task, a task carries a posted actual, or a calendar block / hub
 *          schedule line references the project or a task (the rules live in
 *          src/lib/operations/projectDeletion.ts, re-run INSIDE the transaction;
 *          the GET at [id]/deletion is the same check for the confirm dialog).
 *          Archive is the path for those. Full payload_before captured in
 *          audit_log for replay, with the counts of what the cascade removed.
 *          ARCHIVE-01 (Alex, 2026-10-27): archived → not_started (the row's
 *          "unarchive") restores, in the same transaction, exactly the tasks
 *          the LATEST cascade archived — the ids from that cascade's audit
 *          entry, each still archived by it, to the previous_status its cascade
 *          history row recorded — with a history row each and the audit entry
 *          naming what was restored and what stays archived (the rule:
 *          src/lib/operations/archiveCascade.ts). No cascade on record → nothing
 *          restored, said in words.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma, ProjectSize, ProjectStatus, ProjectType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { statusStampsOf } from '@/lib/operations/projectStamps';
import { recordTaskStatusChange } from '@/lib/operations/recordTaskStatusChange';
import { CASCADE_ARCHIVE_REASON, CASCADE_RESTORE_REASON, NO_CASCADE_ON_RECORD, cascadeIdsOf, restorePlanOf, unarchiveWords, type ArchivedTaskFacts, type RestorePlan } from '@/lib/operations/archiveCascade';
import { describeBlockers, projectDeletionCheck, type DeletionPreview } from '@/lib/operations/projectDeletion';

// Active task statuses that an archive cascade retires to 'archived'. Terminal
// states (completed, cancelled, superseded) are LEFT UNTOUCHED — they are the
// audit trail. Mirrors the unscheduled-queue active set.
const ARCHIVABLE_TASK_STATUSES = ['open', 'in_progress', 'blocked'] as const;

// "Today" at UTC midnight, matching how daily-plan plan_date is stored/compared
// (daily-plan/items/route.ts parsePlanDate → `${date}T00:00:00.000Z`). Items with
// plan_date < today are PAST (untouched); >= today are future (removable).
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const VALID_STATUSES: ProjectStatus[] = [
  'not_started',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'archived',
  // BACKLOG-01 (Alex, 2026-10-20): the four capture statuses.
  'backlog',
  'scoped',
  'scheduled',
  'dropped',
];

// BACKLOG-01: the strict enums and why's cap, as the POST holds them.
const PROJECT_TYPES: readonly ProjectType[] = ['engineering', 'accounting', 'content', 'travel', 'ops'];
const PROJECT_SIZES: readonly ProjectSize[] = ['S', 'M', 'L'];
const WHY_MAX_CODE_POINTS = 4000;
/** BACKLOG-01b: deadline_reason is a VARCHAR(500) — 500 is the column's length, counted in code points. */
const DEADLINE_REASON_MAX_CODE_POINTS = 500;
/** BACKLOG-01b: once here, THE AUDIT and THE PLAN may not be cleared. */
const SCOPED_OR_BEYOND: readonly ProjectStatus[] = ['scoped', 'scheduled', 'in_progress', 'completed'];

async function loadAuthorizedProject(projectId: string, userId: string) {
  return prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const project = await loadAuthorizedProject(id, user.id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    return failClosedResponse('Project GET', 'Failed to load project', error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await loadAuthorizedProject(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();

    // Build the patch object explicitly — never trust body keys to flow through.
    const data: Prisma.operations_projectsUpdateInput = {};

    const trimNonEmpty = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };

    if (body.title !== undefined) {
      const t = trimNonEmpty(body.title);
      if (t === null || t.length > 500) {
        return NextResponse.json(
          { error: 'Validation', field: 'title', message: 'required, max 500 chars' },
          { status: 400 }
        );
      }
      // Uniqueness check on title change.
      if (t !== existing.title) {
        const dup = await prisma.operations_projects.findFirst({
          where: { user_id: user.id, title: t, NOT: { id } },
        });
        if (dup) {
          return NextResponse.json(
            { error: 'Duplicate', field: 'title', message: 'a project with this title already exists' },
            { status: 409 }
          );
        }
      }
      data.title = t;
    }

    // PR-Ops-Evolve-1: deep_research_input / claude_code_audit_input are manual
    // paste targets (reality inputs) saved on the same path as the Text sections.
    // BACKLOG-01b (Alex, 2026-10-20): goal / problem / diagnosis / design left this
    // loop — one fact, one home, each with its rule below.
    for (const field of ['deep_research_input', 'claude_code_audit_input'] as const) {
      if (body[field] !== undefined) {
        const t = trimNonEmpty(body[field]);
        data[field] = t;
      }
    }

    // BACKLOG-01b (Alex, 2026-10-20): problem (1 WHAT IS WRONG TODAY) and goal (3 THE
    // ONE CORRECT OUTCOME) follow why's rule — a paragraph of ≤ 4000 code points;
    // nothing typed when the row HAS one is a clearing, refused by name; a row
    // captured before (null) stays null.
    for (const field of ['problem', 'goal'] as const) {
      if (body[field] === undefined) continue;
      const t = trimNonEmpty(body[field]);
      if (t === null) {
        if (existing[field] !== null) {
          return NextResponse.json(
            { error: 'Validation', field, message: `${field} may not be cleared once set` },
            { status: 400 }
          );
        }
        continue;
      }
      const length = [...t].length;
      if (length > WHY_MAX_CODE_POINTS) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} is at most ${WHY_MAX_CODE_POINTS} characters (${length} given)` },
          { status: 400 }
        );
      }
      data[field] = t;
    }
    // diagnosis (THE AUDIT) and design (THE PLAN): the chat's text pasted back —
    // unbounded, clearable while the row is in the backlog (or any unscoped status),
    // never once scoped, scheduled, in progress or completed — refused by name.
    // The values AFTER this body feed "scope it" below.
    let diagnosisAfter: string | null = existing.diagnosis;
    let designAfter: string | null = existing.design;
    for (const field of ['diagnosis', 'design'] as const) {
      if (body[field] === undefined) continue;
      const t = trimNonEmpty(body[field]);
      if (t === null && existing[field] !== null && SCOPED_OR_BEYOND.includes(existing.status)) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} may not be cleared once scoped` },
          { status: 400 }
        );
      }
      data[field] = t;
      if (field === 'diagnosis') diagnosisAfter = t; else designAfter = t;
    }
    // rulings (4 ALREADY RULED) and open_questions (5 WANT A RECOMMENDATION ON):
    // optional, clearable, capped like the three texts.
    for (const field of ['rulings', 'open_questions'] as const) {
      if (body[field] === undefined) continue;
      const t = trimNonEmpty(body[field]);
      if (t !== null && [...t].length > WHY_MAX_CODE_POINTS) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} is at most ${WHY_MAX_CODE_POINTS} characters (${[...t].length} given)` },
          { status: 400 }
        );
      }
      data[field] = t;
    }
    // deadline_reason (6 BY WHEN, AND WHY): ≤ 500 code points; required while a
    // target date is set — checked with the date below.
    let deadlineReasonAfter: string | null = existing.deadline_reason;
    if (body.deadline_reason !== undefined) {
      const t = trimNonEmpty(body.deadline_reason);
      if (t !== null && [...t].length > DEADLINE_REASON_MAX_CODE_POINTS) {
        return NextResponse.json(
          { error: 'Validation', field: 'deadline_reason', message: `deadline_reason is at most ${DEADLINE_REASON_MAX_CODE_POINTS} characters (${[...t].length} given)` },
          { status: 400 }
        );
      }
      data.deadline_reason = t;
      deadlineReasonAfter = t;
    }

    // PR-Ops-3.7: structured-list fields. Each is an array of strings,
    // each item ≤ 500 chars, ≤ 20 items per array.
    const validateItems = (
      value: unknown,
      fieldName: string
    ): { ok: true; items: string[] } | { ok: false; message: string } => {
      if (!Array.isArray(value)) {
        return { ok: false, message: `${fieldName} must be an array` };
      }
      if (value.length > 20) {
        return { ok: false, message: `${fieldName} cannot have more than 20 items` };
      }
      const items: string[] = [];
      for (let i = 0; i < value.length; i++) {
        const raw = value[i];
        if (typeof raw !== 'string') {
          return { ok: false, message: `${fieldName}[${i}] must be a string` };
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) continue; // silently drop empty items
        if (trimmed.length > 500) {
          return { ok: false, message: `${fieldName}[${i}] exceeds 500 characters` };
        }
        items.push(trimmed);
      }
      return { ok: true, items };
    };

    const itemFieldMap = [
      { body: 'goalItems', column: 'goal_items' as const },
      { body: 'problemItems', column: 'problem_items' as const },
      { body: 'diagnosisItems', column: 'diagnosis_items' as const },
    ];
    for (const { body: bodyKey, column } of itemFieldMap) {
      if (body[bodyKey] !== undefined) {
        const result = validateItems(body[bodyKey], bodyKey);
        if (!result.ok) {
          return NextResponse.json(
            { error: 'Validation', field: bodyKey, message: result.message },
            { status: 400 }
          );
        }
        data[column] = result.items;
      }
    }

    // BACKLOG-01 (Alex, 2026-10-20): the capture's fields, with the POST's rules.
    // type: strict; '' or null when the row HAS a type is a clearing — refused by
    // name. On a row captured before (type null) '' or null is nothing chosen
    // yet, so the column stays null; it is not a clearing.
    if (body.type !== undefined) {
      if (body.type === null || body.type === '') {
        if (existing.type !== null) {
          return NextResponse.json(
            { error: 'Validation', field: 'type', message: 'type may not be cleared once set' },
            { status: 400 }
          );
        }
      } else {
        const found = PROJECT_TYPES.find((t) => t === body.type);
        if (!found) {
          return NextResponse.json(
            { error: 'Validation', field: 'type', message: `type must be one of ${PROJECT_TYPES.join(', ')}` },
            { status: 400 }
          );
        }
        data.type = found;
      }
    }
    // size: S, M, L, or cleared to null ("not sized").
    if (body.size !== undefined) {
      if (body.size === null || body.size === '') {
        data.size = null;
      } else {
        const found = PROJECT_SIZES.find((x) => x === body.size);
        if (!found) {
          return NextResponse.json(
            { error: 'Validation', field: 'size', message: `size must be one of ${PROJECT_SIZES.join(', ')} or empty` },
            { status: 400 }
          );
        }
        data.size = found;
      }
    }
    // why: a paragraph of at most 4000 CODE POINTS (counted as JOURNAL-04 counts
    // the evening's block, src/lib/operations/journal.ts:285); nothing typed when
    // the row HAS a why is a clearing — refused by name; on a row captured before
    // (why null) it stays null.
    if (body.why !== undefined) {
      const t = trimNonEmpty(body.why);
      if (t === null) {
        if (existing.why !== null) {
          return NextResponse.json(
            { error: 'Validation', field: 'why', message: 'why may not be cleared once set' },
            { status: 400 }
          );
        }
      } else {
        const whyLength = [...t].length;
        if (whyLength > WHY_MAX_CODE_POINTS) {
          return NextResponse.json(
            { error: 'Validation', field: 'why', message: `why is at most ${WHY_MAX_CODE_POINTS} characters (${whyLength} given)` },
            { status: 400 }
          );
        }
        data.why = t;
      }
    }
    // definition_of_done and notes: optional — nothing typed is NULL, never "".
    for (const field of ['definition_of_done', 'notes'] as const) {
      if (body[field] !== undefined) data[field] = trimNonEmpty(body[field]);
    }
    const definitionOfDoneAfter: string | null = body.definition_of_done !== undefined ? trimNonEmpty(body.definition_of_done) : existing.definition_of_done;
    // links: the *_items shape (≤ 20 strings of ≤ 500; a blank line dropped as the items are).
    if (body.links !== undefined) {
      const result = validateItems(body.links, 'links');
      if (!result.ok) {
        return NextResponse.json(
          { error: 'Validation', field: 'links', message: result.message },
          { status: 400 }
        );
      }
      data.links = result.items;
    }

    // BACKLOG-01b: the only guarded transition is backlog → scoped (diagnosis, design
    // and definition_of_done required; promoted_at set once); BACKLOG-03 adds the table.
    let statusChange: { from: ProjectStatus; to: ProjectStatus } | null = null;
    if (body.status !== undefined) {
      const incoming = body.status as ProjectStatus;
      if (!VALID_STATUSES.includes(incoming)) {
        return NextResponse.json(
          { error: 'Validation', field: 'status', message: 'invalid status value' },
          { status: 400 }
        );
      }
      // "scope it" (Alex, 2026-10-20): backlog → scoped only when THE AUDIT, THE PLAN
      // and PROOF OF DONE are all non-empty AFTER this body is applied — refused by
      // name listing the missing; promoted_at set once, never overwritten.
      if (incoming === 'scoped' && existing.status === 'backlog') {
        const after = { diagnosis: diagnosisAfter, design: designAfter, definition_of_done: definitionOfDoneAfter };
        const missing = (['diagnosis', 'design', 'definition_of_done'] as const).filter((f) => after[f] === null);
        if (missing.length > 0) {
          return NextResponse.json(
            { error: 'Validation', field: 'status', message: `scope it needs: ${missing.join(', ')}` },
            { status: 400 }
          );
        }
        data.promoted_at = existing.promoted_at ?? new Date();
      }
      if (incoming !== existing.status) {
        statusChange = { from: existing.status, to: incoming };
        // COLUMNS-01 (Alex, 2026-10-25, ruling C): the dates PROJECTS prints — scheduled_at the latest transition INTO scheduled; done_at the
        // latest INTO completed, null once the status leaves completed (DONE never contradicts STATUS). The pure rule is
        // src/lib/operations/projectStamps.ts; the stamps ride this status change and its existing audit entry (before/after carry them).
        // promoted_at keeps its own rule above. No backfill — a project moved before this ruling keeps its null until it moves again.
        const stamps = statusStampsOf(statusChange.from, statusChange.to, new Date());
        if (stamps.scheduled_at !== undefined) data.scheduled_at = stamps.scheduled_at;
        if (stamps.done_at !== undefined) data.done_at = stamps.done_at;
      }
      data.status = incoming;
    }

    let targetAfter: Date | null = existing.target_completion_date;
    if (body.target_completion_date !== undefined) {
      targetAfter =
        typeof body.target_completion_date === 'string' && body.target_completion_date.length > 0
          ? new Date(body.target_completion_date)
          : null;
      data.target_completion_date = targetAfter;
    }
    // BACKLOG-01b (Alex, 2026-10-20): a target date requires its reason — after this
    // body, the row holds a date and no reason (a date set without one, or the reason
    // cleared while a date stands) → refused by name. A reason without a date is text.
    if (targetAfter !== null && deadlineReasonAfter === null) {
      return NextResponse.json(
        { error: 'Validation', field: 'deadline_reason', message: 'deadline_reason is required when a target date is set' },
        { status: 400 }
      );
    }

    if (body.estimated_total_minutes !== undefined) {
      const v = body.estimated_total_minutes;
      if (v === null || v === '') {
        data.estimated_total_minutes = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: 'Validation', field: 'estimated_total_minutes', message: 'must be a non-negative number' },
            { status: 400 }
          );
        }
        data.estimated_total_minutes = n;
      }
    }

    if (body.estimated_total_cost_usd !== undefined) {
      const v = body.estimated_total_cost_usd;
      if (v === null || v === '') {
        data.estimated_total_cost_usd = null;
      } else if (typeof v === 'string' && v.trim().length > 0) {
        data.estimated_total_cost_usd = new Prisma.Decimal(v.trim());
      } else if (typeof v === 'number') {
        data.estimated_total_cost_usd = new Prisma.Decimal(v);
      }
    }

    // Archiving a project cascades (in ONE transaction): its ACTIVE tasks retire
    // to 'archived' (terminal-status tasks keep their status — audit trail), and
    // their FUTURE, not-yet-DONE daily-plan items are removed (cascading any
    // scheduled block via FK). Past-dated and DONE items are never touched.
    const isArchiving = statusChange?.to === 'archived';
    let archivedTaskIds: string[] = [];
    let removedItemCount = 0;
    // ARCHIVE-01 (Alex, 2026-10-27): the row's "unarchive" — archived → not_started — restores the latest
    // cascade's tasks in this transaction (archiveCascade.ts). Any other move out of archived restores nothing.
    const isUnarchiving = statusChange?.from === 'archived' && statusChange?.to === 'not_started';

    const { updated: project, cascadeRestore } = await prisma.$transaction(async (tx) => {
      const updated = await tx.operations_projects.update({ where: { id }, data });
      let restoreInTx: { source: { audit_log_id: string; sequence_number: string } | null; plan: RestorePlan } | null = null;

      if (isArchiving) {
        const activeTasks = await tx.operations_project_tasks.findMany({
          where: { project_id: id, status: { in: [...ARCHIVABLE_TASK_STATUSES] } },
          select: { id: true, status: true },
        });
        archivedTaskIds = activeTasks.map((t) => t.id);

        for (const t of activeTasks) {
          // Status-history row per task — preserves the single-funnel invariant
          // (a task status change never lands without its history row).
          // ARCHIVE-01 (ruling A): this row — previous_status the status it had, new_status 'archived', reason
          // CASCADE_ARCHIVE_REASON ('project archived', the word written here since the cascade was built), changed_by
          // the actor — is what the restore reads back; nothing here changed.
          await recordTaskStatusChange(tx, t.id, user.id, t.status, 'archived', userEmail, CASCADE_ARCHIVE_REASON);
          await tx.operations_project_tasks.update({
            where: { id: t.id },
            data: { status: 'archived' },
          });
        }

        if (archivedTaskIds.length > 0) {
          // Future (plan_date >= today), not-DONE items for the now-archived
          // tasks. `none: { status: completed }` spares DONE items; FK cascade
          // removes any scheduled (non-completed) block.
          const removed = await tx.operations_daily_plan_items.deleteMany({
            where: {
              task_id: { in: archivedTaskIds },
              plan_date: { gte: todayUtcMidnight() },
              calendar_blocks: { none: { status: 'completed' } },
            },
          });
          removedItemCount = removed.count;
        }
      }

      if (isUnarchiving) {
        // ARCHIVE-01 (ruling B): ONE SOURCE for which tasks the latest cascade archived — the project's latest audit
        // entry with status_to 'archived' (its cascade_archived_task_ids). The previous status of each comes from its
        // own cascade history row; a task is restored only while still archived by that cascade (archiveCascade.ts).
        const cascadeEntry = await tx.audit_log.findFirst({
          where: {
            target_table: 'operations_projects',
            target_id: id,
            action_type: 'operations_project_status_changed',
            payload_metadata: { path: ['status_to'], equals: 'archived' },
          },
          orderBy: { sequence_number: 'desc' },
          select: { id: true, sequence_number: true, payload_metadata: true },
        });
        const cascadeIds = cascadeEntry === null ? null : cascadeIdsOf(cascadeEntry.payload_metadata);
        const archivedTasks = await tx.operations_project_tasks.findMany({
          where: { project_id: id, status: 'archived' },
          select: { id: true },
        });
        const latestRows = archivedTasks.length === 0 ? [] : await tx.operations_task_status_history.findMany({
          where: { task_id: { in: archivedTasks.map((t) => t.id) } },
          orderBy: { changed_at: 'desc' },
          distinct: ['task_id'],
          select: { task_id: true, new_status: true, previous_status: true, reason: true },
        });
        const latestByTask = new Map(latestRows.map((r) => [r.task_id, { new_status: r.new_status, previous_status: r.previous_status, reason: r.reason }]));
        const facts: ArchivedTaskFacts[] = archivedTasks.map((t) => ({ id: t.id, latest: latestByTask.get(t.id) ?? null }));
        const plan = restorePlanOf(cascadeIds, facts);
        for (const r of plan.restore) {
          // The restore's history row — 'archived' back to the status the cascade recorded — then the task, atomically. The
          // WHERE names the proven project and the still-archived guard (SEC-02): a task that is not this project's, or
          // changed under the read, throws (P2025) and the whole restore rolls back — never a stray row.
          await recordTaskStatusChange(tx, r.id, user.id, 'archived', r.status, userEmail, CASCADE_RESTORE_REASON);
          await tx.operations_project_tasks.update({ where: { id: r.id, project_id: id, status: 'archived' }, data: { status: r.status } });
        }
        restoreInTx = {
          source: cascadeEntry === null ? null : { audit_log_id: cascadeEntry.id, sequence_number: cascadeEntry.sequence_number.toString() },
          plan,
        };
      }

      return { updated, cascadeRestore: restoreInTx };
    });
    // ARCHIVE-01: the words the row prints, and the counts the audit entry carries.
    const restoreWords = cascadeRestore === null ? null : unarchiveWords(cascadeRestore.plan, cascadeRestore.source !== null);

    // Status changes audit as a distinct evidentiary event. For an archive
    // cascade, the project-level audit records the cascade counts (matching the
    // project-DELETE sibling, which documents its cascade at the project level).
    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: statusChange ? 'operations_project_status_changed' : 'operations_project_updated',
        description: statusChange
          ? `Project "${existing.title}" status: ${statusChange.from} → ${statusChange.to}` +
            (isArchiving
              ? ` (archived ${archivedTaskIds.length} active task(s); removed ${removedItemCount} future plan item(s))`
              : '') +
            (restoreWords !== null ? ` (${restoreWords})` : '')
          : `Updated project "${existing.title}" for ${userEmail}`,
      },
      target: {
        table: 'operations_projects',
        id: project.id,
      },
      payload: {
        before: existing,
        after: project,
        metadata: statusChange
          ? {
              status_from: statusChange.from,
              status_to: statusChange.to,
              ...(isArchiving
                ? {
                    cascade_archived_task_ids: archivedTaskIds,
                    cascade_removed_future_item_count: removedItemCount,
                  }
                : {}),
              // ARCHIVE-01: what the restore did, from which cascade entry, and what stays archived (with its why).
              ...(cascadeRestore !== null
                ? {
                    cascade_source: cascadeRestore.source,
                    ...(cascadeRestore.source === null ? { cascade_note: NO_CASCADE_ON_RECORD } : {}),
                    cascade_restored_task_ids: cascadeRestore.plan.restore.map((r) => r.id),
                    cascade_restored: cascadeRestore.plan.restore,
                    cascade_left_archived_task_ids: cascadeRestore.plan.left.map((l) => l.id),
                    cascade_left_archived: cascadeRestore.plan.left,
                    cascade_no_longer_archived_task_ids: cascadeRestore.plan.noLongerArchived,
                  }
                : {}),
            }
          : undefined,
      },
    });

    if (cascadeRestore !== null && restoreWords !== null) {
      return NextResponse.json({
        project,
        cascade: {
          source: cascadeRestore.source,
          restored: cascadeRestore.plan.restore,
          left_archived: cascadeRestore.plan.left,
          no_longer_archived: cascadeRestore.plan.noLongerArchived,
          words: restoreWords,
        },
      });
    }
    return NextResponse.json({ project });
  } catch (error) {
    return failClosedResponse('Project PATCH', 'Failed to update project', error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await loadAuthorizedProject(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // TASKS-01: the check and the delete are ONE transaction — a link made
    // between the preview and the click still refuses the delete.
    const outcome = await prisma.$transaction(async (tx): Promise<
      { kind: 'missing' } | { kind: 'blocked'; preview: DeletionPreview } | { kind: 'deleted'; preview: DeletionPreview }
    > => {
      const preview = await projectDeletionCheck(tx, id, user.id);
      if (!preview) return { kind: 'missing' };
      if (preview.blockers.length > 0) return { kind: 'blocked', preview };
      await tx.operations_projects.delete({ where: { id } });
      return { kind: 'deleted', preview };
    });
    if (outcome.kind === 'missing') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (outcome.kind === 'blocked') {
      return NextResponse.json(
        { error: 'ProjectHasLiveLinks', message: describeBlockers(outcome.preview), blockers: outcome.preview.blockers },
        { status: 409 }
      );
    }

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_deleted',
        description: `Deleted project "${existing.title}" for ${userEmail}`,
      },
      target: {
        table: 'operations_projects',
        id: existing.id,
      },
      payload: {
        before: existing,
        metadata: {
          cascade_removed: outcome.preview.removes,
          links_severed: outcome.preview.severs,
        },
      },
    });

    return NextResponse.json({ deleted: true, id: existing.id, removed: outcome.preview.removes, severed: outcome.preview.severs });
  } catch (error) {
    // Translate DB constraint violations into a clear, non-leaky message
    // instead of forwarding the raw Postgres string (no-silent-failure:
    // surface WHY legibly). Covers FK (P2003) + other constraint (P2004)
    // violations and raw check-constraint errors. TASKS-01: every link the
    // schema restricts is named by the check above BEFORE this can fire; this
    // stays for a constraint added later that the leaf does not yet know.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2004')
    ) {
      return NextResponse.json(
        {
          error: 'ConstraintViolation',
          message:
            'Couldn’t delete this project: a linked record blocked it. Remove the linked records first, then try again.',
        },
        { status: 409 }
      );
    }
    return failClosedResponse('Project DELETE', 'Failed to delete project', error);
  }
}
