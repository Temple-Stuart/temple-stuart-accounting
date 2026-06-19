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
import { buildResearchPrompt, buildResearchSegments } from '@/lib/ai/generateDeepResearch';
import { buildTasksPrompt, buildTasksSegments } from '@/lib/ai/generateProjectTasks';
import { buildAuditPrompt, buildAuditSegments } from '@/lib/ai/buildAuditPrompt';
import { verifyAgainst } from '@/lib/ai/promptSegments';

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
    // Each prompt ALSO carries `segments` (template vs user-input spans) for the red-input
    // display, verified against the real string — verifyAgainst returns the spans ONLY if
    // they rebuild the real prompt exactly, else one neutral segment (no red, never a lie).
    const researchInput = { projectTitle: project.title, goalItems, problemItems, diagnosisItems, northStar };
    const research = buildResearchPrompt(researchInput);
    const researchSegments = verifyAgainst(buildResearchSegments(researchInput), research.userMessage);

    // PROMPT-2: the audit prompt imports the research findings (the standard it measures
    // against) — mirrors how fusion embeds the research text below.
    const auditInput = { projectTitle: project.title, goalItems, deepResearchInput: project.deep_research_input };
    const audit = buildAuditPrompt(auditInput);
    const auditSegments = verifyAgainst(buildAuditSegments(auditInput), audit);

    const fusionInput = {
      projectTitle: project.title,
      goalItems,
      problemItems,
      diagnosisItems,
      northStar,
      // The fusion prompt embeds the CURRENT research + audit text, so the preview
      // shows exactly what would be fused if "generate tasks" fired right now.
      deepResearchInput: project.deep_research_input,
      claudeCodeAuditInput: project.claude_code_audit_input,
    };
    const fusion = buildTasksPrompt(fusionInput);
    const fusionSegments = verifyAgainst(buildTasksSegments(fusionInput), fusion.userMessage);

    return NextResponse.json({
      research: { ...research, segments: researchSegments }, // { systemPrompt, userMessage, segments }
      audit: { text: audit, segments: auditSegments },       // copy-ready string + segments
      fusion: { ...fusion, segments: fusionSegments },       // { systemPrompt, userMessage, segments }
    });
  } catch (error) {
    console.error('[Project Prompts GET]', error);
    return NextResponse.json({ error: 'Failed to build prompts' }, { status: 500 });
  }
}
