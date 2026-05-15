/**
 * /api/operations/projects/[id]/generate-tasks
 *
 * POST — generate an institutional-rigor structured array of operational
 *        tasks for the project, using its current goal/problem/diagnosis
 *        items as input. Uses Claude Sonnet 4 with web_search +
 *        return_project_tasks tools under the hood.
 *
 * Truth-first: does NOT save tasks to the DB. Returns the parsed task
 * array + cost + inspection in the response. The user must explicitly
 * accept via the AITaskPreview → bulk-create gate before any rows
 * land in operations_project_tasks.
 *
 * Inputs mirror the generate-design endpoint: the structured-list
 * fields (goal_items / problem_items / diagnosis_items) populated in
 * PR-Ops-3.7, with the same legacy-paragraph fallback during the
 * migration window.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateProjectTasks } from '@/lib/ai/generateProjectTasks';

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
          message: 'project must have at least one goal item, one problem item, and one diagnosis item before generating tasks',
        },
        { status: 400 }
      );
    }

    const result = await generateProjectTasks({
      userId: user.id,
      userEmail,
      projectId,
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
    });

    return NextResponse.json({
      tasks: result.tasks,
      usage_id: result.usageId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      inspection: result.inspection,
    });
  } catch (error) {
    console.error('[Generate Tasks POST]', error);
    return NextResponse.json(
      {
        error: 'Failed to generate tasks',
        message: error instanceof Error ? `AI task synthesis failed: ${error.message}` : 'unknown',
      },
      { status: 500 }
    );
  }
}
