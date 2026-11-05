/**
 * EVENTS-01 (Alex, 2026-10-30) — THE WORDS an experience row is shown in. PURE:
 * no clock, no locale call, no fetch, no React. It imports the leaf's types only.
 *
 * Every date is a 'YYYY-MM-DD' string and every comparison is a string compare
 * on that shape; the month name comes from the string's month number
 * (en-US abbreviations), never from Date or toLocaleString. `today` is the UTC
 * calendar date the front door computed ONCE (src/app/page.tsx) and passed down —
 * nothing here reads the clock, so the server's words and the browser's are the
 * same words.
 *
 *   dateWords(start, end)        "Oct 31 – Nov 10, 2026" (cross-month) ·
 *                                "Dec 8–20, 2026" (same month) · "Nov 14, 2026"
 *                                (one day) · "Nov 1, 2026 – Mar 31, 2027" (cross-year)
 *   experienceLine(row, today)   THE one line a card shows (see the function)
 *   experienceWindowLine(row)    the dated part of that line, with no day in it — a stop's
 *                                page names the event it was around on any day (TRIPCARDS-01)
 *   upcoming(rows, today, n)     announced/conflict rows with end ≥ today, by start, first n
 *   lineupPill(row, today)       the lineup's pill words for one row
 *   shortDayWords(iso)           "Jul 1" — one day without its year (TRIPPOST-01)
 *   weekdayWords(iso)            "Wed" — the day's weekday, by integer arithmetic on the
 *                                date's own parts (Sakamoto's method), never Date (TRIPPOST-01)
 *
 * EVENTS-01b (2026-10-30): the series summary and its pill are DELETED — the section
 * always shows one category, so every row is its own pill and nothing collapses; a
 * conflict pill says " · window being confirmed" only (a conflict is unconfirmed by
 * definition).
 */

import type { Experience } from './experiences';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** The en dash between two days — "Dec 8–20" (no spaces) and "Oct 31 – Nov 10" (spaced). */
const DASH = '–';

export class ExperienceWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExperienceWordsError';
  }
}

function parts(iso: string): { year: string; month: number; day: number } {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new ExperienceWordsError(`"${iso}" is not YYYY-MM-DD`);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new ExperienceWordsError(`"${iso}" is not a calendar date`);
  return { year: m[1], month, day };
}

const monthDay = (p: { month: number; day: number }): string => `${MONTHS[p.month - 1]} ${p.day}`;

/** One day without its year: "Jul 1" (TRIPPOST-01 — the trip post's day rows). */
export function shortDayWords(iso: string): string {
  return monthDay(parts(iso));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** Sakamoto's month offsets, January first. */
const SAKAMOTO = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const;

/** A day's weekday: "Wed" (TRIPPOST-01). Integer arithmetic on the date's own parts — Sakamoto's method — so no Date, no Intl, no locale. */
export function weekdayWords(iso: string): string {
  const p = parts(iso);
  const y = p.month < 3 ? Number(p.year) - 1 : Number(p.year);
  const index = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + SAKAMOTO[p.month - 1] + p.day) % 7;
  return WEEKDAYS[index];
}

/** One day: "Oct 30, 2026". */
export function dayWords(iso: string): string {
  const p = parts(iso);
  return `${monthDay(p)}, ${p.year}`;
}

/** A window: "Oct 31 – Nov 10, 2026" · "Dec 8–20, 2026" · "Nov 14, 2026" · "Nov 1, 2026 – Mar 31, 2027". */
export function dateWords(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (start > end) throw new ExperienceWordsError(`start ${start} is after end ${end}`);
  if (start === end) return `${monthDay(a)}, ${a.year}`;
  if (a.year !== b.year) return `${monthDay(a)}, ${a.year} ${DASH} ${monthDay(b)}, ${b.year}`;
  if (a.month !== b.month) return `${monthDay(a)} ${DASH} ${monthDay(b)}, ${a.year}`;
  return `${monthDay(a)}${DASH}${b.day}, ${a.year}`;
}

/** The words for a row with no dates, or whose window has passed: the day it was checked, said. */
export function notAnnouncedLine(checkedOn: string): string {
  return `Next edition not announced (checked ${dayWords(checkedOn)})`;
}

/** A row's window is still open: announced or in conflict, and its end is today or later. */
export function isUpcoming(row: Experience, today: string): boolean {
  return (row.status === 'announced' || row.status === 'conflict') && row.end !== null && row.end >= today;
}

/**
 * THE ONE LINE a card shows.
 *   not_announced                → "Next edition not announced (checked Oct 30, 2026)"
 *   end < today                  → the same words, with the row's own checkedOn
 *   announced · official         → "<dateWords> · per <sourceName>"
 *   announced · secondary        → "<dateWords> · reported by <sourceName>, not yet confirmed by the organizer"
 *   conflict                     → "<dateWords> · window being confirmed"
 *   windowKind 'window'          → "Window " before the dates
 *   windowKind 'swell'           → "Window " before the dates and " · called on a swell" after the line
 */
export function experienceLine(row: Experience, today: string): string {
  if (row.status === 'not_announced') return notAnnouncedLine(row.checkedOn);
  if (row.start === null || row.end === null) throw new ExperienceWordsError(`${row.id}: status ${row.status} with no dates — the leaf's law refuses this row`);
  if (row.end < today) return notAnnouncedLine(row.checkedOn);
  return experienceWindowLine(row);
}

/**
 * TRIPCARDS-01 (2026-11-05): an announced or conflicting row's window in words — experienceLine's
 * dated words, with no day in them. A row with no window is refused by name, never a guess.
 */
export function experienceWindowLine(row: Experience): string {
  if (row.status === 'not_announced' || row.start === null || row.end === null) throw new ExperienceWordsError(`${row.id}: status ${row.status} has no window to name`);
  const words = dateWords(row.start, row.end);
  const prefix = row.windowKind === 'fixed' ? '' : 'Window ';
  let line: string;
  if (row.status === 'conflict') line = `${prefix}${words} · window being confirmed`;
  else if (row.sourceKind === 'official') line = `${prefix}${words} · per ${row.sourceName}`;
  else line = `${prefix}${words} · reported by ${row.sourceName}, not yet confirmed by the organizer`;
  if (row.windowKind === 'swell') line += ' · called on a swell';
  return line;
}

/** Announced or conflicting rows whose window is still open, by start (ties keep the leaf's order), the first n. */
export function upcoming(rows: readonly Experience[], today: string, n: number): Experience[] {
  return rows
    .filter((row) => isUpcoming(row, today))
    .sort((a, b) => (a.start as string).localeCompare(b.start as string))
    .slice(0, n);
}

/**
 * The lineup's pill for one row.
 *   conflict, window open              → "name · city · <dateWords> · window being confirmed" — and
 *                                        nothing else: a conflict is unconfirmed by definition (EVENTS-01b)
 *   announced, window open             → "name · city · <dateWords>", then " · reported" for a secondary source
 *   not_announced, or window passed    → "name · not announced"
 */
export function lineupPill(row: Experience, today: string): string {
  if (row.status === 'not_announced' || row.start === null || row.end === null || row.end < today) return `${row.name} · not announced`;
  const words = `${row.name} · ${row.city} · ${dateWords(row.start, row.end)}`;
  if (row.status === 'conflict') return `${words} · window being confirmed`;
  return row.sourceKind === 'secondary' ? `${words} · reported` : words;
}
