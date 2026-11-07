/**
 * SUPERSEDE-01a (Alex, 2026-11-07, SUPERSEDE-00 ruling 2) — THE ONE SUPERSESSION RULE AND THE ONE PLANNED-MINUTES RULE,
 * IN ONE LEAF. Moved VERBATIM from src/components/workbench/operations/day/dayCard.ts (TRAVEL-01c rulings A–F — a routine
 * occurrence that shares a minute with a travel block is superseded by the earliest such block; WORK-03b — a stop's
 * planned minutes: a line's duration_minutes, a stepless routine's window length; TRAVEL-01b ruling D — a travel stop's
 * stated duration, else its same-day clock difference): "SUPERSEDE-01a (Alex, 2026-11-07, SUPERSEDE-00 ruling 2): moved
 * from dayCard.ts so that Budget (01b) reads the same rule the card reads — one rule, one owner". The card applies it
 * (dayStops' occurrences and marks, its stops' minutes), the ledger answer applies it for a record's plan, and Budget
 * (01b) will read it for its lines — every reader imports from here; the card re-exports nothing.
 *
 * A leaf: its only import is the calendar's minutesOf (a module with no imports). Pure — no clock, no zone, no fetch;
 * instants compare as instants. The only text that differs from the card's: the four thrown messages are prefixed
 * `supersession:` (were `dayCard:`), cannotSupersedeWords takes the two instants it reads as a structural type (was
 * Pick<TravelStop, …> — TravelStop stays in the card), and clockOf is exported (the card reads it). The planned-minutes
 * rule holds one boolean `||` (a null check, never a default), outside the supersession section's purity slice, as today.
 */
import { minutesOf } from '@/lib/calendar/day';

/** A planned row's kind by its category (other → 'other'); a booking's check-in or check-out; a segment is a flight. */
export type TravelKind = 'flight' | 'transfer' | 'activity' | 'lodging' | 'other' | 'check-in' | 'check-out';

/** TRAVEL-01c (ruling A): a travel stop with both instants — what can supersede. */
export interface TravelBlock {
  readonly key: string;
  readonly kind: TravelKind;
  readonly name: string;
  /** The block's stated clock (the stop's time); null when it stated none. */
  readonly time: string | null;
  readonly startAt: string;
  readonly endAt: string;
}

/** TRAVEL-01c (ruling C): the earliest block that supersedes a stop, and how many other blocks overlap it too. */
export interface Supersession {
  readonly by: TravelBlock;
  readonly more: number;
}

/** 'HH:MM' of a @db.Time value ('1970-01-01THH:MM:SS.000Z'), as the week's clockOf. */
export const clockOf = (time: string): string => time.slice(11, 16);

/** What the planned-minutes rule reads: a line (its duration_minutes) or a stepless routine (its window — @db.Time values: a Date on the server, its JSON '1970-01-01THH:MM:SS.000Z' on the card). */
export type PlannedMinutesPlan =
  | { readonly kind: 'line'; readonly duration_minutes: number | null }
  | { readonly kind: 'routine'; readonly start_time: Date | string | null; readonly end_time: Date | string | null }
  /** TRAVEL-01b: a travel stop — its stated duration, else its stated start and end clocks ('HH:MM', the leaf's) when the end is stated on the same day. */
  | { readonly kind: 'travel'; readonly duration_minutes: number | null; readonly start: string | null; readonly end: string | null; readonly endSameDay: boolean };
/** Minutes past midnight of a routine's @db.Time; null for none; a value that is no time is the read's error, thrown by name. */
const windowMinutesOf = (what: 'start_time' | 'end_time', v: Date | string | null): number | null => {
  if (v === null) return null;
  const m = minutesOf(clockOf(v instanceof Date ? v.toISOString() : v));
  if (m === null) throw new Error(`supersession: ${what} ${JSON.stringify(v)} is not a time — a @db.Time arrives as 1970-01-01THH:MM:SS.000Z`);
  return m;
};
/** TRAVEL-01b: minutes past midnight of a stated 'HH:MM' clock (the travel leaf's); a value that is no clock is the read's error, thrown by name. */
const clockMinutesOf = (what: 'start' | 'end', clock: string): number => {
  const m = minutesOf(clock);
  if (m === null) throw new Error(`supersession: a travel ${what} ${JSON.stringify(clock)} is not a clock — the travel read hands HH:MM`);
  return m;
};
/**
 * WORK-03b (Alex, 2026-10-26): THE ONE PLANNED-MINUTES RULE — the stop's `minutes`: what the work block's length is drawn
 * from (workBlock.ts blockWindowOf), what the ledger prints as PLANNED MIN (ledger.ts, through the ledger route's
 * recordInputOf) and what the stop's own minutes are. A line → its duration_minutes (the line's own, as it was). A stepless
 * routine with both start_time and end_time → end − start in whole minutes, an end before the start ending the next day
 * (rruleHelpers.ts EMPTY_WINDOW_WORDS — MOVE-01's window convention); an end equal to the start is 0 — refused on write, and
 * no length here (blockWindowOf: ≤ 0 is none). Else null: a line that states none, a stepless routine without a window.
 * Applied here for the card's stops and in the ledger route for a record's plan; no reader restates it.
 * TRAVEL-01b (Alex, 2026-10-31, ruling D): a travel stop → its stated duration_minutes; else the stated start→end clock
 * difference when the end is stated on the SAME day and is after the start (vendor-commit writes a transfer's destTime
 * equal to its start — zero length is no length → null; an end before the start on the same day is no length either);
 * else null. Nothing converts a clock across zones: the clocks are as stated.
 */
export function plannedMinutesOf(plan: PlannedMinutesPlan): number | null {
  if (plan.kind === 'line') return plan.duration_minutes;
  if (plan.kind === 'travel') {
    if (plan.duration_minutes !== null) return plan.duration_minutes;
    if (plan.start === null) return null;
    if (plan.end === null) return null;
    if (!plan.endSameDay) return null;
    const start = clockMinutesOf('start', plan.start);
    const end = clockMinutesOf('end', plan.end);
    return end > start ? end - start : null;
  }
  const start = windowMinutesOf('start_time', plan.start_time);
  const end = windowMinutesOf('end_time', plan.end_time);
  if (start === null || end === null) return null;
  return end >= start ? end - start : end + 24 * 60 - start;
}

// ── TRAVEL-01c (Alex, 2026-10-31, rulings A–F): SUPERSESSION, DERIVED — NEVER WRITTEN ──────────────────────────────────
//
// A routine occurrence that shares a minute with a travel block is superseded by it. Everything here is a pure rule over
// dayStops' own stops; nothing fetches, nothing writes. No `||`, no `?? <default>` in this section.

export const SUPERSEDED_BY_WORDS = 'superseded by';
export const CANNOT_SUPERSEDE_NO_END_WORDS = 'cannot supersede — no end stated';
export const CANNOT_SUPERSEDE_NO_INSTANT_WORDS = 'cannot supersede — no instant';
export const SUPERSEDED_BY_TRAVEL_WORDS = 'superseded by travel';
export const NOT_IN_PLAN_WORDS = "not in today's plan";
/** "and 1 more" — the other blocks that overlap the same stop. */
export const andMoreWords = (n: number): string => `and ${n} more`;

/** TRAVEL-01c (ruling B): what the rule reads of a routine occurrence — its planned instant, its minutes by the one rule, whether a record is at it. */
export interface OccurrenceWindow {
  readonly key: string;
  readonly at: Date;
  readonly minutes: number | null;
  readonly hasRecord: boolean;
}

/** Why a travel stop cannot supersede (ruling A): no instant at all, or a start with no end; null for a block. */
export function cannotSupersedeWords(t: { readonly startAt: string | null; readonly endAt: string | null }): string | null {
  if (t.startAt === null) return CANNOT_SUPERSEDE_NO_INSTANT_WORDS;
  if (t.endAt === null) return CANNOT_SUPERSEDE_NO_END_WORDS;
  return null;
}

/** An ISO instant as milliseconds; a block's instant that is no instant is the read's error, thrown by name. */
const instantMsOf = (key: string, what: 'startAt' | 'endAt', iso: string): number => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`supersession: ${key} ${what} ${JSON.stringify(iso)} is not an instant`);
  return ms;
};

/** The first comparison that decides, in order — a comparator chain with no default in it. */
const firstDecidingOf = (comparisons: readonly number[]): number => {
  for (const c of comparisons) if (c !== 0) return c;
  return 0;
};

/**
 * TRAVEL-01c (ruling B): per routine occurrence, the block that supersedes it — the EARLIEST by instant (start, then end,
 * then the blocks' order) — and how many other blocks overlap it too; nothing for an occurrence with a record (reality
 * wins), nothing when no block shares a minute. The occurrence's window is [at, at + minutes) in instants; a stop with no
 * length (null, or no positive minutes) is a point, superseded when it lies inside a block's [startAt, endAt). Instants
 * compare as instants — no wall clocks, no zones. A block whose end is not after its start has no window: refused by name.
 */
export function supersessionOf(blocks: readonly TravelBlock[], occurrences: readonly OccurrenceWindow[]): ReadonlyMap<string, Supersession> {
  const ordered = blocks
    .map((b, i) => ({ b, i, start: instantMsOf(b.key, 'startAt', b.startAt), end: instantMsOf(b.key, 'endAt', b.endAt) }))
    .sort((x, y) => firstDecidingOf([x.start - y.start, x.end - y.end, x.i - y.i]));
  for (const x of ordered) {
    if (x.end <= x.start) throw new Error(`supersession: ${x.b.key} ends ${x.b.endAt}, not after its start ${x.b.startAt} — no window to supersede with`);
  }
  const marks = new Map<string, Supersession>();
  for (const o of occurrences) {
    if (o.hasRecord) continue;
    const start = o.at.getTime();
    const length = o.minutes === null ? 0 : o.minutes > 0 ? o.minutes : 0;
    const end = start + length * 60_000;
    const over = ordered.filter((x) => (length === 0 ? x.start <= start && start < x.end : start < x.end && x.start < end));
    if (over.length === 0) continue;
    marks.set(o.key, { by: over[0].b, more: over.length - 1 });
  }
  return marks;
}
