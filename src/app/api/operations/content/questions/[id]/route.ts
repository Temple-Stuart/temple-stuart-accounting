/**
 * /api/operations/content/questions/[id]
 *
 * DELETE — ARCHIVE a question (is_active=false). NEVER a hard delete: scene-rows
 * snapshot a question's wording (assigned_question_text), and the live FK is
 * SetNull, so retiring a question must leave both the question row and every
 * scene that referenced it intact. Mirrors the CE-1 step-archive posture.
 *
 * Security (mirrors content/scene-rows/route.ts):
 *   - cookie verify (getVerifiedEmail) → 401, users lookup → 404
 *   - the question must belong to the authed user (defensive 404)
 *   - writeAuditLog under system_other (no operations_content_question_* enum
 *     yet — same deferred-enum note as the piece-create + collection routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';

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

    const existing = await prisma.operations_content_questions.findFirst({
      where: { id, user_id: user.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Archive, never hard-delete (scenes snapshot the wording; FK is SetNull).
    const archived = await prisma.operations_content_questions.update({
      where: { id },
      data: { is_active: false },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: `Archived (soft-deleted) content question "${existing.question_text.slice(0, 80)}" — scenes that snapshot it are preserved`,
      },
      target: { table: 'operations_content_questions', id: existing.id },
      payload: {
        before: existing,
        after: archived,
        metadata: { entity_id: existing.entity_id, soft_delete: true },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Content Question DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to archive question', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
