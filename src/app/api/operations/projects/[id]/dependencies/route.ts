/**
 * /api/operations/projects/[id]/dependencies
 *
 * GET  — return the project's incoming AND outgoing dependency edges,
 *        hydrated with the other endpoint's title + status. Both
 *        directions returned in one call to minimize roundtrips for
 *        the row's expanded view.
 *
 *        Response shape:
 *          {
 *            outgoing: HydratedDependency[],   // edges where THIS project is the source
 *            incoming: InverseDependency[],     // edges where THIS project is the target
 *          }
 *
 *        outgoing[i].depends_on_project_title is what THIS project is "blocked by".
 *        incoming[i].project_title is what THIS project "blocks" or "informs", etc.
 *
 * POST — create a dependency edge. Validates:
 *          - body.depends_on_project_id is present and is a different project
 *            (DB CHECK enforces too; defense-in-depth)
 *          - both source and target projects are owned by the user
 *          - (source, target, type) is unique (pre-emptive 409)
 *          - if type === 'blocks', cycle detection over existing blocks edges
 *            (β: only blocks counts; informs/derived_from skip cycle check)
 *        Audits operations_project_dependency_added.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ProjectDependencyType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { buildAdjacency, dfsHasCycle } from '@/lib/operations/cycleDetection';

const VALID_TYPES: ProjectDependencyType[] = ['blocks', 'informs', 'derived_from'];

async function loadAuthorizedProject(projectId: string, userId: string) {
  return prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
}

export async function GET(
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
    const project = await loadAuthorizedProject(projectId, user.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Outgoing: this project is the source. Hydrate target.
    const outgoingRaw = await prisma.operations_project_dependencies.findMany({
      where: { project_id: projectId },
      orderBy: [{ dependency_type: 'asc' }, { created_at: 'asc' }],
    });
    const outgoingTargetIds = outgoingRaw.map((d) => d.depends_on_project_id);
    const outgoingTargets = outgoingTargetIds.length > 0
      ? await prisma.operations_projects.findMany({
          where: { id: { in: outgoingTargetIds }, user_id: user.id },
          select: { id: true, title: true, status: true },
        })
      : [];
    const outgoingTargetMap = new Map(outgoingTargets.map((p) => [p.id, p]));
    const outgoing = outgoingRaw.map((d) => ({
      ...d,
      depends_on_project_title: outgoingTargetMap.get(d.depends_on_project_id)?.title ?? '(unknown)',
      depends_on_project_status: outgoingTargetMap.get(d.depends_on_project_id)?.status ?? 'unknown',
    }));

    // Incoming: this project is the target. Hydrate source.
    const incomingRaw = await prisma.operations_project_dependencies.findMany({
      where: { depends_on_project_id: projectId },
      orderBy: [{ dependency_type: 'asc' }, { created_at: 'asc' }],
    });
    const incomingSourceIds = incomingRaw.map((d) => d.project_id);
    const incomingSources = incomingSourceIds.length > 0
      ? await prisma.operations_projects.findMany({
          where: { id: { in: incomingSourceIds }, user_id: user.id },
          select: { id: true, title: true, status: true },
        })
      : [];
    const incomingSourceMap = new Map(incomingSources.map((p) => [p.id, p]));
    const incoming = incomingRaw.map((d) => ({
      ...d,
      project_title: incomingSourceMap.get(d.project_id)?.title ?? '(unknown)',
      project_status: incomingSourceMap.get(d.project_id)?.status ?? 'unknown',
    }));

    return NextResponse.json({ outgoing, incoming });
  } catch (error) {
    console.error('[Dependencies GET]', error);
    return NextResponse.json(
      { error: 'Failed to load dependencies', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: sourceId } = await params;
    const source = await loadAuthorizedProject(sourceId, user.id);
    if (!source) return NextResponse.json({ error: 'Source project not found' }, { status: 404 });

    const body = await request.json();

    if (typeof body.depends_on_project_id !== 'string' || body.depends_on_project_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'depends_on_project_id', message: 'required' },
        { status: 400 }
      );
    }
    const targetId = body.depends_on_project_id.trim();

    // Defense-in-depth: app-level rejection (DB CHECK rejects too).
    if (targetId === sourceId) {
      return NextResponse.json(
        { error: 'Validation', field: 'depends_on_project_id', message: 'a project cannot depend on itself' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(body.dependency_type)) {
      return NextResponse.json(
        { error: 'Validation', field: 'dependency_type', message: 'must be blocks, informs, or derived_from' },
        { status: 400 }
      );
    }
    const dependency_type = body.dependency_type as ProjectDependencyType;

    const target = await loadAuthorizedProject(targetId, user.id);
    if (!target) return NextResponse.json({ error: 'Target project not found' }, { status: 404 });

    // Pre-emptive uniqueness check on (project_id, depends_on_project_id, dependency_type).
    const existing = await prisma.operations_project_dependencies.findFirst({
      where: {
        project_id: sourceId,
        depends_on_project_id: targetId,
        dependency_type,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Duplicate', message: `this ${dependency_type} edge already exists` },
        { status: 409 }
      );
    }

    // β: cycle detection over `blocks` edges only. Mutual informs/derived_from
    // are legitimate semantics; cycles allowed.
    if (dependency_type === 'blocks') {
      // Filter to user's own projects via relation predicate (cheap belt-and-
      // suspenders; cascade FKs already guarantee no orphan-ownership rows).
      const blocksEdges = await prisma.operations_project_dependencies.findMany({
        where: {
          dependency_type: 'blocks',
          project: { user_id: user.id },
        },
        select: { project_id: true, depends_on_project_id: true },
      });
      const adj = buildAdjacency(blocksEdges);
      if (dfsHasCycle(adj, sourceId, targetId)) {
        return NextResponse.json(
          {
            error: 'Cycle',
            field: 'depends_on_project_id',
            message: `adding this blocks edge would create a cycle: "${target.title}" already depends (transitively) on "${source.title}"`,
          },
          { status: 400 }
        );
      }
    }

    const dependency = await prisma.operations_project_dependencies.create({
      data: {
        project_id: sourceId,
        depends_on_project_id: targetId,
        dependency_type,
        rationale: typeof body.rationale === 'string' && body.rationale.trim().length > 0
          ? body.rationale.trim()
          : null,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_dependency_added',
        description: `${source.title} ${dependency_type} ${target.title}`,
      },
      target: {
        table: 'operations_project_dependencies',
        id: dependency.id,
      },
      payload: {
        after: dependency,
        metadata: {
          source_project_id: sourceId,
          source_project_title: source.title,
          target_project_id: targetId,
          target_project_title: target.title,
          dependency_type,
        },
      },
    });

    return NextResponse.json({ dependency, isCreate: true }, { status: 201 });
  } catch (error) {
    console.error('[Dependencies POST]', error);
    return NextResponse.json(
      { error: 'Failed to create dependency', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
