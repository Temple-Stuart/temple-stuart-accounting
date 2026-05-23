/**
 * generateProjectTasks — produces an institutional-rigor structured
 * array of operational tasks for a project, given its GOAL / PROBLEM /
 * DIAGNOSIS items.
 *
 * Uses Claude Sonnet 4 with:
 *   - web_search_20250305 server tool (max 8 searches) for verifying
 *     vendor URLs and current process names
 *   - return_project_tasks custom tool (forced via tool_choice) for
 *     structured JSON output
 *
 * Returns the parsed tasks array + cost metadata + inspection block;
 * does NOT auto-save to the database. Caller (bulk-create endpoint)
 * explicitly inserts tasks after user acceptance.
 *
 * Truth-first: user owns INPUTS (item arrays), AI owns SYNTHESIS
 * (tasks array), explicit acceptance gate (use-this button in
 * AITaskPreview) between them.
 */

import { recordUsage } from './recordUsage';
import { MODEL_SONNET_4 } from './client';
import { PROJECT_DESIGN_EXEMPLAR } from './exemplars/projectDesign';
import { formatNorthStarBlock, type NorthStarContext } from './northStarContext';

interface GenerateInput {
  userId: string;
  userEmail: string;
  projectId: string;            // empty string for stateless mode
  projectTitle: string;
  goalItems: string[];
  problemItems: string[];
  diagnosisItems: string[];
  northStar?: NorthStarContext | null;
  // PR-Ops-Evolve-1: optional pasted reality inputs. When present they are
  // appended to the user message so the generated task set is grounded in
  // external research (what's true/best) + a codebase audit (what's shipped/stale).
  deepResearchInput?: string | null;
  claudeCodeAuditInput?: string | null;
}

interface GeneratedTask {
  title: string;
  description: string;
  link_url: string | null;
  notes: string | null;
  suggested_order: number;
}

interface GenerateOutput {
  tasks: GeneratedTask[];
  usageId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  inspection: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    userMessage: string;
    rawResponse: string;
  };
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '(none provided)';
  return items.map((item) => `- ${item}`).join('\n');
}

const TASK_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 200, description: 'Declarative action title' },
          description: { type: 'string', maxLength: 1000, description: 'Operational detail of what to do' },
          link_url: { type: 'string', description: 'Verified vendor URL relevant to the task' },
          notes: { type: 'string', maxLength: 1500, description: 'Institutional context: dependencies, timing, decision points, gotchas' },
          suggested_order: { type: 'integer', minimum: 0, description: '0-indexed recommended sequence' },
        },
        required: ['title', 'description', 'suggested_order'],
      },
      minItems: 1,
      maxItems: 30,
    },
  },
  required: ['tasks'],
} as const;

const SYSTEM_PROMPT = `You are a project scoping expert trained on the institutional rigor of Bridgewater Associates' Principles, Citadel's risk discipline, and Renaissance Technologies' empirical method.

Your job: produce a structured array of atomic operational tasks that, when completed in order, will accomplish the user's GOAL.

INPUTS (from the user, in natural-voice item arrays):
  - GOAL items: "I WANT to ..." (target end states)
  - PROBLEM items: "I HAVE NOT ... / I KEEP ..." (current gaps and recurring obstacles)
  - DIAGNOSIS items: "Because ... / The root cause is ..." (root CAUSES — WHY the gap exists, not solutions). Diagnosis items name causal mechanisms; they do NOT prescribe what to do. Your tasks (this output) are the SOLUTION layer designed against those causes — do not just echo the diagnosis back as a task.

When a NORTH STAR block is present at the top of the user message, treat it as the strategic frame — scope this project's tasks as a coherent part of that vision, respecting its sequencing and dependencies, and do not propose work that contradicts it.

SOLO-FOUNDER OPERATOR CONTEXT: The user is a solo founder and User #1 of their own product. They validate by USING the thing in real production, not by controlled experiments. Favor decide-by-use over A/B tests, completion-rate metrics, abandonment funnels, or "test with N users" studies. Do NOT propose tasks whose only deliverable is a measurement or a study. Institutional rigor here means sequencing and dependency discipline, not corporate product-management ceremony. NOTE: legitimate correctness-validation tasks (verifying a calculation against known-correct examples, reconciling data against a source of truth) ARE real work and SHOULD be proposed when relevant — the guardrail targets ceremony, not correctness checks.

OUTPUTS (you produce, via the return_project_tasks tool):
  An array of 5–30 atomic operational tasks. Each task carries:
    - title: ≤200 char declarative action ("File FAFSA 2026-2027")
    - description: ≤1000 char operational detail (what to do exactly)
    - link_url: VERIFIED URL for the relevant vendor/portal/agency form
    - notes: ≤1500 char institutional context — dependencies, timing,
             gotchas, decision points, blockers. This is where the
             reasoning that previously lived in prose plans now lives.
    - suggested_order: 0-indexed integer for recommended sequence

WEB SEARCH BUDGET — UP TO 8 SEARCHES:
  Before producing tasks, use the web_search tool to verify current
  vendor URLs, form names, portal navigation paths, and process steps.
  Prefer .gov / official vendor domains. Don't waste searches on
  general explanations; use them to anchor SPECIFIC URLs and CURRENT
  process names. If you cannot verify a URL within the search budget,
  set link_url to null rather than fabricating.

VOICE — CRISP AND DIRECT (NON-NEGOTIABLE):
  Write like a friend who knows the system — not a compliance memo.
  Short sentences. Periods over commas. One idea per sentence.

  BANNED constructs (instant rejection):
    - All-caps memo markers: NO "UPSTREAM BLOCKER:", "CRITICAL:",
      "DECISION POINT —", "HARD CONSTRAINT:", "SOFT PULL:", "PARALLEL with:",
      "NOTE:", "WARNING:". State the fact plainly instead.
    - Hedge language: NO "typically", "usually", "may", "likely",
      "some campuses", "in most cases", "generally". If web search
      gave you a real number or date, use it. If it didn't, omit.
    - Approximations dressed as facts: NO "~2 weeks", "around $50",
      "(typically December 1)". Cite the real value from web search
      or omit the time/cost.
    - Preamble fluff: NO "It should be noted that...", "Keep in mind
      that...", "Please be aware that...". Just state the fact.
    - Long compound sentences. If a sentence has more than one
      semicolon or three commas, split it.

  REQUIRED in every notes field:
    - WHY this task matters (one sentence, direct)
    - WHAT it depends on (named upstream tasks if any, flat statement)
    - Real deadlines from web_search (not hedged ranges)
    - Concrete blockers (state the failure mode, not the abstraction)

  EXAMPLES OF THE VOICE:
    BAD:  "CRITICAL FIRST STEP: Students who have been absent for one or
           more semesters typically need to apply for readmission rather
           than continuing enrollment. Fall 2026 application deadline has
           likely passed (typically December 1), so Spring 2027 may be
           the earliest realistic target."
    GOOD: "Skipped semesters mean applying fresh, not re-enrolling. Fall
           2026 closed December 1. Target Spring 2027 — applications
           open August 2026."

    BAD:  "DECISION POINT — TIMING: Some campuses accept late submissions
           with a fee, but Cal State LA's policy on this is unclear and
           may require contacting the registrar directly to confirm."
    GOOD: "Past the deadline? Call the registrar to ask about late submission.
           Some CSU campuses allow it with a fee. Cal State LA's policy
           isn't published — confirm by phone before assuming."

  Tasks speak as the system's plan ("File FAFSA 2026-2027"). Do NOT
  echo the "I WANT to / I HAVE NOT / I KEEP / Because / The root cause is"
  grammar from the user's inputs. The exemplar below is the voice
  contract — your output matches its register exactly.

ORDERING:
  suggested_order starts at 0 and increments. Tasks that block
  other tasks should have lower suggested_order. Independent tasks
  can share the same order (parallelizable). The operator may
  re-order after acceptance.

═══════════════════════════════════════════════════════════════════════════════
EXEMPLAR — INSTITUTIONAL GOLD STANDARD
═══════════════════════════════════════════════════════════════════════════════

Project title: "${PROJECT_DESIGN_EXEMPLAR.title}"

GOAL items:
${bulletList(PROJECT_DESIGN_EXEMPLAR.goal_items as unknown as string[])}

PROBLEM items:
${bulletList(PROJECT_DESIGN_EXEMPLAR.problem_items as unknown as string[])}

DIAGNOSIS items:
${bulletList(PROJECT_DESIGN_EXEMPLAR.diagnosis_items as unknown as string[])}

tasks_exemplar (THIS is the shape of what you produce):
\`\`\`json
${JSON.stringify(PROJECT_DESIGN_EXEMPLAR.tasks_exemplar, null, 2)}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

REALITY INPUTS (when present): the user message may include "Deep Research Findings" and/or "Codebase Audit Findings". When they appear, ground the task set in them — treat research as the authority on what is true/best/current in the world, and the audit as the authority on what is actually shipped, stale, or missing in the codebase. Propose a reality-informed task set that closes the gap between them. Do NOT mark or reference any existing tasks as retired/superseded — this run only proposes a task set; reconciliation against the existing list happens elsewhere.

Now produce tasks for the user's project below at this exact rigor. Verify URLs via web_search. Then call return_project_tasks with the structured array.`;

export async function generateProjectTasks(input: GenerateInput): Promise<GenerateOutput> {
  // PR-Ops-Evolve-1: only emit a reality block when a box is non-empty — no empty headers.
  const research = input.deepResearchInput?.trim();
  const audit = input.claudeCodeAuditInput?.trim();
  const realityBlock =
    (research ? `\n## Deep Research Findings (external — what's true/best/current)\n${research}\n` : '') +
    (audit ? `\n## Codebase Audit Findings (what's actually shipped / stale / missing)\n${audit}\n` : '');

  const userMessage = `${formatNorthStarBlock(input.northStar ?? null)}Project title: "${input.projectTitle}"

GOAL items:
${bulletList(input.goalItems)}

PROBLEM items:
${bulletList(input.problemItems)}

DIAGNOSIS items:
${bulletList(input.diagnosisItems)}
${realityBlock}
Web-search to verify vendor URLs (max 8 searches). Then call return_project_tasks with the structured task array.`;

  const inputsSummary =
    `project_id=${input.projectId}; ` +
    `goal_items_count=${input.goalItems.length}; ` +
    `problem_items_count=${input.problemItems.length}; ` +
    `diagnosis_items_count=${input.diagnosisItems.length}`;

  const isStateless = !input.projectId;

  const result = await recordUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    model: MODEL_SONNET_4,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4000,
    temperature: 0.3,
    purpose: isStateless
      ? 'project_tasks_generation_create_form'
      : 'project_tasks_generation',
    targetTable: isStateless ? null : 'operations_projects',
    targetId: isStateless ? null : input.projectId,
    inputsSummary,
    auditDescription: isStateless
      ? `Generated tasks for new project "${input.projectTitle}" (create form, no project_id yet)`
      : `Generated tasks for project "${input.projectTitle}"`,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 8,
      },
      {
        name: 'return_project_tasks',
        description: 'Return the structured task array as the final output.',
        input_schema: TASK_SCHEMA,
      },
    ] as any,
    toolChoice: { type: 'tool', name: 'return_project_tasks' } as any,
  });

  // Extract the structured task array from the return_project_tasks tool use.
  const taskToolUse = (result.toolUses ?? []).find((t) => t.name === 'return_project_tasks');
  if (!taskToolUse) {
    throw new Error('AI did not invoke return_project_tasks tool — synthesis failed');
  }

  const toolInput = taskToolUse.input as { tasks?: unknown };
  if (!toolInput || !Array.isArray(toolInput.tasks)) {
    throw new Error('return_project_tasks tool input did not contain a tasks array');
  }

  const tasks: GeneratedTask[] = toolInput.tasks
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map((t, i) => ({
      title: typeof t.title === 'string' ? t.title.trim().slice(0, 200) : `Task ${i + 1}`,
      description: typeof t.description === 'string' ? t.description.trim().slice(0, 1000) : '',
      link_url: typeof t.link_url === 'string' && t.link_url.trim().length > 0
        ? t.link_url.trim()
        : null,
      notes: typeof t.notes === 'string' && t.notes.trim().length > 0
        ? t.notes.trim().slice(0, 1500)
        : null,
      suggested_order: typeof t.suggested_order === 'number' ? t.suggested_order : i,
    }));

  if (tasks.length === 0) {
    throw new Error('AI returned empty tasks array');
  }

  return {
    tasks,
    usageId: result.usageId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    inspection: result.inspection,
  };
}
