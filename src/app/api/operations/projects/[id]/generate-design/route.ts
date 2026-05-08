/**
 * /api/operations/projects/[id]/generate-design
 *
 * POST — generate an institutional-rigor design field for the project,
 *        using its current goal/problem/diagnosis as input.
 *
 *        Does NOT save to the project. Returns the generated text in
 *        the response; user must explicitly accept and PATCH the project
 *        with the new design field separately.
 *
 *        Validates that the project has non-empty goal/problem/diagnosis
 *        before calling the AI — those are the inputs the generator
 *        depends on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateProjectDesign } from '@/lib/ai/generateProjectDesign';

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

    if (!project.goal.trim() || !project.problem.trim() || !project.diagnosis.trim()) {
      return NextResponse.json(
        {
          error: 'Validation',
          message: 'project must have goal, problem, and diagnosis fields filled before generating design',
        },
        { status: 400 }
      );
    }

    const result = await generateProjectDesign({
      userId: user.id,
      userEmail,
      projectId,
      projectTitle: project.title,
      goal: project.goal,
      problem: project.problem,
      diagnosis: project.diagnosis,
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
    console.error('[Generate Design POST]', error);
    return NextResponse.json(
      { error: 'Failed to generate design', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
