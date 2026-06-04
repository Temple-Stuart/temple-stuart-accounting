/**
 * generateReelScript — Stage 3 (OPS-CE-5): turn a day's answered scenes + task
 * record into the reel VOICEOVER, in Alex's voice.
 *
 * Mirrors the codebase AI pattern (generateProjectDesign): a system prompt + a
 * user message of ONLY the real day data, run through recordUsage (immutable
 * operations_ai_usage version row + audit). Plain-text output (prose script) — no
 * forced tool. Does NOT save; the route returns it for the human gate (edit → save).
 *
 * Truth-first: the model gets ONLY what Alex answered + the real task record, and is
 * told NEVER to fabricate events, feelings, or numbers.
 */

import { recordUsage } from './recordUsage';
import { MODEL_SONNET_4 } from './client';

export interface ScriptSceneInput {
  scene_number: number;
  activity: string;
  time: string | null;
  narrative: string | null;
  b_roll: string | null;
  question: string | null;
  answer: string;
}
export interface ScriptTaskInput {
  title: string;
  project: string | null;
  status: string;
  planned: boolean;
  scheduled: string | null; // "09:00–10:30"
  actual: string | null; // "09:05–10:40" when done
}
interface GenInput {
  userId: string;
  userEmail: string;
  pieceId: string;
  dateLabel: string;
  scenes: ScriptSceneInput[];
  tasks: ScriptTaskInput[];
}
interface GenOutput {
  script: string;
  usageId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
}

// THE VOICE CONTRACT — the soul of the reel. Encoded verbatim.
const SYSTEM_PROMPT = `You write the VOICEOVER SCRIPT for a daily short-form reel. You write in ALEX'S RAW VOICE.

ALEX'S VOICE (non-negotiable):
- Plain language a simple person instantly understands. Fun, playful, enjoyable to listen to.
- Built for WILD ENGAGEMENT: hook HARD in the first line, keep momentum every beat, land a strong close.
- Talk like he'd say it OUT LOUD to a friend. Short sentences. Real words.

HARD BAN (instant rewrite if any appears):
- Academic or pretentious verbiage. Corporate tone. Try-hard "smart" vocabulary. Platitudes / motivational-poster lines.
- If a sentence sounds like an essay or a LinkedIn post, rewrite it like he'd actually say it.

THE LOCKED REEL FORMAT:
1. HOOK — open on the strongest line drawn from his answers. Stop the scroll.
2. BODY — the planning / goals / stakes / mindset answers, voiced over the day's life footage (morning scenes through the day, in order). This is most of the reel.
3. PROOF-BURST — near the END, compress the EXECUTION (the task blocks: what got built, planned vs actual, what shipped) into a rapid-fire burst. Fast, concrete, receipts.
4. CLOSE — the day score + a "catch me tomorrow" hook, pulled from the tomorrow/closing answers.

OUTPUT SHAPE:
- SCENE-MAPPED: tag each beat with [scene N · activity] (use the scene numbers + activities given) so Alex can match clips while editing. The proof-burst may be tagged [execution].
- Target ~2:00 read aloud — roughly 280–320 words. Tight.
- Use ONLY what Alex answered and the REAL task record below. If something wasn't answered, don't voice it.
- NEVER fabricate events, feelings, numbers, or outcomes. No invented stats. If the task record is thin, keep the proof-burst short — real and short beats padded.

Write the script now. Output only the script (the tagged beats), nothing else.`;

function bulletScenes(scenes: ScriptSceneInput[]): string {
  return scenes
    .map((s) => {
      const lines = [
        `[scene ${s.scene_number} · ${s.activity}${s.time ? ` · ${s.time}` : ''}]`,
        s.narrative ? `  narrative purpose: ${s.narrative}` : '',
        s.b_roll ? `  b-roll: ${s.b_roll}` : '',
        s.question ? `  question: ${s.question}` : '',
        `  ANSWER: ${s.answer}`,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');
}

function bulletTasks(tasks: ScriptTaskInput[]): string {
  if (tasks.length === 0) return '(no project tasks on the calendar this day)';
  return tasks
    .map((t) => {
      const time = t.actual
        ? `actual ${t.actual}`
        : t.scheduled
          ? `scheduled ${t.scheduled}`
          : 'no time';
      return `- ${t.title}${t.project ? ` (${t.project})` : ''} — ${t.status} · ${time}`;
    })
    .join('\n');
}

export async function generateReelScript(input: GenInput): Promise<GenOutput> {
  const userMessage = `DAY: ${input.dateLabel}

THE DAY'S SCENES (in clock order — these are the life-footage beats; voice the BODY from these answers):
${bulletScenes(input.scenes)}

THE EXECUTION RECORD (the task blocks — compress these into the rapid proof-burst near the end; planned-vs-actual + what shipped):
${bulletTasks(input.tasks)}

Write Alex's reel voiceover per the format and his voice. Scene-map every beat. Use ONLY the above. Never fabricate.`;

  const inputsSummary = `piece_id=${input.pieceId}; scenes_answered=${input.scenes.length}; task_blocks=${input.tasks.length}`;

  const result = await recordUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    model: MODEL_SONNET_4,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1500,
    temperature: 0.85, // creative, conversational voice
    purpose: 'reel_voiceover_generation',
    targetTable: 'operations_content_pieces',
    targetId: input.pieceId,
    inputsSummary,
    auditDescription: `Generated reel voiceover for content piece ${input.pieceId} (${input.dateLabel})`,
  });

  const script = result.text.trim();
  if (script.length === 0) {
    throw new Error('AI returned an empty script');
  }

  return {
    script,
    usageId: result.usageId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  };
}
