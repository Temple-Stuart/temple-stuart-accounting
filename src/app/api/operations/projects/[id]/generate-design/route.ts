/**
 * /api/operations/projects/[id]/generate-design
 *
 * POST — generate an institutional-rigor design field for the project,
 *        using its current goal/problem/diagnosis as input.
 *
 * PR-Ops-3.7 update: reads structured array fields (goal_items,
 * problem_items, diagnosis_items) when populated; falls back to
 * legacy paragraph fields wrapped as single-element arrays for
 * backwards compatibility during the migration window. After all
 * projects are converted to structured lists, the legacy fallback
 * branch can be removed in a cleanup PR.
 *
 * Truth-first: does NOT save to the project. Returns the generated
 * text in the response; user must explicitly accept and PATCH the
 * project with the new design field separately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateProjectDesign } from '@/lib/ai/generateProjectDesign';
import { toNorthStarContext } from '@/lib/ai/northStarContext';
import { requirePipeBudget, PipeBudgetError } from '@/lib/pipeBudget';

/**
 * Resolve a field's items: prefer the JSONB array, fall back to wrapping
 * the legacy paragraph as a single-element array. Returns null if neither
 * has content (caller rejects).
 */
function resolveItems(itemsJson: unknown, legacyText: string | null): string[] | null {
  if (Array.isArray(itemsJson)) {
    const arr = itemsJson.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (arr.length > 0) return arr;
  }
  const legacy = (legacyText ?? '').trim();
  if (legacy.length > 0) return [legacy];
  return null;
}

export async function POST(
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

    const { id: projectId } = await params;
    const project = await prisma.operations_projects.findFirst({
      where: { id: projectId, user_id: user.id },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const goalItems = resolveItems(project.goal_items, project.goal);
    const problemItems = resolveItems(project.problem_items, project.problem);
    const diagnosisItems = resolveItems(project.diagnosis_items, project.diagnosis);

    if (!goalItems || !problemItems || !diagnosisItems) {
      return NextResponse.json(
        {
          error: 'Validation',
          message: 'project must have goal, problem, and diagnosis content (as items or legacy text) before generating design',
        },
        { status: 400 }
      );
    }

    // COST-GUARD-1: daily spend cap — AFTER auth, BEFORE the paid call. Over cap → 429.
    await requirePipeBudget(user.id);

    const nsRow = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });

    const result = await generateProjectDesign({
      userId: user.id,
      userEmail,
      projectId,
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
      northStar: toNorthStarContext(nsRow),
      // Ground the plan in the project's pasted codebase audit (same source the
      // tasks endpoint uses) so it reuses what exists instead of rebuilding it.
      auditInput: project.claude_code_audit_input,
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
    if (error instanceof PipeBudgetError) {
      return NextResponse.json({ error: 'Rate limit', message: error.message }, { status: 429 });
    }
    console.error('[Generate Design POST]', error);
    return NextResponse.json(
      { error: 'Failed to generate design', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
