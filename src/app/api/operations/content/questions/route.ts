/**
 * /api/operations/content/questions
 *
 * Alex's reusable SCENE-QUESTION library (OPS-CE-2 table). This is the
 * minimal manager that makes the library usable (CE-3 enabler): list + create.
 * Archiving lives on the [id] route. CE-3's AI enrich ASSIGNS from this library.
 *
 * GET  — list the user's ACTIVE questions (is_active=true), optional
 *        ?entity_id filter, ordered by sort_order then created_at. Read-only.
 * POST — create a question: question_text (required), label / sort_order
 *        (optional), entity_id (required + owned). Soft-delete only — there is
 *        no hard-delete (scenes snapshot a question's wording).
 *
 * Security (mirrors content/grid/piece/route.ts):
 *   - cookie verify (getVerifiedEmail) → 401, users lookup → 404
 *   - entity_id must name an entity owned by the caller (entities.userId),
 *     else defensive 404. user_id is server-set from auth, never the client.
 *   - writeAuditLog after writes. Audit note: there is no
 *     operations_content_question_* AuditActionType yet — adding one is a
 *     schema change, deliberately deferred. Logged under system_other with
 *     target.table = operations_content_questions (same precedent as the
 *     piece-create route). FOLLOW-UP: add the enum and switch over.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id');

    const questions = await prisma.operations_content_questions.findMany({
      where: {
        user_id: user.id,
        is_active: true,
        ...(entityId ? { entity_id: entityId } : {}),
      },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('[Content Questions GET]', error);
    return NextResponse.json(
      { error: 'Failed to load questions', message: error instanceof Error ? error.message : 'unknown' },
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

    const body = (await request.json()) as Record<string, unknown>;

    // question_text required.
    if (typeof body.question_text !== 'string' || body.question_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'question_text', message: 'question_text is required' },
        { status: 400 }
      );
    }
    const questionText = body.question_text.trim();

    // entity_id required + owned (defensive 404).
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

    // label optional, capped at 200.
    let label: string | null = null;
    if (body.label !== undefined && body.label !== null) {
      if (typeof body.label !== 'string') {
        return NextResponse.json(
          { error: 'Validation', field: 'label', message: 'label must be a string' },
          { status: 400 }
        );
      }
      const l = body.label.trim();
      if (l.length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'label', message: 'label exceeds 200 characters' },
          { status: 400 }
        );
      }
      label = l.length > 0 ? l : null;
    }

    // sort_order optional, non-negative integer (default 0).
    let sortOrder = 0;
    if (body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== '') {
      const n = Number(body.sort_order);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'sort_order', message: 'sort_order must be a non-negative integer' },
          { status: 400 }
        );
      }
      sortOrder = n;
    }

    const question = await prisma.operations_content_questions.create({
      data: {
        user_id: user.id,
        entity_id: entity.id,
        question_text: questionText,
        label,
        sort_order: sortOrder,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: `Created content question "${questionText.slice(0, 80)}" for entity ${entity.id}`,
      },
      target: { table: 'operations_content_questions', id: question.id },
      payload: {
        after: question,
        metadata: { entity_id: entity.id },
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error('[Content Questions POST]', error);
    return NextResponse.json(
      { error: 'Failed to create question', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
