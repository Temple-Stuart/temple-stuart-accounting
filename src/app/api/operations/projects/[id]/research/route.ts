/**
 * /api/operations/projects/[id]/research  (PR-Loop-1)
 *
 * POST — the RESEARCH agent. Runs Anthropic Claude with the server-side web_search
 *        tool over the project's goal/problem/diagnosis items to produce a research
 *        brief (industry standard + how to beat it), and WRITES it to
 *        operations_projects.deep_research_input for the user to REVIEW.
 *
 * Human checkpoint preserved: this POPULATES the review field only. It does NOT
 * trigger fusion (generate-tasks) and it does NOT insert any tasks. The user reads
 * the populated research, edits if desired, then separately chooses to generate tasks.
 *
 * SECURITY:
 *   - PAID call (web_search). Auth is FIRST — getVerifiedEmail + project ownership
 *     scoping — before any API hit (mirrors generate-tasks/route.ts). On fail → 401/404
 *     before a single paid token is spent.
 *   - The key never leaves the server (client.ts getAnthropicClient reads process.env).
 *   - Web-search results are treated as untrusted data by the agent's system prompt.
 *
 * Inputs mirror generate-tasks: the structured-list fields (goal_items / problem_items /
 * diagnosis_items) with the legacy-paragraph fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateDeepResearch } from '@/lib/ai/generateDeepResearch';
import { toNorthStarContext } from '@/lib/ai/northStarContext';

/**
 * Resolve a field's items: prefer the JSONB array, fall back to wrapping the legacy
 * paragraph as a single-element array. Returns null if neither has content.
 * (Identical to generate-tasks/route.ts so research + fusion read goals the same way.)
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
    // ── AUTH FIRST (paid call — gate before any API hit) ──────────────────────
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId } = await params;
    const project = await prisma.operations_projects.findFirst({
      where: { id: projectId, user_id: user.id }, // ownership scope
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const goalItems = resolveItems(project.goal_items, project.goal);
    // PD-Clean parity: only GOAL is required. problem/diagnosis are optional — empty resolves to []
    // and the research builder ignores them (references only title+goals), so no fabricated content.
    const problemItems = resolveItems(project.problem_items, project.problem) ?? [];
    const diagnosisItems = resolveItems(project.diagnosis_items, project.diagnosis) ?? [];

    if (!goalItems) {
      return NextResponse.json(
        {
          error: 'Validation',
          message: 'project must have at least one goal item before running research',
        },
        { status: 400 }
      );
    }

    const nsRow = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });

    const result = await generateDeepResearch({
      userId: user.id,
      userEmail,
      projectId,
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
      northStar: toNorthStarContext(nsRow),
    });

    // POPULATE the review field — does NOT trigger fusion or insert any tasks.
    await prisma.operations_projects.update({
      where: { id: projectId },
      data: { deep_research_input: result.research },
    });

    return NextResponse.json({
      deep_research_input: result.research,
      usage_id: result.usageId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      inspection: result.inspection,
    });
  } catch (error) {
    console.error('[Project Research POST]', error);
    return NextResponse.json(
      {
        error: 'Failed to run research',
        message: error instanceof Error ? `AI research failed: ${error.message}` : 'unknown',
      },
      { status: 500 }
    );
  }
}
