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
    // Archived projects are out of scope: hidden from the active backlog unless
    // explicitly requested (the "show archived" toggle). History is preserved —
    // this is a read filter only.
    const includeArchived = searchParams.get('include_archived') === 'true';

    const where: Prisma.operations_projectsWhereInput = { user_id: user.id };
    if (!includeArchived) {
      where.status = { not: 'archived' };
    }
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
      // PD-2: task_count via Prisma _count on the tasks relation (no migration).
      include: { _count: { select: { tasks: true } } },
      orderBy: [
        // Prisma can't sort by computed status_order without raw SQL; we sort
        // server-side after fetch. Single-user backlogs are small (<200), so
        // in-memory sort cost is negligible.
        { priority_score: { sort: 'desc', nulls: 'last' } },
        { target_completion_date: 'asc' },
        { updated_at: 'desc' },
      ],
    });

    // PD-2: run_count = DISTINCT source_ai_usage_id across each project's tasks (the
    // evolve-run markers). groupBy on (project_id, source_ai_usage_id) → one row per
    // distinct run; count rows per project. Reads existing data — NO migration.
    const projectIds = projects.map((p) => p.id);
    const runGroups = projectIds.length
      ? await prisma.operations_project_tasks.groupBy({
          by: ['project_id', 'source_ai_usage_id'],
          where: { project_id: { in: projectIds }, source_ai_usage_id: { not: null } },
        })
      : [];
    const runCountByProject = new Map<string, number>();
    for (const g of runGroups) {
      runCountByProject.set(g.project_id, (runCountByProject.get(g.project_id) ?? 0) + 1);
    }

    // PROJECTS-UX-2: REAL cost-per-project — the DIM allocation rollup.
    // READ-ONLY (findMany only), layered onto the payload exactly like the
    // PD-2 counts above. The math derives from the schema's own doctrine:
    //   • ledger_entries.amount is BigInt CENTS ("Clean slate with BigInt
    //     amounts", schema.prisma ledger_entries); sign lives in entry_type
    //     ('D'/'C') — the same D/C semantics /api/runway uses for its burn
    //     legs. Net allocated = debit allocations − credit allocations (a
    //     credit allocated to a project offsets its cost).
    //   • ledger_line_links.percent is Decimal(5,2) — the link's SHARE of the
    //     line (sum-to-100 across a line's links, the DIM-1 doctrine). One
    //     link's allocated cents = amount × percent / 100; computed as
    //     amount × round(percent×100) / 10000 so the 2dp percent is exact
    //     integer math (fractional cents accumulate, rounded ONCE per project).
    //   • User scoping via the owning chain the EXPORT-1 route proved:
    //     link → ledger_entry → journal_entry.userId (links carry no userId).
    //   • Coverage is DECLARED per the DIM-1 doctrine: link_count/line_count
    //     ride the payload so the display can say how many lines feed the sum.
    // Self-reported estimates (estimated/actual_cost_usd) are NOT mixed in.
    type LedgerAllocated = { cents: number; dollars: string; link_count: number; line_count: number };
    let allocByProject: Map<string, LedgerAllocated> | null = null;
    try {
      const links = projectIds.length
        ? await prisma.ledger_line_links.findMany({
            where: {
              project_id: { in: projectIds },
              ledger_entry: { journal_entry: { userId: user.id } },
            },
            select: {
              project_id: true,
              percent: true,
              ledger_entry_id: true,
              ledger_entry: { select: { amount: true, entry_type: true } },
            },
          })
        : [];
      const acc = new Map<string, { cents: number; links: number; lines: Set<string> }>();
      for (const l of links) {
        if (!l.project_id) continue;
        const pctCenti = Math.round(Number(l.percent) * 100);
        const signed = (l.ledger_entry.entry_type === 'C' ? -1 : 1) * Number(l.ledger_entry.amount);
        const a = acc.get(l.project_id) ?? { cents: 0, links: 0, lines: new Set<string>() };
        a.cents += (signed * pctCenti) / 10_000;
        a.links += 1;
        a.lines.add(l.ledger_entry_id);
        acc.set(l.project_id, a);
      }
      allocByProject = new Map();
      for (const [pid, a] of acc) {
        const rounded = Math.round(a.cents);
        allocByProject.set(pid, {
          cents: rounded,
          dollars: (rounded / 100).toFixed(2),
          link_count: a.links,
          line_count: a.lines.size,
        });
      }
    } catch (rollupError) {
      // RULED degradation (PROJECTS-UX-2): if the rollup read fails, the field
      // is OMITTED and the client renders NOTHING — never a made-up number —
      // while the projects list itself still loads. Logged, never swallowed.
      console.error('[Projects GET] ledger allocation rollup failed', rollupError);
      allocByProject = null;
    }

    // Status-priority sort layered on top of priority_score order.
    const sorted = projects.slice().sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      // Within same status: preserve priority_score / target_date / updated_at order from Prisma.
      return 0;
    });

    // PD-2: surface the real counts on each row (and drop the internal _count shape).
    // PROJECTS-UX-2: ledger_allocated joins the row — an object for projects
    // with links, null for projects with none (absence is honest — the client
    // renders nothing), and ABSENT entirely when the rollup read failed.
    const withCounts = sorted.map(({ _count, ...p }) => ({
      ...p,
      task_count: _count.tasks,
      run_count: runCountByProject.get(p.id) ?? 0,
      ...(allocByProject ? { ledger_allocated: allocByProject.get(p.id) ?? null } : {}),
    }));

    return NextResponse.json({ projects: withCounts });
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
      fieldName: string,
      allowEmpty = false
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
      if (!allowEmpty && value.length === 0) {
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
    // PD-Clean: problem/diagnosis are OPTIONAL — title+goals is a valid project. Items are
    // still type/length-validated; empty is accepted (the pipe degrades to "(none provided)").
    const problemItemsResult = validateItems(body.problemItems, 'problemItems', true);
    if (!problemItemsResult.ok) return problemItemsResult.response;
    const diagnosisItemsResult = validateItems(body.diagnosisItems, 'diagnosisItems', true);
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

    // Optional pasted Claude Code audit — persisted so later re-runs (design/tasks)
    // stay grounded in the same codebase reality. Column is @db.Text; whole text in.
    const claude_code_audit_input = trimNullable(body.claude_code_audit_input);

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
        claude_code_audit_input,
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
