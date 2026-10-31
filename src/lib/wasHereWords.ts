/**
 * WASHERE-01 (Alex, 2026-10-31) — THE WORDS a trip-log row is shown in. PURE: no
 * clock, no locale call, no fetch, no React. It imports the leaf's types and the
 * ONE dateWords / dayWords from experienceWords.ts — never a second.
 *
 *   wasHereLabel(row)        end null → "I'M HERE" · end set → "I WAS HERE"
 *   stayWords(row)           end null → "Since Oct 22, 2026" · end set → dateWords(start, end)
 *   newestFirst(rows)        the rows by start, descending — derived, a copy
 *
 * WASHERE-02 (2026-10-31) — the stops' events:
 *   daysBetween(a, b)        a civil-date day count on 'YYYY-MM-DD' strings (the
 *                            days-from-civil formula), no Date object
 *   stopEventLine(ev)        dateWords(start, end) · the status words · per / reported by the source
 *   missedWords(ev, stay)    "started the day after I left" / "started <n> days after I left" /
 *                            "ended the day before I arrived" / "ended <n> days before I arrived"
 *   onPill(ev)               "<name> · <venue, or area when venue is null> · <stopEventLine>"
 *   missedPill(ev, stay)     "<name> · <venue or area> · <dateWords> · <missedWords>"
 */

import type { StopEvent, WasHereRow } from './wasHere';
import { dateWords, dayWords } from './experienceWords';

export class WasHereWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WasHereWordsError';
  }
}

export function wasHereLabel(row: WasHereRow): string {
  return row.end === null ? 'I\'M HERE' : 'I WAS HERE';
}

export function stayWords(row: WasHereRow): string {
  return row.end === null ? `Since ${dayWords(row.start)}` : dateWords(row.start, row.end);
}

export function newestFirst(rows: readonly WasHereRow[]): WasHereRow[] {
  return [...rows].sort((a, b) => b.start.localeCompare(a.start));
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a civil date — Howard Hinnant's days_from_civil, integer arithmetic only. */
function daysFromCivil(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new WasHereWordsError(`"${iso}" is not YYYY-MM-DD`);
  let y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new WasHereWordsError(`"${iso}" is not a calendar date`);
  y -= mo <= 2 ? 1 : 0;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The civil days from a to b: 2026-07-30 → 2026-08-01 is 2; 2028-02-28 → 2028-03-01 is 2 (a leap year). */
export function daysBetween(a: string, b: string): number {
  return daysFromCivil(b) - daysFromCivil(a);
}

const sourceWords = (ev: StopEvent): string => (ev.sourceKind === 'official' ? `per ${ev.sourceName}` : `reported by ${ev.sourceName}`);

/** dateWords(start, end) · the status words · the source: "Jul 21, 2026 · took place · per Rip Curl Indonesia". */
export function stopEventLine(ev: StopEvent): string {
  const when = dateWords(ev.start, ev.end);
  const by = sourceWords(ev);
  switch (ev.status) {
    case 'took_place': return `${when} · took place · ${by}`;
    case 'scheduled': return `${when} · ${by}`;
    case 'postponed': return `${when} · postponed · ${by}`;
    case 'cancelled': return `${when} · cancelled · ${by}`;
  }
}

/** How a near miss was missed, in days derived from the two dates — never typed. */
export function missedWords(ev: StopEvent, stay: WasHereRow): string {
  if (stay.end !== null && ev.start > stay.end) {
    const n = daysBetween(stay.end, ev.start);
    return n === 1 ? 'started the day after I left' : `started ${n} days after I left`;
  }
  if (ev.end < stay.start) {
    const n = daysBetween(ev.end, stay.start);
    return n === 1 ? 'ended the day before I arrived' : `ended ${n} days before I arrived`;
  }
  throw new WasHereWordsError(`${ev.name} overlaps the stay — not a near miss (the law refuses this row)`);
}

/** The venue, or the area when the page named no venue. */
export function stopEventPlace(ev: StopEvent): string {
  return ev.venue ?? ev.area;
}

/** The WHAT WAS ON pill. */
export function onPill(ev: StopEvent): string {
  return `${ev.name} · ${stopEventPlace(ev)} · ${stopEventLine(ev)}`;
}

/** The JUST MISSED pill. */
export function missedPill(ev: StopEvent, stay: WasHereRow): string {
  return `${ev.name} · ${stopEventPlace(ev)} · ${dateWords(ev.start, ev.end)} · ${missedWords(ev, stay)}`;
}
