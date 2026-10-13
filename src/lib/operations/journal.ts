/**
 * journal — THE DAY'S JOURNAL, PURE (JOURNAL-01, 2026-10-13).
 *
 * The journal routine's stop (a routine whose role is 'journal', stopRole.ts)
 * shows a plate of three blocks on the day card — YESTERDAY, TODAY, PLAN — and
 * asks the questions under it. The ANSWERS a person types are one row per
 * (user, day) in operations_day_journals: the adjustment ("→ so today"), the
 * one thing, the witness, the blocker, what shipped, up to three "if … then …"
 * pairs and the obstacle's "if … → then …". The plate's NUMBERS are never
 * stored: they are derived at read time from yesterday's own reads
 * (day/dayCard.ts dayTally).
 *
 * Here: the thirteen answers and their columns' lengths, what the routes accept
 * (journalInput — the one rule, shared by the form so the screen refuses in the
 * route's own words), a row as the routes answer it (journalRowOf), whether a
 * second write changes anything (journalUnchanged), and the words. No fetch, no
 * clock, no Prisma — the tests drive every rule.
 */
import { isIsoDay } from '@/lib/budget/days';

/** Each answer's column length (VARCHAR(n) — n CHARACTERS, counted in code points, not UTF-16 units). */
export const ANSWER_MAX = {
  adjustment: 280,
  one_thing: 120,
  witness: 120,
  blocker: 280,
  shipped: 500,
  plan_1_if: 160,
  plan_1_then: 160,
  plan_2_if: 160,
  plan_2_then: 160,
  plan_3_if: 160,
  plan_3_then: 160,
  obstacle_if: 160,
  obstacle_then: 160,
} as const;

export type AnswerField = keyof typeof ANSWER_MAX;

/** The thirteen answers in the plate's order: YESTERDAY's adjustment, TODAY's four, PLAN's three pairs and the obstacle. */
export const ANSWER_FIELDS: readonly AnswerField[] = [
  'adjustment',
  'one_thing', 'witness', 'blocker', 'shipped',
  'plan_1_if', 'plan_1_then', 'plan_2_if', 'plan_2_then', 'plan_3_if', 'plan_3_then', 'obstacle_if', 'obstacle_then',
];

/** An "if" and its "then" — both or neither (the migration's pair CHECKs). */
export const PAIRS: readonly (readonly [AnswerField, AnswerField])[] = [
  ['plan_1_if', 'plan_1_then'],
  ['plan_2_if', 'plan_2_then'],
  ['plan_3_if', 'plan_3_then'],
  ['obstacle_if', 'obstacle_then'],
];

/** The nine independent answers the at-least-one CHECK counts — each "_if" stands for its pair. */
export const INDEPENDENT_FIELDS: readonly AnswerField[] = ['adjustment', 'one_thing', 'plan_1_if', 'plan_2_if', 'plan_3_if', 'obstacle_if', 'blocker', 'witness', 'shipped'];

export type Answers = Readonly<Record<AnswerField, string | null>>;

/** A journal as the routes answer it: the day 'YYYY-MM-DD', typed_at the row's updated_at as ISO text. */
export interface JournalRow extends Answers {
  readonly id: string;
  readonly day: string;
  readonly typed_at: string;
}

/** The row as Prisma reads it. */
export interface JournalDbRow extends Answers {
  readonly id: string;
  readonly day: Date;
  readonly updated_at: Date;
}

/** Every answer null — what an unanswered day reads as. */
export const NO_ANSWERS: Answers = Object.freeze(Object.fromEntries(ANSWER_FIELDS.map((f) => [f, null])) as Record<AnswerField, string | null>);

/** The answers alone, from a row or a body — built fresh from ANSWER_FIELDS, so no other key passes through. */
export const answersOf = (source: Partial<Record<AnswerField, string | null>>): Answers =>
  Object.fromEntries(ANSWER_FIELDS.map((f) => [f, source[f] ?? null])) as Record<AnswerField, string | null>;

/** A row as the routes answer it — the day as 'YYYY-MM-DD' (@db.Date is UTC midnight, the STAY-01 convention), typed_at from updated_at. */
export function journalRowOf(row: JournalDbRow): JournalRow {
  return { ...answersOf(row), id: row.id, day: row.day.toISOString().slice(0, 10), typed_at: row.updated_at.toISOString() };
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
export const notStringWords = (field: AnswerField): string => `${field} must be a string`;
export const tooLongWords = (field: AnswerField, given: number): string => `${field} is at most ${ANSWER_MAX[field]} characters (${given} given)`;
export const pairWords = (missing: AnswerField, given: AnswerField): string => `${missing} goes with ${given} — give both or neither`;

// C0 and C1 controls (stopRecord.ts's rule), and a surrogate half with no partner (not UTF-8 — the database would refuse it).
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
/** The bidirectional controls — they reverse how the plate renders what follows. */
const BIDI = /[‪-‮⁦-⁩]/;
/** Format characters and nonspacing marks — invisible on their own; stripped only to ask whether anything is left. */
const INVISIBLE = /[\p{Cf}\p{Mn}]/gu;

/**
 * The one rule for what a journal is given. The body an object; `day` a real
 * 'YYYY-MM-DD' day (isIsoDay — the one rule; a year-0000 day was probed on the
 * table: Prisma's binary date write and read both succeed, so nothing is
 * refused here that the database accepts); each answer absent, null
 * or a string — trimmed, runs of whitespace one space; no control character, no
 * lone surrogate, no bidi control (each refused by name); an answer that is
 * nothing visible once format characters and nonspacing marks are set aside is
 * unanswered (null) — a ZWJ emoji is visible and kept; at most the column's
 * length in CODE POINTS; an "if" with its "then", both or neither (the null side
 * named); and at least one answer. The answers come back built from
 * ANSWER_FIELDS alone — no key of the body passes through.
 */
export function journalInput(body: unknown): JournalInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return refuse('day', BODY_WORDS);
  const b = body as Record<string, unknown>;
  if (!isIsoDay(b.day)) return refuse('day', dayWords(b.day));
  const day = b.day;

  const answers: Record<AnswerField, string | null> = { ...NO_ANSWERS };
  for (const field of ANSWER_FIELDS) {
    const raw = b[field];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') return refuse(field, notStringWords(field));
    const v = raw.trim().replace(/\s+/g, ' ');
    if (CONTROLS.test(v) || LONE_SURROGATE.test(v)) return refuse(field, CONTROLS_WORDS);
    if (BIDI.test(v)) return refuse(field, BIDI_WORDS);
    if (v.replace(INVISIBLE, '').trim() === '') continue;
    const length = [...v].length;
    if (length > ANSWER_MAX[field]) return refuse(field, tooLongWords(field, length));
    answers[field] = v;
  }
  for (const [ifField, thenField] of PAIRS) {
    if ((answers[ifField] === null) !== (answers[thenField] === null)) {
      return answers[ifField] === null ? refuse(ifField, pairWords(ifField, thenField)) : refuse(thenField, pairWords(thenField, ifField));
    }
  }
  if (ANSWER_FIELDS.every((f) => answers[f] === null)) return refuse('adjustment', NOTHING_TYPED_WORDS);
  return { ok: true, value: { day, answers } };
}

/** Would writing `answers` over `row` change nothing? */
export const journalUnchanged = (row: Answers, answers: Answers): boolean => ANSWER_FIELDS.every((f) => row[f] === answers[f]);

// ── WORDS ───────────────────────────────────────────────────────────────────

/** The question each answer answers — the plate's label and the form's. */
export const QUESTION_WORDS = {
  adjustment: '→ so today',
  one_thing: 'one thing',
  witness: 'witness',
  blocker: 'blocker',
  shipped: 'shipped',
  plan_if: 'if',
  plan_then: 'then',
  obstacle_if: 'obstacle',
  obstacle_then: '→ then',
} as const;

export const YESTERDAY_WORD = 'YESTERDAY';
export const TODAY_BLOCK_WORD = 'TODAY';
export const PLAN_BLOCK_WORD = 'PLAN';
/** An unanswered question prints this — never a blank. */
export const UNANSWERED_WORD = '—';
export const SHIPPED_HINT_WORDS = 'shipped is typed at the end of the day';
/** The journal read is in flight. */
export const JOURNAL_LOADING_WORDS = 'reading the journal…';
/** The journal read failed — distinct from in flight. */
export const JOURNAL_NOT_READ_WORDS = 'journal not read';
/** "nothing typed for Tue Oct 13" — the read answered, and there is no row. */
export const noJournalWords = (dayWords: string): string => `nothing typed for ${dayWords}`;
/** Yesterday's journal read answered, and there is no row. */
export const NO_YESTERDAY_WORDS = 'no journal yesterday';
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

/** "one thing —" · "one thing ship the PR" — a question with its answer, '—' when unanswered. */
export const answerLine = (label: string, value: string | null): string => `${label} ${value === null ? UNANSWERED_WORD : value}`;
/** "if — then —" · "obstacle rain → then the gym" — a pair on one line. */
export const pairLine = (ifLabel: string, ifValue: string | null, thenLabel: string, thenValue: string | null): string =>
  `${answerLine(ifLabel, ifValue)} ${answerLine(thenLabel, thenValue)}`;
