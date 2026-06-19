/**
 * /api/operations/projects/[id]/prompts  (PR-TM-2)
 *
 * GET — return the THREE interpolated pipeline prompts for this project (research /
 *       audit / fusion), with the project's goals plugged in, for the Truth Machine to
 *       DISPLAY. This is the read-only "here's the actual prompt" preview.
 *
 * NO ANTHROPIC CALL — this endpoint only runs the SAME pure prompt builders the real
 * calls use (buildResearchPrompt / buildTasksPrompt / buildAuditPrompt), so the shown
 * prompt can never drift from what actually fires, AND there is zero token cost. It is
 * still AUTH-GATED + ownership-scoped (it exposes the project's goals/research/audit text).
 *
 * Inputs mirror generate-tasks / research: structured-list fields with legacy fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { toNorthStarContext } from '@/lib/ai/northStarContext';
import { buildResearchPrompt } from '@/lib/ai/generateDeepResearch';
import { buildTasksPrompt } from '@/lib/ai/generateProjectTasks';
import { buildAuditPrompt } from '@/lib/ai/buildAuditPrompt';

function resolveItems(itemsJson: unknown, legacyText: string | null): string[] {
  if (Array.isArray(itemsJson)) {
    const arr = itemsJson.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (arr.length > 0) return arr;
  }
  const legacy = (legacyText ?? '').trim();
  return legacy.length > 0 ? [legacy] : [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth + ownership (no paid call, but the prompts embed the user's project text).
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

    const nsRow = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });
    const northStar = toNorthStarContext(nsRow);

    // SAME builders the real calls use → the preview cannot drift from what fires.
    const research = buildResearchPrompt({
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
      northStar,
    });

    const audit = buildAuditPrompt({
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
    });

    const fusion = buildTasksPrompt({
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
      northStar,
      // The fusion prompt embeds the CURRENT research + audit text, so the preview
      // shows exactly what would be fused if "generate tasks" fired right now.
      deepResearchInput: project.deep_research_input,
      claudeCodeAuditInput: project.claude_code_audit_input,
    });

    return NextResponse.json({
      research, // { systemPrompt, userMessage }
      audit,    // copy-ready string
      fusion,   // { systemPrompt, userMessage }
    });
  } catch (error) {
    console.error('[Project Prompts GET]', error);
    return NextResponse.json({ error: 'Failed to build prompts' }, { status: 500 });
  }
}
