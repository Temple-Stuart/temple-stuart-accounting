/**
 * /api/operations/content/scenes/[id]
 *
 * GET    — read one scene owned by the caller.
 * PATCH  — update mutable fields (scene_title, focus_category,
 *          filming_location_base, estimated_hours, script). routine_id,
 *          scene_number, entity_id and the system columns are immutable
 *          and rejected with 400.
 * DELETE — hard delete. Audits operations_content_scene_deleted.
 *
 * All handlers scope by user_id with defensive 404 non-disclosure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

const IMMUTABLE_FIELDS = [
  'routine_id',
  'scene_number',
  'entity_id',
  'user_id',
  'id',
  'created_at',
  'updated_at',
];

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
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'id', message: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    const scene = await prisma.operations_content_scenes.findFirst({
      where: { id, user_id: user.id },
    });
    if (!scene) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ scene });
  } catch (error) {
    console.error('[Content Scene GET]', error);
    return NextResponse.json(
      { error: 'Failed to load scene', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
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
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'id', message: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Reject any attempt to mutate an immutable field.
    for (const field of IMMUTABLE_FIELDS) {
      if (field in body) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} is immutable and cannot be updated` },
          { status: 400 }
        );
      }
    }

    const data: Prisma.operations_content_scenesUpdateInput = {};

    if (body.scene_title !== undefined) {
      if (typeof body.scene_title !== 'string') {
        return NextResponse.json(
          { error: 'Validation', field: 'scene_title', message: 'scene_title must be a string' },
          { status: 400 }
        );
      }
      const t = body.scene_title.trim();
      if (t.length === 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'scene_title', message: 'scene_title cannot be empty' },
          { status: 400 }
        );
      }
      if (t.length > 500) {
        return NextResponse.json(
          { error: 'Validation', field: 'scene_title', message: 'scene_title exceeds 500 characters' },
          { status: 400 }
        );
      }
      data.scene_title = t;
    }

    if (body.focus_category !== undefined) {
      if (body.focus_category === null) {
        data.focus_category = null;
      } else {
        if (typeof body.focus_category !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'focus_category', message: 'focus_category must be a string' },
            { status: 400 }
          );
        }
        const t = body.focus_category.trim();
        if (t.length > 200) {
          return NextResponse.json(
            { error: 'Validation', field: 'focus_category', message: 'focus_category exceeds 200 characters' },
            { status: 400 }
          );
        }
        data.focus_category = t.length > 0 ? t : null;
      }
    }

    if (body.filming_location_base !== undefined) {
      if (body.filming_location_base === null) {
        data.filming_location_base = null;
      } else {
        if (typeof body.filming_location_base !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'filming_location_base', message: 'filming_location_base must be a string' },
            { status: 400 }
          );
        }
        const t = body.filming_location_base.trim();
        if (t.length > 200) {
          return NextResponse.json(
            { error: 'Validation', field: 'filming_location_base', message: 'filming_location_base exceeds 200 characters' },
            { status: 400 }
          );
        }
        data.filming_location_base = t.length > 0 ? t : null;
      }
    }

    if (body.estimated_hours !== undefined) {
      if (body.estimated_hours === null) {
        data.estimated_hours = null;
      } else {
        if (typeof body.estimated_hours !== 'number' || !Number.isFinite(body.estimated_hours)) {
          return NextResponse.json(
            { error: 'Validation', field: 'estimated_hours', message: 'estimated_hours must be a number' },
            { status: 400 }
          );
        }
        if (body.estimated_hours <= 0 || body.estimated_hours > 999.99) {
          return NextResponse.json(
            { error: 'Validation', field: 'estimated_hours', message: 'estimated_hours must be greater than 0 and at most 999.99' },
            { status: 400 }
          );
        }
        data.estimated_hours = body.estimated_hours;
      }
    }

    if (body.script !== undefined) {
      if (body.script === null) {
        data.script = null;
      } else {
        if (typeof body.script !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'script', message: 'script must be a string' },
            { status: 400 }
          );
        }
        const t = body.script.trim();
        data.script = t.length > 0 ? t : null;
      }
    }

    const existing = await prisma.operations_content_scenes.findFirst({
      where: { id, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.operations_content_scenes.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_content_scene_updated',
        description: `Updated content scene ${id}`,
      },
      target: { table: 'operations_content_scenes', id: updated.id },
      payload: {
        before: existing,
        after: updated,
        metadata: {
          routine_id: existing.routine_id,
          scene_number: existing.scene_number,
        },
      },
    });

    return NextResponse.json({ scene: updated });
  } catch (error) {
    console.error('[Content Scene PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update scene', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
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
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'id', message: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    const existing = await prisma.operations_content_scenes.findFirst({
      where: { id, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.operations_content_scenes.delete({ where: { id } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_content_scene_deleted',
        description: `Deleted content scene ${id}`,
      },
      target: { table: 'operations_content_scenes', id },
      payload: {
        before: existing,
        metadata: {
          routine_id: existing.routine_id,
          scene_number: existing.scene_number,
        },
      },
    });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('[Content Scene DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete scene', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
