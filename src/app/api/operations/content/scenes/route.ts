/**
 * /api/operations/content/scenes
 *
 * GET  — list operations_content_scene_groups for the authenticated user,
 *        ordered by scene_number ASC. Optional ?entity_id filter.
 *        No audit (read-only).
 * POST — create a scene. routine_id must reference a routine owned by
 *        the caller; entity_id is server-derived from that routine
 *        (β-1: never trust client value). scene_number is unique per
 *        user; routine_id is unique globally (one scene per routine).
 *        Audits operations_content_scene_created.
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

    const scenes = await prisma.operations_content_scene_groups.findMany({
      where,
      orderBy: { scene_number: 'asc' },
    });

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error('[Content Scenes GET]', error);
    return NextResponse.json(
      { error: 'Failed to load scenes', message: error instanceof Error ? error.message : 'unknown' },
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

    // --- Required fields ---
    if (typeof body.routine_id !== 'string' || !isValidUuid(body.routine_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'routine_id', message: 'routine_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    const routineId = body.routine_id;

    if (typeof body.scene_number !== 'number' || !Number.isInteger(body.scene_number) || body.scene_number <= 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'scene_number', message: 'scene_number is required and must be a positive integer' },
        { status: 400 }
      );
    }
    const sceneNumber = body.scene_number;

    if (typeof body.scene_title !== 'string') {
      return NextResponse.json(
        { error: 'Validation', field: 'scene_title', message: 'scene_title is required and must be a string' },
        { status: 400 }
      );
    }
    const sceneTitle = body.scene_title.trim();
    if (sceneTitle.length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'scene_title', message: 'scene_title cannot be empty' },
        { status: 400 }
      );
    }
    if (sceneTitle.length > 500) {
      return NextResponse.json(
        { error: 'Validation', field: 'scene_title', message: 'scene_title exceeds 500 characters' },
        { status: 400 }
      );
    }

    // --- Optional fields ---
    let focusCategory: string | null = null;
    if (body.focus_category !== undefined && body.focus_category !== null) {
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
      focusCategory = t.length > 0 ? t : null;
    }

    let filmingLocationBase: string | null = null;
    if (body.filming_location_base !== undefined && body.filming_location_base !== null) {
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
      filmingLocationBase = t.length > 0 ? t : null;
    }

    let estimatedHours: number | null = null;
    if (body.estimated_hours !== undefined && body.estimated_hours !== null) {
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
      estimatedHours = body.estimated_hours;
    }

    let script: string | null = null;
    if (body.script !== undefined && body.script !== null) {
      if (typeof body.script !== 'string') {
        return NextResponse.json(
          { error: 'Validation', field: 'script', message: 'script must be a string' },
          { status: 400 }
        );
      }
      const t = body.script.trim();
      script = t.length > 0 ? t : null;
    }

    // --- Ownership: routine must belong to the caller (defensive 404) ---
    const routine = await prisma.operations_routines.findFirst({
      where: { id: routineId, user_id: user.id },
    });
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // entity_id is server-derived from the parent routine — never the client.
    const entityId = routine.entity_id;

    // --- UNIQUE constraint pre-checks ---
    const existingForRoutine = await prisma.operations_content_scene_groups.findFirst({
      where: { routine_id: routineId },
    });
    if (existingForRoutine) {
      return NextResponse.json(
        { error: 'Conflict', field: 'routine_id', message: 'a scene already exists for this routine' },
        { status: 409 }
      );
    }

    const existingForNumber = await prisma.operations_content_scene_groups.findFirst({
      where: { user_id: user.id, scene_number: sceneNumber },
    });
    if (existingForNumber) {
      return NextResponse.json(
        { error: 'Conflict', field: 'scene_number', message: `scene_number ${sceneNumber} already in use` },
        { status: 409 }
      );
    }

    const scene = await prisma.operations_content_scene_groups.create({
      data: {
        user_id: user.id,
        entity_id: entityId,
        routine_id: routineId,
        scene_number: sceneNumber,
        scene_title: sceneTitle,
        focus_category: focusCategory,
        filming_location_base: filmingLocationBase,
        estimated_hours: estimatedHours,
        script,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_content_scene_created',
        description: `Created content scene ${sceneNumber} for routine ${routineId}`,
      },
      target: { table: 'operations_content_scene_groups', id: scene.id },
      payload: {
        after: scene,
        metadata: {
          routine_id: routineId,
          entity_id: entityId,
          scene_number: sceneNumber,
        },
      },
    });

    return NextResponse.json({ scene }, { status: 201 });
  } catch (error) {
    console.error('[Content Scenes POST]', error);
    return NextResponse.json(
      { error: 'Failed to create scene', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
