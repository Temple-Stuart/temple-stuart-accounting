/**
 * POST /api/operations/ai/generate-design
 *
 * Stateless variant of the per-project endpoint. Accepts the user's
 * goal/problem/diagnosis directly in the request body — used by the
 * project CREATE form before a project_id exists.
 *
 * The audit row's target falls back to the operations_ai_usage row
 * itself (target_table='operations_ai_usage', target_id=usage.id) via
 * the existing recordUsage fallback engineered in PR-Ops-3.5.
 * metadata.purpose discriminates from edit-mode calls.
 *
 * Same response shape as the per-project endpoint including the
 * inspection block. UI renders the same preview pane + drawer.
 *
 * Truth-first: does NOT auto-save anything. Returns the generated text
 * for user review. User must explicitly click "use this" to populate
 * the create form's design textarea, then "create project" to save.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateProjectDesign } from '@/lib/ai/generateProjectDesign';

interface RequestBody {
  title?: string;
  goal?: string;
  problem?: string;
  diagnosis?: string;
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
    const title = (body.title ?? '').trim();
    const goal = (body.goal ?? '').trim();
    const problem = (body.problem ?? '').trim();
    const diagnosis = (body.diagnosis ?? '').trim();

    if (!title || !goal || !problem || !diagnosis) {
      return NextResponse.json(
        {
          error: 'Validation',
          message: 'title, goal, problem, and diagnosis are all required to generate a design',
        },
        { status: 400 }
      );
    }

    // generateProjectDesign accepts an empty projectId as the sentinel
    // for stateless mode; it routes the audit row to the usage row via
    // the recordUsage fallback and discriminates the purpose label.
    const result = await generateProjectDesign({
      userId: user.id,
      userEmail,
      projectId: '',
      projectTitle: title,
      goal,
      problem,
      diagnosis,
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
