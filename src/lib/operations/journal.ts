/**
 * journal — THE DAY'S JOURNAL, PURE (JOURNAL-01, 2026-10-13; JOURNAL-02, 2026-10-13; JOURNAL-03, 2026-10-15).
 *
 * The journal routine's stop (a routine whose role is 'journal', stopRole.ts)
 * shows a plate on the day card and asks its questions under it. The ANSWERS a
 * person types are one row per (user, day) in operations_day_journals. The
 * plate's NUMBERS are never stored: they are derived at read time from
 * yesterday's own reads (day/dayCard.ts dayTally).
 *
 * JOURNAL-02 — THE SIMPLE JOURNAL. Five things, in this order on the plate and
 * in the form: YESTERDAY (read-only, derived from yesterday's row and reads),
 * TODAY (the day's goals, a list — goals), BLOCKERS (what could stop it —
 * blocker), PLAN (numbered steps, each tickable — plan_steps and plan_done, one
 * tick per step) and END OF DAY (what got done, typed tonight — shipped, the
 * same column relabelled).
 *
 * JOURNAL-03 (Alex, 2026-10-15) — END OF DAY IS RETIRED: the plan's ticks say
 * what got done, so the box asked nothing the plate did not already show. Four
 * things now: YESTERDAY, TODAY, BLOCKERS, PLAN. `shipped` joins the retired
 * answers — retired, not deleted: the column stays (no migration, nothing
 * dropped), the words typed before stay in the row and in `retired`, and a
 * write never touches them (the routes write the four answers alone).
 *
 * RETIRED 2026-10-13 (JOURNAL-02): adjustment, one_thing, witness, plan_1_if …
 * plan_3_then, obstacle_if, obstacle_then; 2026-10-15 (JOURNAL-03): shipped.
 * Not asked, not shown and never written. KEPT in the table with the words
 * typed before (no migration drops a column); a row carries them in `retired`
 * so the audit log's before and after keep them — the screen never reads
 * `retired`. JOURNAL-03: a body that carries one is refused by name
 * (retiredFieldWords — was ignored), so a page from before reloads instead of
 * believing its words were saved.
 *
 * Here: the four answers and their limits, what the routes accept (journalInput
 * — the one rule, shared by the form so the screen refuses in the route's own
 * words), a row as the routes answer it (journalRowOf), whether a second write
 * changes anything (journalUnchanged), the plan's ticks carried across a
 * re-pasted plan (carryTicks), the steps left open (openSteps), and the words.
 * No fetch, no clock, no Prisma — the tests drive every rule.
 */
import { isIsoDay } from '@/lib/budget/days';

/** The text answer's column length (VARCHAR(n) — n CHARACTERS, counted in code points, not UTF-16 units). JOURNAL-03 (2026-10-15): shipped's 500 left with END OF DAY. */
export const ANSWER_MAX = {
  blocker: 280,
} as const;

export type TextField = keyof typeof ANSWER_MAX;

/** Each list's limits: the lines it holds (the migration's CHECKs) and each line's characters (the rule's). */
export const LIST_MAX = {
  goals: { lines: 8, characters: 160 },
  plan_steps: { lines: 12, characters: 200 },
} as const;

export type ListField = keyof typeof LIST_MAX;

/** The four answers in the plate's order: TODAY's goals, BLOCKERS, PLAN's steps and their ticks. JOURNAL-03 (2026-10-15): END OF DAY (shipped) is retired. */
export const ANSWER_FIELDS = ['goals', 'blocker', 'plan_steps', 'plan_done'] as const;

export type AnswerField = (typeof ANSWER_FIELDS)[number];

export interface Answers {
  readonly goals: string[];
  readonly blocker: string | null;
  readonly plan_steps: string[];
  /** One tick per step, in the steps' order. */
  readonly plan_done: boolean[];
}

/** RETIRED 2026-10-13 (JOURNAL-02) and 2026-10-15 (JOURNAL-03, shipped) — kept in the table, never asked, shown or written; a body that carries one is refused by name. */
export const RETIRED_FIELDS = [
  'adjustment', 'one_thing', 'witness',
  'plan_1_if', 'plan_1_then', 'plan_2_if', 'plan_2_then', 'plan_3_if', 'plan_3_then', 'obstacle_if', 'obstacle_then',
  'shipped',
] as const;

export type RetiredField = (typeof RETIRED_FIELDS)[number];
export type Retired = Readonly<Record<RetiredField, string | null>>;

/** A journal as the routes answer it: the day 'YYYY-MM-DD', typed_at the row's updated_at as ISO text, the retired answers for the audit log. */
export interface JournalRow extends Answers {
  readonly id: string;
  readonly day: string;
  readonly typed_at: string;
  readonly retired: Retired;
}

/** The row as Prisma reads it. */
export type JournalDbRow = Answers & Retired & {
  readonly id: string;
  readonly day: Date;
  readonly updated_at: Date;
};

/** Nothing answered — what an unanswered day reads as. */
export const NO_ANSWERS: Answers = Object.freeze({
  goals: Object.freeze([]) as unknown as string[], blocker: null, plan_steps: Object.freeze([]) as unknown as string[], plan_done: Object.freeze([]) as unknown as boolean[],
});

/** The answers alone, from a row — built fresh from ANSWER_FIELDS, the lists copied, so no other key passes through. */
export const answersOf = (source: Partial<Answers>): Answers => ({
  goals: [...(source.goals ?? [])],
  blocker: source.blocker ?? null,
  plan_steps: [...(source.plan_steps ?? [])],
  plan_done: [...(source.plan_done ?? [])],
});

const retiredOf = (row: Retired): Retired => Object.fromEntries(RETIRED_FIELDS.map((f) => [f, row[f] ?? null])) as Record<RetiredField, string | null>;

/** A row as the routes answer it — the day as 'YYYY-MM-DD' (@db.Date is UTC midnight, the STAY-01 convention), typed_at from updated_at. */
export function journalRowOf(row: JournalDbRow): JournalRow {
  return { ...answersOf(row), retired: retiredOf(row), id: row.id, day: row.day.toISOString().slice(0, 10), typed_at: row.updated_at.toISOString() };
}

/** A 'YYYY-MM-DD' day as the @db.Date value Prisma writes — UTC midnight (src/lib/operations/stay.ts asDate, the one convention). */
export const asJournalDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

// ── THE INPUT RULE ──────────────────────────────────────────────────────────

/** JOURNAL-03 (2026-10-15): a retired field is named too — the body that carries one is refused. */
export type JournalField = 'day' | AnswerField | RetiredField;

export type JournalInputResult =
  | { readonly ok: true; readonly value: { readonly day: string; readonly answers: Answers } }
  | { readonly ok: false; readonly field: JournalField; readonly message: string };

const refuse = (field: JournalField, message: string): JournalInputResult => ({ ok: false, field, message });

export const BODY_WORDS = 'the body must be an object with day and the answers';
export const NOTHING_TYPED_WORDS = 'nothing typed — a journal is at least one answer';
export const CONTROLS_WORDS = 'control characters are not an answer';
export const BIDI_WORDS = 'direction-reversing characters (U+202A–U+202E, U+2066–U+2069) are not an answer';
export const dayWords = (raw: unknown): string => `day ${JSON.stringify(raw)} is not a 'YYYY-MM-DD' day`;
export const notStringWords = (field: TextField): string => `${field} must be a string`;
export const tooLongWords = (field: TextField, given: number): string => `${field} is at most ${ANSWER_MAX[field]} characters (${given} given)`;
export const notListWords = (field: ListField): string => `${field} must be a list of lines`;
export const tooManyWords = (field: ListField, given: number): string => `${field} is at most ${LIST_MAX[field].lines} lines (${given} given)`;
export const lineNotStringWords = (field: ListField, line: number): string => `${field} line ${line} must be a string`;
export const blankLineWords = (field: ListField, line: number): string => `${field} line ${line} is blank — type it or leave it out`;
export const lineTooLongWords = (field: ListField, line: number, given: number): string => `${field} line ${line} is at most ${LIST_MAX[field].characters} characters (${given} given)`;
export const lineWords = (field: ListField, line: number, words: string): string => `${field} line ${line}: ${words}`;
/** JOURNAL-03 (Alex, 2026-10-15): "shipped is retired — it is no longer asked; reload the page" — a body from a page that still asks it. */
export const retiredFieldWords = (field: RetiredField): string => `${field} is retired — it is no longer asked; reload the page`;
export const DONE_NOT_LIST_WORDS = 'plan_done must be a list of true or false, one per step';
export const doneNotBooleanWords = (line: number): string => `plan_done line ${line} must be true or false`;
export const doneLengthWords = (ticks: number, steps: number): string => `plan_done has ${ticks} ticks for ${steps} steps — one tick per step`;

// C0 and C1 controls (stopRecord.ts's rule), and a surrogate half with no partner (not UTF-8 — the database would refuse it).
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
/** The bidirectional controls — they reverse how the plate renders what follows. */
const BIDI = /[‪-‮⁦-⁩]/;
/** Format characters and nonspacing marks — invisible on their own; stripped only to ask whether anything is left. */
const INVISIBLE = /[\p{Cf}\p{Mn}]/gu;

/** One piece of typed text through the JOURNAL-01 rules: trimmed, runs of whitespace one space; a control, a lone surrogate, a bidi control refused by name; `visible` false when nothing is left once format characters and nonspacing marks are set aside. */
function cleanText(raw: string): { readonly ok: true; readonly text: string; readonly visible: boolean; readonly length: number } | { readonly ok: false; readonly words: string } {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (CONTROLS.test(text) || LONE_SURROGATE.test(text)) return { ok: false, words: CONTROLS_WORDS };
  if (BIDI.test(text)) return { ok: false, words: BIDI_WORDS };
  return { ok: true, text, visible: text.replace(INVISIBLE, '').trim() !== '', length: [...text].length };
}

/** A list answer: absent or null is empty; each line a string, cleaned, visible, within its characters — a blank line refused by name, never dropped. */
function listOf(field: ListField, raw: unknown): { readonly ok: true; readonly lines: string[] } | { readonly ok: false; readonly result: JournalInputResult } {
  if (raw === undefined || raw === null) return { ok: true, lines: [] };
  if (!Array.isArray(raw)) return { ok: false, result: refuse(field, notListWords(field)) };
  if (raw.length > LIST_MAX[field].lines) return { ok: false, result: refuse(field, tooManyWords(field, raw.length)) };
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item: unknown = raw[i];
    if (typeof item !== 'string') return { ok: false, result: refuse(field, lineNotStringWords(field, i + 1)) };
    const clean = cleanText(item);
    if (!clean.ok) return { ok: false, result: refuse(field, lineWords(field, i + 1, clean.words)) };
    if (!clean.visible) return { ok: false, result: refuse(field, blankLineWords(field, i + 1)) };
    if (clean.length > LIST_MAX[field].characters) return { ok: false, result: refuse(field, lineTooLongWords(field, i + 1, clean.length)) };
    lines.push(clean.text);
  }
  return { ok: true, lines };
}

/** A text answer: absent or null is unanswered; a string, cleaned; nothing visible is unanswered (null); within its column's characters. */
function textOf(field: TextField, raw: unknown): { readonly ok: true; readonly text: string | null } | { readonly ok: false; readonly result: JournalInputResult } {
  if (raw === undefined || raw === null) return { ok: true, text: null };
  if (typeof raw !== 'string') return { ok: false, result: refuse(field, notStringWords(field)) };
  const clean = cleanText(raw);
  if (!clean.ok) return { ok: false, result: refuse(field, clean.words) };
  if (!clean.visible) return { ok: true, text: null };
  if (clean.length > ANSWER_MAX[field]) return { ok: false, result: refuse(field, tooLongWords(field, clean.length)) };
  return { ok: true, text: clean.text };
}

/**
 * The one rule for what a journal is given: { day, goals?, blocker?,
 * plan_steps?, plan_done? }. The body an object; then no retired field —
 * JOURNAL-03 (Alex, 2026-10-15): a body that carries one of the twelve, any
 * value, null included, is refused by that field's name (retiredFieldWords;
 * JOURNAL-02 ignored them), while any other extra key is still ignored. `day` a real
 * 'YYYY-MM-DD' day (isIsoDay — the one rule). Absent lists are empty, absent
 * texts null. Every string through the JOURNAL-01 rules (cleanText): trimmed,
 * runs of whitespace one space; no control character, no lone surrogate, no
 * bidi control (each refused by name). A goal or a step is a line: at most 8
 * goals of 160 characters and 12 steps of 200, counted in CODE POINTS; a blank
 * line is refused by name (the form drops blank lines before sending — the rule
 * never drops one silently). plan_done is one true or false per step, refused
 * by name when it is not. A text answer that is nothing visible is unanswered
 * (null). At least one goal, step or blocker (JOURNAL-03: end of day no
 * longer counts). Checked in the plate's order, the first bad field named. The
 * answers come back built from the four fields alone — a retired field, or any
 * other key, never passes.
 */
export function journalInput(body: unknown): JournalInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return refuse('day', BODY_WORDS);
  const b = body as Record<string, unknown>;
  for (const f of RETIRED_FIELDS) if (Object.prototype.hasOwnProperty.call(b, f)) return refuse(f, retiredFieldWords(f));
  if (!isIsoDay(b.day)) return refuse('day', dayWords(b.day));
  const day = b.day;

  const goals = listOf('goals', b.goals);
  if (!goals.ok) return goals.result;
  const blocker = textOf('blocker', b.blocker);
  if (!blocker.ok) return blocker.result;
  const steps = listOf('plan_steps', b.plan_steps);
  if (!steps.ok) return steps.result;

  const rawDone = b.plan_done;
  const plan_done: boolean[] = [];
  if (rawDone !== undefined && rawDone !== null) {
    if (!Array.isArray(rawDone)) return refuse('plan_done', DONE_NOT_LIST_WORDS);
    // The count first — a list of any length is refused before a single element is looked at.
    if (rawDone.length !== steps.lines.length) return refuse('plan_done', doneLengthWords(rawDone.length, steps.lines.length));
    for (let i = 0; i < rawDone.length; i += 1) {
      const tick: unknown = rawDone[i];
      if (typeof tick !== 'boolean') return refuse('plan_done', doneNotBooleanWords(i + 1));
      plan_done.push(tick);
    }
  }
  if (plan_done.length !== steps.lines.length) return refuse('plan_done', doneLengthWords(plan_done.length, steps.lines.length));

  if (goals.lines.length === 0 && steps.lines.length === 0 && blocker.text === null) return refuse('goals', NOTHING_TYPED_WORDS);
  return { ok: true, value: { day, answers: { goals: goals.lines, blocker: blocker.text, plan_steps: steps.lines, plan_done } } };
}

const sameList = <T>(a: readonly T[], b: readonly T[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Would writing `answers` over `row` change nothing? The four answers, the lists element by element (JOURNAL-03: shipped is not written, so not compared). */
export const journalUnchanged = (row: Answers, answers: Answers): boolean =>
  sameList(row.goals, answers.goals)
  && row.blocker === answers.blocker
  && sameList(row.plan_steps, answers.plan_steps)
  && sameList(row.plan_done, answers.plan_done);

// ── THE PLAN'S TICKS ────────────────────────────────────────────────────────

/**
 * The lines of a box as the form sends them: split on line breaks, each
 * trimmed and its runs of whitespace one space (the rule's own cleaning, so a
 * re-pasted step matches its saved text exactly), blank lines dropped. Only
 * whitespace is blank here — a line of invisible characters is kept and the
 * rule refuses it by name.
 */
export const linesOf = (text: string): string[] => text.split(/\r\n|\r|\n/).map((line) => line.trim().replace(/\s+/g, ' ')).filter((line) => line !== '');

/**
 * PLAN-01 (2026-10-13): a pasted list's leading marker — "1." "1)" "-" "•" "*"
 * followed by a space — is the list's, not the step's: the plate numbers the
 * steps itself (and bullets the goals), so the form removes it from each plan
 * and goal line after linesOf and before carryTicks. Nothing else in a line
 * changes: "1.5 kg rice", "-5 degrees" and "a - b" stay as typed. A line from
 * linesOf ends in no space, so a stripped line is never empty.
 */
export const stripListMarker = (line: string): string => line.replace(/^(?:\d+[.)]|[-•*]) /, '');

/**
 * The ticks a re-pasted plan keeps: a new step whose exact text was a saved
 * step keeps that saved step's tick (the first saved match not yet used, so
 * two steps of the same text keep their own ticks in order); any other step
 * starts unticked. A saved plan whose ticks are not one per step is refused —
 * the table's CHECK holds it, so it is a broken input, never guessed at.
 */
export function carryTicks(oldSteps: readonly string[], oldDone: readonly boolean[], newSteps: readonly string[]): boolean[] {
  if (oldSteps.length !== oldDone.length) throw new Error(`journal: ${oldDone.length} ticks for ${oldSteps.length} saved steps — one tick per step`);
  const used = oldSteps.map(() => false);
  return newSteps.map((step) => {
    const at = oldSteps.findIndex((saved, i) => !used[i] && saved === step);
    if (at === -1) return false;
    used[at] = true;
    return oldDone[at];
  });
}

/** The steps not ticked, in their order — what a day left open. */
export function openSteps(answers: Answers): string[] {
  if (answers.plan_steps.length !== answers.plan_done.length) throw new Error(`journal: ${answers.plan_done.length} ticks for ${answers.plan_steps.length} steps — one tick per step`);
  return answers.plan_steps.filter((_, i) => !answers.plan_done[i]);
}

/**
 * CLEAN-02 (2026-10-14): yesterday from its plan's ticks — no journal (the read
 * answered no row), no plan (a journal with no steps), or the steps done of all
 * and the ones left over (openSteps, in their order). The card's YESTERDAY line
 * and the plan prompt's both read it; nothing here is money.
 */
export type YesterdaySteps =
  | { readonly kind: 'no journal' }
  | { readonly kind: 'no plan' }
  | { readonly kind: 'steps'; readonly done: number; readonly of: number; readonly leftOver: readonly string[] };

export function yesterdaySteps(row: Answers | null): YesterdaySteps {
  if (row === null) return { kind: 'no journal' };
  if (row.plan_steps.length === 0) return { kind: 'no plan' };
  const leftOver = openSteps(row);
  return { kind: 'steps', done: row.plan_steps.length - leftOver.length, of: row.plan_steps.length, leftOver };
}

// ── WORDS ───────────────────────────────────────────────────────────────────

/** The form's three questions — each box is labelled with its question. JOURNAL-03 (2026-10-15): END_OF_DAY_QUESTION is gone with its box. */
export const TODAY_GOALS_QUESTION = 'What do you need to get done today? One per line.';
export const BLOCKERS_QUESTION = 'What could stop it?';
export const PLAN_QUESTION = 'The plan — paste the steps from chat, one per line.';
/** The examples the goals and plan boxes show until something is typed. */
export const GOALS_EXAMPLE = 'perfect the day cards\nbook travel for the rest of the trip';
export const PLAN_EXAMPLE = 'merge TABLE-01\nbook travel while CC runs\nrecord brunch and dinner\nscreenshot the card, edit, post';

/** The plate's four blocks, in order. JOURNAL-03 (2026-10-15): END_OF_DAY_BLOCK_WORD is gone with its block. */
export const YESTERDAY_WORD = 'YESTERDAY';
export const TODAY_BLOCK_WORD = 'TODAY';
export const BLOCKERS_BLOCK_WORD = 'BLOCKERS';
export const PLAN_BLOCK_WORD = 'PLAN';
/** An unanswered question prints this — never a blank. */
export const UNANSWERED_WORD = '—';
/** "• perfect the day cards" — a goal on the plate. */
export const goalWords = (goal: string): string => `• ${goal}`;
/** "☐ 1. merge TABLE-01" · "✓ 1. merge TABLE-01" — a step and its tick. */
export const planStepWords = (index: number, step: string, done: boolean): string => `${done ? '✓' : '☐'} ${index}. ${step}`;
/** "2 of 5 done" — under the plan. */
export const planDoneWords = (done: number, of: number): string => `${done} of ${of} done`;
// JOURNAL-03 (2026-10-15): NOTE_WORD and noteWords — yesterday's END OF DAY text on the plate, "note: …" — are gone with END OF DAY.
/** CLEAN-02 (2026-10-14): yesterday's journal does not exist — the read answered no row. */
export const NO_JOURNAL_YESTERDAY_WORDS = 'no journal yesterday';
/** Yesterday's journal has no plan — nothing to tick. */
export const NO_PLAN_YESTERDAY_WORDS = 'no plan yesterday';
export const LEFT_OVER_WORD = 'left over:';
/**
 * CLEAN-02 (2026-10-14): the card's YESTERDAY line from yesterday's plan ticks —
 * "all 6 steps done" · "4 of 6 steps done · left over: a · b" · "no plan
 * yesterday" · "no journal yesterday" (was the money tally and "not finished: …").
 */
export function yesterdayStepsWords(row: Answers | null): string {
  const y = yesterdaySteps(row);
  if (y.kind === 'no journal') return NO_JOURNAL_YESTERDAY_WORDS;
  if (y.kind === 'no plan') return NO_PLAN_YESTERDAY_WORDS;
  return y.leftOver.length === 0 ? `all ${y.of} steps done` : `${y.done} of ${y.of} steps done · ${LEFT_OVER_WORD} ${y.leftOver.join(' · ')}`;
}
/** "+ yesterday's open steps (2)" — the form's button that appends them to the plan box. */
export const ADD_OPEN_STEPS_WORDS = (n: number): string => `+ yesterday's open steps (${n})`;
// ── PLAN-01 (2026-10-13): THE PLAN PROMPT — YESTERDAY AND TODAY, HANDED TO CLAUDE ──

/** Yesterday as the plan prompt needs it: read (its journal, or null when the read answered no row), or why it is not. CLEAN-02: the row itself — its ticks (JOURNAL-03: its note is gone). */
export type YesterdayForPrompt =
  | { readonly ok: true; readonly row: Answers | null }
  | { readonly ok: false; readonly words: string };

export interface PlanPromptInput {
  readonly dayWords: string;
  /** Yesterday's journal as read — null when there is none. */
  readonly yesterday: Answers | null;
  /** The goals as the form's DRAFT holds them, not only what is saved. */
  readonly goals: readonly string[];
  readonly blocker: string | null;
}

export const COPY_PLAN_PROMPT_WORDS = 'copy plan prompt';
export const PLAN_PROMPT_COPIED_WORDS = 'copied — paste it into Claude';
/** The clipboard refused the write — its reason, in words; nothing else is tried. */
export const planPromptFailedWords = (reason: string): string => `could not copy the plan prompt — ${reason}`;
/** Yesterday's journal is not read (in flight, or failed) — the prompt is not offered, never written with yesterday filled in. */
export const planPromptWaitsWords = (words: string): string => `the plan prompt needs yesterday's journal — ${words}`;
export const PLAN_PROMPT_DAY = 'Day:';
export const PLAN_PROMPT_STEPS = 'Yesterday — steps:';
export const PLAN_PROMPT_LEFT_OVER = 'Yesterday — left over:';
// JOURNAL-03 (2026-10-15): PLAN_PROMPT_NOTE ('Yesterday — note:') is gone with END OF DAY.
export const PLAN_PROMPT_NO_JOURNAL = 'no journal';
export const PLAN_PROMPT_NO_PLAN = 'no plan';
export const PLAN_PROMPT_TODAY = 'Today — what I need to get done:';
export const PLAN_PROMPT_BLOCKERS = 'Blockers:';
export const PLAN_PROMPT_NONE = 'none';
export const PLAN_PROMPT_NONE_TYPED = 'none typed';
/** The ask — its limits are the plan's own (LIST_MAX), so the steps that come back fit the box. */
export const PLAN_PROMPT_ASK = `Audit the temple-stuart-accounting repo where you need to, then give me today's plan as numbered steps, one per line, plain text, at most ${LIST_MAX.plan_steps.lines} steps, each under ${LIST_MAX.plan_steps.characters} characters — each a step I can tick off (a Claude Code prompt to send is a step). After the steps, give me any Claude Code prompts the steps need.`;

const promptItems = (items: readonly string[], none: string): string[] => (items.length === 0 ? [`- ${none}`] : items.map((item) => `- ${item}`));

/** CLEAN-02 (2026-10-14): "4 of 6 done" · "all 6 done" · "no plan" · "no journal" — the prompt's steps line, from the card's own rule (yesterdaySteps). */
function promptStepsWords(y: YesterdaySteps): string {
  if (y.kind === 'no journal') return PLAN_PROMPT_NO_JOURNAL;
  if (y.kind === 'no plan') return PLAN_PROMPT_NO_PLAN;
  return y.leftOver.length === 0 ? `all ${y.of} done` : `${y.done} of ${y.of} done`;
}
/** The steps yesterday left over — none when there was no journal or no plan. */
const leftOverOf = (y: YesterdaySteps): readonly string[] => (y.kind === 'steps' ? y.leftOver : []);

/**
 * The plan prompt, exactly: every line a constant or built from one — nothing invented, nothing filled in.
 * CLEAN-02 (2026-10-14): yesterday is its steps (done of all), what was left over, and its note — the
 * "accomplished:" and "not finished:" lines are gone; everything else is unchanged.
 * JOURNAL-03 (2026-10-15): the "Yesterday — note:" line is gone with END OF DAY — yesterday is its steps
 * and what was left over; everything else is unchanged.
 */
export function planPromptText(input: PlanPromptInput): string {
  const y = yesterdaySteps(input.yesterday);
  return [
    `${PLAN_PROMPT_DAY} ${input.dayWords}`,
    `${PLAN_PROMPT_STEPS} ${promptStepsWords(y)}`,
    PLAN_PROMPT_LEFT_OVER,
    ...promptItems(leftOverOf(y), PLAN_PROMPT_NONE),
    PLAN_PROMPT_TODAY,
    ...promptItems(input.goals, PLAN_PROMPT_NONE_TYPED),
    `${PLAN_PROMPT_BLOCKERS} ${input.blocker === null ? PLAN_PROMPT_NONE_TYPED : input.blocker}`,
    '',
    PLAN_PROMPT_ASK,
  ].join('\n');
}

/** The journal stop's RECORD row says what the record is (StopForm.tsx). */
export const JOURNAL_RECORD_WORDS = 'RECORD — when you did the journal';
/** The journal read is in flight. */
export const JOURNAL_LOADING_WORDS = 'reading the journal…';
/** "nothing typed for Tue Oct 13" — the read answered, and there is no row. */
export const noJournalWords = (dayWords: string): string => `nothing typed for ${dayWords}`;
/** Yesterday's journal read is in flight. */
export const YESTERDAY_LOADING_WORDS = 'reading yesterday…';
// CLEAN-02 (2026-10-14): the journal card shows no money and no source line — JOURNAL_NOT_READ_WORDS, yesterdayFailedWords,
// typedWords, typedOnWords, NONE_TYPED_WORDS and journalProvenanceWords (the tally's failure and the source line's words) are gone.
/** The question before a clear — the audit log keeps the answers. */
export const clearJournalQuestion = (dayWords: string): string => `Clear the journal for ${dayWords}? The audit log keeps it; the card forgets it.`;
/** The route's 409: the row moved or was cleared under the writer. */
export const RACE_WORDS = (day: string): string => `the journal for ${day} was written moments ago — read the day again`;
