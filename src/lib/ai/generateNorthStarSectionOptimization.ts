/**
 * generateNorthStarSectionOptimization — refine ONE North Star section
 * against the FULL reality of the user's selected projects + tasks.
 *
 * Mirrors src/lib/ai/generateProjectDesign.ts exactly:
 *   - same singleton Anthropic client + model (MODEL_SONNET_4)
 *   - same recordUsage wrapper for cost + audit logging
 *   - same inspection block returned to the caller for transparency
 *
 * Two output shapes:
 *   - 'prose'  — mission_statement / one_year_target / three_year_target /
 *               guiding_principles. AI returns plain text replacement.
 *   - 'chips'  — core_values. AI returns a JSON array of strings; the
 *               module parses it strictly. Malformed JSON or non-array
 *               output → throws. No silent fallback to raw text per the
 *               PR-Ops-5.16 no-fallback rule.
 *
 * Full raw project + task rows are sent (no summarization) per Alex's
 * "max context, truthful payload" decision. The route-layer overflow
 * guard rejects payloads that exceed the context window — this module
 * trusts that the route validated size before calling.
 */

import { recordUsage } from './recordUsage';
import { MODEL_SONNET_4 } from './client';

export type OptimizableKind = 'prose' | 'chips';

export interface ProjectContext {
  id: string;
  entity_id: string;
  title: string;
  goal: string | null;
  problem: string | null;
  diagnosis: string | null;
  design: string | null;
  goal_items: string[];
  problem_items: string[];
  diagnosis_items: string[];
  status: string;
  target_completion_date: string | null;
  estimated_total_minutes: number | null;
  estimated_total_cost_usd: string | null;
}

export interface TaskContext {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_minutes: number | null;
  estimated_cost_usd: string | null;
  actual_minutes: number | null;
  actual_cost_usd: string | null;
  coa_code: string | null;
  deadline: string | null;
  notes: string | null;
  unblocks_label: string | null;
}

interface GenerateInput {
  userId: string;
  userEmail: string;
  sectionName: string;
  sectionKind: OptimizableKind;
  currentValue: string | string[];
  projects: ProjectContext[];
  tasks: TaskContext[];
  northStarId: string | null;
}

interface GenerateOutput {
  proposedValue: string | string[];
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

const SECTION_VOICE: Record<string, string> = {
  mission_statement:
    'mission_statement: declarative, present-tense, identity-shaping. Names what the work IS, not what it will do. ~1-3 sentences.',
  one_year_target:
    'one_year_target: concrete, dated, measurable. "By <month> 2027, <specific outcome>." References real projects and their target dates. ~2-5 sentences.',
  three_year_target:
    'three_year_target: same shape as one_year_target but at the 3-year horizon. References longer-arc projects or the larger pattern the 1-year targets compose into. ~2-5 sentences.',
  guiding_principles:
    'guiding_principles: imperative or declarative, one principle per line, opinionated and specific. Reference the kind of tradeoffs the user is actually making in their tasks. ~5-12 lines.',
  core_values:
    'core_values: a short list of value-name chips (each value is 1-4 words, the chip label only — no explanation prose). Each value names a stance the projects/tasks actually demonstrate. ~3-8 values.',
};

function buildSystemPrompt(sectionName: string, kind: OptimizableKind): string {
  const voice = SECTION_VOICE[sectionName] ?? '(unknown section)';
  const proseOutputContract = `OUTPUT: return ONLY the proposed section text. No preamble. No section header. No surrounding markdown or code fences. Plain prose suitable for whitespace-pre-wrap rendering. Match the section's voice exactly.

Voice for this section:
${voice}`;

  const chipsOutputContract = `OUTPUT: return ONLY a JSON array of strings. Each string is one core-value chip (1-4 words). No preamble. No surrounding prose. No code fences. The first character of your response must be \`[\` and the last must be \`]\`.

Example of valid output:
["truth over comfort", "discipline beats motivation", "ship verified"]

Voice for this section:
${voice}`;

  const outputContract = kind === 'chips' ? chipsOutputContract : proseOutputContract;

  return `You are refining ONE section of a user's North Star ("vision document") against the reality of their actual project work. Your job: propose a sharpened version of THIS SECTION that is grounded, specific, and true to the work they are actually doing.

YOU RECEIVE:
  - SECTION: the name of the section being refined
  - CURRENT VALUE: what's in the section today (may be empty if the user is generating from scratch)
  - PROJECTS: the full row data for each project the user picked as context, including:
      * the project's title, goal, problem, diagnosis, design
      * its goal_items[], problem_items[], diagnosis_items[] (Bridgewater 5-step scoping items)
      * status, target_completion_date, estimated cost/minutes
  - TASKS: the full row data for every task under those projects, including:
      * title, description, status
      * estimated_minutes, estimated_cost_usd, actual_minutes, actual_cost_usd
      * coa_code (chart-of-accounts category), deadline, notes, unblocks_label

RULES (non-negotiable):
  1. Ground every claim in either CURRENT VALUE, PROJECTS, or TASKS.
     Do NOT invent commitments, deadlines, or facts the user hasn't recorded.
  2. Sharpen, don't expand. If the current section is 3 lines and the
     reality is 10 tasks, the proposal should still be ~3-5 lines — the
     goal is precision, not volume.
  3. Replace theoretical generality with what the work reveals. If the
     current value says "build a great product" and the tasks show a
     specific product with specific deadlines, name the product and the
     timeline.
  4. Honesty over polish. If the projects contradict the current value
     (e.g., current says "I value focus" but there are 8 simultaneous
     tracks), reflect that tension rather than smoothing it over.
  5. If PROJECTS and TASKS are both empty, propose based on CURRENT
     VALUE alone — sharpen wording, eliminate filler, do NOT fabricate
     project references.
  6. Do not echo the section name, label, or instructions in your output.
     Just the new section content.

${outputContract}`;
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '  (none)';
  return items.map((s) => `  - ${s}`).join('\n');
}

function formatProject(p: ProjectContext, tasks: TaskContext[]): string {
  const projectTasks = tasks.filter((t) => t.project_id === p.id);
  const taskLines =
    projectTasks.length === 0
      ? '  (no tasks)'
      : projectTasks
          .map((t) => {
            const parts: string[] = [];
            parts.push(`[${t.status}] ${t.title}`);
            if (t.deadline) parts.push(`deadline=${t.deadline}`);
            if (t.estimated_minutes !== null) parts.push(`est_min=${t.estimated_minutes}`);
            if (t.estimated_cost_usd !== null) parts.push(`est_cost=$${t.estimated_cost_usd}`);
            if (t.actual_minutes !== null) parts.push(`actual_min=${t.actual_minutes}`);
            if (t.actual_cost_usd !== null) parts.push(`actual_cost=$${t.actual_cost_usd}`);
            if (t.coa_code) parts.push(`coa=${t.coa_code}`);
            let line = `  - ${parts.join(' · ')}`;
            if (t.description) line += `\n      description: ${t.description}`;
            if (t.unblocks_label) line += `\n      unblocks: ${t.unblocks_label}`;
            if (t.notes) line += `\n      notes: ${t.notes}`;
            return line;
          })
          .join('\n');

  return `═══ PROJECT: ${p.title} (status=${p.status}${
    p.target_completion_date ? `, target=${p.target_completion_date}` : ''
  }) ═══
goal items:
${bulletList(p.goal_items)}
problem items:
${bulletList(p.problem_items)}
diagnosis items:
${bulletList(p.diagnosis_items)}
goal (prose): ${p.goal ?? '(none)'}
problem (prose): ${p.problem ?? '(none)'}
diagnosis (prose): ${p.diagnosis ?? '(none)'}
design (prose):
${p.design ?? '(none)'}
tasks (${projectTasks.length}):
${taskLines}`;
}

function buildUserMessage(input: GenerateInput): string {
  const currentValueBlock =
    input.sectionKind === 'chips'
      ? `[${(input.currentValue as string[]).map((v) => JSON.stringify(v)).join(', ')}]`
      : `"""\n${(input.currentValue as string) || '(empty)'}\n"""`;

  const projectsBlock =
    input.projects.length === 0
      ? '(no projects supplied — propose based on CURRENT VALUE alone, do not fabricate project references)'
      : input.projects.map((p) => formatProject(p, input.tasks)).join('\n\n');

  return `SECTION: ${input.sectionName}

CURRENT VALUE:
${currentValueBlock}

PROJECTS (${input.projects.length}) + TASKS (${input.tasks.length}):
${projectsBlock}

Now produce the proposed value for this section, following the rules + output contract in the system prompt.`;
}

/**
 * Parse the AI's response for the 'chips' sectionKind. Throws on any
 * format violation — NO fallback to raw text per the no-fallback rule.
 */
function parseChipsResponse(raw: string): string[] {
  const trimmed = raw.trim();
  // Strip possible code-fence wrapping, defensively (the prompt forbids it,
  // but if the model leaks one this still parses the array). This is NOT
  // a content fallback — it's a syntactic strip; if the inner content
  // isn't valid JSON-array-of-strings, we still throw.
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(
      `AI returned non-JSON for core_values optimization; expected a JSON array of strings. Raw response: ${raw.slice(0, 200)}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `AI returned non-array for core_values optimization; got ${typeof parsed}. Raw response: ${raw.slice(0, 200)}`
    );
  }
  const out: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== 'string') {
      throw new Error(
        `AI returned non-string element at index ${i} in core_values array; expected string. Raw response: ${raw.slice(0, 200)}`
      );
    }
    const t = item.trim();
    if (t.length > 0) out.push(t);
  }
  if (out.length === 0) {
    throw new Error(
      'AI returned an empty core_values array; refusing to propose an empty set. Retry with different project selection.'
    );
  }
  return out;
}

export async function generateNorthStarSectionOptimization(
  input: GenerateInput
): Promise<GenerateOutput> {
  const systemPrompt = buildSystemPrompt(input.sectionName, input.sectionKind);
  const userMessage = buildUserMessage(input);

  const currentValueSummary =
    input.sectionKind === 'chips'
      ? `current_values=${(input.currentValue as string[]).length}`
      : `current_text_len=${(input.currentValue as string).length}`;

  const inputsSummary =
    `section=${input.sectionName}; kind=${input.sectionKind}; ` +
    `${currentValueSummary}; ` +
    `projects=${input.projects.length}; tasks=${input.tasks.length}`;

  const result = await recordUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    model: MODEL_SONNET_4,
    systemPrompt,
    userMessage,
    maxTokens: input.sectionKind === 'chips' ? 1000 : 3000,
    temperature: 0.3,
    purpose: 'north_star_section_optimization',
    targetTable: input.northStarId ? 'operations_north_star' : null,
    targetId: input.northStarId,
    inputsSummary,
    auditDescription: `Optimized North Star section "${input.sectionName}" against ${input.projects.length} projects / ${input.tasks.length} tasks`,
  });

  if (result.text.trim().length === 0) {
    throw new Error('AI returned empty response; refusing to propose empty content.');
  }

  let proposedValue: string | string[];
  if (input.sectionKind === 'chips') {
    proposedValue = parseChipsResponse(result.text);
  } else {
    proposedValue = result.text.trim();
  }

  return {
    proposedValue,
    usageId: result.usageId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    inspection: result.inspection,
  };
}
