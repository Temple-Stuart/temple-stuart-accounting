/**
 * stay — THE STAY'S RULES, PURE (STAY-01, 2026-10-12).
 *
 * A stay is where the user is from a first day to a last day, inclusive —
 * "Chiang Mai, Oct 20 → Nov 2", "Los Angeles, Nov 3 → Feb 2". Calendar DAYS
 * ('YYYY-MM-DD'), never instants, never a zone. One user's stays never overlap
 * (the migration's trigger holds it; the routes refuse it by name first).
 *
 * Here: what the routes accept (stayInput — the one rule for a place and two
 * days), whether two spans meet (overlaps), which stay covers a day
 * (coveringStay), where a day sits in its stay (stayDay — "DAY 3 OF 14"), the
 * last day a length gives (endsOnFor — a week, a month, three months or N days),
 * and the words. No fetch, no clock, no Prisma — the tests drive every rule.
 */
import { isIsoDay } from '@/lib/budget/days';

/** A stay as the routes answer it: both days 'YYYY-MM-DD'. */
export interface StayRow {
  readonly id: string;
  readonly place: string;
  readonly starts_on: string;
  readonly ends_on: string;
}

export interface StaySpan {
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface StayValues extends StaySpan {
  readonly place: string;
}

/** A row's days as 'YYYY-MM-DD' — @db.Date is UTC midnight. */
export const stayRowOf = (row: { readonly id: string; readonly place: string; readonly starts_on: Date; readonly ends_on: Date }): StayRow => ({
  id: row.id,
  place: row.place,
  starts_on: row.starts_on.toISOString().slice(0, 10),
  ends_on: row.ends_on.toISOString().slice(0, 10),
});

/** A 'YYYY-MM-DD' day as the @db.Date value Prisma writes — UTC midnight. */
export const asDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** The fixed tag the migration's trigger raises with; the routes read it back as a 409. */
export const OVERLAP_TAG = 'STAY_OVERLAP';
export const PLACE_MAX = 80;

export type StayField = 'place' | 'starts_on' | 'ends_on';

export type StayInputResult =
  | { readonly ok: true; readonly value: StayValues }
  | { readonly ok: false; readonly field: StayField; readonly message: string };

/**
 * The one rule for what a stay is given: place a string, trimmed, 1–80
 * characters (the migration's CHECK and VARCHAR(80)); starts_on and ends_on
 * real 'YYYY-MM-DD' days; the last day on or after the first (the CHECK).
 * Refuses the first bad field by name; never fills one in.
 */
export function stayInput(body: unknown): StayInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, field: 'place', message: 'the body must be an object with place, starts_on and ends_on' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.place !== 'string') return { ok: false, field: 'place', message: 'required (a string — the place as you name it)' };
  const place = b.place.trim().replace(/\s+/g, ' ');
  if (place.length === 0) return { ok: false, field: 'place', message: 'required (a blank is no place)' };
  if (place.length > PLACE_MAX) return { ok: false, field: 'place', message: `at most ${PLACE_MAX} characters (${place.length} given)` };
  if (!isIsoDay(b.starts_on)) return { ok: false, field: 'starts_on', message: `starts_on ${JSON.stringify(b.starts_on)} is not a 'YYYY-MM-DD' day` };
  if (!isIsoDay(b.ends_on)) return { ok: false, field: 'ends_on', message: `ends_on ${JSON.stringify(b.ends_on)} is not a 'YYYY-MM-DD' day` };
  if (b.ends_on < b.starts_on) return { ok: false, field: 'ends_on', message: `ends_on ${b.ends_on} is before starts_on ${b.starts_on}` };
  return { ok: true, value: { place, startsOn: b.starts_on, endsOn: b.ends_on } };
}

/** Two spans meet when they share a day — both ends inclusive (the trigger's test). */
export const overlaps = (a: StaySpan, b: StaySpan): boolean => a.startsOn <= b.endsOn && a.endsOn >= b.startsOn;

const spanOf = (s: StayRow): StaySpan => ({ startsOn: s.starts_on, endsOn: s.ends_on });

/** The stay a day falls in, or null. One user's stays never overlap, so there is at most one. */
export function coveringStay(stays: readonly StayRow[], day: string): StayRow | null {
  const found = stays.filter((s) => s.starts_on <= day && day <= s.ends_on);
  if (found.length > 1) throw new Error(`stay: ${found.length} stays cover ${day} — the database holds one (${found.map((s) => s.id).join(', ')})`);
  return found.length === 1 ? found[0] : null;
}

/** The stays that meet `span`, other than `exceptId` (the row being edited). */
export const meeting = (stays: readonly StayRow[], span: StaySpan, exceptId: string | null = null): StayRow[] =>
  stays.filter((s) => s.id !== exceptId && overlaps(spanOf(s), span));

const DAY_MS = 86_400_000;
const utc = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);
const isoOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** How many days a span holds, both ends counted. */
export const stayLength = (span: StaySpan): number => (utc(span.endsOn) - utc(span.startsOn)) / DAY_MS + 1;

/** Where `day` sits in its stay: n (1 on the first day) of the stay's length; null when the day is outside it. */
export function stayDay(stay: StaySpan, day: string): { readonly n: number; readonly of: number } | null {
  if (day < stay.startsOn || day > stay.endsOn) return null;
  return { n: (utc(day) - utc(stay.startsOn)) / DAY_MS + 1, of: stayLength(stay) };
}

export type StayPreset = 'week' | 'month' | 'quarter' | { readonly days: number };

/**
 * The last day a length gives from a first day: a week is 7 days; a month ends
 * the day before the same date next month (Oct 20 → Nov 19), or on that month's
 * last day when it has no such date (Jan 31 → Feb 28); three months likewise
 * (Nov 3 → Feb 2); N days is N days, the first counted. N below 1 throws.
 */
export function endsOnFor(startsOn: string, preset: StayPreset): string {
  if (typeof preset === 'object') {
    if (!Number.isInteger(preset.days) || preset.days < 1) throw new Error(`stay: a stay is at least 1 day, not ${preset.days}`);
    return isoOf(utc(startsOn) + (preset.days - 1) * DAY_MS);
  }
  if (preset === 'week') return isoOf(utc(startsOn) + 6 * DAY_MS);
  const months = preset === 'month' ? 1 : 3;
  const [y, m, d] = startsOn.split('-').map(Number);
  const targetLast = Date.UTC(y, m - 1 + months + 1, 0); // day 0 of the month after = the target month's last day
  const sameDate = Date.UTC(y, m - 1 + months, d); // overflows past the target month when it has no such date
  // The day before the same date `months` on — or the target month's last day when that date does not exist there.
  return isoOf(sameDate > targetLast ? targetLast : sameDate - DAY_MS);
}

// ── WORDS ───────────────────────────────────────────────────────────────────

export const NO_STAY_WORDS = 'NO STAY';
export const stayDayWords = (n: number, of: number): string => `DAY ${n} OF ${of}`;
export const stayLengthWords = (of: number): string => (of === 1 ? '1 day' : `${of} days`);
export const overlapWords = (span: StaySpan, other: StayRow): string =>
  `${span.startsOn} to ${span.endsOn} meets the stay "${other.place}" (${other.starts_on} to ${other.ends_on})`;
