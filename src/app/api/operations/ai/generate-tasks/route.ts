/**
 * POST /api/operations/ai/generate-tasks
 *
 * Stateless variant of /api/operations/projects/[id]/generate-tasks.
 * Used by SectionD's create-project form to preview AI-synthesized
 * tasks BEFORE the project row exists. Mirrors the generate-design
 * stateless pattern: validate, call the generator with projectId='',
 * return the structured array + cost + inspection for human review.
 *
 * Truth-first: does NOT save tasks. The caller (SectionD's preview-
 * tasks flow) must explicitly create the project first, then bulk-
 * create the tasks against the new id. The acceptance gate lives in
 * AITaskPreview's onAcceptStateless callback.
 *
 * Validation:
 *   - projectTitle: trimmed string, 1–500 chars
 *   - goalItems / problemItems / diagnosisItems: arrays of 1–30 trimmed
 *     strings, each 1–1000 chars
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateProjectTasks } from '@/lib/ai/generateProjectTasks';

interface RequestBody {
  projectTitle?: unknown;
  goalItems?: unknown;
  problemItems?: unknown;
  diagnosisItems?: unknown;
}

const MAX_TITLE_CHARS = 500;
const MAX_ITEMS_PER_ARRAY = 30;
const MAX_CHARS_PER_ITEM = 1000;

function validateItems(
  value: unknown,
  fieldName: string
): { ok: true; items: string[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message: `${fieldName} must be an array` };
  }
  if (value.length === 0) {
    return { ok: false, message: `${fieldName} must contain at least one item` };
  }
  if (value.length > MAX_ITEMS_PER_ARRAY) {
    return {
      ok: false,
      message: `${fieldName} cannot have more than ${MAX_ITEMS_PER_ARRAY} items`,
    };
  }
  const items: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const raw = value[i];
    if (typeof raw !== 'string') {
      return { ok: false, message: `${fieldName}[${i}] must be a string` };
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return { ok: false, message: `${fieldName}[${i}] cannot be empty` };
    }
    if (trimmed.length > MAX_CHARS_PER_ITEM) {
      return {
        ok: false,
        message: `${fieldName}[${i}] exceeds ${MAX_CHARS_PER_ITEM} characters`,
      };
    }
    items.push(trimmed);
  }
  return { ok: true, items };
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = (await request.json()) as RequestBody;

    const projectTitle =
      typeof body.projectTitle === 'string' ? body.projectTitle.trim() : '';
    if (projectTitle.length === 0) {
      return NextResponse.json(
        { error: 'projectTitle is required' },
        { status: 400 }
      );
    }
    if (projectTitle.length > MAX_TITLE_CHARS) {
      return NextResponse.json(
        { error: `projectTitle exceeds ${MAX_TITLE_CHARS} characters` },
        { status: 400 }
      );
    }

    const goalResult = validateItems(body.goalItems, 'goalItems');
    if (!goalResult.ok) {
      return NextResponse.json({ error: goalResult.message }, { status: 400 });
    }

    const problemResult = validateItems(body.problemItems, 'problemItems');
    if (!problemResult.ok) {
      return NextResponse.json({ error: problemResult.message }, { status: 400 });
    }

    const diagnosisResult = validateItems(body.diagnosisItems, 'diagnosisItems');
    if (!diagnosisResult.ok) {
      return NextResponse.json({ error: diagnosisResult.message }, { status: 400 });
    }

    try {
      const result = await generateProjectTasks({
        userId: user.id,
        userEmail,
        projectId: '',
        projectTitle,
        goalItems: goalResult.items,
        problemItems: problemResult.items,
        diagnosisItems: diagnosisResult.items,
      });

      return NextResponse.json({
        tasks: result.tasks,
        usageId: result.usageId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        inspection: result.inspection,
      });
    } catch (genError) {
      const message = genError instanceof Error ? genError.message : 'unknown';
      return NextResponse.json(
        { error: `AI task synthesis failed: ${message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Stateless Generate Tasks POST]', error);
    return NextResponse.json(
      {
        error: `AI task synthesis failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      },
      { status: 500 }
    );
  }
}
