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
 *   notAnnouncedLine(checkedOn)  "Next edition not announced (checked Oct 30, 2026)" — no dates, or an edition's
 *                                window has passed
 *   seasonNotAnnouncedLine(checkedOn) "Next season not announced (checked Nov 8, 2026)" — an announced season's
 *                                published window has passed (EVENTS-04, 2026-11-09)
 *   experienceWindowLine(row)    the dated part of that line, with no day in it — a stop's
 *                                page names the event it was around on any day (TRIPCARDS-01)
 *   usualWindowWords(start, end) "Usually Dec – Mar" · "Usually Apr" (one month) — a typical season's
 *                                months, no day and no year (SEASONS-01, 2026-11-08)
 *   upcoming(rows, today, n)     announced/conflict rows with end ≥ today, by start, first n
 *   shortDayWords(iso)           "Jul 1" — one day without its year (TRIPPOST-01)
 *   weekdayWords(iso)            "Wed" — the day's weekday, by integer arithmetic on the
 *                                date's own parts (Sakamoto's method), never Date (TRIPPOST-01)
 *
 * EVENTS-01b (2026-10-30): the series summary and its pill are DELETED — the section
 * always shows one category, so every row is its own pill and nothing collapses; a
 * conflict pill says " · window being confirmed" only (a conflict is unconfirmed by
 * definition). EVENTS-01c (2026-11-06): THE LINEUP folded into COMING UP's cards, and the pill
 * words (lineupPill) left with it — no caller.
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

/** SEASONS-01 (2026-11-08): a typical season's usual window in months — "Usually Dec – Mar"; within one month, "Usually Apr". No day, no year: the months come from MONTHS, never from Date or a locale. */
export function usualWindowWords(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (start > end) throw new ExperienceWordsError(`start ${start} is after end ${end}`);
  if (a.year === b.year && a.month === b.month) return `Usually ${MONTHS[a.month - 1]}`;
  return `Usually ${MONTHS[a.month - 1]} ${DASH} ${MONTHS[b.month - 1]}`;
}

/** The words for a row with no dates, or whose window has passed: the day it was checked, said. */
export function notAnnouncedLine(checkedOn: string): string {
  return `Next edition not announced (checked ${dayWords(checkedOn)})`;
}

/** EVENTS-04 (Alex, 2026-11-09): an announced season whose published window has passed — a place's season, not an edition: the day it was checked, said. */
export function seasonNotAnnouncedLine(checkedOn: string): string {
  return `Next season not announced (checked ${dayWords(checkedOn)})`;
}

/** A row's window is still open: announced or in conflict, and its end is today or later. */
export function isUpcoming(row: Experience, today: string): boolean {
  return (row.status === 'announced' || row.status === 'conflict') && row.end !== null && row.end >= today;
}

/**
 * THE ONE LINE a card shows.
 *   not_announced                → "Next edition not announced (checked Oct 30, 2026)"
 *   end < today                  → the same words, with the row's own checkedOn — a season's own words instead,
 *                                  seasonNotAnnouncedLine (EVENTS-04, 2026-11-09)
 *   announced · official         → "<dateWords> · per <sourceName>"
 *   announced · secondary        → "<dateWords> · reported by <sourceName>, not yet confirmed by the organizer"
 *   conflict                     → "<dateWords> · window being confirmed"
 *   windowKind 'window'          → "Window " before the dates
 *   windowKind 'swell'           → "Window " before the dates and " · called on a swell" after the line
 *   SEASONS-01 (2026-11-08), windowKind 'season' — "per <sourceName>" whatever the sourceKind (CLOSED 3 gives
 *   the season lines one wording; a source that is not the place's own is named in the row's notes, CLOSED 4):
 *     typical                    → "Usually <Mon> – <Mon> · per <sourceName>" — whatever today is: a usual
 *                                  window does not expire, so the same words print every day
 *     announced                  → "Season <dateWords> · per <sourceName>", and the not-announced words
 *                                  once its end has passed, as any announced row — EVENTS-04 (2026-11-09): the season's
 *                                  own, "Next season not announced (checked <day>)" (seasonNotAnnouncedLine)
 */
export function experienceLine(row: Experience, today: string): string {
  if (row.status === 'not_announced') return notAnnouncedLine(row.checkedOn);
  if (row.start === null || row.end === null) throw new ExperienceWordsError(`${row.id}: status ${row.status} with no dates — the leaf's law refuses this row`);
  // SEASONS-01 (2026-11-08): a typical row is a usual window — it is printed before the end < today rule.
  if (row.status === 'typical') return experienceWindowLine(row);
  // EVENTS-04 (2026-11-09): a season whose published window has passed says the season's words; every other row, the edition's.
  if (row.end < today) return row.windowKind === 'season' ? seasonNotAnnouncedLine(row.checkedOn) : notAnnouncedLine(row.checkedOn);
  return experienceWindowLine(row);
}

/**
 * TRIPCARDS-01 (2026-11-05): an announced or conflicting row's window in words — experienceLine's
 * dated words, with no day in them. A row with no window is refused by name, never a guess.
 */
export function experienceWindowLine(row: Experience): string {
  if (row.status === 'not_announced' || row.start === null || row.end === null) throw new ExperienceWordsError(`${row.id}: status ${row.status} has no window to name`);
  // SEASONS-01 (2026-11-08): a place's season — its usual months (typical) or this season's published dates (announced),
  // "per <source>" whatever the sourceKind: the ruled words (CLOSED 3); the notes name a source that is not the place's own.
  if (row.windowKind === 'season') {
    return row.status === 'typical'
      ? `${usualWindowWords(row.start, row.end)} · per ${row.sourceName}`
      : `Season ${dateWords(row.start, row.end)} · per ${row.sourceName}`;
  }
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

