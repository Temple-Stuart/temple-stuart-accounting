/**
 * WASHERE-01 (Alex, 2026-10-31) — THE WORDS a trip-log row is shown in. PURE: no
 * clock, no locale call, no fetch, no React. It imports the leaf's types and the
 * ONE dateWords / dayWords from experienceWords.ts — never a second.
 *
 *   wasHereLabel(row)        end null → "I'M HERE" · end set → "I WAS HERE"
 *   stayWords(row)           end null → "Since Oct 22, 2026" · end set → dateWords(start, end)
 *   tripOrder(rows)          the rows by start, ascending — trip order, derived, a copy
 *                            (WASHERE-03; newestFirst left with it — no caller)
 *   stopWords(n)             "Stop 1" … "Stop 7" — n is the row's place in tripOrder, derived (WASHERE-03)
 *   listWords(items)         the items joined by " · " — WORKED FROM and DID (WASHERE-03)
 *
 * WASHERE-02 (2026-10-31) — the stops' events. WASHERE-03 cut the near-miss words:
 * daysBetween, missedWords and missedPill left with their fixtures (no caller).
 *   stopEventLine(ev)        dateWords(start, end) · the status words · per / reported by the source
 *   stopEventPlace(ev)       the venue, or the area when the page named none
 *   onPill(ev)               "<name> · <stopEventPlace> · <stopEventLine>"
 */

import type { StopEvent, WasHereRow } from './wasHere';
import { dateWords, dayWords } from './experienceWords';

export function wasHereLabel(row: WasHereRow): string {
  return row.end === null ? 'I\'M HERE' : 'I WAS HERE';
}

export function stayWords(row: WasHereRow): string {
  return row.end === null ? `Since ${dayWords(row.start)}` : dateWords(row.start, row.end);
}

/** The rows in trip order — by start, ascending; a copy. */
export function tripOrder(rows: readonly WasHereRow[]): WasHereRow[] {
  return [...rows].sort((a, b) => a.start.localeCompare(b.start));
}

/** The stop's number in the trip, from its place in tripOrder: "Stop 1". */
export function stopWords(n: number): string {
  return `Stop ${n}`;
}

/** WORKED FROM and DID: the items, joined. */
export function listWords(items: readonly string[]): string {
  return items.join(' · ');
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

/** The venue, or the area when the page named no venue. */
export function stopEventPlace(ev: StopEvent): string {
  return ev.venue ?? ev.area;
}

/** The WHAT WAS ON pill. */
export function onPill(ev: StopEvent): string {
  return `${ev.name} · ${stopEventPlace(ev)} · ${stopEventLine(ev)}`;
}
