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
 *   upcoming(rows, today, n)     announced/conflict rows with end ≥ today, by start, first n
 *   seriesSummary(rows, today)   a series with more than SERIES_COLLAPSE_OVER upcoming
 *                                rows collapses to one pill — derived, never typed
 *   lineupPill(row, today)       the lineup's pill words for one row
 *   seriesPill(summary)          the lineup's pill words for a collapsed series
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

/** A series with MORE than this many upcoming rows collapses to one lineup pill. */
export const SERIES_COLLAPSE_OVER = 3;

export interface SeriesSummary {
  /** The series name, as the rows spell it. */
  name: string;
  /** How many of its rows are upcoming. */
  count: number;
  /** The word for one of them: a championship has rounds; anything else has events. */
  unit: 'rounds' | 'events';
  /** dateWords of the earliest upcoming row. */
  first: string;
  /** dateWords of the latest upcoming row. */
  last: string;
  /** The whole run, earliest start to latest end: "Mar 12 – Dec 12, 2027". */
  span: string;
  /** The earliest upcoming row's source — the pill's one link. */
  sourceUrl: string;
}

/** One summary per series with more than SERIES_COLLAPSE_OVER upcoming rows, in the order the series first appear. */
export function seriesSummary(rows: readonly Experience[], today: string): SeriesSummary[] {
  const groups = new Map<string, Experience[]>();
  for (const row of upcoming(rows, today, rows.length)) {
    if (row.series === null) continue;
    const group = groups.get(row.series);
    if (group) group.push(row); else groups.set(row.series, [row]);
  }
  const out: SeriesSummary[] = [];
  for (const [name, group] of groups) {
    if (group.length <= SERIES_COLLAPSE_OVER) continue;
    const earliest = group[0];
    const latest = group.reduce((best, row) => ((row.end as string) > (best.end as string) ? row : best), group[0]);
    out.push({
      name,
      count: group.length,
      unit: /championship/i.test(name) ? 'rounds' : 'events',
      first: dateWords(earliest.start as string, earliest.end as string),
      last: dateWords(latest.start as string, latest.end as string),
      span: dateWords(earliest.start as string, latest.end as string),
      sourceUrl: earliest.sourceUrl,
    });
  }
  return out;
}

/**
 * The lineup's pill for one row.
 *   announced / conflict, window open → "name · city · <dateWords>", then " · reported" for a
 *                                        secondary source and " · window being confirmed" for a conflict
 *   not_announced, or window passed    → "name · not announced"
 */
export function lineupPill(row: Experience, today: string): string {
  if (row.status === 'not_announced' || row.start === null || row.end === null || row.end < today) return `${row.name} · not announced`;
  let words = `${row.name} · ${row.city} · ${dateWords(row.start, row.end)}`;
  if (row.sourceKind === 'secondary') words += ' · reported';
  if (row.status === 'conflict') words += ' · window being confirmed';
  return words;
}

/** The lineup's pill for a collapsed series: "2027 FIA Formula One World Championship · 24 rounds · Mar 12 – Dec 12, 2027". */
export function seriesPill(summary: SeriesSummary): string {
  return `${summary.name} · ${summary.count} ${summary.unit} · ${summary.span}`;
}
