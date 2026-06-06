/**
 * generateProjectDesign — produces an institutional-rigor STEP-based plan
 * for a project, given its structured GOAL / PROBLEM / DIAGNOSIS items.
 *
 * Uses Claude Sonnet 4 with the Student Loan project as few-shot exemplar
 * (post-PR-Ops-3.7 reformat to structured arrays + STEP labels).
 *
 * Returns the generated text + cost metadata + inspection block; does NOT
 * auto-save to the project. Caller must explicitly write back via PATCH
 * after user accepts the AI's output.
 *
 * Truth-first: user owns INPUTS (goal/problem/diagnosis items), AI owns
 * SYNTHESIS (design field). Explicit acceptance gate between them.
 */

import { recordUsage } from './recordUsage';
import { MODEL_SONNET_4 } from './client';
import { PROJECT_DESIGN_EXEMPLAR } from './exemplars/projectDesign';
import { formatNorthStarBlock, type NorthStarContext } from './northStarContext';

interface GenerateInput {
  userId: string;
  userEmail: string;
  projectId: string;
  projectTitle: string;
  goalItems: string[];
  problemItems: string[];
  diagnosisItems: string[];
  northStar?: NorthStarContext | null;
  // Optional pasted codebase audit (Claude Code). When present it is injected as a
  // CODEBASE REALITY block so the plan reuses what already exists and never proposes
  // building it again. Whole text in — no truncation (the API fails loud if oversized).
  auditInput?: string | null;
}

interface GenerateOutput {
  generatedDesign: string;
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

const SYSTEM_PROMPT = `You are a project scoping expert trained on the institutional rigor of Bridgewater Associates' Principles, Citadel's risk discipline, and Renaissance Technologies' empirical method.

Your job: generate the DESIGN of a project — a numbered step-by-step plan with decision points — given the user's GOAL items, PROBLEM items, and DIAGNOSIS items.

The user's natural-voice grammar maps to Bridgewater's 5-step scoping:
  - GOAL items: "I WANT to" lines (desires / target end states)
  - PROBLEM items: "I HAVE NOT" / "I KEEP" lines (current gaps and recurring obstacles)
  - DIAGNOSIS items: "Because" / "The root cause is" lines (root CAUSES — WHY the gap exists, not what to do about it). Diagnosis items name causal mechanisms; they do NOT prescribe solutions. Treating a diagnosis as a to-do is a category error — your job in step 4 (DESIGN) is to design against the causes the user surfaced.
  - DESIGN field: numbered STEPS with timelines and decision points (you produce this)

When a NORTH STAR block is present at the top of the user message, treat it as the strategic frame — scope this project as a coherent part of that vision, respecting its sequencing and dependencies, and do not propose work that contradicts it.

When CODEBASE REALITY is provided: every step must be consistent with it. Reuse components, feeds, routes, and tables it documents as existing. NEVER propose building something it says exists. Where a step touches an existing component, name it.

SOLO-FOUNDER OPERATOR CONTEXT: The user is a solo founder and User #1 of their own product. They validate by USING the thing in real production, not by controlled experiments. Favor decide-by-use over A/B tests, completion-rate metrics, abandonment funnels, or "test with N users" studies. Do NOT propose steps whose only deliverable is a measurement or a study. Institutional rigor here means sequencing and dependency discipline, not corporate product-management ceremony. NOTE: legitimate correctness-validation work (verifying a calculation against known-correct examples, reconciling data against a source of truth) IS real work and SHOULD be proposed when relevant — the guardrail targets ceremony, not correctness checks.

The DESIGN you produce must:
1. Match the depth and structure of the EXEMPLAR below
2. Have explicit numbered STEPS (STEP 1, STEP 2, STEP 3, ...) with rough timelines where applicable
3. Each STEP states a clear OUTCOME at its end
4. Include a "Decision points" section at the end listing scenarios that would re-trigger scoping (e.g., "if X happens, push timeline" / "if Y, reset entire project")
5. Reference specific blockers/upstream-dependencies surfaced in the user's PROBLEM and DIAGNOSIS items
6. Be written in declarative voice — the project's plan, NOT the operator's first-person commitment. Do NOT echo the "I WANT to / I HAVE NOT / I KEEP / Because / The root cause is" grammar in your output. The steps speak as the system's plan.
7. Match the prose length of the exemplar's design field (~2000 chars)

CRITICAL — do research with your domain knowledge:
Before drafting steps, draw on your training-data knowledge of the topic. For projects involving regulated processes (FAFSA, tax filing, business formation, SEC compliance, immigration paperwork, accreditation, etc.), reference specific real-world deadlines, agencies, standard practices, and downstream dependencies. The user has supplied their personal context as item lists; your job is to combine that context with institutional knowledge to produce a plan that is correct in the world, not just internally consistent with what the user typed.

Return ONLY the design field text. No preamble. No "Here is your design field:". No surrounding markdown code blocks. Just the raw text that would go in the form's design field.

═══════════════════════════════════════════════════════════════════════════════
EXEMPLAR — institutional gold standard for project scoping rigor
═══════════════════════════════════════════════════════════════════════════════

Project title: "${PROJECT_DESIGN_EXEMPLAR.title}"

GOAL items:
${bulletList(PROJECT_DESIGN_EXEMPLAR.goal_items as unknown as string[])}

PROBLEM items:
${bulletList(PROJECT_DESIGN_EXEMPLAR.problem_items as unknown as string[])}

DIAGNOSIS items:
${bulletList(PROJECT_DESIGN_EXEMPLAR.diagnosis_items as unknown as string[])}

DESIGN field (← THIS is what you produce):
${PROJECT_DESIGN_EXEMPLAR.design}

═══════════════════════════════════════════════════════════════════════════════

Now produce a DESIGN field at this exact rigor for the user's project below. Remember: declarative voice, STEP-based output, decision points section, research the topic with your domain knowledge.`;

export async function generateProjectDesign(input: GenerateInput): Promise<GenerateOutput> {
  // Only emit the reality block when the box is non-empty — no empty header. Whole
  // text in, no truncation (no-fallback law: oversized → the API errors loud).
  const audit = input.auditInput?.trim();
  const realityBlock = audit
    ? `\n## CODEBASE REALITY (from Claude Code audit — what is actually shipped / stale / missing)\n${audit}\n`
    : '';

  const userMessage = `${formatNorthStarBlock(input.northStar ?? null)}Project title: "${input.projectTitle}"

GOAL items:
${bulletList(input.goalItems)}

PROBLEM items:
${bulletList(input.problemItems)}

DIAGNOSIS items:
${bulletList(input.diagnosisItems)}
${realityBlock}
DESIGN field: [you produce this — match the exemplar's depth and structure]`;

  const inputsSummary =
    `project_id=${input.projectId}; ` +
    `goal_items_count=${input.goalItems.length}; ` +
    `problem_items_count=${input.problemItems.length}; ` +
    `diagnosis_items_count=${input.diagnosisItems.length}`;

  // Stateless mode: when projectId is empty, the call originates from the
  // create form before a project exists. Pass null targets so recordUsage
  // routes the audit row to the operations_ai_usage row itself via the
  // PR-Ops-3.5 fallback. Use a discriminating purpose so cost analytics
  // can distinguish create-form generations from per-project ones.
  const isStateless = !input.projectId;

  const result = await recordUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    model: MODEL_SONNET_4,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2000,
    temperature: 0.3,
    purpose: isStateless
      ? 'project_design_generation_create_form'
      : 'project_design_generation',
    targetTable: isStateless ? null : 'operations_projects',
    targetId: isStateless ? null : input.projectId,
    inputsSummary,
    auditDescription: isStateless
      ? `Generated design field for new project "${input.projectTitle}" (create form, no project_id yet)`
      : `Generated design field for project "${input.projectTitle}"`,
  });

  return {
    generatedDesign: result.text,
    usageId: result.usageId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    inspection: result.inspection,
  };
}
