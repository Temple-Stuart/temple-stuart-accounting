/**
 * journal — THE DAY'S JOURNAL, PURE (JOURNAL-01, 2026-10-13; JOURNAL-02, 2026-10-13; JOURNAL-03, 2026-10-15; JOURNAL-04, 2026-10-19).
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
 * JOURNAL-04 (Alex, 2026-10-19) — THE EVENING'S THREE ANSWERS. The journal
 * becomes two cards: MORNING — planning (the four above) and EVENING —
 * reflection: `audit` (where did we actually get to — the audit Claude writes
 * from the plan, the ticks and the day's records, pasted back; a BLOCK of
 * paragraphs, its line breaks kept), `learned` (what did I learn, or what
 * surprised me) and `next` (where do I want to take it next — the line
 * tomorrow's morning card shows first and the reel's cliffhanger, REEL-02).
 * Seven answers now, read in ANSWER_FIELDS' order; an evening alone is a
 * journal. The three columns are JOURNAL-04's migration.
 *
 * JOURNAL-05 (Alex, 2026-10-19) — THE TWO CARDS. MORNING — planning: the plate
 * as it stood, named, with last night's `next` read first in its YESTERDAY
 * block (LAST_NIGHT_WORD); its form's three questions reworded (the MORNING_*
 * questions). EVENING — reflection: a second plate under the morning form —
 * today's ticks by the morning's own counts rule (todayStepsWords), the card's
 * verdict as it says it, and the three answers as held — and its form
 * (stops/EveningForm.tsx): "copy audit prompt" (auditPromptText — built from
 * the card's own reads and words, nothing paid, nothing leaves the browser but
 * the clipboard), the pasted audit, learned, next. Both forms send the whole
 * row as held (JOURNAL-04b); the morning's clear clears both. The words are
 * all here.
 *
 * JOURNAL-06 (Alex, 2026-10-20) — THE EVENING'S SIX QUESTIONS AND THE
 * REFLECTION PROMPT. The evening card asks SEVEN, in order: ACCOMPLISHED (the
 * `audit` column — the narrative the chat writes from the reflection prompt,
 * pasted back) · GAPS · EVOLUTION · DIRECTION · ALIGNMENT · ON TRACK · NEXT.
 * Five new Text columns — gaps, evolution, direction, alignment, on_track —
 * each the audit's rule (blockOf). `learned` RETIRES, JOURNAL-03's way: its
 * column stays, it leaves ANSWER_FIELDS, joins RETIRED_FIELDS, its question and
 * box go, nothing reads it. "copy reflection prompt" replaces "copy audit
 * prompt": reflectionPromptText words a CONSTANT around the day's data (what
 * auditPromptText carried) + THE BACKLOG + WHAT MOVED TODAY + THE ANSWERS +
 * THE ASK (REFLECTION_PROMPT_ASK, verbatim, the same every day). Eleven
 * answers now; every writer sends the whole row. The five columns are
 * JOURNAL-06's migration.
 *
 * REEL-02 (Alex, 2026-10-19) — THE AUDIT PROMPT PRINTS MONEY ONLY FOR A STOP
 * THAT ASKS IT. AuditPromptStop carries `asksAmount`, set by the card from its
 * own rule (day/dayCard.ts asksAmount — this file imports nothing of the card):
 * a stop that asks an amount prints its budget and actual as before; one that
 * asks none (plan · execute · journal · all_day) prints its name and its
 * outcome in the card's own words — done, skipped, not recorded — no budget,
 * no actual.
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
 * Here: the seven answers and their limits, what the routes accept (journalInput
 * — the one rule, shared by the form so the screen refuses in the route's own
 * words), a row as the routes answer it (journalRowOf), whether a second write
 * changes anything (journalUnchanged), the plan's ticks carried across a
 * re-pasted plan (carryTicks), the steps left open (openSteps), and the words.
 * No fetch, no clock, no Prisma — the tests drive every rule.
 */
import { isIsoDay } from '@/lib/budget/days';
import { NO_OPEN_PROJECTS_WORDS, logOrder } from './morningLog';

/**
 * The text answers' limits in CHARACTERS, counted in code points (not UTF-16 units). blocker's 280 is its column's
 * length (VARCHAR(280)). JOURNAL-04 (Alex, 2026-10-19): the evening's three — learned's and next's 500 are their
 * columns' lengths (VARCHAR(500)); audit's 4000 is the rule's OWN cap on a TEXT column, which the database does not
 * bound. JOURNAL-03 (2026-10-15): shipped's 500 left with END OF DAY.
 */
// JOURNAL-06 (Alex, 2026-10-20): the evening's five — gaps, evolution, direction, alignment, on_track — each the
// audit's rule (a block of at most 4000 code points and 200 lines); learned RETIRED (JOURNAL-03's way) and left
// ANSWER_MAX with its question.
export const ANSWER_MAX = {
  blocker: 280,
  audit: 4000,
  gaps: 4000,
  evolution: 4000,
  direction: 4000,
  alignment: 4000,
  on_track: 4000,
  next: 500,
} as const;

export type TextField = keyof typeof ANSWER_MAX;

/** JOURNAL-04: the BLOCK answers — paragraphs, their line breaks kept (blockOf) — and the lines each may hold. JOURNAL-06: six blocks. */
export type BlockField = 'audit' | 'gaps' | 'evolution' | 'direction' | 'alignment' | 'on_track';
export const BLOCK_MAX_LINES = 200;

/** Each list's limits: the lines it holds (the migration's CHECKs) and each line's characters (the rule's). */
export const LIST_MAX = {
  goals: { lines: 8, characters: 160 },
  plan_steps: { lines: 12, characters: 200 },
} as const;

export type ListField = keyof typeof LIST_MAX;

/**
 * The eleven answers: the morning's four in the plate's order — TODAY's goals, BLOCKERS, PLAN's steps and their
 * ticks — then the evening's seven (JOURNAL-06, Alex, 2026-10-20) in the card's order: audit (ACCOMPLISHED — the
 * narrative), gaps, evolution, direction, alignment, on_track, next. JOURNAL-03 (2026-10-15): END OF DAY
 * (shipped) is retired; JOURNAL-06: learned is retired the same way.
 */
export const ANSWER_FIELDS = ['goals', 'blocker', 'plan_steps', 'plan_done', 'audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next'] as const;

export type AnswerField = (typeof ANSWER_FIELDS)[number];

export interface Answers {
  readonly goals: string[];
  readonly blocker: string | null;
  readonly plan_steps: string[];
  /** One tick per step, in the steps' order. */
  readonly plan_done: boolean[];
  /** JOURNAL-04: ACCOMPLISHED — the narrative pasted back from the chat (JOURNAL-06); a block, paragraphs joined with '\n'; null until typed. */
  readonly audit: string | null;
  /** JOURNAL-06: the gaps — what is missing, wrong, or not yet true; a block. */
  readonly gaps: string | null;
  /** JOURNAL-06: what changed in how we build today; a block. */
  readonly evolution: string | null;
  /** JOURNAL-06: going well, or change direction — which, and why; a block. */
  readonly direction: string | null;
  /** JOURNAL-06: anything the chat did not aligned with the vision; a block. */
  readonly alignment: string | null;
  /** JOURNAL-06: on the rails — accounting rules, SOC 2, the mission; a block. */
  readonly on_track: string | null;
  /** JOURNAL-04: where I want to take it next; null until typed. */
  readonly next: string | null;
}

/**
 * RETIRED 2026-10-13 (JOURNAL-02), 2026-10-15 (JOURNAL-03, shipped) and 2026-10-20 (JOURNAL-06, learned) — kept in
 * the table, never asked, shown or written; a body that carries one is refused by name.
 */
export const RETIRED_FIELDS = [
  'adjustment', 'one_thing', 'witness',
  'plan_1_if', 'plan_1_then', 'plan_2_if', 'plan_2_then', 'plan_3_if', 'plan_3_then', 'obstacle_if', 'obstacle_then',
  'shipped',
  'learned',
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
  audit: null, gaps: null, evolution: null, direction: null, alignment: null, on_track: null, next: null,
});

/** The answers alone, from a row — built fresh from ANSWER_FIELDS (the eleven, JOURNAL-06), the lists copied, so no other key passes through. */
export const answersOf = (source: Partial<Answers>): Answers => ({
  goals: [...(source.goals ?? [])],
  blocker: source.blocker ?? null,
  plan_steps: [...(source.plan_steps ?? [])],
  plan_done: [...(source.plan_done ?? [])],
  audit: source.audit ?? null,
  gaps: source.gaps ?? null,
  evolution: source.evolution ?? null,
  direction: source.direction ?? null,
  alignment: source.alignment ?? null,
  on_track: source.on_track ?? null,
  next: source.next ?? null,
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
/** JOURNAL-04: a block of more lines than it may hold, counted after its blank-line runs collapse. */
export const tooManyLinesWords = (field: BlockField, given: number): string => `${field} is at most ${BLOCK_MAX_LINES} lines (${given} given)`;
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
 * JOURNAL-04 (Alex, 2026-10-19): a BLOCK answer — the pasted audit, paragraphs.
 * Absent or null is unanswered; a string, split on CR, LF or CRLF; each line
 * trimmed and its runs of whitespace one space (linesOf's own rule, through
 * cleanText — so a control other than the line break, a lone surrogate or a
 * bidi control is refused by name with the text answers' own words, and the
 * check runs PER LINE, so the line break itself never trips CONTROLS); leading
 * and trailing blank lines dropped; a run of blank lines inside becomes ONE
 * empty line (a paragraph break is kept, a stack of them is one); joined with
 * '\n'. Only whitespace is blank here, as in linesOf; a line of invisible
 * characters is kept as typed, and whether anything is visible is asked over
 * every line together: nothing visible is unanswered (null). More lines than
 * BLOCK_MAX_LINES after the collapse are refused by name (tooManyLinesWords);
 * over ANSWER_MAX code points after the cleaning, by name (tooLongWords). NEVER
 * flattened to one line — a block keeps its line breaks, which textOf does not.
 */
function blockOf(field: BlockField, raw: unknown): { readonly ok: true; readonly text: string | null } | { readonly ok: false; readonly result: JournalInputResult } {
  if (raw === undefined || raw === null) return { ok: true, text: null };
  if (typeof raw !== 'string') return { ok: false, result: refuse(field, notStringWords(field)) };
  const lines: string[] = [];
  let visible = false;
  for (const line of raw.split(/\r\n|\r|\n/)) {
    const clean = cleanText(line);
    if (!clean.ok) return { ok: false, result: refuse(field, clean.words) };
    if (clean.visible) visible = true;
    // A blank line inside is one paragraph break; a run of them is one; none at the start.
    if (clean.text === '') { if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push(''); }
    else lines.push(clean.text);
  }
  if (!visible) return { ok: true, text: null };
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length > BLOCK_MAX_LINES) return { ok: false, result: refuse(field, tooManyLinesWords(field, lines.length)) };
  const text = lines.join('\n');
  const length = [...text].length;
  if (length > ANSWER_MAX[field]) return { ok: false, result: refuse(field, tooLongWords(field, length)) };
  return { ok: true, text };
}

/**
 * The one rule for what a journal is given: { day, goals?, blocker?,
 * plan_steps?, plan_done?, audit?, gaps?, evolution?, direction?, alignment?, on_track?, next? }
 * (JOURNAL-06: learned retired). The body an object; then no retired field —
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
 * (null). JOURNAL-04 (2026-10-19): then the evening's three — audit a block
 * (blockOf: its line breaks kept, at most 4000 code points and 200 lines),
 * next a text (textOf, at most 500); JOURNAL-06 (2026-10-20): the five blocks (gaps, evolution,
 * direction, alignment, on_track) each the audit's rule. At least one of the eleven
 * (JOURNAL-03: end of day no longer counts; JOURNAL-06: learned neither).
 * Checked in ANSWER_FIELDS' order — the plate's four, then the three — the
 * first bad field named. The answers come back built from the seven fields
 * alone — a retired field, or any other key, never passes.
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

  // JOURNAL-04: the evening's answers, after the morning's four. JOURNAL-06 (Alex, 2026-10-20): seven, in the
  // card's order — the narrative and the five as blocks, then next as a line; learned is refused above, retired.
  const audit = blockOf('audit', b.audit);
  if (!audit.ok) return audit.result;
  const gaps = blockOf('gaps', b.gaps);
  if (!gaps.ok) return gaps.result;
  const evolution = blockOf('evolution', b.evolution);
  if (!evolution.ok) return evolution.result;
  const direction = blockOf('direction', b.direction);
  if (!direction.ok) return direction.result;
  const alignment = blockOf('alignment', b.alignment);
  if (!alignment.ok) return alignment.result;
  const on_track = blockOf('on_track', b.on_track);
  if (!on_track.ok) return on_track.result;
  const next = textOf('next', b.next);
  if (!next.ok) return next.result;

  if (goals.lines.length === 0 && steps.lines.length === 0 && blocker.text === null && audit.text === null && gaps.text === null && evolution.text === null && direction.text === null && alignment.text === null && on_track.text === null && next.text === null) return refuse('goals', NOTHING_TYPED_WORDS);
  return { ok: true, value: { day, answers: { goals: goals.lines, blocker: blocker.text, plan_steps: steps.lines, plan_done, audit: audit.text, gaps: gaps.text, evolution: evolution.text, direction: direction.text, alignment: alignment.text, on_track: on_track.text, next: next.text } } };
}

const sameList = <T>(a: readonly T[], b: readonly T[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Would writing `answers` over `row` change nothing? The eleven answers (JOURNAL-06), the lists element by element (JOURNAL-03: shipped is not written, so not compared; JOURNAL-06: learned neither). */
export const journalUnchanged = (row: Answers, answers: Answers): boolean =>
  sameList(row.goals, answers.goals)
  && row.blocker === answers.blocker
  && sameList(row.plan_steps, answers.plan_steps)
  && sameList(row.plan_done, answers.plan_done)
  && row.audit === answers.audit
  && row.gaps === answers.gaps
  && row.evolution === answers.evolution
  && row.direction === answers.direction
  && row.alignment === answers.alignment
  && row.on_track === answers.on_track
  && row.next === answers.next;

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

/**
 * The morning form's three questions — each box is labelled with its question. JOURNAL-03 (2026-10-15): END_OF_DAY_QUESTION is gone with its box.
 * JOURNAL-05 (Alex, 2026-10-19): reworded as the MORNING's — "what must be true by tonight"; TODAY_GOALS_QUESTION, BLOCKERS_QUESTION and
 * PLAN_QUESTION went with their words (every pin moved to these; no alias was needed).
 */
export const MORNING_GOALS_QUESTION = 'What must be true by tonight? One per line.';
export const MORNING_BLOCKER_QUESTION = 'What could stop it?';
export const MORNING_PLAN_QUESTION = 'The plan — copy the plan prompt, paste the steps from chat, one per line.';
/** The examples the goals and plan boxes show until something is typed. */
export const GOALS_EXAMPLE = 'perfect the day cards\nbook travel for the rest of the trip';
export const PLAN_EXAMPLE = 'merge TABLE-01\nbook travel while CC runs\nrecord brunch and dinner\nscreenshot the card, edit, post';

/** The plate's four blocks, in order. JOURNAL-03 (2026-10-15): END_OF_DAY_BLOCK_WORD is gone with its block. */
export const YESTERDAY_WORD = 'YESTERDAY';
export const TODAY_BLOCK_WORD = 'TODAY';
export const BLOCKERS_BLOCK_WORD = 'BLOCKERS';
export const PLAN_BLOCK_WORD = 'PLAN';
// DECK-01 (Alex, 2026-10-16): UNANSWERED_WORD ('—') is gone — once something is typed, a block with no answer is left off the
// plate; nothing typed is the one line noJournalWords. Nothing prints a blank.
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
/** DECK-01 (Alex, 2026-10-16): "2 left over" — the count alone on the plate; the steps themselves are the form's "+ yesterday's open steps" and the plan prompt's. */
export const leftOverWords = (k: number): string => `${k} left over`;
/**
 * CLEAN-02 (2026-10-14): the card's YESTERDAY line from yesterday's plan ticks —
 * "all 6 steps done" · "4 of 6 steps done · left over: a · b" · "no plan
 * yesterday" · "no journal yesterday" (was the money tally and "not finished: …").
 * DECK-01 (Alex, 2026-10-16): one line of counts — "4 of 6 steps done · 2 left
 * over"; the left-over steps are no longer listed on the plate (LEFT_OVER_WORD,
 * 'left over:', is gone with the list). The form and the plan prompt keep them.
 */
export function yesterdayStepsWords(row: Answers | null): string {
  const y = yesterdaySteps(row);
  if (y.kind === 'no journal') return NO_JOURNAL_YESTERDAY_WORDS;
  if (y.kind === 'no plan') return NO_PLAN_YESTERDAY_WORDS;
  return stepsCountWords(y);
}
/** The counts line itself — "all 6 steps done" · "4 of 6 steps done · 2 left over" — one rule for the morning's YESTERDAY and the evening's TODAY'S TICKS (JOURNAL-05). */
const stepsCountWords = (y: Extract<YesterdaySteps, { kind: 'steps' }>): string =>
  (y.leftOver.length === 0 ? `all ${y.of} steps done` : `${y.done} of ${y.of} steps done · ${leftOverWords(y.leftOver.length)}`);
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

// ── JOURNAL-05 (Alex, 2026-10-19): THE TWO CARDS — MORNING (planning) · EVENING (reflection) ──

/** The two cards' labels — the first line of each plate's journal block, under the stop's bold and small words. */
export const MORNING_WORD = 'MORNING — planning';
export const EVENING_WORD = 'EVENING — reflection';
/** The morning's YESTERDAY block, ONE line above its counts, only when yesterday's row has a `next` — nothing when it has none. */
export const LAST_NIGHT_WORD = 'Last night: ';
export const lastNightWords = (next: string): string => `${LAST_NIGHT_WORD}${next}`;

/** The evening plate's blocks, in order. JOURNAL-06 (2026-10-20): the audit column is ACCOMPLISHED on the plate; LEARNED left with its column's question. */
export const TODAY_TICKS_WORD = 'TODAY’S TICKS';
export const VERDICT_WORD = 'VERDICT';
export const AUDIT_WORD = 'ACCOMPLISHED';
export const NEXT_WORD = 'NEXT';
/** The evening's own idiom for an answer not yet typed, and for a verdict the card does not show. */
export const EVENING_BLANK_WORD = '—';
/** Today's row has no plan (or no journal) — nothing to tick. */
export const NO_PLAN_TODAY_WORDS = 'no plan today';
/** The evening's TODAY'S TICKS — the morning's counts rule (yesterdaySteps, stepsCountWords) applied to TODAY's row; "no plan today" when it has none. */
export function todayStepsWords(row: Answers | null): string {
  const y = yesterdaySteps(row);
  return y.kind === 'steps' ? stepsCountWords(y) : NO_PLAN_TODAY_WORDS;
}

/**
 * THE EVENING'S QUESTIONS (JOURNAL-06, Alex, 2026-10-20) — seven, verbatim, each box labelled with its question, in
 * this order. EVENING_AUDIT_QUESTION keeps its NAME (the column is `audit`; the pins moved to the words) — the
 * words are ACCOMPLISHED's. EVENING_LEARNED_QUESTION left with learned (retired).
 */
export const EVENING_AUDIT_QUESTION = 'What got done today — the narrative. Copy the reflection prompt, paste the chat\'s narrative here.';
export const EVENING_GAPS_QUESTION = 'What gaps do you see — what is missing, wrong, or not yet true?';
export const EVENING_EVOLUTION_QUESTION = 'What changed in how we build today — a rule, a better way, something we stopped doing?';
export const EVENING_DIRECTION_QUESTION = 'Going well, or change direction? Which, and why.';
export const EVENING_ALIGNMENT_QUESTION = 'Is the chat doing anything not aligned with your vision? Name it.';
export const EVENING_ON_TRACK_QUESTION = 'On the rails — accounting rules, SOC 2, the mission? Anything that bent?';
export const EVENING_NEXT_QUESTION = 'Where do I want to take it next?';
/** The seven labels, in the card's order — the form's blocks and the prompt's THE ANSWERS section name the same facts. */
export const EVENING_LABELS = {
  audit: 'ACCOMPLISHED', gaps: 'GAPS', evolution: 'EVOLUTION', direction: 'DIRECTION', alignment: 'ALIGNMENT', on_track: 'ON TRACK', next: 'NEXT',
} as const;
export type EveningField = keyof typeof EVENING_LABELS;
export const EVENING_ORDER: readonly EveningField[] = ['audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next'];
export const EVENING_QUESTIONS: Readonly<Record<EveningField, string>> = {
  audit: EVENING_AUDIT_QUESTION, gaps: EVENING_GAPS_QUESTION, evolution: EVENING_EVOLUTION_QUESTION, direction: EVENING_DIRECTION_QUESTION,
  alignment: EVENING_ALIGNMENT_QUESTION, on_track: EVENING_ON_TRACK_QUESTION, next: EVENING_NEXT_QUESTION,
};
/** The NEXT box's placeholder — one line on the reel later (REEL-02). */
export const EVENING_NEXT_PLACEHOLDER = 'one sentence';
export const EVENING_SAVE_WORDS = 'save';
/** JOURNAL-06: "copy reflection prompt" replaces "copy audit prompt" — the same clipboard pattern, the words moved. */
export const COPY_REFLECTION_PROMPT_WORDS = 'copy reflection prompt';
export const REFLECTION_PROMPT_COPIED_WORDS = 'copied — paste it into Claude, then paste the narrative into ACCOMPLISHED';
/** The clipboard refused the write — its reason, in words; nothing else is tried. */
export const reflectionPromptFailedWords = (reason: string): string => `could not copy the reflection prompt — ${reason}`;
/** The card's reads are in flight or failed — the prompt is not offered, never written from a partial day (the gating "copy script" uses). */
export const reflectionPromptWaitsWords = (words: string): string => `the reflection prompt needs the day's reads — ${words}`;

/** The day's heads (JOURNAL-05's audit prompt, kept by JOURNAL-06's reflection prompt). */
export const AUDIT_PROMPT_DAY = 'Day:';
export const AUDIT_PROMPT_GOALS = 'Goals:';
export const AUDIT_PROMPT_BLOCKER = 'Blocker:';
export const AUDIT_PROMPT_PLAN = 'Plan — steps and ticks:';
export const AUDIT_PROMPT_STOPS = 'Stops — budget vs actual:';
export const AUDIT_PROMPT_TOTALS = 'Totals:';
export const AUDIT_PROMPT_NO_PLAN = 'no plan';
export const AUDIT_PROMPT_NO_STOPS = 'no stops';
/** JOURNAL-06 (Alex, 2026-10-20): the reflection prompt's three sections after the day's lines, and THE ASK — a CONSTANT, the same every day by construction. */
export const REFLECTION_PROMPT_BACKLOG = 'THE BACKLOG';
/** BACKLOG-02 (2026-10-20): the same words THE LOG prints (morningLog.ts) — one home. */
export const REFLECTION_PROMPT_NO_BACKLOG = NO_OPEN_PROJECTS_WORDS;
export const REFLECTION_PROMPT_MOVED = 'WHAT MOVED TODAY';
export const REFLECTION_PROMPT_NOTHING_MOVED = '— nothing recorded —';
export const REFLECTION_PROMPT_ANSWERS = 'THE ANSWERS';
export const REFLECTION_PROMPT_NOT_ANSWERED = '— not answered —';
export const REFLECTION_PROMPT_ASK = [
  'REFLECT ON THIS DAY. Same prompt every day; the data above is today\'s. Return, in this order and nothing else:',
  '1 THE NARRATIVE — what got done, against the plan: stop by stop, PR by PR (you know the PRs; the app\'s audit slice is above), what did not get done and why it is likely so; where the money went against the budget. Written to be pasted into ACCOMPLISHED.',
  '2 THE GAPS, VERIFIED — for each gap I named, is it real, what is its cause, and what closes it. Add gaps I did not name.',
  '3 DIRECTION, VERIFIED — for each change of direction I named, does it make sense against the mandates (Truth-First, Security-First, the accounting rules, SOC 2, the mission)? Yes or no, and why. Then: anything you did today that was off my vision — name it plainly.',
  '4 NEXT PROJECTS / TASKS — for the days ahead. Each NEW project as one complete block in THE BRIEF FORMAT (TITLE: · TYPE: · BOOK: · SIZE: · TARGET: · WHAT IS WRONG TODAY · WHY IT MATTERS · THE ONE CORRECT OUTCOME · ALREADY RULED · WANT A RECOMMENDATION ON · BY WHEN, AND WHY · PROOF OF DONE · LINKS · NOTES), ready to paste. For EXISTING projects (listed above), the tasks to add, by project title, one line each. Rank what should come first and say why.',
  'Be specific and short. No praise, no filler. One truth.',
].join('\n');
/** "✓ merge TABLE-01" · "✗ post the reel" — a step with its tick. */
export const auditStepWords = (step: string, done: boolean): string => `${done ? '✓' : '✗'} ${step}`;

/**
 * One stop as the card words it: its name, its vendor when known, and — REEL-02 (Alex, 2026-10-19) — by whether its form asks an amount
 * (the card's own rule, day/dayCard.ts asksAmount, decided by the card): its BUDGET cell and its ACTUAL cell (the row's own delta; "skipped"
 * and "—" as the card names a skipped and an unrecorded stop), or, when it asks none, its OUTCOME in the card's own words (done · skipped ·
 * not recorded) and no money words at all.
 */
export type AuditPromptStop =
  | { readonly name: string; readonly vendor: string | null; readonly asksAmount: true; readonly budgetWords: string; readonly actualWords: string }
  | { readonly name: string; readonly vendor: string | null; readonly asksAmount: false; readonly outcomeWords: string };
/** JOURNAL-06: one project of THE BACKLOG — the user's projects not done, as the projects GET answers them (dayReads.ts readBacklog). */
export interface ReflectionBacklogRow {
  readonly rank: number | null;
  readonly title: string;
  readonly type: string | null;
  readonly status: string;
  readonly size: string | null;
  /** 'YYYY-MM-DD' or null. */
  readonly target: string | null;
  /** Tasks not done — open, in progress, blocked, pending review. */
  readonly openTasks: number;
}
/** JOURNAL-06: one row of WHAT MOVED TODAY — the day's audit-log slice for the actor (dayReads.ts readMovedToday). */
export interface ReflectionMovedRow {
  readonly action_type: string;
  readonly description: string;
}
/** What the reflection prompt is made from — the card's OWN reads and words, handed in by DayCard.tsx; nothing else. */
export interface ReflectionPromptInput {
  readonly dayWords: string;
  /** The day's journal as held (the stored row) — null when nothing was typed. THE ANSWERS print from it. */
  readonly journal: Answers | null;
  /** Every stop of the day in the table's (clock) order. */
  readonly stops: readonly AuditPromptStop[];
  /** The TOTAL row's two figures as the card prints them ("—" when unknown). */
  readonly budgetWords: string;
  readonly actualWords: string;
  /** The card's verdict words, or null when the card shows none. */
  readonly verdictWords: string | null;
  /** THE BACKLOG — printed in rank order, unranked last, then by title. */
  readonly backlog: readonly ReflectionBacklogRow[];
  /** WHAT MOVED TODAY — the day's operations_ audit rows for the actor, oldest first as read. */
  readonly moved: readonly ReflectionMovedRow[];
}
/** The prompt as the evening form holds it: the text, or why it is not offered yet. */
export type ReflectionPromptState = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly words: string };

/** "- Brunch at Luka Café — budget $25, actual $22 ▼ $3" — one stop's line; a stop that asks no amount: "- Co-working — done" (REEL-02). */
export const auditStopWords = (s: AuditPromptStop): string =>
  `- ${s.name}${s.vendor === null ? '' : ` at ${s.vendor}`} — ${s.asksAmount ? `budget ${s.budgetWords}, actual ${s.actualWords}` : s.outcomeWords}`;
/** "budget $284, actual $277.38, ▼ $6.62 under" — the totals line; no verdict words when the card shows none. */
export const auditTotalsWords = (budgetWords: string, actualWords: string, verdictWords: string | null): string =>
  `budget ${budgetWords}, actual ${actualWords}${verdictWords === null ? '' : `, ${verdictWords}`}`;

/** "#3 · Fix the ledger CSV · engineering · backlog · M · target 2026-11-30 · open tasks 2" — one project of THE BACKLOG; "—" for a rank, type, size or target not set. */
export const backlogRowWords = (p: ReflectionBacklogRow): string =>
  `#${p.rank === null ? '—' : p.rank} · ${p.title} · ${p.type ?? '—'} · ${p.status} · ${p.size ?? '—'} · target ${p.target ?? '—'} · open tasks ${p.openTasks}`;
/** Rank order, unranked last, then by title — the same order however the rows arrive. */
/** BACKLOG-02 (2026-10-20): THE LOG's order (morningLog.ts logOrder) — one rule for the prompt and the card, generic so a log row stays a log row. */
export const backlogOrder = <T extends { readonly rank: number | null; readonly title: string }>(rows: readonly T[]): T[] => logOrder(rows);
/** The action types whose descriptions WHAT MOVED TODAY lists one by one — a project's status change, a task's (its completion is the status change to done, its own type). */
export const MOVED_DESCRIBED_TYPES: readonly string[] = ['operations_project_status_changed', 'operations_project_task_status_changed', 'operations_project_task_completed'];
/**
 * JOURNAL-06b (Alex, 2026-10-20): the audit-log read's cap — the most rows GET /api/audit-log answers, set at
 * src/app/api/audit-log/route.ts:137 (`Math.min(…, 500)`). readMovedToday asks for exactly this many (dayReads.ts), so a
 * read that comes back with this many rows may have stopped short of the day: the prompt says so under its counts.
 */
export const AUDIT_READ_LIMIT = 500;
/** Under WHAT MOVED TODAY's counts, only when the read returned exactly AUDIT_READ_LIMIT rows — the counts may be short, said, never hidden. */
export const MOVED_CAP_WORDS = `— the read stops at ${AUDIT_READ_LIMIT} rows; today has at least ${AUDIT_READ_LIMIT}, so these counts may be short —`;
/**
 * "- operations_project_created × 2" — the counts per action type, in the type's alphabetical order; then (JOURNAL-06b) MOVED_CAP_WORDS
 * when the read came back full (exactly AUDIT_READ_LIMIT rows); then each status change's description.
 */
export function movedWords(rows: readonly ReflectionMovedRow[]): string[] {
  if (rows.length === 0) return [`- ${REFLECTION_PROMPT_NOTHING_MOVED}`];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.action_type, (counts.get(r.action_type) ?? 0) + 1);
  const lines = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([type, n]) => `- ${type} × ${n}`);
  if (rows.length === AUDIT_READ_LIMIT) lines.push(MOVED_CAP_WORDS);
  for (const r of rows) if (MOVED_DESCRIBED_TYPES.includes(r.action_type)) lines.push(`- ${r.description}`);
  return lines;
}
/** "ACCOMPLISHED: …" — one answer as typed, or "— not answered —"; a block's lines follow its label. */
export const answerWords = (field: EveningField, text: string | null): string => `${EVENING_LABELS[field]}: ${text === null ? REFLECTION_PROMPT_NOT_ANSWERED : text}`;

/**
 * The reflection prompt (JOURNAL-06, Alex, 2026-10-20), exactly: every line a constant or built from one — the day's lines as the audit
 * prompt had them (the day, the goals or none typed, the blocker or none, the plan's steps with their ticks or no plan, the stops in
 * clock order with budget and actual or (REEL-02) the outcome alone, the totals with the verdict), then THE BACKLOG (one line per project
 * not done, rank order, unranked last; "— no open projects —"), then WHAT MOVED TODAY (the counts per action type, then — JOURNAL-06b —
 * the cap line when the read came back full, then each project or task status change's description; "— nothing recorded —"), then THE ANSWERS (the six after ACCOMPLISHED, as typed or "— not answered
 * —"), then THE ASK — the same words every day. Pure; from the card's own reads and words, nothing invented, nothing filled in.
 */
export function reflectionPromptText(input: ReflectionPromptInput): string {
  const j = input.journal;
  const steps = j === null ? [] : j.plan_steps;
  const answered = (field: EveningField): string | null => (j === null ? null : j[field]);
  return [
    `${AUDIT_PROMPT_DAY} ${input.dayWords}`,
    AUDIT_PROMPT_GOALS,
    ...promptItems(j === null ? [] : j.goals, PLAN_PROMPT_NONE_TYPED),
    `${AUDIT_PROMPT_BLOCKER} ${j === null || j.blocker === null ? PLAN_PROMPT_NONE : j.blocker}`,
    AUDIT_PROMPT_PLAN,
    ...(steps.length === 0 ? [`- ${AUDIT_PROMPT_NO_PLAN}`] : steps.map((step, i) => `- ${auditStepWords(step, (j as Answers).plan_done[i])}`)),
    AUDIT_PROMPT_STOPS,
    ...(input.stops.length === 0 ? [`- ${AUDIT_PROMPT_NO_STOPS}`] : input.stops.map(auditStopWords)),
    `${AUDIT_PROMPT_TOTALS} ${auditTotalsWords(input.budgetWords, input.actualWords, input.verdictWords)}`,
    '',
    REFLECTION_PROMPT_BACKLOG,
    ...(input.backlog.length === 0 ? [`- ${REFLECTION_PROMPT_NO_BACKLOG}`] : backlogOrder(input.backlog).map((p) => `- ${backlogRowWords(p)}`)),
    '',
    REFLECTION_PROMPT_MOVED,
    ...movedWords(input.moved),
    '',
    REFLECTION_PROMPT_ANSWERS,
    ...EVENING_ORDER.filter((f) => f !== 'audit').map((f) => answerWords(f, answered(f))),
    '',
    REFLECTION_PROMPT_ASK,
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
/** The question before a clear — the audit log keeps the answers. JOURNAL-05 (Alex, 2026-10-19): the whole row goes — the morning's four and the evening's answers — and the question says so. */
export const clearJournalQuestion = (dayWords: string): string => `Clear the whole journal for ${dayWords} — morning and evening? The audit log keeps it; the card forgets it.`;
/** The route's 409: the row moved or was cleared under the writer. */
export const RACE_WORDS = (day: string): string => `the journal for ${day} was written moments ago — read the day again`;
