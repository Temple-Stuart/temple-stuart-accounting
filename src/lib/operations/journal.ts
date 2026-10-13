/**
 * journal — THE DAY'S JOURNAL, PURE (JOURNAL-01, 2026-10-13; JOURNAL-02, 2026-10-13).
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
 * RETIRED 2026-10-13 (JOURNAL-02): adjustment, one_thing, witness, plan_1_if …
 * plan_3_then, obstacle_if, obstacle_then. Not asked, not shown, never read
 * from a body and never written. KEPT in the table with the words typed before
 * (the migration drops no column); a row carries them in `retired` so the audit
 * log's before and after keep them — the screen never reads `retired`.
 *
 * Here: the five answers and their limits, what the routes accept (journalInput
 * — the one rule, shared by the form so the screen refuses in the route's own
 * words), a row as the routes answer it (journalRowOf), whether a second write
 * changes anything (journalUnchanged), the plan's ticks carried across a
 * re-pasted plan (carryTicks), the steps left open (openSteps), and the words.
 * No fetch, no clock, no Prisma — the tests drive every rule.
 */
import { isIsoDay } from '@/lib/budget/days';

/** The two text answers' column lengths (VARCHAR(n) — n CHARACTERS, counted in code points, not UTF-16 units). */
export const ANSWER_MAX = {
  blocker: 280,
  shipped: 500,
} as const;

export type TextField = keyof typeof ANSWER_MAX;

/** Each list's limits: the lines it holds (the migration's CHECKs) and each line's characters (the rule's). */
export const LIST_MAX = {
  goals: { lines: 8, characters: 160 },
  plan_steps: { lines: 12, characters: 200 },
} as const;

export type ListField = keyof typeof LIST_MAX;

/** The five answers in the plate's order: TODAY's goals, BLOCKERS, PLAN's steps and their ticks, END OF DAY. */
export const ANSWER_FIELDS = ['goals', 'blocker', 'plan_steps', 'plan_done', 'shipped'] as const;

export type AnswerField = (typeof ANSWER_FIELDS)[number];

export interface Answers {
  readonly goals: string[];
  readonly blocker: string | null;
  readonly plan_steps: string[];
  /** One tick per step, in the steps' order. */
  readonly plan_done: boolean[];
  readonly shipped: string | null;
}

/** RETIRED 2026-10-13 (JOURNAL-02) — kept in the table, never asked, shown or written. */
export const RETIRED_FIELDS = [
  'adjustment', 'one_thing', 'witness',
  'plan_1_if', 'plan_1_then', 'plan_2_if', 'plan_2_then', 'plan_3_if', 'plan_3_then', 'obstacle_if', 'obstacle_then',
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
  goals: Object.freeze([]) as unknown as string[], blocker: null, plan_steps: Object.freeze([]) as unknown as string[], plan_done: Object.freeze([]) as unknown as boolean[], shipped: null,
});

/** The answers alone, from a row — built fresh from ANSWER_FIELDS, the lists copied, so no other key passes through. */
export const answersOf = (source: Partial<Answers>): Answers => ({
  goals: [...(source.goals ?? [])],
  blocker: source.blocker ?? null,
  plan_steps: [...(source.plan_steps ?? [])],
  plan_done: [...(source.plan_done ?? [])],
  shipped: source.shipped ?? null,
});

const retiredOf = (row: Retired): Retired => Object.fromEntries(RETIRED_FIELDS.map((f) => [f, row[f] ?? null])) as Record<RetiredField, string | null>;

/** A row as the routes answer it — the day as 'YYYY-MM-DD' (@db.Date is UTC midnight, the STAY-01 convention), typed_at from updated_at. */
export function journalRowOf(row: JournalDbRow): JournalRow {
  return { ...answersOf(row), retired: retiredOf(row), id: row.id, day: row.day.toISOString().slice(0, 10), typed_at: row.updated_at.toISOString() };
}

/** A 'YYYY-MM-DD' day as the @db.Date value Prisma writes — UTC midnight (src/lib/operations/stay.ts asDate, the one convention). */
export const asJournalDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

// ── THE INPUT RULE ──────────────────────────────────────────────────────────

export type JournalField = 'day' | AnswerField;

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
 * plan_steps?, plan_done?, shipped? }. The body an object; `day` a real
 * 'YYYY-MM-DD' day (isIsoDay — the one rule). Absent lists are empty, absent
 * texts null. Every string through the JOURNAL-01 rules (cleanText): trimmed,
 * runs of whitespace one space; no control character, no lone surrogate, no
 * bidi control (each refused by name). A goal or a step is a line: at most 8
 * goals of 160 characters and 12 steps of 200, counted in CODE POINTS; a blank
 * line is refused by name (the form drops blank lines before sending — the rule
 * never drops one silently). plan_done is one true or false per step, refused
 * by name when it is not. A text answer that is nothing visible is unanswered
 * (null). At least one goal, step, blocker or end of day. Checked in the
 * plate's order, the first bad field named. The answers come back built from
 * the five fields alone — a retired field, or any other key, never passes.
 */
export function journalInput(body: unknown): JournalInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return refuse('day', BODY_WORDS);
  const b = body as Record<string, unknown>;
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

  const shipped = textOf('shipped', b.shipped);
  if (!shipped.ok) return shipped.result;

  if (goals.lines.length === 0 && steps.lines.length === 0 && blocker.text === null && shipped.text === null) return refuse('goals', NOTHING_TYPED_WORDS);
  return { ok: true, value: { day, answers: { goals: goals.lines, blocker: blocker.text, plan_steps: steps.lines, plan_done, shipped: shipped.text } } };
}

const sameList = <T>(a: readonly T[], b: readonly T[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Would writing `answers` over `row` change nothing? The five answers, the lists element by element. */
export const journalUnchanged = (row: Answers, answers: Answers): boolean =>
  sameList(row.goals, answers.goals)
  && row.blocker === answers.blocker
  && sameList(row.plan_steps, answers.plan_steps)
  && sameList(row.plan_done, answers.plan_done)
  && row.shipped === answers.shipped;

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

// ── WORDS ───────────────────────────────────────────────────────────────────

/** The form's four questions — each box is labelled with its question. */
export const TODAY_GOALS_QUESTION = 'What are you getting done today? One per line.';
export const BLOCKERS_QUESTION = 'What could stop it?';
export const PLAN_QUESTION = 'The plan — paste the steps from chat, one per line.';
export const END_OF_DAY_QUESTION = 'End of day — what got done? (type tonight)';
/** The examples the goals and plan boxes show until something is typed. */
export const GOALS_EXAMPLE = 'perfect the day cards\nbook travel for the rest of the trip';
export const PLAN_EXAMPLE = 'merge TABLE-01\nbook travel while CC runs\nrecord brunch and dinner\nscreenshot the card, edit, post';

/** The plate's five blocks, in order. */
export const YESTERDAY_WORD = 'YESTERDAY';
export const TODAY_BLOCK_WORD = 'TODAY';
export const BLOCKERS_BLOCK_WORD = 'BLOCKERS';
export const PLAN_BLOCK_WORD = 'PLAN';
export const END_OF_DAY_BLOCK_WORD = 'END OF DAY';
/** An unanswered question prints this — never a blank. */
export const UNANSWERED_WORD = '—';
/** "• perfect the day cards" — a goal on the plate. */
export const goalWords = (goal: string): string => `• ${goal}`;
/** "☐ 1. merge TABLE-01" · "✓ 1. merge TABLE-01" — a step and its tick. */
export const planStepWords = (index: number, step: string, done: boolean): string => `${done ? '✓' : '☐'} ${index}. ${step}`;
/** "2 of 5 done" — under the plan. */
export const planDoneWords = (done: number, of: number): string => `${done} of ${of} done`;
/** "left open: book travel · record brunch" — yesterday's steps not ticked. */
export const leftOpenWords = (steps: readonly string[]): string => `left open: ${steps.join(' · ')}`;
/** "+ yesterday's open steps (2)" — the form's button that appends them to the plan box. */
export const ADD_OPEN_STEPS_WORDS = (n: number): string => `+ yesterday's open steps (${n})`;
/** The journal stop's RECORD row says what the record is (StopForm.tsx). */
export const JOURNAL_RECORD_WORDS = 'RECORD — when you did the journal';
/** The journal read is in flight. */
export const JOURNAL_LOADING_WORDS = 'reading the journal…';
/** The journal read failed — distinct from in flight. */
export const JOURNAL_NOT_READ_WORDS = 'journal not read';
/** "nothing typed for Tue Oct 13" — the read answered, and there is no row. */
export const noJournalWords = (dayWords: string): string => `nothing typed for ${dayWords}`;
/** Yesterday's five reads are in flight. */
export const YESTERDAY_LOADING_WORDS = 'reading yesterday…';
/** The build of yesterday's tally threw — said on the plate, never a plate stuck on "reading yesterday…". */
export const yesterdayFailedWords = (message: string): string => `yesterday could not be tallied — ${message}`;
/** "typed 06:40" — the typed instant's clock on the card's day. */
export const typedWords = (time: string): string => `typed ${time}`;
/** "typed Oct 12 06:40" — the typed instant fell on another day than the card's (the day words: dayCard.ts monthDayWords). */
export const typedOnWords = (dayWords: string, time: string): string => `typed ${dayWords} ${time}`;
export const NONE_TYPED_WORDS = 'none typed';
/**
 * The plate's source line: the numbers' sources, and the words' state — when
 * they were typed (typedWords / typedOnWords), NONE_TYPED_WORDS when the read
 * answered no row, JOURNAL_LOADING_WORDS while it is in flight, and
 * JOURNAL_NOT_READ_WORDS when it failed — never "none typed" for an unknown.
 */
export const journalProvenanceWords = (words: string): string => `numbers: the Budget · stop records · words: ${words}`;
/** The question before a clear — the audit log keeps the answers. */
export const clearJournalQuestion = (dayWords: string): string => `Clear the journal for ${dayWords}? The audit log keeps it; the card forgets it.`;
/** The route's 409: the row moved or was cleared under the writer. */
export const RACE_WORDS = (day: string): string => `the journal for ${day} was written moments ago — read the day again`;
