/**
 * /api/operations/daily-plan/items/[itemId]
 *
 * GET    — read one daily plan item with its calendar_blocks joined.
 * PATCH  — update mutable fields (notes, display_order, ad_hoc_title,
 *          ad_hoc_description). task_id / entity_id / plan_date are
 *          immutable — delete + recreate to change them. Clearing
 *          ad_hoc_title is rejected unless the item is task-linked
 *          (preserves the task_id-or-ad_hoc_title CHECK invariant).
 * DELETE — hard delete. calendar_blocks cascade-delete via the FK
 *          ON DELETE CASCADE; the pre-delete blocks are captured in
 *          the audit payload_before.
 *
 * All handlers scope by user_id with defensive 404 non-disclosure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { loadAuthorizedDailyPlanItem } from '@/lib/operations/loadAuthorizedDailyPlanItem';
import { isValidUuid } from '@/lib/operations/parseUuid';

function trimNullable(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { itemId } = await params;
    if (!isValidUuid(itemId)) {
      return NextResponse.json({ error: 'Validation', field: 'itemId', message: 'Invalid UUID format' }, { status: 400 });
    }
    const item = await loadAuthorizedDailyPlanItem(itemId, user.id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[Daily Plan Item GET]', error);
    return NextResponse.json(
      { error: 'Failed to load daily plan item', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { itemId } = await params;
    if (!isValidUuid(itemId)) {
      return NextResponse.json({ error: 'Validation', field: 'itemId', message: 'Invalid UUID format' }, { status: 400 });
    }
    const existing = await prisma.operations_daily_plan_items.findFirst({
      where: { id: itemId, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Prisma.operations_daily_plan_itemsUpdateInput = {};

    if (body.notes !== undefined) {
      const n = trimNullable(body.notes);
      if (n !== null && n.length > 1500) {
        return NextResponse.json(
          { error: 'Validation', field: 'notes', message: 'notes exceeds 1500 characters' },
          { status: 400 }
        );
      }
      data.notes = n;
    }

    if (body.display_order !== undefined) {
      const n = Number(body.display_order);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { error: 'Validation', field: 'display_order', message: 'display_order must be a number' },
          { status: 400 }
        );
      }
      data.display_order = Math.trunc(n);
    }

    if (body.ad_hoc_title !== undefined) {
      const t = trimNullable(body.ad_hoc_title);
      if (t === null && existing.task_id === null) {
        return NextResponse.json(
          {
            error: 'Validation',
            field: 'ad_hoc_title',
            message: 'ad_hoc_title cannot be cleared on an ad-hoc item — a task-linked or titled item is required',
          },
          { status: 400 }
        );
      }
      if (t !== null && t.length > 500) {
        return NextResponse.json(
          { error: 'Validation', field: 'ad_hoc_title', message: 'ad_hoc_title exceeds 500 characters' },
          { status: 400 }
        );
      }
      data.ad_hoc_title = t;
    }

    if (body.ad_hoc_description !== undefined) {
      const d = trimNullable(body.ad_hoc_description);
      if (d !== null && d.length > 1500) {
        return NextResponse.json(
          { error: 'Validation', field: 'ad_hoc_description', message: 'ad_hoc_description exceeds 1500 characters' },
          { status: 400 }
        );
      }
      data.ad_hoc_description = d;
    }

    const item = await prisma.operations_daily_plan_items.update({
      where: { id: itemId },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_daily_plan_item_updated',
        description: `Updated daily plan item ${itemId}`,
      },
      target: { table: 'operations_daily_plan_items', id: item.id },
      payload: {
        before: existing,
        after: item,
        metadata: {
          plan_date: existing.plan_date,
          entity_id: existing.entity_id,
        },
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[Daily Plan Item PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update daily plan item', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { itemId } = await params;
    if (!isValidUuid(itemId)) {
      return NextResponse.json({ error: 'Validation', field: 'itemId', message: 'Invalid UUID format' }, { status: 400 });
    }
    const existing = await loadAuthorizedDailyPlanItem(itemId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // calendar_blocks cascade-delete via FK ON DELETE CASCADE — capture
    // them before the delete so the audit payload retains the full state.
    const { calendar_blocks, ...item } = existing;

    await prisma.operations_daily_plan_items.delete({ where: { id: itemId } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_daily_plan_item_deleted',
        description: `Deleted daily plan item ${itemId} (${calendar_blocks.length} calendar block(s) cascade-deleted)`,
      },
      target: { table: 'operations_daily_plan_items', id: itemId },
      payload: {
        before: { item, calendar_blocks },
        metadata: {
          plan_date: item.plan_date,
          entity_id: item.entity_id,
          cascaded_block_count: calendar_blocks.length,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Daily Plan Item DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete daily plan item', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
