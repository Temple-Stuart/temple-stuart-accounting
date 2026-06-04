/**
 * enrichRoutineScenes — Stage-1 AI enrich (OPS-CE-3).
 *
 * Given a routine's ACTIVE steps + Alex's ACTIVE question library, proposes
 * PER STEP: a camera angle, a shot type, a b-roll idea, and the BEST-FIT
 * question. Question assignment is LIBRARY-FIRST: the model returns the
 * question_id of an existing library question whenever one fits; it only
 * proposes NEW wording (question_id=null, proposed_new=true) when no library
 * question fits the step.
 *
 * Mirrors generateProjectTasks.ts exactly:
 *   - Claude Sonnet 4 + a forced custom tool (return_scene_enrichment) for
 *     structured JSON output (tool_choice forces the tool).
 *   - runs through recordUsage so every call writes an immutable
 *     operations_ai_usage version row (full prompt + response) + an audit row.
 *   - returns the parsed array + cost metadata + inspection; does NOT save.
 *     The caller (ScenifyModal) reviews/edits, then commits via the existing
 *     /content/scene-rows upsert — the human gate.
 *
 * Truth-first: the AI NEVER invents steps or activities — it only enriches the
 * steps it is given. The route fails loud upstream if there are no active steps.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { recordUsage } from './recordUsage';
import { MODEL_SONNET_4 } from './client';

export interface EnrichStepInput {
  routine_step_id: string;
  step_order: number;
  activity: string;
  sub_activity: string | null;
  time_of_day: string | null;
}

export interface EnrichQuestionInput {
  id: string;
  label: string | null;
  question_text: string;
}

interface EnrichInput {
  userId: string;
  userEmail: string;
  routineId: string;
  routineName: string;
  steps: EnrichStepInput[];
  questions: EnrichQuestionInput[];
}

export interface EnrichedStep {
  routine_step_id: string;
  camera_needed: string | null;
  filming_angle: string | null;
  shot_type: string | null;
  b_roll: string | null;
  question_id: string | null;   // a library question id, or null when proposed_new
  question_text: string;        // the wording (library text, or the proposed new wording)
  proposed_new: boolean;        // true ONLY when no library question fit
}

interface EnrichOutput {
  steps: EnrichedStep[];
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

const ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          routine_step_id: { type: 'string', description: 'The id of the step being enriched (echo it back exactly).' },
          camera_needed: { type: 'string', maxLength: 200, description: 'CAMERA = the iPhone rig + placement (he shoots iPhone-only — never name another device). Say how the phone is mounted and where, e.g. "tripod bedside", "handheld", "desk tripod", "selfie stick", "phone leaned on the shelf".' },
          filming_angle: { type: 'string', maxLength: 200, description: 'Suggested camera angle (e.g. "eye-level over-the-shoulder").' },
          shot_type: { type: 'string', maxLength: 200, description: 'Suggested shot type (e.g. "close-up", "wide establishing").' },
          b_roll: { type: 'string', maxLength: 800, description: 'A concrete b-roll idea to cut to during this step.' },
          question_id: { type: ['string', 'null'], description: 'The id of the BEST-FIT question from the provided library, or null if none fits.' },
          question_text: { type: 'string', maxLength: 800, description: 'The exact wording of the assigned question. If question_id is set, copy that library question verbatim. If null, this is your proposed NEW wording.' },
          proposed_new: { type: 'boolean', description: 'true ONLY when no library question fit and question_text is newly proposed; false when assigned from the library.' },
        },
        required: ['routine_step_id', 'question_text', 'proposed_new'],
      },
    },
  },
  required: ['steps'],
} as const;

const SYSTEM_PROMPT = `You are a short-form video director helping a solo founder turn a daily ROUTINE into a filmable scene map for a reel.

You are given the routine's STEPS (what he actually does, in order) and his OWN QUESTION LIBRARY (a designed set of reflective prompts he asks himself on camera). For EACH step you produce a scene enrichment.

ABSOLUTE RULES:
  - NEVER invent, merge, split, rename, or reorder steps. You enrich ONLY the steps you are given, one enrichment per step, echoing routine_step_id back exactly. The operator owns WHAT he does; you suggest only HOW to film it and WHICH question to ask.
  - Question assignment is LIBRARY-FIRST. For each step, pick the BEST-FIT question from the provided library and return its question_id with question_text copied VERBATIM from that library entry, and proposed_new=false. Serve his framework — do not paraphrase or randomize his questions.
  - ONLY when no library question genuinely fits a step may you propose new wording: set question_id=null, proposed_new=true, and put your proposed question in question_text. Prefer assigning an existing question over proposing a new one. If the library is empty, every step is proposed_new.

PER STEP you also suggest filming craft (these are SUGGESTIONS he will edit):
  - camera_needed: the CAMERA — rig + placement. He shoots iPhone-ONLY, so NEVER name a different device (no DSLR, no webcam, no "camera B"). Describe how the phone is mounted and where: "tripod bedside", "handheld", "desk tripod", "selfie stick", "phone leaned on the shelf". Device variety (lenses/bodies) is a future gear library — not your concern.
  - filming_angle: the camera angle.
  - shot_type: the shot framing.
  - b_roll: one concrete cutaway idea that illustrates this step.
  Keep each crisp and concrete. No hedging, no preamble. If you have nothing useful for a craft field, omit it (it is optional) rather than padding.

OUTPUT: call return_scene_enrichment with one object per provided step. Do not include steps that were not provided.`;

function fmtTime(t: string | null): string {
  if (!t) return '';
  const m = t.match(/T(\d{2}:\d{2})/);
  if (m) return ` @ ${m[1]}`;
  return '';
}

export async function enrichRoutineScenes(input: EnrichInput): Promise<EnrichOutput> {
  const stepsBlock = input.steps
    .map(
      (s) =>
        `- routine_step_id=${s.routine_step_id} | #${s.step_order} ${s.activity}${
          s.sub_activity ? ` — ${s.sub_activity}` : ''
        }${fmtTime(s.time_of_day)}`
    )
    .join('\n');

  const questionsBlock =
    input.questions.length === 0
      ? '(the library is EMPTY — you must propose new wording for every step, proposed_new=true, question_id=null)'
      : input.questions
          .map((q) => `- id=${q.id}${q.label ? ` [${q.label}]` : ''}: ${q.question_text}`)
          .join('\n');

  const userMessage = `Routine: "${input.routineName}"

STEPS (enrich each, one-to-one, echo routine_step_id exactly — never invent steps):
${stepsBlock}

QUESTION LIBRARY (assign the best-fit by id; propose new only when none fits):
${questionsBlock}

Call return_scene_enrichment with exactly ${input.steps.length} enrichment object(s), one per step above.`;

  const inputsSummary =
    `routine_id=${input.routineId}; steps=${input.steps.length}; library_questions=${input.questions.length}`;

  // Typed locals (no `any`): the JSON-schema literal is widened to the SDK's
  // InputSchema shape via `unknown` rather than disabling the type check.
  const tools: Anthropic.ToolUnion[] = [
    {
      name: 'return_scene_enrichment',
      description: 'Return the per-step scene enrichment array as the final output.',
      input_schema: ENRICHMENT_SCHEMA as unknown as Anthropic.Tool['input_schema'],
    },
  ];
  const toolChoice: Anthropic.ToolChoice = { type: 'tool', name: 'return_scene_enrichment' };

  const result = await recordUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    model: MODEL_SONNET_4,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4000,
    temperature: 0.4,
    purpose: 'routine_scene_enrichment',
    targetTable: 'operations_routines',
    targetId: input.routineId,
    inputsSummary,
    auditDescription: `Enriched scene map for routine "${input.routineName}" (${input.steps.length} steps)`,
    tools,
    toolChoice,
  });

  const toolUse = (result.toolUses ?? []).find((t) => t.name === 'return_scene_enrichment');
  if (!toolUse) {
    throw new Error('AI did not invoke return_scene_enrichment tool — enrichment failed');
  }
  const toolInput = toolUse.input as { steps?: unknown };
  if (!toolInput || !Array.isArray(toolInput.steps)) {
    throw new Error('return_scene_enrichment tool input did not contain a steps array');
  }

  // Defensive normalization. Only keep enrichments whose routine_step_id matches
  // a provided step (the AI must never introduce steps). A library question_id
  // is honored only if it is one of the provided library ids — otherwise we treat
  // it as proposed-new (never trust an id the model could have hallucinated).
  const validStepIds = new Set(input.steps.map((s) => s.routine_step_id));
  const validQuestionIds = new Set(input.questions.map((q) => q.id));
  const questionTextById = new Map(input.questions.map((q) => [q.id, q.question_text]));

  const steps: EnrichedStep[] = toolInput.steps
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => {
      const rsid = typeof s.routine_step_id === 'string' ? s.routine_step_id : '';
      const rawQid = typeof s.question_id === 'string' && s.question_id.length > 0 ? s.question_id : null;
      const libraryHit = rawQid && validQuestionIds.has(rawQid);
      // Library assignment → snapshot the canonical library text (not the model's
      // copy, which could drift). Proposed-new → keep the model's wording.
      const questionText = libraryHit
        ? (questionTextById.get(rawQid as string) as string)
        : typeof s.question_text === 'string'
          ? s.question_text.trim().slice(0, 800)
          : '';
      return {
        routine_step_id: rsid,
        camera_needed:
          typeof s.camera_needed === 'string' && s.camera_needed.trim().length > 0
            ? s.camera_needed.trim().slice(0, 200)
            : null,
        filming_angle:
          typeof s.filming_angle === 'string' && s.filming_angle.trim().length > 0
            ? s.filming_angle.trim().slice(0, 200)
            : null,
        shot_type:
          typeof s.shot_type === 'string' && s.shot_type.trim().length > 0
            ? s.shot_type.trim().slice(0, 200)
            : null,
        b_roll:
          typeof s.b_roll === 'string' && s.b_roll.trim().length > 0
            ? s.b_roll.trim().slice(0, 800)
            : null,
        question_id: libraryHit ? (rawQid as string) : null,
        question_text: questionText,
        proposed_new: !libraryHit,
      };
    })
    .filter((s) => validStepIds.has(s.routine_step_id));

  return {
    steps,
    usageId: result.usageId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    inspection: result.inspection,
  };
}
