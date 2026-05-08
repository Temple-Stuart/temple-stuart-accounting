/**
 * generateProjectDesign — produces an institutional-rigor design field
 * for a project, given its goal/problem/diagnosis fields as input.
 *
 * Uses Claude Sonnet 4 with the Student Loan project as few-shot exemplar.
 * Returns the generated text + cost metadata; does NOT auto-save to the
 * project (caller must explicitly write back via PATCH after user accepts).
 *
 * Truth-first principle: the user must consciously accept the AI's output
 * before it overwrites their field. The endpoint that calls this returns
 * the generated text in a preview pane; user reviews and decides.
 */

import { recordUsage } from './recordUsage';
import { MODEL_SONNET_4 } from './client';
import { PROJECT_DESIGN_EXEMPLAR } from './exemplars/projectDesign';

interface GenerateInput {
  userId: string;
  userEmail: string;
  projectId: string;
  projectTitle: string;
  goal: string;
  problem: string;
  diagnosis: string;
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

const SYSTEM_PROMPT = `You are a project scoping consultant trained on the institutional rigor of Bridgewater Associates' Principles, Citadel's risk discipline, and Renaissance Technologies' empirical method.

Your job: generate the DESIGN field of a project — a phased plan with decision points — given the user's GOAL, PROBLEM, and DIAGNOSIS fields.

The user's natural-voice grammar maps to Bridgewater's 5-step scoping:
  - GOAL field: "I WANT" lines (desires / target end states)
  - PROBLEM field: "I DID NOT" lines (current gaps)
  - DIAGNOSIS field: "I NEED" lines (root requirements)
  - DESIGN field: "I WILL" lines, but synthesized into PHASES with timelines and decision points

The DESIGN you produce must:
1. Match the depth and structure of the EXEMPLAR below
2. Have explicit phases (Phase 1, Phase 2, etc.) with rough timelines
3. Each phase has a clear OUTCOME stated
4. Include a "Decision points" section at the end listing scenarios that would re-trigger scoping (e.g., "if X happens, push timeline" / "if Y, reset entire project")
5. Reference specific blockers/upstream-dependencies surfaced in the user's PROBLEM and DIAGNOSIS fields
6. Be written in declarative voice (the system, not "I will" — the design is the project's plan, not the operator's first-person commitment)
7. Match the prose length of the exemplar's DESIGN field (~2000 chars)

Return ONLY the design field text. No preamble. No "Here is your design field:". No surrounding markdown code blocks. Just the raw text that would go in the form's design textarea.

═══════════════════════════════════════════════════════════════════════════════
EXEMPLAR — institutional gold standard for project scoping rigor
═══════════════════════════════════════════════════════════════════════════════

Project title: "${PROJECT_DESIGN_EXEMPLAR.title}"

GOAL field:
${PROJECT_DESIGN_EXEMPLAR.goal}

PROBLEM field:
${PROJECT_DESIGN_EXEMPLAR.problem}

DIAGNOSIS field:
${PROJECT_DESIGN_EXEMPLAR.diagnosis}

DESIGN field (← THIS is what you produce):
${PROJECT_DESIGN_EXEMPLAR.design}

═══════════════════════════════════════════════════════════════════════════════

Now produce a DESIGN field at this exact rigor for the user's project below.`;

export async function generateProjectDesign(input: GenerateInput): Promise<GenerateOutput> {
  const userMessage = `Project title: "${input.projectTitle}"

GOAL field:
${input.goal}

PROBLEM field:
${input.problem}

DIAGNOSIS field:
${input.diagnosis}

DESIGN field: [you produce this — match the exemplar's depth and structure]`;

  const inputsSummary =
    `project_id=${input.projectId}; ` +
    `goal_len=${input.goal.length}; problem_len=${input.problem.length}; ` +
    `diagnosis_len=${input.diagnosis.length}`;

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
