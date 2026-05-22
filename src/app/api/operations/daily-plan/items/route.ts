/**
 * /api/operations/daily-plan/items
 *
 * GET  — list daily plan items in a plan_date range (default: today).
 *        Each item includes its calendar_blocks, ordered by start.
 *        No audit (read-only).
 * POST — create a daily plan item. Exactly one of task_id (task-linked)
 *        or ad_hoc_title (ad-hoc) must be supplied. Task-linked items
 *        derive entity_id from the task (β-1: never trust client value);
 *        ad-hoc items require entity_id in the body. display_order is
 *        server-computed as max+1 within the (user_id, plan_date) scope.
 *        Audits operations_daily_plan_item_created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a YYYY-MM-DD string to a UTC-midnight Date, or null if malformed. */
function parsePlanDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function trimNullable(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let from: Date;
    if (fromParam) {
      const parsed = parsePlanDate(fromParam);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Validation', field: 'from', message: 'from must be a valid YYYY-MM-DD date' },
          { status: 400 }
        );
      }
      from = parsed;
    } else {
      from = todayUtc();
    }

    let to: Date;
    if (toParam) {
      const parsed = parsePlanDate(toParam);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Validation', field: 'to', message: 'to must be a valid YYYY-MM-DD date' },
          { status: 400 }
        );
      }
      to = parsed;
    } else {
      to = from;
    }

    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { error: 'Validation', field: 'to', message: 'to must be on or after from' },
        { status: 400 }
      );
    }

    const items = await prisma.operations_daily_plan_items.findMany({
      where: { user_id: user.id, plan_date: { gte: from, lte: to } },
      include: {
        calendar_blocks: { orderBy: { scheduled_start: 'asc' } },
        task: {
          select: {
            id: true,
            project_id: true,
            title: true,
            status: true,
            coa_code: true,
            estimated_cost_usd: true,
            actual_cost_usd: true,
            actual_minutes: true,
          },
        },
      },
      orderBy: [{ plan_date: 'asc' }, { display_order: 'asc' }],
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[Daily Plan Items GET]', error);
    return NextResponse.json(
      { error: 'Failed to load daily plan items', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    if (typeof body.plan_date !== 'string' || body.plan_date.length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'plan_date', message: 'plan_date is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const planDate = parsePlanDate(body.plan_date);
    if (!planDate) {
      return NextResponse.json(
        { error: 'Validation', field: 'plan_date', message: 'plan_date must be a valid YYYY-MM-DD date' },
        { status: 400 }
      );
    }

    const taskIdRaw = trimNullable(body.task_id);
    const adHocTitle = trimNullable(body.ad_hoc_title);
    const adHocDescription = trimNullable(body.ad_hoc_description);
    const notes = trimNullable(body.notes);

    // CHECK constraint mirror: exactly one of task_id / ad_hoc_title.
    if (taskIdRaw && adHocTitle) {
      return NextResponse.json(
        { error: 'Validation', field: 'task_id', message: 'provide either task_id or ad_hoc_title, not both' },
        { status: 400 }
      );
    }
    if (!taskIdRaw && !adHocTitle) {
      return NextResponse.json(
        { error: 'Validation', field: 'ad_hoc_title', message: 'one of task_id or ad_hoc_title is required' },
        { status: 400 }
      );
    }

    let entityId: string;
    let taskId: string | null = null;
    let finalAdHocDescription: string | null = null;

    if (taskIdRaw) {
      if (!isValidUuid(taskIdRaw)) {
        return NextResponse.json(
          { error: 'Validation', field: 'task_id', message: 'Invalid UUID format' },
          { status: 400 }
        );
      }
      // Task-linked: defensive 404 on cross-user, entity_id derived from task.
      const task = await prisma.operations_project_tasks.findFirst({
        where: { id: taskIdRaw, user_id: user.id },
      });
      if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      taskId = task.id;
      entityId = task.entity_id;
    } else {
      // Ad-hoc: entity_id required in body, length-bounded text fields.
      if (adHocTitle && adHocTitle.length > 500) {
        return NextResponse.json(
          { error: 'Validation', field: 'ad_hoc_title', message: 'ad_hoc_title exceeds 500 characters' },
          { status: 400 }
        );
      }
      if (adHocDescription && adHocDescription.length > 1500) {
        return NextResponse.json(
          { error: 'Validation', field: 'ad_hoc_description', message: 'ad_hoc_description exceeds 1500 characters' },
          { status: 400 }
        );
      }
      const entityIdRaw = trimNullable(body.entity_id);
      if (!entityIdRaw) {
        return NextResponse.json(
          { error: 'Validation', field: 'entity_id', message: 'entity_id is required for ad-hoc items' },
          { status: 400 }
        );
      }
      entityId = entityIdRaw;
      finalAdHocDescription = adHocDescription;
    }

    // display_order = max+1 within (user_id, plan_date).
    const last = await prisma.operations_daily_plan_items.findFirst({
      where: { user_id: user.id, plan_date: planDate },
      orderBy: { display_order: 'desc' },
      select: { display_order: true },
    });
    const displayOrder = last ? last.display_order + 1 : 0;

    const item = await prisma.operations_daily_plan_items.create({
      data: {
        user_id: user.id,
        entity_id: entityId,
        plan_date: planDate,
        task_id: taskId,
        ad_hoc_title: adHocTitle,
        ad_hoc_description: finalAdHocDescription,
        notes,
        display_order: displayOrder,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_daily_plan_item_created',
        description: `Created daily plan item for ${body.plan_date}`,
      },
      target: { table: 'operations_daily_plan_items', id: item.id },
      payload: {
        after: item,
        metadata: {
          plan_date: body.plan_date,
          entity_id: entityId,
          task_id: taskId,
        },
      },
    });

    return NextResponse.json({ item, isCreate: true }, { status: 201 });
  } catch (error) {
    console.error('[Daily Plan Items POST]', error);
    return NextResponse.json(
      { error: 'Failed to create daily plan item', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
