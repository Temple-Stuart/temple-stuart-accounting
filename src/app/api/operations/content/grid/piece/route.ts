/**
 * /api/operations/content/grid/piece
 *
 * POST — create a piece (one day = one new grid COLUMN), the "+ day"
 * affordance. project_id / source_ai_usage_id are intentionally NOT set
 * here: project/version linking is a later PR; this only creates the day.
 *
 * Security (mirrors content/takes/route.ts):
 *   - cookie verify → 401, users lookup → 404
 *   - entity_id must name an entity owned by the caller (entities.userId),
 *     else a defensive 404 — a piece can only be tagged to the user's own
 *     entity. user_id is server-set from auth (never the client).
 *   - writeAuditLog after the write.
 *
 * Audit note: there is no operations_content_piece_* AuditActionType yet —
 * adding one is a schema change, deliberately deferred (this is a view PR,
 * not a schema PR). The write is still fully logged + hash-chained under
 * system_other with target.table = operations_content_pieces. FOLLOW-UP:
 * add operations_content_piece_created/updated/deleted enum values and
 * switch this over.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    // piece_date required, calendar day YYYY-MM-DD.
    if (typeof body.piece_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.piece_date)) {
      return NextResponse.json(
        { error: 'Validation', field: 'piece_date', message: 'piece_date is required as YYYY-MM-DD' },
        { status: 400 }
      );
    }
    const pieceDate = new Date(`${body.piece_date}T00:00:00.000Z`);
    if (Number.isNaN(pieceDate.getTime())) {
      return NextResponse.json(
        { error: 'Validation', field: 'piece_date', message: 'piece_date is not a valid date' },
        { status: 400 }
      );
    }

    // entity_id required + must belong to the caller (defensive 404).
    if (typeof body.entity_id !== 'string' || body.entity_id.length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'entity_id', message: 'entity_id is required' },
        { status: 400 }
      );
    }
    const entity = await prisma.entities.findFirst({
      where: { id: body.entity_id, userId: user.id },
    });
    if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // title optional.
    let title: string | null = null;
    if (body.title !== undefined && body.title !== null) {
      if (typeof body.title !== 'string') {
        return NextResponse.json(
          { error: 'Validation', field: 'title', message: 'title must be a string' },
          { status: 400 }
        );
      }
      const t = body.title.trim();
      if (t.length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'title', message: 'title exceeds 200 characters' },
          { status: 400 }
        );
      }
      title = t.length > 0 ? t : null;
    }

    const piece = await prisma.operations_content_pieces.create({
      data: {
        user_id: user.id,
        entity_id: entity.id,
        piece_date: pieceDate,
        title,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: `Created content piece (day column) ${body.piece_date} for entity ${entity.id}`,
      },
      target: { table: 'operations_content_pieces', id: piece.id },
      payload: {
        after: piece,
        metadata: { entity_id: entity.id, piece_date: body.piece_date },
      },
    });

    return NextResponse.json({ piece }, { status: 201 });
  } catch (error) {
    console.error('[Content Grid Piece POST]', error);
    return NextResponse.json(
      { error: 'Failed to create piece', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
