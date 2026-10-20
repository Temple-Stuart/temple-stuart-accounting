/**
 * /api/operations/projects
 *
 * GET  — list the user's projects, optionally filtered by ?entity_id=<uuid>
 *        (the Tasks page no longer sends it — BACKLOG-01 ruling G: the list
 *        shows every book; the parameter stays for any other caller).
 *        Sorted by status priority (STATUS_ORDER — the active work first), then
 *        priority_score DESC NULLS LAST, then target_completion_date ASC.
 *        No audit write (read-only).
 *
 * POST — CAPTURE a project (BACKLOG-01, Alex, 2026-10-20). Required: entity_id
 *        (the book), title, type (ProjectType, by name) and why (a paragraph,
 *        at most 4000 code points). Optional: size (ProjectSize), definition_of_done,
 *        notes, links (a list of ≤ 20 strings of ≤ 500 — a doc path or a url,
 *        not validated as a url), the Dalio items (goalItems may be EMPTY now —
 *        ruling A: scoping is the row's edit view), target date, estimates.
 *        The row lands status 'backlog', set EXPLICITLY here. Verifies entity
 *        ownership before insert. Catches (user_id, title) unique constraint
 *        pre-emptively for a clean 409. Audits operations_project_created,
 *        naming the type.
 *        BACKLOG-01b (Alex, 2026-10-20) — the capture asks only what Alex knows:
 *        problem (1 WHAT IS WRONG TODAY) and goal (3 THE ONE CORRECT OUTCOME)
 *        join why as REQUIRED texts by name (the same 4000-code-point cap);
 *        rulings (4) and open_questions (5) optional, capped the same;
 *        deadline_reason (6) ≤ 500 code points and REQUIRED when a target
 *        date is set. diagnosis (THE AUDIT) and design (THE PLAN) stay optional
 *        text — they paste back on the row. The *_items arrays are still
 *        accepted and round-tripped (no form fills them; CLEAN-03 rules).
 *
 * Pattern mirrors src/app/api/operations/north-star/route.ts. Sequential
 * prisma + writeAuditLog awaits, NOT transactional (matches codebase
 * convention; relies on writeAuditLog internal P2034/P2024 retry).
 *
 * TASKS-02b (2026-10-20): the mirrored route above is deleted with the North
 * Star's page and section (TASKS-02, #1838); Tasks has no sub-rows, and the
 * audit trail is doored by the Compliance row. The pattern stands on its own,
 * with no file to point at: the create (POST below) awaits
 * prisma.operations_projects.create, then awaits writeAuditLog — sequential,
 * NOT in a transaction — and relies on writeAuditLog's internal retry on
 * P2034/P2024 (src/lib/audit/writeAuditLog.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma, ProjectSize, ProjectStatus, ProjectType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

/**
 * Status sort key — the active work first, then what waits, then what ended.
 * BACKLOG-01 (Alex, 2026-10-20): the four new statuses join the ladder. A
 * legacy not_started row sits AFTER the backlog so an old row does not jump
 * the new line; blocked (needs attention) sits between them. Used in the GET's
 * in-memory sort.
 */
const STATUS_ORDER: Record<ProjectStatus, number> = {
  in_progress: 0,
  scheduled: 1,
  scoped: 2,
  backlog: 3,
  blocked: 4,
  not_started: 5,
  completed: 6,
  dropped: 7,
  cancelled: 8,
  archived: 9,
};

/** BACKLOG-01: the strict enums, as the schema spells them. */
const PROJECT_TYPES: readonly ProjectType[] = ['engineering', 'accounting', 'content', 'travel', 'ops'];
const PROJECT_SIZES: readonly ProjectSize[] = ['S', 'M', 'L'];
const WHY_MAX_CODE_POINTS = 4000;
/** BACKLOG-01b: deadline_reason is a VARCHAR(500) — 500 is the column's length, counted in code points. */
const DEADLINE_REASON_MAX_CODE_POINTS = 500;

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
    //   • SEC-TASKS-01: a reversal pair is left out BY NAME, exactly as the budget
    //     report does (src/app/api/budget/report/route.ts:104) — the journal entry
    //     must be neither a reversal (is_reversal, schema journal_entries) nor
    //     reversed (reversed_by_entry_id). A reversal keeps the original's links
    //     (journal-entry-service.ts reversePlaidTransaction), so without this an
    //     uncommitted charge still counted, and a re-commit counted twice.
    // Self-reported estimates (estimated/actual_cost_usd) are NOT mixed in.
    type LedgerAllocated = { cents: number; dollars: string; link_count: number; line_count: number };
    let allocByProject: Map<string, LedgerAllocated> | null = null;
    try {
      const links = projectIds.length
        ? await prisma.ledger_line_links.findMany({
            where: {
              project_id: { in: projectIds },
              ledger_entry: { journal_entry: { userId: user.id, is_reversal: false, reversed_by_entry_id: null } },
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
    return failClosedResponse('Projects GET', 'Failed to load projects', error);
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

    // BACKLOG-01 (Alex, 2026-10-20): type is REQUIRED and strict — missing or
    // not one of the five is refused by name; the column is nullable only so a
    // row captured before reads "—".
    const type = PROJECT_TYPES.find((t) => t === body.type);
    if (!type) {
      return NextResponse.json(
        { error: 'Validation', field: 'type', message: `type is required — one of ${PROJECT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    // why is REQUIRED — the value or the problem, a paragraph. Its line breaks
    // are kept; its cap is counted in CODE POINTS the way JOURNAL-04 counts the
    // evening's block (src/lib/operations/journal.ts:285 `[...text].length`; the
    // rule there is module-private, so the expression is repeated, not imported).
    const whyRaw = requireString(body.why, 'why');
    if (whyRaw instanceof NextResponse) return whyRaw;
    const whyLength = [...whyRaw].length;
    if (whyLength > WHY_MAX_CODE_POINTS) {
      return NextResponse.json(
        { error: 'Validation', field: 'why', message: `why is at most ${WHY_MAX_CODE_POINTS} characters (${whyLength} given)` },
        { status: 400 }
      );
    }
    const why = whyRaw;
    // BACKLOG-01b (Alex, 2026-10-20): problem (1) and goal (3) are REQUIRED the same
    // way — by name, line breaks kept, the same cap in code points.
    const capWords = (field: string, length: number) => `${field} is at most ${WHY_MAX_CODE_POINTS} characters (${length} given)`;
    const problemRaw = requireString(body.problem, 'problem');
    if (problemRaw instanceof NextResponse) return problemRaw;
    const problemLength = [...problemRaw].length;
    if (problemLength > WHY_MAX_CODE_POINTS) {
      return NextResponse.json({ error: 'Validation', field: 'problem', message: capWords('problem', problemLength) }, { status: 400 });
    }
    const problem = problemRaw;
    const goalRaw = requireString(body.goal, 'goal');
    if (goalRaw instanceof NextResponse) return goalRaw;
    const goalLength = [...goalRaw].length;
    if (goalLength > WHY_MAX_CODE_POINTS) {
      return NextResponse.json({ error: 'Validation', field: 'goal', message: capWords('goal', goalLength) }, { status: 400 });
    }
    const goal = goalRaw;
    // size is optional — '' / null / absent is "not sized"; anything else must be S, M or L.
    let size: ProjectSize | null = null;
    if (body.size !== undefined && body.size !== null && body.size !== '') {
      const found = PROJECT_SIZES.find((x) => x === body.size);
      if (!found) {
        return NextResponse.json(
          { error: 'Validation', field: 'size', message: `size must be one of ${PROJECT_SIZES.join(', ')} or empty` },
          { status: 400 }
        );
      }
      size = found;
    }

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

    // BACKLOG-01 (Alex, 2026-10-20) — ruling A: goal items leave the capture
    // form; the Dalio loop is "scope it" on the row's edit view. The list is
    // still type/length-validated; EMPTY is accepted.
    const goalItemsResult = validateItems(body.goalItems, 'goalItems', true);
    if (!goalItemsResult.ok) return goalItemsResult.response;
    // PD-Clean: problem/diagnosis are OPTIONAL — title+goals is a valid project. Items are
    // still type/length-validated; empty is accepted (the pipe degrades to "(none provided)").
    const problemItemsResult = validateItems(body.problemItems, 'problemItems', true);
    if (!problemItemsResult.ok) return problemItemsResult.response;
    const diagnosisItemsResult = validateItems(body.diagnosisItems, 'diagnosisItems', true);
    if (!diagnosisItemsResult.ok) return diagnosisItemsResult.response;
    // BACKLOG-01: links — the *_items shape (≤ 20 strings of ≤ 500, each
    // non-empty), empty allowed. A doc path or a url; not validated as a url —
    // the prompt docs' paths are not urls.
    const linksResult = validateItems(body.links, 'links', true);
    if (!linksResult.ok) return linksResult.response;

    // Legacy paragraph fields are optional/nullable post-PR-Ops-3.7. The
    // *_items arrays above are the source of truth; legacy text is stored
    // verbatim if the client sends it (transition-period dual-write).
    const trimNullable = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };
    // BACKLOG-01b: diagnosis is THE AUDIT — pasted back on the row, optional here.
    const diagnosis = trimNullable(body.diagnosis);

    // Design is AI-populated post-PR-Ops-3.7 via "use this" acceptance.
    // Optional at create time; client may send it pre-populated.
    const design = trimNullable(body.design);

    // Optional pasted Claude Code audit — persisted so later re-runs (design/tasks)
    // stay grounded in the same codebase reality. Column is @db.Text; whole text in.
    const claude_code_audit_input = trimNullable(body.claude_code_audit_input);

    // BACKLOG-01: optional at capture — nothing typed is NULL, never "".
    const definition_of_done = trimNullable(body.definition_of_done);
    const notes = trimNullable(body.notes);
    // BACKLOG-01b: 4 ALREADY RULED and 5 WANT A RECOMMENDATION ON — optional, capped
    // like the three texts; 6's reason ≤ 500 code points (its column's length).
    const rulings = trimNullable(body.rulings);
    if (rulings !== null && [...rulings].length > WHY_MAX_CODE_POINTS) {
      return NextResponse.json({ error: 'Validation', field: 'rulings', message: capWords('rulings', [...rulings].length) }, { status: 400 });
    }
    const open_questions = trimNullable(body.open_questions);
    if (open_questions !== null && [...open_questions].length > WHY_MAX_CODE_POINTS) {
      return NextResponse.json({ error: 'Validation', field: 'open_questions', message: capWords('open_questions', [...open_questions].length) }, { status: 400 });
    }
    const deadline_reason = trimNullable(body.deadline_reason);
    if (deadline_reason !== null && [...deadline_reason].length > DEADLINE_REASON_MAX_CODE_POINTS) {
      return NextResponse.json(
        { error: 'Validation', field: 'deadline_reason', message: `deadline_reason is at most ${DEADLINE_REASON_MAX_CODE_POINTS} characters (${[...deadline_reason].length} given)` },
        { status: 400 }
      );
    }

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
    // BACKLOG-01b (Alex, 2026-10-20): a target date requires its reason — 6 BY WHEN,
    // AND WHY. A reason without a date is allowed (it is just text).
    if (target_completion_date !== null && deadline_reason === null) {
      return NextResponse.json(
        { error: 'Validation', field: 'deadline_reason', message: 'deadline_reason is required when a target date is set' },
        { status: 400 }
      );
    }

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
        // BACKLOG-01 (Alex, 2026-10-20): a captured project lands in the
        // BACKLOG — set here, explicitly; the column's default (not_started)
        // is a legacy row's, never a capture's.
        status: 'backlog',
        type,
        size,
        why,
        definition_of_done,
        links: linksResult.items,
        notes,
        goal,
        problem,
        diagnosis,
        design,
        rulings,
        open_questions,
        deadline_reason,
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
        description: `captured ${type} project "${title}" for ${userEmail}`,
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
    return failClosedResponse('Projects POST', 'Failed to create project', error);
  }
}
