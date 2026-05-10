/**
 * /api/operations/projects
 *
 * GET  — list the user's projects, optionally filtered by ?entity_id=<uuid>.
 *        Sorted by status priority (not_started/in_progress first), then
 *        priority_score DESC NULLS LAST, then target_completion_date ASC.
 *        No audit write (read-only).
 *
 * POST — create a project. Validates all 4 Bridgewater scoping fields
 *        (goal, problem, diagnosis, design) non-empty server-side. Verifies
 *        entity ownership before insert. Catches (user_id, title) unique
 *        constraint pre-emptively for clean 409 error.
 *        Audits operations_project_created.
 *
 * Pattern mirrors src/app/api/operations/north-star/route.ts. Sequential
 * prisma + writeAuditLog awaits, NOT transactional (matches codebase
 * convention; relies on writeAuditLog internal P2034/P2024 retry).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

/**
 * Status sort key. not_started + in_progress surface first (active work);
 * blocked next (needs attention); completed/cancelled/archived last.
 * Used in the GET orderBy.
 */
const STATUS_ORDER: Record<ProjectStatus, number> = {
  not_started: 0,
  in_progress: 1,
  blocked: 2,
  completed: 3,
  cancelled: 4,
  archived: 5,
};

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id');

    const where: Prisma.operations_projectsWhereInput = { user_id: user.id };
    if (entityId) {
      // Verify entity ownership before filtering.
      const entity = await prisma.entities.findFirst({
        where: { id: entityId, userId: user.id },
      });
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found or not owned' },
          { status: 404 }
        );
      }
      where.entity_id = entityId;
    }

    const projects = await prisma.operations_projects.findMany({
      where,
      orderBy: [
        // Prisma can't sort by computed status_order without raw SQL; we sort
        // server-side after fetch. Single-user backlogs are small (<200), so
        // in-memory sort cost is negligible.
        { priority_score: { sort: 'desc', nulls: 'last' } },
        { target_completion_date: 'asc' },
        { updated_at: 'desc' },
      ],
    });

    // Status-priority sort layered on top of priority_score order.
    const sorted = projects.slice().sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      // Within same status: preserve priority_score / target_date / updated_at order from Prisma.
      return 0;
    });

    return NextResponse.json({ projects: sorted });
  } catch (error) {
    console.error('[Projects GET]', error);
    return NextResponse.json(
      { error: 'Failed to load projects', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    // Validation gates — fire BEFORE DB lookups to save roundtrips.
    const requireString = (v: unknown, field: string, max?: number): string | NextResponse => {
      if (typeof v !== 'string' || v.trim().length === 0) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} is required` },
          { status: 400 }
        );
      }
      const trimmed = v.trim();
      if (max && trimmed.length > max) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} exceeds ${max} characters` },
          { status: 400 }
        );
      }
      return trimmed;
    };

    const entity_id_raw = requireString(body.entity_id, 'entity_id');
    if (entity_id_raw instanceof NextResponse) return entity_id_raw;
    const title = requireString(body.title, 'title', 500);
    if (title instanceof NextResponse) return title;

    // PR-Ops-3.7: structured-list fields are the source of truth. Each
    // is required, non-empty array of trimmed strings ≤ 500 chars,
    // ≤ 20 items per array.
    const validateItems = (
      value: unknown,
      fieldName: string
    ): { ok: true; items: string[] } | { ok: false; response: NextResponse } => {
      if (!Array.isArray(value)) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: 'Validation', field: fieldName, message: `${fieldName} must be an array` },
            { status: 400 }
          ),
        };
      }
      if (value.length === 0) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: 'Validation', field: fieldName, message: `${fieldName} must contain at least one item` },
            { status: 400 }
          ),
        };
      }
      if (value.length > 20) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: 'Validation', field: fieldName, message: `${fieldName} cannot have more than 20 items` },
            { status: 400 }
          ),
        };
      }
      const items: string[] = [];
      for (let i = 0; i < value.length; i++) {
        const raw = value[i];
        if (typeof raw !== 'string') {
          return {
            ok: false,
            response: NextResponse.json(
              { error: 'Validation', field: fieldName, message: `${fieldName}[${i}] must be a string` },
              { status: 400 }
            ),
          };
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          return {
            ok: false,
            response: NextResponse.json(
              { error: 'Validation', field: fieldName, message: `${fieldName}[${i}] cannot be empty` },
              { status: 400 }
            ),
          };
        }
        if (trimmed.length > 500) {
          return {
            ok: false,
            response: NextResponse.json(
              { error: 'Validation', field: fieldName, message: `${fieldName}[${i}] exceeds 500 characters` },
              { status: 400 }
            ),
          };
        }
        items.push(trimmed);
      }
      return { ok: true, items };
    };

    const goalItemsResult = validateItems(body.goalItems, 'goalItems');
    if (!goalItemsResult.ok) return goalItemsResult.response;
    const problemItemsResult = validateItems(body.problemItems, 'problemItems');
    if (!problemItemsResult.ok) return problemItemsResult.response;
    const diagnosisItemsResult = validateItems(body.diagnosisItems, 'diagnosisItems');
    if (!diagnosisItemsResult.ok) return diagnosisItemsResult.response;

    // Legacy paragraph fields are optional/nullable post-PR-Ops-3.7. The
    // *_items arrays above are the source of truth; legacy text is stored
    // verbatim if the client sends it (transition-period dual-write).
    const trimNullable = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };
    const goal = trimNullable(body.goal);
    const problem = trimNullable(body.problem);
    const diagnosis = trimNullable(body.diagnosis);

    // Design is AI-populated post-PR-Ops-3.7 via "use this" acceptance.
    // Optional at create time; client may send it pre-populated.
    const design = trimNullable(body.design);

    // Verify entity ownership.
    const entity = await prisma.entities.findFirst({
      where: { id: entity_id_raw, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found or not owned', field: 'entity_id' },
        { status: 404 }
      );
    }

    // Pre-emptive uniqueness check on (user_id, title) — cleaner UX than
    // catching the Prisma P2002 error after the fact.
    const duplicate = await prisma.operations_projects.findFirst({
      where: { user_id: user.id, title },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'Duplicate',
          field: 'title',
          message: 'a project with this title already exists',
        },
        { status: 409 }
      );
    }

    // Optional fields — coerce strings/numbers carefully.
    const target_completion_date =
      typeof body.target_completion_date === 'string' && body.target_completion_date.length > 0
        ? new Date(body.target_completion_date)
        : null;

    const estimated_total_minutes =
      body.estimated_total_minutes !== undefined &&
      body.estimated_total_minutes !== null &&
      body.estimated_total_minutes !== ''
        ? Number(body.estimated_total_minutes)
        : null;
    if (estimated_total_minutes !== null && (!Number.isFinite(estimated_total_minutes) || estimated_total_minutes < 0)) {
      return NextResponse.json(
        { error: 'Validation', field: 'estimated_total_minutes', message: 'must be a non-negative integer' },
        { status: 400 }
      );
    }

    const estimated_total_cost_usd =
      typeof body.estimated_total_cost_usd === 'string' && body.estimated_total_cost_usd.trim().length > 0
        ? new Prisma.Decimal(body.estimated_total_cost_usd.trim())
        : typeof body.estimated_total_cost_usd === 'number'
        ? new Prisma.Decimal(body.estimated_total_cost_usd)
        : null;

    const project = await prisma.operations_projects.create({
      data: {
        user_id: user.id,
        entity_id: entity_id_raw,
        title,
        goal,
        problem,
        diagnosis,
        design,
        goal_items: goalItemsResult.items,
        problem_items: problemItemsResult.items,
        diagnosis_items: diagnosisItemsResult.items,
        target_completion_date,
        estimated_total_minutes,
        estimated_total_cost_usd,
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
        type: 'operations_project_created',
        description: `Created project "${title}" for ${userEmail}`,
      },
      target: {
        table: 'operations_projects',
        id: project.id,
      },
      payload: {
        after: project,
        metadata: { entity_id: entity_id_raw },
      },
    });

    return NextResponse.json({ project, isCreate: true }, { status: 201 });
  } catch (error) {
    console.error('[Projects POST]', error);
    return NextResponse.json(
      { error: 'Failed to create project', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
