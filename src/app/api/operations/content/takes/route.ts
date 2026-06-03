/**
 * /api/operations/content/takes
 *
 * GET  — list operations_content_scenes for the authenticated user,
 *        ordered by created_at ASC. Optional ?entity_id filter.
 *        No audit (read-only).
 * POST — create a take. routine_step_id must reference a routine step
 *        owned by the caller; entity_id is server-derived from that
 *        step (β-1: never trust client value). routine_step_id is
 *        unique (one take per step). All four content fields are
 *        optional — a bare take row is a valid "marked-as-takeable,
 *        details TBD" state. Audits operations_content_take_created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const where: { user_id: string; entity_id?: string } = { user_id: user.id };

    if (searchParams.has('entity_id')) {
      const entityId = searchParams.get('entity_id');
      if (typeof entityId !== 'string' || entityId.length === 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'entity_id', message: 'entity_id must be a non-empty string' },
          { status: 400 }
        );
      }
      where.entity_id = entityId;
    }

    const takes = await prisma.operations_content_scenes.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({ takes });
  } catch (error) {
    console.error('[Content Takes GET]', error);
    return NextResponse.json(
      { error: 'Failed to load takes', message: error instanceof Error ? error.message : 'unknown' },
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

    // --- Required field ---
    if (typeof body.routine_step_id !== 'string' || !isValidUuid(body.routine_step_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'routine_step_id', message: 'routine_step_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    const routineStepId = body.routine_step_id;

    // --- Optional fields (validate only if present) ---
    let filmingLocationSpecific: string | null = null;
    if (body.filming_location_specific !== undefined && body.filming_location_specific !== null) {
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
      filmingLocationSpecific = t.length > 0 ? t : null;
    }

    let cameraNeeded: string | null = null;
    if (body.camera_needed !== undefined && body.camera_needed !== null) {
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
      cameraNeeded = t.length > 0 ? t : null;
    }

    let filmingAngle: string | null = null;
    if (body.filming_angle !== undefined && body.filming_angle !== null) {
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
      filmingAngle = t.length > 0 ? t : null;
    }

    let notes: string | null = null;
    if (body.notes !== undefined && body.notes !== null) {
      if (typeof body.notes !== 'string') {
        return NextResponse.json(
          { error: 'Validation', field: 'notes', message: 'notes must be a string' },
          { status: 400 }
        );
      }
      const t = body.notes.trim();
      notes = t.length > 0 ? t : null;
    }

    // --- Ownership: routine step must belong to the caller (defensive 404) ---
    const step = await prisma.operations_routine_steps.findFirst({
      where: { id: routineStepId, user_id: user.id },
    });
    if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // entity_id is server-derived from the parent routine step — never the client.
    const entityId = step.entity_id;

    // --- UNIQUE constraint pre-check ---
    const existingForStep = await prisma.operations_content_scenes.findFirst({
      where: { routine_step_id: routineStepId },
    });
    if (existingForStep) {
      return NextResponse.json(
        { error: 'Conflict', field: 'routine_step_id', message: 'a take already exists for this routine_step' },
        { status: 409 }
      );
    }

    const take = await prisma.operations_content_scenes.create({
      data: {
        user_id: user.id,
        entity_id: entityId,
        routine_step_id: routineStepId,
        filming_location_specific: filmingLocationSpecific,
        camera_needed: cameraNeeded,
        filming_angle: filmingAngle,
        notes,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_content_take_created',
        description: `Created content take for routine step ${routineStepId}`,
      },
      target: { table: 'operations_content_scenes', id: take.id },
      payload: {
        after: take,
        metadata: {
          routine_step_id: routineStepId,
          entity_id: entityId,
        },
      },
    });

    return NextResponse.json({ take }, { status: 201 });
  } catch (error) {
    console.error('[Content Takes POST]', error);
    return NextResponse.json(
      { error: 'Failed to create take', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
