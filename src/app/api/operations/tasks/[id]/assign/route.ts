/**
 * POST /api/operations/tasks/[id]/assign
 *
 * ATOMIC "assign a task to the calendar" for the Hub. The daily-plan UX
 * uses a two-call path (create item, then create block) which can orphan
 * a block-less item if the block step fails or the user abandons after a
 * 409. This endpoint does the whole placement in ONE prisma.$transaction:
 * find-or-create the (task, day) item, then create the timed block, then
 * optionally set category/cost on the TASK — all-or-nothing.
 *
 * The two-call endpoints (items + items/[itemId]/blocks) are NOT removed;
 * they still back the daily-plan surface. This is additive for the Hub.
 *
 * Conflict contract is replicated VERBATIM from the existing block-create
 * endpoint (src/app/api/operations/daily-plan/items/[itemId]/blocks/
 * route.ts:97-103) which delegates to detectBlockConflicts
 * (src/lib/operations/detectBlockConflicts.ts:21-41): Postgres OVERLAPS,
 * status NOT IN ('cancelled','missed'), half-open intervals. On conflict
 * without allow_conflicts → 409 { error:'Conflict', conflicting_block_ids }.
 * allow_conflicts is an explicit user choice surfaced in the UI — never
 * auto-set server-side.
 *
 * Auth: getVerifiedEmail → user lookup → task ownership check, as the
 * FIRST lines. entity_id is derived from the task server-side (never
 * trusted from the client), mirroring the item-create endpoint
 * (daily-plan/items/route.ts:174-180).
 *
 * Category-on-assign writes TASK fields only (coa_code; estimated_cost_usd
 * only when currently null). It does NOT touch any budget-line or actuals
 * wiring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateTime(v: unknown): Date | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePlanDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Carries conflict ids out of the rolled-back transaction. */
class ConflictError extends Error {
  constructor(public conflictingBlockIds: string[]) {
    super('Conflict');
    this.name = 'ConflictError';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // --- Auth gates (FIRST, before any write) ---
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: taskId } = await params;
    if (!isValidUuid(taskId)) {
      return NextResponse.json({ error: 'Validation', field: 'id', message: 'Invalid task UUID' }, { status: 400 });
    }

    // Ownership check + server-side entity derivation.
    const task = await prisma.operations_project_tasks.findFirst({
      where: { id: taskId, user_id: user.id },
    });
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Validation', message: 'request body must be JSON' }, { status: 400 });
    }

    const planDate = parsePlanDate(body.plan_date);
    if (!planDate) {
      return NextResponse.json(
        { error: 'Validation', field: 'plan_date', message: 'plan_date is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const start = parseDateTime(body.scheduled_start);
    if (!start) {
      return NextResponse.json(
        { error: 'Validation', field: 'scheduled_start', message: 'scheduled_start is required (ISO datetime)' },
        { status: 400 }
      );
    }
    const end = parseDateTime(body.scheduled_end);
    if (!end) {
      return NextResponse.json(
        { error: 'Validation', field: 'scheduled_end', message: 'scheduled_end is required (ISO datetime)' },
        { status: 400 }
      );
    }
    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: 'Validation', field: 'scheduled_end', message: 'scheduled_end must be after scheduled_start' },
        { status: 400 }
      );
    }

    const allowConflicts = body.allow_conflicts === true;

    // Optional category-on-assign — TASK fields only.
    const coaCodeRaw =
      typeof body.coa_code === 'string' && body.coa_code.trim().length > 0 ? body.coa_code.trim() : null;
    let estCost: Prisma.Decimal | null = null;
    if (body.estimated_cost_usd !== undefined && body.estimated_cost_usd !== null && body.estimated_cost_usd !== '') {
      const n = Number(body.estimated_cost_usd);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'estimated_cost_usd', message: 'must be a non-negative number' },
          { status: 400 }
        );
      }
      estCost = new Prisma.Decimal(n);
    }

    const entityId = task.entity_id; // server-derived; never from client

    const result = await prisma.$transaction(async (tx) => {
      // a. Conflict check — replicate the existing blocks endpoint contract
      //    verbatim (detectBlockConflicts.ts:27-40), but on the txn client.
      const conflictRows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM operations_calendar_blocks
          WHERE user_id = ${user.id}
            AND status NOT IN ('cancelled', 'missed')
            AND (scheduled_start, scheduled_end) OVERLAPS (${start}::timestamptz, ${end}::timestamptz)`
      );
      const conflictingBlockIds = conflictRows.map((r) => r.id);
      if (conflictingBlockIds.length > 0 && !allowConflicts) {
        throw new ConflictError(conflictingBlockIds);
      }

      // b. find-or-create the (task, day) item. No DB @@unique on
      //    (task_id, plan_date) exists, so dedupe in-app: reuse an existing
      //    item for this task+date if present, else create one.
      let item = await tx.operations_daily_plan_items.findFirst({
        where: { user_id: user.id, task_id: task.id, plan_date: planDate },
      });
      if (!item) {
        const last = await tx.operations_daily_plan_items.findFirst({
          where: { user_id: user.id, plan_date: planDate },
          orderBy: { display_order: 'desc' },
          select: { display_order: true },
        });
        item = await tx.operations_daily_plan_items.create({
          data: {
            user_id: user.id,
            entity_id: entityId,
            plan_date: planDate,
            task_id: task.id,
            display_order: last ? last.display_order + 1 : 0,
            created_by: userEmail,
          },
        });
      }

      // c. create the timed block on that item.
      const block = await tx.operations_calendar_blocks.create({
        data: {
          user_id: user.id,
          entity_id: entityId,
          daily_plan_item_id: item.id,
          scheduled_start: start,
          scheduled_end: end,
          status: 'scheduled',
          created_by: userEmail,
        },
      });

      // d. category-on-assign: TASK fields only. coa_code if provided;
      //    estimated_cost_usd only when currently null (don't overwrite).
      const taskData: Prisma.operations_project_tasksUpdateInput = {};
      if (coaCodeRaw !== null) taskData.coa_code = coaCodeRaw;
      if (estCost !== null && task.estimated_cost_usd === null) taskData.estimated_cost_usd = estCost;
      if (Object.keys(taskData).length > 0) {
        await tx.operations_project_tasks.update({ where: { id: task.id }, data: taskData });
      }

      return { item, block, conflictingBlockIds };
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_calendar_block_created',
        description: `Assigned task "${task.title}" to the calendar on ${body.plan_date}`,
      },
      target: { table: 'operations_calendar_blocks', id: result.block.id },
      payload: {
        after: result.block,
        metadata: {
          task_id: task.id,
          daily_plan_item_id: result.item.id,
          allow_conflicts_used: allowConflicts,
          conflicts_overridden: result.conflictingBlockIds.length > 0 ? result.conflictingBlockIds : undefined,
        },
      },
    });

    return NextResponse.json(
      { item: result.item, block: result.block, conflicts: result.conflictingBlockIds },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(
        { error: 'Conflict', conflicting_block_ids: error.conflictingBlockIds },
        { status: 409 }
      );
    }
    console.error('[Task Assign POST]', error);
    return NextResponse.json(
      { error: 'Failed to assign task', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
