/**
 * /api/operations/content/takes/[id]
 *
 * GET    — read one take owned by the caller.
 * PATCH  — update mutable fields (filming_location_specific,
 *          camera_needed, filming_angle, notes). routine_step_id,
 *          entity_id and the system columns are immutable and rejected
 *          with 400. Empty body is a valid no-op update.
 * DELETE — hard delete. Audits operations_content_take_deleted.
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
  'routine_step_id',
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

    const take = await prisma.operations_content_takes.findFirst({
      where: { id, user_id: user.id },
    });
    if (!take) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ take });
  } catch (error) {
    console.error('[Content Take GET]', error);
    return NextResponse.json(
      { error: 'Failed to load take', message: error instanceof Error ? error.message : 'unknown' },
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

    const data: Prisma.operations_content_takesUpdateInput = {};

    if (body.filming_location_specific !== undefined) {
      if (body.filming_location_specific === null) {
        data.filming_location_specific = null;
      } else {
        if (typeof body.filming_location_specific !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'filming_location_specific', message: 'filming_location_specific must be a string' },
            { status: 400 }
          );
        }
        const t = body.filming_location_specific.trim();
        if (t.length > 200) {
          return NextResponse.json(
            { error: 'Validation', field: 'filming_location_specific', message: 'filming_location_specific exceeds 200 characters' },
            { status: 400 }
          );
        }
        data.filming_location_specific = t.length > 0 ? t : null;
      }
    }

    if (body.camera_needed !== undefined) {
      if (body.camera_needed === null) {
        data.camera_needed = null;
      } else {
        if (typeof body.camera_needed !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'camera_needed', message: 'camera_needed must be a string' },
            { status: 400 }
          );
        }
        const t = body.camera_needed.trim();
        if (t.length > 200) {
          return NextResponse.json(
            { error: 'Validation', field: 'camera_needed', message: 'camera_needed exceeds 200 characters' },
            { status: 400 }
          );
        }
        data.camera_needed = t.length > 0 ? t : null;
      }
    }

    if (body.filming_angle !== undefined) {
      if (body.filming_angle === null) {
        data.filming_angle = null;
      } else {
        if (typeof body.filming_angle !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'filming_angle', message: 'filming_angle must be a string' },
            { status: 400 }
          );
        }
        const t = body.filming_angle.trim();
        if (t.length > 200) {
          return NextResponse.json(
            { error: 'Validation', field: 'filming_angle', message: 'filming_angle exceeds 200 characters' },
            { status: 400 }
          );
        }
        data.filming_angle = t.length > 0 ? t : null;
      }
    }

    if (body.notes !== undefined) {
      if (body.notes === null) {
        data.notes = null;
      } else {
        if (typeof body.notes !== 'string') {
          return NextResponse.json(
            { error: 'Validation', field: 'notes', message: 'notes must be a string' },
            { status: 400 }
          );
        }
        const t = body.notes.trim();
        data.notes = t.length > 0 ? t : null;
      }
    }

    const existing = await prisma.operations_content_takes.findFirst({
      where: { id, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.operations_content_takes.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_content_take_updated',
        description: `Updated content take ${id}`,
      },
      target: { table: 'operations_content_takes', id: updated.id },
      payload: {
        before: existing,
        after: updated,
        metadata: {
          routine_step_id: existing.routine_step_id,
          entity_id: existing.entity_id,
        },
      },
    });

    return NextResponse.json({ take: updated });
  } catch (error) {
    console.error('[Content Take PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update take', message: error instanceof Error ? error.message : 'unknown' },
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

    const existing = await prisma.operations_content_takes.findFirst({
      where: { id, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.operations_content_takes.delete({ where: { id } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_content_take_deleted',
        description: `Deleted content take ${id}`,
      },
      target: { table: 'operations_content_takes', id },
      payload: {
        before: existing,
        metadata: {
          routine_step_id: existing.routine_step_id,
          entity_id: existing.entity_id,
        },
      },
    });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('[Content Take DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete take', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
