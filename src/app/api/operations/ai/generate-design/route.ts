/**
 * POST /api/operations/ai/generate-design
 *
 * Stateless variant of the per-project endpoint (PR-Ops-3.6 introduced).
 * PR-Ops-3.7 updates: accepts structured array inputs (goalItems,
 * problemItems, diagnosisItems) instead of paragraph strings. The AI
 * system prompt was rewritten to STEP-based output with research
 * instruction; user message format is bulleted lists.
 *
 * Validation:
 *   - title: non-empty trimmed string
 *   - goalItems: non-empty array, each item ≤ 500 chars trimmed,
 *                array ≤ 20 items
 *   - problemItems: same
 *   - diagnosisItems: same
 *
 * Truth-first: does NOT auto-save anything. Returns the generated text
 * for user review. User must explicitly click "use this" to populate
 * the create form's design field, then "create project" to save.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateProjectDesign } from '@/lib/ai/generateProjectDesign';

interface RequestBody {
  title?: string;
  goalItems?: unknown;
  problemItems?: unknown;
  diagnosisItems?: unknown;
}

const MAX_ITEMS_PER_ARRAY = 20;
const MAX_CHARS_PER_ITEM = 500;

function validateItems(value: unknown, fieldName: string): { ok: true; items: string[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message: `${fieldName} must be an array` };
  }
  if (value.length === 0) {
    return { ok: false, message: `${fieldName} must contain at least one item` };
  }
  if (value.length > MAX_ITEMS_PER_ARRAY) {
    return { ok: false, message: `${fieldName} cannot have more than ${MAX_ITEMS_PER_ARRAY} items` };
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
      return { ok: false, message: `${fieldName}[${i}] exceeds ${MAX_CHARS_PER_ITEM} characters` };
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
    const title = (typeof body.title === 'string' ? body.title : '').trim();
    if (!title) {
      return NextResponse.json(
        { error: 'Validation', message: 'title is required' },
        { status: 400 }
      );
    }

    const goalResult = validateItems(body.goalItems, 'goalItems');
    if (!goalResult.ok) return NextResponse.json({ error: 'Validation', message: goalResult.message }, { status: 400 });

    const problemResult = validateItems(body.problemItems, 'problemItems');
    if (!problemResult.ok) return NextResponse.json({ error: 'Validation', message: problemResult.message }, { status: 400 });

    const diagnosisResult = validateItems(body.diagnosisItems, 'diagnosisItems');
    if (!diagnosisResult.ok) return NextResponse.json({ error: 'Validation', message: diagnosisResult.message }, { status: 400 });

    const result = await generateProjectDesign({
      userId: user.id,
      userEmail,
      projectId: '',
      projectTitle: title,
      goalItems: goalResult.items,
      problemItems: problemResult.items,
      diagnosisItems: diagnosisResult.items,
    });

    return NextResponse.json({
      generated_design: result.generatedDesign,
      usage_id: result.usageId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      inspection: result.inspection,
    });
  } catch (error) {
    console.error('[Stateless Generate Design POST]', error);
    return NextResponse.json(
      { error: 'Failed to generate design', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
