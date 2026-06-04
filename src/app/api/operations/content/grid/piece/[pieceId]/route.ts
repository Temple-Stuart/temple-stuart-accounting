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

    // Only the fields PRESENT in the body are updated — so saving execution_notes
    // never clobbers the script, and vice-versa. Each: trim, empty → null.
    const data: Record<string, string | null> = {};
    const fields = ['script', 'execution_notes'] as const;
    for (const f of fields) {
      if (body[f] === undefined) continue;
      if (body[f] !== null && typeof body[f] !== 'string') {
        return NextResponse.json(
          { error: 'Validation', field: f, message: `${f} must be a string or null` },
          { status: 400 }
        );
      }
      const v = typeof body[f] === 'string' ? (body[f] as string).trim() : '';
      data[f] = v.length > 0 ? v : null;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'Validation', message: 'provide script and/or execution_notes' },
        { status: 400 }
      );
    }

    const piece = await prisma.operations_content_pieces.update({
      where: { id: pieceId },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: `Saved ${Object.keys(data).join(' + ')} on content piece ${pieceId} (${piece.piece_date.toISOString().slice(0, 10)})`,
      },
      target: { table: 'operations_content_pieces', id: piece.id },
      payload: {
        before: { script: existing.script, execution_notes: existing.execution_notes },
        after: { script: piece.script, execution_notes: piece.execution_notes },
        metadata: { piece_date: piece.piece_date.toISOString().slice(0, 10), fields: Object.keys(data) },
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
