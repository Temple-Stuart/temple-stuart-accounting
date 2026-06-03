/**
 * /api/operations/content/grid/cell
 *
 * POST — upsert a take-cell (the per-scene × piece script) keyed by the
 * @@unique([scene_id, piece_id]) grid invariant. This is the ONLY write
 * path to cells; the grid never fabricates a cell.
 *
 * Security (mirrors content/takes/route.ts):
 *   - cookie verify (getVerifiedEmail) → 401
 *   - users lookup → 404
 *   - BOTH the scene AND the piece must belong to the authed user, else a
 *     defensive 404 (no cross-user writes, no information leak about which
 *     of the two failed).
 *   - entity_id is server-derived from the scene — never the client.
 *   - writeAuditLog after the write: operations_content_take_created on
 *     insert, operations_content_take_updated on update (a "take" = a cell).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    if (typeof body.scene_id !== 'string' || !isValidUuid(body.scene_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'scene_id', message: 'scene_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    if (typeof body.piece_id !== 'string' || !isValidUuid(body.piece_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'piece_id', message: 'piece_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    const sceneId: string = body.scene_id;
    const pieceId: string = body.piece_id;

    // script is the cell content — optional; empty trimmed → null.
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

    // --- Ownership: BOTH parents must belong to the caller (defensive 404) ---
    const scene = await prisma.operations_content_scenes.findFirst({
      where: { id: sceneId, user_id: user.id },
    });
    if (!scene) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const piece = await prisma.operations_content_pieces.findFirst({
      where: { id: pieceId, user_id: user.id },
    });
    if (!piece) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // entity_id server-derived from the scene — never the client.
    const entityId = scene.entity_id;

    // Resolve create-vs-update up front so the audit action is accurate.
    const existing = await prisma.operations_content_takes.findUnique({
      where: { scene_id_piece_id: { scene_id: sceneId, piece_id: pieceId } },
    });

    const cell = existing
      ? await prisma.operations_content_takes.update({
          where: { scene_id_piece_id: { scene_id: sceneId, piece_id: pieceId } },
          data: { script },
        })
      : await prisma.operations_content_takes.create({
          data: {
            user_id: user.id,
            entity_id: entityId,
            scene_id: sceneId,
            piece_id: pieceId,
            script,
          },
        });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: existing ? 'operations_content_take_updated' : 'operations_content_take_created',
        description: `${existing ? 'Updated' : 'Created'} content take (cell) for scene ${sceneId} × piece ${pieceId}`,
      },
      target: { table: 'operations_content_takes', id: cell.id },
      payload: {
        before: existing ?? undefined,
        after: cell,
        metadata: { scene_id: sceneId, piece_id: pieceId, entity_id: entityId },
      },
    });

    return NextResponse.json({ cell }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('[Content Grid Cell POST]', error);
    return NextResponse.json(
      { error: 'Failed to upsert cell', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
