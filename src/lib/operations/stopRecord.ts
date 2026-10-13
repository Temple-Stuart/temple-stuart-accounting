/**
 * stopRecord — THE RECORD AT A STOP, PURE (STOP-01, 2026-10-12).
 *
 * A stop is one line of a routine at one occurrence, or a routine with no
 * lines at one occurrence — the day card's row. Its record is what happened
 * there: done at an instant (or skipped, with the reason), what was actually
 * paid (USD cents, typed on the day — the Books post days later and never for
 * cash), a rating 1–5 against a fixed rubric, a note, the minutes. A task has
 * no record here: its own row holds its actual (operations_project_tasks
 * actual_cost_usd, actual_minutes, completed_at) — one fact, one home.
 *
 * Here: what the route accepts (stopInput — the one rule), a row as the routes
 * answer it (stopRecordRowOf), the address as its columns (planOf), whether a
 * second write changes anything (unchanged), and the words. No fetch, no clock,
 * no Prisma — the tests drive every rule.
 */

export const STOP_KINDS = ['routine_line', 'routine'] as const;
/** The Budget's own words for the two addresses a record can have (days.ts OccurrenceKind, less project_task). */
export type StopRecordKind = (typeof STOP_KINDS)[number];

export const STOP_OUTCOMES = ['done', 'skipped'] as const;
export type StopOutcome = (typeof STOP_OUTCOMES)[number];

/** The note column (VARCHAR(280)). */
export const NOTE_MAX = 280;
/** A stop's minutes fit in a day (the migration's CHECK). */
export const MINUTES_MAX = 1440;
/** The actual_cents column is an INTEGER. */
export const CENTS_MAX = 2_147_483_647;

/** A record as the routes answer it — instants as ISO text. */
export interface StopRecordRow {
  readonly id: string;
  readonly kind: StopRecordKind;
  /** The step's id for a routine_line, the routine's for a routine. */
  readonly target_id: string;
  readonly occurrence_at: string;
  readonly outcome: StopOutcome;
  readonly done_at: string | null;
  readonly actual_cents: number | null;
  readonly rating: number | null;
  readonly note: string | null;
  readonly actual_minutes: number | null;
}

export interface StopRecordDbRow {
  readonly id: string;
  readonly routine_id: string | null;
  readonly step_id: string | null;
  readonly occurrence_at: Date;
  readonly outcome: string;
  readonly done_at: Date | null;
  readonly actual_cents: number | null;
  readonly rating: number | null;
  readonly note: string | null;
  readonly actual_minutes: number | null;
}

const isOutcome = (v: unknown): v is StopOutcome => (STOP_OUTCOMES as readonly unknown[]).includes(v);
const isKind = (v: unknown): v is StopRecordKind => (STOP_KINDS as readonly unknown[]).includes(v);

/** A row as the routes answer it. A row that breaks the migration's CHECKs is the database's error, never read as something else. */
export function stopRecordRowOf(row: StopRecordDbRow): StopRecordRow {
  if ((row.routine_id === null) === (row.step_id === null)) throw new Error(`stopRecord: row ${row.id} names ${row.routine_id === null ? 'no plan' : 'two plans'} — the migration's CHECK holds exactly one`);
  if (!isOutcome(row.outcome)) throw new Error(`stopRecord: row ${row.id} has outcome ${JSON.stringify(row.outcome)} — not done or skipped`);
  return {
    id: row.id,
    kind: row.step_id !== null ? 'routine_line' : 'routine',
    target_id: row.step_id !== null ? row.step_id : (row.routine_id as string),
    occurrence_at: row.occurrence_at.toISOString(),
    outcome: row.outcome,
    done_at: row.done_at === null ? null : row.done_at.toISOString(),
    actual_cents: row.actual_cents,
    rating: row.rating,
    note: row.note,
    actual_minutes: row.actual_minutes,
  };
}

/** The address as its two plan columns. */
export const planOf = (kind: StopRecordKind, id: string): { readonly routine_id: string | null; readonly step_id: string | null } =>
  (kind === 'routine_line' ? { routine_id: null, step_id: id } : { routine_id: id, step_id: null });

/** The card's key for a record — the same words the day card gives its stops (dayCard.ts: `line:<step>:<instant>` · `routine:<routine>:<instant>`). */
export const recordKey = (r: Pick<StopRecordRow, 'kind' | 'target_id' | 'occurrence_at'>): string =>
  `${r.kind === 'routine_line' ? 'line' : 'routine'}:${r.target_id}:${r.occurrence_at}`;

const HOUR_MS = 3_600_000;
/**
 * The instants that can fall on a local day D in ANY zone: zones run from
 * UTC−12 to UTC+14, so D begins no earlier than D−1 10:00Z (UTC+14) and ends no
 * later than D+1 12:00Z (UTC−12). A pre-filter for the GET; the route then
 * places each record by its own routine's zone (instantToZoned), exactly.
 */
export function recordWindow(day: string): { readonly gte: Date; readonly lt: Date } {
  const midnight = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(midnight)) throw new Error(`stopRecord: ${JSON.stringify(day)} is not a day`);
  return { gte: new Date(midnight - 14 * HOUR_MS), lt: new Date(midnight + 36 * HOUR_MS) };
}

// ── THE INPUT RULE ──────────────────────────────────────────────────────────

export interface StopRecordValues {
  readonly kind: StopRecordKind;
  readonly id: string;
  readonly instant: Date;
  readonly outcome: StopOutcome;
  readonly doneAt: Date | null;
  readonly actualCents: number | null;
  readonly rating: number | null;
  readonly note: string | null;
  readonly actualMinutes: number | null;
}

export type StopField = 'kind' | 'id' | 'instant' | 'outcome' | 'done_at' | 'actual_cents' | 'rating' | 'note' | 'actual_minutes';

export type StopInputResult =
  | { readonly ok: true; readonly value: StopRecordValues }
  | { readonly ok: false; readonly field: StopField; readonly message: string };

const refuse = (field: StopField, message: string): StopInputResult => ({ ok: false, field, message });

/**
 * An ISO 8601 instant with its offset stated — 'YYYY-MM-DDTHH:MM[:SS[.sss]]Z'
 * or '±HH:MM' — a four-digit year, and a real date (the round trip through the
 * Date must land on the same calendar fields). Date.parse alone would read a
 * zone-less 'YYYY-MM-DDTHH:MM' in the PROCESS's zone and accept 'Oct 11 2026'
 * and six-digit years; none of those is an instant the card wrote.
 */
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;
export function instantOf(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const m = INSTANT_RE.exec(raw);
  if (m === null || m[1] === '0000') return null; // there is no year 0 (Postgres refuses it)
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  // The calendar fields as written must survive the round trip (Feb 30 would roll to Mar 2; 25:00 is refused by Date.parse already).
  const offsetMin = m[8] === 'Z' ? 0 : (m[8].startsWith('-') ? -1 : 1) * (Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(4, 6)));
  const local = new Date(ms + offsetMin * 60_000);
  if (local.getUTCFullYear() !== Number(m[1]) || local.getUTCMonth() + 1 !== Number(m[2]) || local.getUTCDate() !== Number(m[3]) || local.getUTCHours() !== Number(m[4]) || local.getUTCMinutes() !== Number(m[5])) return null;
  return d;
}

/** A done-at may run ahead of the server's clock by this much (the browser's clock is the user's) — never further into the future. */
export const DONE_AT_SKEW_MS = 10 * 60_000;

/** absent and null both mean "not given". */
const given = (raw: unknown): boolean => raw !== undefined && raw !== null;

/**
 * The one rule for what a record is given. kind one of the two; id a string
 * (the route answers 404 for one that is no UUID or not the caller's); instant
 * an ISO instant; outcome done or skipped; done_at an instant when done and
 * absent when skipped; actual_cents a whole number 0 or more, or absent (never
 * 0 for "not typed"); rating 1–5 or absent; note one line, trimmed, spaces
 * collapsed, 1–280 characters, no control characters, or absent — and REQUIRED
 * when skipped; actual_minutes 0–1440 or absent. The first bad field is named;
 * nothing is filled in.
 */
export function stopInput(body: unknown, now: Date): StopInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return refuse('kind', 'the body must be an object with kind, id, instant and outcome');
  }
  const b = body as Record<string, unknown>;
  if (!isKind(b.kind)) return refuse('kind', `kind must be one of ${STOP_KINDS.join(', ')}`);
  if (typeof b.id !== 'string' || b.id === '') return refuse('id', "required (the line's id for a routine_line, the routine's for a routine)");
  const instant = instantOf(b.instant);
  if (instant === null) return refuse('instant', `instant ${JSON.stringify(b.instant)} is not an ISO instant`);
  if (!isOutcome(b.outcome)) return refuse('outcome', `outcome must be one of ${STOP_OUTCOMES.join(', ')}`);

  let doneAt: Date | null = null;
  if (b.outcome === 'done') {
    doneAt = instantOf(b.done_at);
    if (doneAt === null) return refuse('done_at', `done_at ${JSON.stringify(b.done_at)} is not an ISO instant — a done stop says when`);
    if (doneAt.getTime() > now.getTime() + DONE_AT_SKEW_MS) return refuse('done_at', `done_at ${doneAt.toISOString()} is in the future`);
  } else if (given(b.done_at)) {
    return refuse('done_at', 'a skipped stop has no done_at');
  }

  let actualCents: number | null = null;
  if (given(b.actual_cents)) {
    const c = b.actual_cents;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) return refuse('actual_cents', `actual_cents ${JSON.stringify(c)} is not a whole number of cents, 0 or more`);
    if (c > CENTS_MAX) return refuse('actual_cents', `actual_cents ${c} is past the column's range (${CENTS_MAX})`);
    actualCents = c;
  }

  let rating: number | null = null;
  if (given(b.rating)) {
    const r = b.rating;
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 1 || r > 5) return refuse('rating', `rating ${JSON.stringify(r)} is not 1 to 5`);
    rating = r;
  }

  let note: string | null = null;
  if (given(b.note)) {
    if (typeof b.note !== 'string') return refuse('note', 'note must be a string');
    const n = b.note.trim().replace(/\s+/g, ' ');
    // C0 and C1 controls, and a surrogate half with no partner (not UTF-8 — the database would refuse it).
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f-\u009f]/.test(n) || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(n)) return refuse('note', 'control characters are not a note');
    if (n.length > NOTE_MAX) return refuse('note', `note is at most ${NOTE_MAX} characters (${n.length} given)`);
    note = n === '' ? null : n;
  }
  if (b.outcome === 'skipped' && note === null) return refuse('note', SKIP_REASON_WORDS);

  let actualMinutes: number | null = null;
  if (given(b.actual_minutes)) {
    const m = b.actual_minutes;
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 0 || m > MINUTES_MAX) return refuse('actual_minutes', `actual_minutes ${JSON.stringify(m)} is not 0 to ${MINUTES_MAX}`);
    actualMinutes = m;
  }

  return { ok: true, value: { kind: b.kind, id: b.id, instant, outcome: b.outcome, doneAt, actualCents, rating, note, actualMinutes } };
}

/** Would writing `v` over `row` change nothing? (The instant and the plan are the row's address — the same by construction.) */
export const unchanged = (row: StopRecordRow, v: StopRecordValues): boolean =>
  row.outcome === v.outcome
  && row.done_at === (v.doneAt === null ? null : v.doneAt.toISOString())
  && row.actual_cents === v.actualCents
  && row.rating === v.rating
  && row.note === v.note
  && row.actual_minutes === v.actualMinutes;

// ── WORDS ───────────────────────────────────────────────────────────────────

/**
 * The rubric — pinned, so a 4 on day 9 means what it meant on day 3. Alex asked
 * for stars ("how many star rating?"); a star with no criterion is noise to the
 * analyst reading it, so each star is a sentence.
 */
export const RATING_WORDS: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  5: 'would plan it again at this price',
  4: 'again, but cheaper exists',
  3: 'fine',
  2: 'not again',
  1: 'should not have paid',
};

/** '★★★★☆' — a rating outside 1–5 is the database's error, never drawn. */
export function starsWords(rating: number): string {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`stopRecord: a rating is 1 to 5, not ${rating}`);
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

/** "★★★★☆ · again, but cheaper exists" */
export const ratingWords = (rating: number): string => `${starsWords(rating)} · ${RATING_WORDS[rating as 1 | 2 | 3 | 4 | 5]}`;

export const DONE_WORD = 'done';
export const SKIPPED_WORD = 'skipped';
export const OPEN_WORD = 'open';
export const LATER_WORD = 'later';
/** The precedence label: a line with no record of its own carries its routine's completion — said so, never passed off as the line's. */
export const ROUTINE_DONE_WORDS = 'routine marked done';
export const ROUTINE_MISSED_WORDS = 'routine missed';
export const TASK_DONE_WORDS = 'task done';
export const TASK_OPEN_WORDS = 'task open';
export const NOT_RECORDED_WORDS = 'not recorded';

/** "done 12:41" */
export const doneWords = (time: string): string => `${DONE_WORD} ${time}`;
/** "skipped — closed" */
export const skippedWords = (note: string): string => `${SKIPPED_WORD} — ${note}`;
/** "11 min late" · "8 min early" · "on time" */
export const lateWords = (minutes: number): string => (minutes === 0 ? 'on time' : minutes > 0 ? `${minutes} min late` : `${-minutes} min early`);
/** "30 min" */
export const minutesWords = (minutes: number): string => `${minutes} min`;

/** The route's refusals, by name. */
export const LINES_WORDS = 'the routine has lines — record each line, not the routine';
export const ARCHIVED_LINE_WORDS = 'the line is archived — it has no stop';
export const INACTIVE_ROUTINE_WORDS = 'the routine is inactive — it has no stop';
export const SKIP_REASON_WORDS = 'a skipped stop needs its reason (note)';
export const BODY_NOT_JSON_WORDS = 'the body is not JSON';
export const RACE_WORDS = (instant: string): string => `a record at ${instant} was written moments ago — read the day again`;
export const noStopWords = (instant: string, day: string, thatDays: string | null): string =>
  (thatDays === null ? `no stop at ${instant} — the routine has no stop on ${day}` : `no stop at ${instant} — on ${day} the routine's stop is at ${thatDays}`);
export const refusedWords = (reason: string, detail: string): string => `the routine's day cannot be read — ${reason}: ${detail}`;

/** The question before a clear (`what`: the record's status words) — the audit log keeps the record. */
export const clearStopQuestion = (what: string): string => `Clear this stop's record (${what})? The audit log keeps it; the card forgets it.`;
/** The form's own refusals, before any request. */
export const WHEN_WORDS = 'say when it was done (HH:MM)';
/**
 * PLAN-01 (2026-10-13): the record's time box says the zone it reads a typed
 * time in — "HH:MM" when the routine's zone is the browser's, "HH:MM
 * (America/Los_Angeles)" when it is not — so a time typed in Chiang Mai is never
 * silently read in a routine's other zone. The rule that reads it is unchanged.
 */
export const TIME_BOX_WORDS = 'HH:MM';
export const timeBoxWords = (routineZone: string, viewerZone: string): string => (routineZone === viewerZone ? TIME_BOX_WORDS : `${TIME_BOX_WORDS} (${routineZone})`);
export const amountWords = (typed: string): string => `${JSON.stringify(typed)} is not an amount (dollars, at most two decimals)`;
export const NEGATIVE_AMOUNT_WORDS = 'an amount is 0 or more';
export const minutesTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not a number of minutes`;
