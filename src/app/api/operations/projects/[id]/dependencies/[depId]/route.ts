/**
 * /api/operations/projects/[id]/dependencies/[depId]
 *
 * DELETE — remove a dependency edge. Defensive parentage check:
 *          depId must belong to projectId (defense against deleting
 *          another project's dependency edge by guessing the depId).
 *          Audits operations_project_dependency_removed with full
 *          payload_before for replay.
 *
 * No GET or PATCH endpoints — dependency edges are immutable in the
 * UI: the only operations are add (POST on parent route) and remove
 * (this DELETE). Editing rationale would require remove+add pair,
 * which the UI can compose if needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

async function loadAuthorizedProject(projectId: string, userId: string) {
  return prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId, depId } = await params;
    const project = await loadAuthorizedProject(projectId, user.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Defensive parentage: dependency must belong to this project.
    const existing = await prisma.operations_project_dependencies.findFirst({
      where: { id: depId, project_id: projectId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
    }

    // Hydrate target title for audit description.
    const target = await prisma.operations_projects.findFirst({
      where: { id: existing.depends_on_project_id, user_id: user.id },
      select: { title: true },
    });

    await prisma.operations_project_dependencies.delete({ where: { id: depId } });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_dependency_removed',
        description: `Removed: ${project.title} ${existing.dependency_type} ${target?.title ?? existing.depends_on_project_id}`,
      },
      target: {
        table: 'operations_project_dependencies',
        id: existing.id,
      },
      payload: {
        before: existing,
        metadata: {
          source_project_id: projectId,
          source_project_title: project.title,
          target_project_id: existing.depends_on_project_id,
          target_project_title: target?.title ?? null,
          dependency_type: existing.dependency_type,
        },
      },
    });

    return NextResponse.json({ deleted: true, id: existing.id });
  } catch (error) {
    console.error('[Dependency DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete dependency', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
