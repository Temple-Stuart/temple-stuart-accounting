/**
 * /api/operations/content/scene-rows
 *
 * POST — upsert a scene-ROW (operations_content_scenes) for a routine
 * STEP, keyed by routine_step_id (@unique). This is the grid's row
 * source: one scene-row per routine step, carrying the STABLE shot
 * fields Alex fills in Scenify — camera_needed, filming_angle, shot_type,
 * b_roll, narrative_purpose. The per-day SCRIPT is NOT here (that is the
 * grid's take-cells, /grid/cell).
 *
 * Security (mirrors content/takes/route.ts):
 *   - cookie verify (getVerifiedEmail) → 401, users lookup → 404
 *   - the routine_step must belong to the authed user (defensive 404)
 *   - entity_id is server-derived from the step — never the client
 *   - writeAuditLog after the write: operations_content_scene_created on
 *     insert, operations_content_scene_updated on update (these are the
 *     scene-row audit enums).
 *
 * Upsert (not 409) so Scenify is re-openable to refine shot fields over
 * time — "evolve how I shoot."
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

// VarChar(200) shot fields: trim, cap at 200, empty → null.
function parseVarchar200(
  body: Record<string, unknown>,
  field: string
): { value: string | null } | { error: NextResponse } {
  const raw = body[field];
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') {
    return {
      error: NextResponse.json(
        { error: 'Validation', field, message: `${field} must be a string` },
        { status: 400 }
      ),
    };
  }
  const t = raw.trim();
  if (t.length > 200) {
    return {
      error: NextResponse.json(
        { error: 'Validation', field, message: `${field} exceeds 200 characters` },
        { status: 400 }
      ),
    };
  }
  return { value: t.length > 0 ? t : null };
}

// Text shot fields: trim, empty → null, no length cap.
function parseText(
  body: Record<string, unknown>,
  field: string
): { value: string | null } | { error: NextResponse } {
  const raw = body[field];
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') {
    return {
      error: NextResponse.json(
        { error: 'Validation', field, message: `${field} must be a string` },
        { status: 400 }
      ),
    };
  }
  const t = raw.trim();
  return { value: t.length > 0 ? t : null };
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.routine_step_id !== 'string' || !isValidUuid(body.routine_step_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'routine_step_id', message: 'routine_step_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    const routineStepId: string = body.routine_step_id;

    const cameraNeeded = parseVarchar200(body, 'camera_needed');
    if ('error' in cameraNeeded) return cameraNeeded.error;
    const filmingAngle = parseVarchar200(body, 'filming_angle');
    if ('error' in filmingAngle) return filmingAngle.error;
    const shotType = parseVarchar200(body, 'shot_type');
    if ('error' in shotType) return shotType.error;
    const bRoll = parseText(body, 'b_roll');
    if ('error' in bRoll) return bRoll.error;
    const narrativePurpose = parseText(body, 'narrative_purpose');
    if ('error' in narrativePurpose) return narrativePurpose.error;

    // --- Ownership: the routine step must belong to the caller (defensive 404) ---
    // OPS-CE-1: is_active guard — an archived (soft-deleted) step is inert; no
    // new scene-row may be created/refined on it (404), so removed steps can't
    // be silently resurrected with content.
    const step = await prisma.operations_routine_steps.findFirst({
      where: { id: routineStepId, user_id: user.id, is_active: true },
    });
    if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // entity_id is server-derived from the parent step — never the client.
    const entityId = step.entity_id;

    // Resolve create-vs-update up front for an accurate audit action.
    const existing = await prisma.operations_content_scenes.findUnique({
      where: { routine_step_id: routineStepId },
    });

    const shotData = {
      camera_needed: cameraNeeded.value,
      filming_angle: filmingAngle.value,
      shot_type: shotType.value,
      b_roll: bRoll.value,
      narrative_purpose: narrativePurpose.value,
    };

    const sceneRow = existing
      ? await prisma.operations_content_scenes.update({
          where: { routine_step_id: routineStepId },
          data: shotData,
        })
      : await prisma.operations_content_scenes.create({
          data: {
            user_id: user.id,
            entity_id: entityId,
            routine_step_id: routineStepId,
            ...shotData,
          },
        });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: existing ? 'operations_content_scene_updated' : 'operations_content_scene_created',
        description: `${existing ? 'Updated' : 'Created'} content scene-row for routine step ${routineStepId}`,
      },
      target: { table: 'operations_content_scenes', id: sceneRow.id },
      payload: {
        before: existing ?? undefined,
        after: sceneRow,
        metadata: { routine_step_id: routineStepId, entity_id: entityId },
      },
    });

    return NextResponse.json({ sceneRow, created: !existing }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('[Content Scene-Rows POST]', error);
    return NextResponse.json(
      { error: 'Failed to upsert scene-row', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
