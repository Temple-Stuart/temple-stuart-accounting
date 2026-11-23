/**
 * TRIPPOST-02 (Alex, 2026-11-23) — THE FIGURES a stop's page shows: how long the stay was, the stay a night, the motorbike a day,
 * the fixed bookings and a day's share of them; and the journal's calendar, read from the post's first day on. PURE: whole cents
 * in, whole cents out, by integer arithmetic alone — no clock, no locale, no fetch, no React. It prints nothing: the words these
 * figures are drawn in, and every amount, are src/lib/tripPostPageWords.ts's (through the one money formatter).
 *
 * THE RULE is the handoff's (design-refs/trippost-02/README.md, The figures), sentence for sentence:
 *   · nights — the stay's end less its start, in days; a stay with no end yet has none (null);
 *   · the motorbike's days — the rental's last day less its first (TRIP_MOTO_DAYS, src/lib/tripCosts.ts); a rental with no row
 *     has none (null);
 *   · a rate — an amount over what it is spread across, to the nearest cent, halves up: floor((2 × amount + over) / (2 × over));
 *     the stay and the flight in are spread across the nights, the motorbike across its days. Spread across nothing (a stay that
 *     ends the day it starts), a rate is refused by name — never a guess;
 *   · fixed bookings — the sum of the lines paid; null when no line is paid, since a figure that cannot be worked out is never
 *     a number;
 *   · a day's share — drawn only when every line is one he never had or has a rate, and one at least is paid. It is the
 *     rounding of the unrounded sum: ONE fraction, its numerator and its denominator whole — the product of what each line is
 *     spread across — rounded once. Never the sum of the rounded rates.
 * Days between two dates are counted by dayNumber (src/lib/experienceWords.ts — Hinnant's days_from_civil). Its inverse,
 * civilFromDays (Hinnant's civil_from_days), lives here: the calendar's seats and its seven weekdays are read from the post's first
 * day on, and no other leaf steps a date.
 */

import type { TripCostLine, TripCosts, TripMotoDays } from './tripCosts';
import type { TripPostRoutine, TripPostRoutineKind } from './tripPosts';
import type { WasHereRow } from './wasHere';
import { dayNumber } from './experienceWords';

export class TripFiguresError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripFiguresError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);
const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** n ÷ d, rounded down — exact on whole numbers (no float division): n ≥ 0, d ≥ 1. */
const floorDiv = (n: number, d: number): number => (n - (n % d)) / d;

/** The days from one date to the other: dayNumber(to) − dayNumber(from). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/**
 * Hinnant's civil_from_days — dayNumber's inverse: a day's number (the days from 1970-01-01 on the civil calendar) back to its
 * 'YYYY-MM-DD', by integer arithmetic alone. A number whose year is not four digits is refused by name.
 */
export function civilFromDays(n: number): string {
  if (!whole(n)) throw new TripFiguresError(`civilFromDays: ${String(n)} is not a whole day number`);
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  if (year < 0 || year > 9999) throw new TripFiguresError(`civilFromDays: day ${n} falls in the year ${year}, which is not YYYY`);
  return `${String(year).padStart(4, '0')}-${two(month)}-${two(day)}`;
}

/** The stay's nights: its end less its start — null while it has no end. */
export function nightsOf(row: Pick<WasHereRow, 'start' | 'end'>): number | null {
  return row.end === null ? null : daysBetween(row.start, row.end);
}

/** The rental's days: its last day less its first — null for a rental whose days his log does not hold. */
export function motoDayCount(days: TripMotoDays | null): number | null {
  return days === null ? null : daysBetween(days.from, days.to);
}

/** A rate: an amount over what it is spread across, to the nearest cent, halves up — floor((2 × amount + over) / (2 × over)). */
export function rateCents(amountCents: number, over: number): number {
  if (!whole(amountCents) || amountCents < 0) throw new TripFiguresError(`rateCents: ${String(amountCents)} is not a whole number of cents`);
  if (!whole(over) || over < 1) throw new TripFiguresError(`rateCents: ${String(over)} is not a whole number at least 1 — an amount spread across nothing has no rate`);
  const twice = 2 * amountCents + over;
  if (!whole(twice) || !whole(2 * over)) throw new TripFiguresError(`rateCents: ${amountCents} over ${over} is past whole-number arithmetic`);
  return floorDiv(twice, 2 * over);
}

/**
 * One of the stop's three lines, as a figure: a line he never had (none); one not in his log (unknown); or one paid — spread across
 * what it covers, or, while that is not in his log, its amount alone (spread null).
 */
export type LineFigure =
  | { kind: 'none' }
  | { kind: 'unknown' }
  | { kind: 'paid'; amountCents: number; spread: { over: number; rateCents: number } | null };

/** A line, spread across `over` (nights or days) — or across nothing yet, when `over` is null. */
export function lineFigure(line: TripCostLine, over: number | null): LineFigure {
  switch (line.kind) {
    case 'none': return { kind: 'none' };
    case 'unknown': return { kind: 'unknown' };
    case 'paid': return { kind: 'paid', amountCents: line.amountCents, spread: over === null ? null : { over, rateCents: rateCents(line.amountCents, over) } };
  }
}

/** Everything the stop's page counts. */
export interface StopFigures {
  /** The stay's nights, or null (no end yet). */
  nights: number | null;
  /** The rental's days, or null (not in his log). */
  motoDays: number | null;
  /** The stay, spread across the nights. */
  stay: LineFigure;
  /** The motorbike, spread across its days. */
  moto: LineFigure;
  /** The flight in, spread across the nights. */
  flightIn: LineFigure;
  /** The sum of the lines paid — null when no line is paid. */
  fixedCents: number | null;
  /** A day's share of the fixed bookings — null where it is not drawn. */
  dayShareCents: number | null;
}

/**
 * A day's share of the fixed bookings — or null where it is not drawn: drawn only when every line is one he never had or has a
 * rate, and one at least is paid. ONE fraction: the denominator the product of what each paid line is spread across, the
 * numerator each amount times the others' spans; rounded once, halves up.
 */
export function dayShareCents(lines: readonly LineFigure[]): number | null {
  const spread: { amountCents: number; over: number }[] = [];
  for (const line of lines) {
    if (line.kind === 'none') continue;
    if (line.kind === 'unknown' || line.spread === null) return null;
    spread.push({ amountCents: line.amountCents, over: line.spread.over });
  }
  if (spread.length === 0) return null;
  let denominator = 1;
  for (const s of spread) denominator *= s.over;
  let numerator = 0;
  spread.forEach((s, i) => {
    let others = 1;
    spread.forEach((t, j) => { if (j !== i) others *= t.over; });
    numerator += s.amountCents * others;
  });
  if (!whole(numerator) || !whole(denominator)) throw new TripFiguresError(`dayShareCents: ${numerator} over ${denominator} is past whole-number arithmetic`);
  return rateCents(numerator, denominator);
}

/** The stop's figures, from its row's dates, its costs and its rental's days. */
export function stopFigures(row: Pick<WasHereRow, 'start' | 'end'>, costs: TripCosts, motoDays: TripMotoDays | null): StopFigures {
  const nights = nightsOf(row);
  const rental = motoDayCount(motoDays);
  const stay = lineFigure(costs.stay, nights);
  const moto = lineFigure(costs.moto, rental);
  const flightIn = lineFigure(costs.flightIn, nights);
  const lines = [stay, moto, flightIn];
  let fixed = 0;
  let paid = 0;
  for (const line of lines) {
    if (line.kind !== 'paid') continue;
    fixed += line.amountCents;
    paid += 1;
  }
  if (!whole(fixed)) throw new TripFiguresError(`stopFigures: the fixed bookings ${fixed} are past whole-number arithmetic`);
  return { nights, motoDays: rental, stay, moto, flightIn, fixedCents: paid === 0 ? null : fixed, dayShareCents: dayShareCents(lines) };
}

/** The day he aims for, by kind: each kind once, in the order the day first meets it, with its hours summed. */
export function routineTotals(routine: TripPostRoutine): { kind: TripPostRoutineKind; hours: number }[] {
  const totals: { kind: TripPostRoutineKind; hours: number }[] = [];
  for (const block of routine.blocks) {
    const seen = totals.find((t) => t.kind === block.kind);
    if (seen === undefined) totals.push({ kind: block.kind, hours: block.hours });
    else seen.hours += block.hours;
  }
  return totals;
}

/** The seven dates the calendar's weekdays are read from: its first day and the six after it. */
export function weekdayDates(first: string): string[] {
  const n = dayNumber(first);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => civilFromDays(n + i));
}

/** One seat of the calendar: its date, and its place among the post's days — or null, an empty seat (no entry that day). */
export interface CalendarSeat {
  date: string;
  entry: number | null;
}

/**
 * The calendar's seats: every date from the post's first day to its last, in order, so every day stands under its weekday. A date
 * the post has no entry for is an empty seat. The days must be 'YYYY-MM-DD' and strictly ascending (the posts law), or they are
 * refused by name.
 */
export function calendarSeats(dates: readonly string[]): CalendarSeat[] {
  if (dates.length === 0) throw new TripFiguresError('calendarSeats: a post with no days has no calendar');
  dates.forEach((date, i) => {
    if (!ISO_DATE.test(date)) throw new TripFiguresError(`calendarSeats: "${date}" is not YYYY-MM-DD`);
    if (i > 0 && date <= dates[i - 1]) throw new TripFiguresError(`calendarSeats: ${date} comes after ${dates[i - 1]} — the days run strictly ascending`);
  });
  const first = dayNumber(dates[0]);
  const last = dayNumber(dates[dates.length - 1]);
  const seats: CalendarSeat[] = [];
  for (let n = first; n <= last; n += 1) {
    const date = civilFromDays(n);
    const entry = dates.indexOf(date);
    seats.push({ date, entry: entry === -1 ? null : entry });
  }
  return seats;
}
