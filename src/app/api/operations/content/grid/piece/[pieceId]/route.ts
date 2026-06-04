/**
 * PATCH /api/operations/content/grid/piece/[pieceId]
 *
 * Persist the day's reel script onto the piece (OPS-CE-5 save path). Human-gated:
 * called only when Alex saves a generated/edited script. Last-write-wins on
 * piece.script (the immutable per-run reasoning lives in operations_ai_usage).
 *
 * Security (mirrors content/grid/piece/route.ts):
 *   - cookie verify → 401, users lookup → 404
 *   - the piece must belong to the caller (defensive 404). user_id never trusted.
 *   - writeAuditLog. Audit note: no operations_content_piece_* AuditActionType exists
 *     yet (same deferred-enum gap as the piece-create route) — logged under
 *     system_other with target.table = operations_content_pieces. FOLLOW-UP: add the
 *     enum and switch over.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { pieceId } = await params;
    if (!isValidUuid(pieceId)) {
      return NextResponse.json({ error: 'Validation', field: 'pieceId', message: 'Invalid UUID format' }, { status: 400 });
    }

    const existing = await prisma.operations_content_pieces.findFirst({
      where: { id: pieceId, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;

    // script: required for this endpoint; trim, empty → null.
    if (body.script !== undefined && body.script !== null && typeof body.script !== 'string') {
      return NextResponse.json(
        { error: 'Validation', field: 'script', message: 'script must be a string or null' },
        { status: 400 }
      );
    }
    const script =
      typeof body.script === 'string' && body.script.trim().length > 0 ? body.script.trim() : null;

    const piece = await prisma.operations_content_pieces.update({
      where: { id: pieceId },
      data: { script },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: `Saved reel script on content piece ${pieceId} (${piece.piece_date.toISOString().slice(0, 10)})`,
      },
      target: { table: 'operations_content_pieces', id: piece.id },
      payload: {
        before: { script: existing.script },
        after: { script: piece.script },
        metadata: { piece_date: piece.piece_date.toISOString().slice(0, 10) },
      },
    });

    return NextResponse.json({ piece });
  } catch (error) {
    console.error('[Content Piece PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to save script', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
