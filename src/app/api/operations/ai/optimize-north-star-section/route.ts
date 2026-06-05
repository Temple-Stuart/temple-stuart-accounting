/**
 * POST /api/operations/ai/optimize-north-star-section
 *
 * Refine ONE North Star section against the FULL reality of the user's
 * selected projects + tasks. Mirrors /api/operations/ai/generate-design:
 *   - getVerifiedEmail + prisma.users.findFirst auth (NO tier check —
 *     operations AI surface is single-user cookie-gated; confirmed by
 *     grep of src/app/api/operations/ai/ and src/lib/ai/ → no tier refs)
 *   - generateNorthStarSectionOptimization → recordUsage wrapper
 *     (handles cost log + audit row + inspection block)
 *   - Inspection block forwarded to client for live transparency
 *
 * Body:
 *   { section_name: 'mission_statement' | 'one_year_target' |
 *                   'three_year_target' | 'guiding_principles' |
 *                   'core_values',
 *     project_ids: string[] }
 *
 * Response (success):
 *   { proposed_value, usage_id, input_tokens, output_tokens, cost_usd,
 *     inspection }
 *   - proposed_value is `string` for prose sections, `string[]` for
 *     core_values.
 *
 * Errors (NO fallback content anywhere):
 *   - 400  malformed body / unknown section / invalid project id
 *   - 401  no auth
 *   - 404  user not found / any project_id not owned by user
 *   - 413  assembled payload exceeds context-window ceiling — caller
 *          must narrow the project selection. NEVER truncated.
 *   - 500  Anthropic call failure
 *   - 502  AI returned empty / malformed (e.g., chips JSON parse fail)
 *
 * Human commits: this endpoint NEVER writes operations_north_star.
 * The proposal lives in client state until the user hits the existing
 * whole-form save on the North Star surface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import {
  generateNorthStarSectionOptimization,
  type ProjectContext,
  type TaskContext,
  type OptimizableKind,
} from '@/lib/ai/generateNorthStarSectionOptimization';

type ProseSection =
  | 'mission_statement'
  | 'one_year_target'
  | 'three_year_target'
  | 'guiding_principles';
type ChipsSection = 'core_values';
type OptimizableSection = ProseSection | ChipsSection;

const PROSE_SECTIONS: readonly ProseSection[] = [
  'mission_statement',
  'one_year_target',
  'three_year_target',
  'guiding_principles',
] as const;

const CHIPS_SECTIONS: readonly ChipsSection[] = ['core_values'] as const;

const ALL_SECTIONS: readonly OptimizableSection[] = [
  ...PROSE_SECTIONS,
  ...CHIPS_SECTIONS,
] as const;

function isOptimizableSection(v: unknown): v is OptimizableSection {
  return typeof v === 'string' && (ALL_SECTIONS as readonly string[]).includes(v);
}

function kindOf(section: OptimizableSection): OptimizableKind {
  return (CHIPS_SECTIONS as readonly string[]).includes(section) ? 'chips' : 'prose';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PROJECTS_PER_CALL = 30;

/**
 * Context-window guard. Sonnet 4 has a 200k-token context window; we
 * reserve generous headroom for the system prompt + output + safety.
 * Chars-per-token averages ~3.5-4 for English prose; we use 4 as a
 * conservative ratio. 500_000 chars ≈ 125k input tokens, leaving
 * ~75k tokens for system prompt + output + Anthropic-side overhead.
 *
 * If the assembled user message exceeds this ceiling, the route returns
 * 413 with a clear "narrow the selection" message. NEVER truncates.
 */
const MAX_USER_MESSAGE_CHARS = 500_000;

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = (await request.json().catch(() => null)) as
      | { section_name?: unknown; project_ids?: unknown }
      | null;
    if (!body) {
      return NextResponse.json(
        { error: 'Validation', message: 'request body must be JSON' },
        { status: 400 }
      );
    }

    if (!isOptimizableSection(body.section_name)) {
      return NextResponse.json(
        {
          error: 'Validation',
          field: 'section_name',
          message: `section_name must be one of: ${ALL_SECTIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }
    const sectionName = body.section_name;
    const sectionKind = kindOf(sectionName);

    if (!Array.isArray(body.project_ids)) {
      return NextResponse.json(
        { error: 'Validation', field: 'project_ids', message: 'project_ids must be an array' },
        { status: 400 }
      );
    }
    const projectIds: string[] = [];
    for (const raw of body.project_ids) {
      if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
        return NextResponse.json(
          {
            error: 'Validation',
            field: 'project_ids',
            message: 'every project_id must be a valid UUID string',
          },
          { status: 400 }
        );
      }
      projectIds.push(raw);
    }
    if (projectIds.length > MAX_PROJECTS_PER_CALL) {
      return NextResponse.json(
        {
          error: 'Validation',
          field: 'project_ids',
          message: `cannot optimize against more than ${MAX_PROJECTS_PER_CALL} projects in one call; narrow the selection.`,
        },
        { status: 400 }
      );
    }

    // Load the user's North Star (may be null if they haven't saved one yet).
    const northStar = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });

    // Read the current value for the selected section.
    let currentValue: string | string[];
    if (sectionKind === 'chips') {
      currentValue = northStar?.core_values ?? [];
    } else {
      const prose = northStar
        ? (northStar[sectionName as ProseSection] as string | null)
        : null;
      currentValue = prose ?? '';
    }

    // Fetch the selected projects with ownership-scoped query. If any
    // requested ID is missing from the result set, the user doesn't own
    // it — refuse the whole call rather than silently dropping.
    let projects: Awaited<ReturnType<typeof prisma.operations_projects.findMany>> = [];
    if (projectIds.length > 0) {
      projects = await prisma.operations_projects.findMany({
        where: { id: { in: projectIds }, user_id: user.id },
      });
      if (projects.length !== projectIds.length) {
        const foundIds = new Set(projects.map((p) => p.id));
        const missing = projectIds.filter((id) => !foundIds.has(id));
        return NextResponse.json(
          {
            error: 'Validation',
            field: 'project_ids',
            message: `one or more project_ids are not owned by this user: ${missing.join(', ')}`,
          },
          { status: 404 }
        );
      }
    }

    // Fetch all tasks for those projects in one query (owner-scoped
    // redundantly via project ownership above).
    const tasksRaw =
      projects.length > 0
        ? await prisma.operations_project_tasks.findMany({
            // Archived tasks are out of scope — never feed them to the optimizer.
            where: { project_id: { in: projects.map((p) => p.id) }, status: { not: 'archived' } },
            orderBy: [{ display_order: 'asc' }, { updated_at: 'desc' }],
          })
        : [];

    // Project rows: pass through, normalizing Decimal/Date types to the
    // JSON-friendly shape the generator expects. Prisma Decimal serializes
    // as string when JSON.stringify'd; we coerce here for the generator's
    // explicit type contract.
    const projectsCtx: ProjectContext[] = projects.map((p) => ({
      id: p.id,
      entity_id: p.entity_id,
      title: p.title,
      goal: p.goal,
      problem: p.problem,
      diagnosis: p.diagnosis,
      design: p.design,
      goal_items: (p.goal_items as string[]) ?? [],
      problem_items: (p.problem_items as string[]) ?? [],
      diagnosis_items: (p.diagnosis_items as string[]) ?? [],
      status: p.status,
      target_completion_date: p.target_completion_date
        ? p.target_completion_date.toISOString().slice(0, 10)
        : null,
      estimated_total_minutes: p.estimated_total_minutes,
      estimated_total_cost_usd: p.estimated_total_cost_usd
        ? p.estimated_total_cost_usd.toString()
        : null,
    }));

    const tasksCtx: TaskContext[] = tasksRaw.map((t) => ({
      id: t.id,
      project_id: t.project_id,
      title: t.title,
      description: t.description,
      status: t.status,
      estimated_minutes: t.estimated_minutes,
      estimated_cost_usd: t.estimated_cost_usd ? t.estimated_cost_usd.toString() : null,
      actual_minutes: t.actual_minutes,
      actual_cost_usd: t.actual_cost_usd ? t.actual_cost_usd.toString() : null,
      coa_code: t.coa_code,
      deadline: t.deadline ? t.deadline.toISOString() : null,
      notes: t.notes,
      unblocks_label: t.unblocks_label,
    }));

    // Context-window guard. Estimate the assembled user-message size
    // BEFORE calling the model. If it exceeds the ceiling, surface
    // truthfully — never truncate the payload silently.
    const estimatedChars = estimateUserMessageChars(
      sectionName,
      sectionKind,
      currentValue,
      projectsCtx,
      tasksCtx
    );
    if (estimatedChars > MAX_USER_MESSAGE_CHARS) {
      const approxTokens = Math.round(estimatedChars / 4);
      return NextResponse.json(
        {
          error: 'PayloadTooLarge',
          field: 'project_ids',
          message: `Assembled payload (~${approxTokens.toLocaleString()} tokens / ${estimatedChars.toLocaleString()} chars) exceeds the safe context-window ceiling (~${Math.round(
            MAX_USER_MESSAGE_CHARS / 4
          ).toLocaleString()} tokens). Narrow the project selection and try again.`,
          estimated_chars: estimatedChars,
          estimated_tokens: approxTokens,
          ceiling_chars: MAX_USER_MESSAGE_CHARS,
        },
        { status: 413 }
      );
    }

    let result;
    try {
      result = await generateNorthStarSectionOptimization({
        userId: user.id,
        userEmail,
        sectionName,
        sectionKind,
        currentValue,
        projects: projectsCtx,
        tasks: tasksCtx,
        northStarId: northStar?.id ?? null,
      });
    } catch (genError) {
      // Discriminate JSON-parse / empty-response errors as 502 (upstream
      // produced malformed output) vs other failures as 500. NO fallback
      // content — the caller sees the truthful error.
      const message =
        genError instanceof Error ? genError.message : 'AI generation failed';
      const looksLikeMalformed =
        message.includes('non-JSON') ||
        message.includes('non-array') ||
        message.includes('non-string') ||
        message.includes('empty') ||
        message.includes('empty response') ||
        message.includes('empty core_values');
      return NextResponse.json(
        { error: looksLikeMalformed ? 'BadAIResponse' : 'AIGenerationFailed', message },
        { status: looksLikeMalformed ? 502 : 500 }
      );
    }

    return NextResponse.json({
      proposed_value: result.proposedValue,
      usage_id: result.usageId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      inspection: result.inspection,
    });
  } catch (error) {
    console.error('[Optimize North Star Section POST]', error);
    return NextResponse.json(
      {
        error: 'InternalError',
        message: error instanceof Error ? error.message : 'unknown',
      },
      { status: 500 }
    );
  }
}

/**
 * Rough char-count estimate of the assembled user message. Must stay
 * roughly aligned with what generateNorthStarSectionOptimization's
 * buildUserMessage produces — if that helper's format changes, this
 * estimate may drift; the ceiling is conservative enough that small
 * drift is safe, but big format changes should refresh this.
 */
function estimateUserMessageChars(
  sectionName: string,
  sectionKind: OptimizableKind,
  currentValue: string | string[],
  projects: ProjectContext[],
  tasks: TaskContext[]
): number {
  let total = 0;
  // Header + section name + framing prose.
  total += 200 + sectionName.length;
  // Current value.
  total +=
    sectionKind === 'chips'
      ? (currentValue as string[]).reduce((s, v) => s + v.length + 4, 0)
      : (currentValue as string).length;
  for (const p of projects) {
    total +=
      300 + // project header framing
      p.title.length +
      (p.goal?.length ?? 0) +
      (p.problem?.length ?? 0) +
      (p.diagnosis?.length ?? 0) +
      (p.design?.length ?? 0) +
      p.goal_items.reduce((s, v) => s + v.length + 6, 0) +
      p.problem_items.reduce((s, v) => s + v.length + 6, 0) +
      p.diagnosis_items.reduce((s, v) => s + v.length + 6, 0);
  }
  for (const t of tasks) {
    total +=
      100 + // task line framing
      t.title.length +
      (t.description?.length ?? 0) +
      (t.notes?.length ?? 0) +
      (t.unblocks_label?.length ?? 0);
  }
  return total;
}
