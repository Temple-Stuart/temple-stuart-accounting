/**
 * HOME-TRAVEL-01 (Alex's brief, 2026-11-12 16:08 Manila: "if someone selects events, they add to a queue table below the search
 * bar, so the person who adds them can see them for review to like aid in booking flights and stuff.... the see what they wanna do
 * when it is, so they know dates they need to filter for flights and stuff, to build around the events"; the board approved on the
 * design canvas at 20:26: "ok I approve the travel market place") — THE GUEST'S TRIP: ITS WORDS AND ITS ORDER.
 *
 * PURE: no clock, no locale call, no storage, no React. The trip card (src/components/landing/GuestTripStrip.tsx) draws what this
 * leaf says; it types no word of its own. The rules are the README's ("The trip: the rules", design-refs/home-travel-01/README.md):
 *   · ORDER — the events with dates first, by start date (ties keep the order added); then the events without dates, in the order
 *     added. An event "has dates" when its line names an open window on `today` (isUpcoming): a usual season ("Usually …") and a
 *     window closed by today are without dates, as the reference draws them.
 *   · BETWEEN TWO DATED EVENTS IN A ROW — the days strictly between the first's end and the second's start, counted from the date
 *     strings' own parts (dayNumber, src/lib/experienceWords.ts), never Date: "{n} days between", "1 day between", "Back to back"
 *     at 0; "Overlaps the one above" when the second starts on or before the first ends.
 *   · THE SUMMARY — "{n} event" / "{n} events" (every event in the trip), " · ", then dateWords(first start, latest end) over the
 *     dated ones; "dates not announced yet" after the dot when none has dates. Only when the trip holds an event.
 *   · AN EVENT'S DATES — tripWhenWords (src/lib/experienceWords.ts, beside experienceWindowLine); ITS PLACE — "{city}, {country}",
 *     a city that is not fixed printing the leaf's own mark ("—, USA"); STAY NEAR IT → — where canStayNear says so.
 * The four words GuestTripStrip.tsx typed until this brief live here too: "Your trip so far", the pitch, "Create free account",
 * "Total" — its words unchanged.
 */
import { EXPERIENCES, type Experience } from './experiences';
import { canStayNear, dateWords, dayNumber, isUpcoming, tripWhenWords } from './experienceWords';

/** BOOK-3: the card's eyebrow — and, HOME-TRAVEL-01, its name for a screen reader. Typed in GuestTripStrip.tsx until 2026-11-12. */
export const TRIP_EYEBROW = 'Your trip so far';
/** BOOK-3: the ruled pitch, verbatim. Typed in GuestTripStrip.tsx until 2026-11-12. */
export const TRIP_PITCH = 'This trip lives in your browser — create a free account to save it, budget it, and map it to your runway.';
/** BOOK-3: the account button's words. Typed in GuestTripStrip.tsx until 2026-11-12. */
export const CREATE_FREE_ACCOUNT = 'Create free account';
/** BOOK-3: the total row's label — with " (USD)" and its kin after it when the trip holds more than one currency. Typed in GuestTripStrip.tsx until 2026-11-12. */
export const TOTAL = 'Total';
/** BOOK-3: a booking's code or amount the response did not state — a dash, never a guess. Typed in GuestTripStrip.tsx until 2026-11-12. */
export const NOT_STATED = '—';
/** HOME-TRAVEL-01: the gold button — it opens Flights and brings the box into view. It fills nothing: no airport, no date. */
export const SEARCH_FLIGHTS = 'Search flights →';
/** HOME-TRAVEL-01: the summary's dates when no event in the trip has any. */
export const DATES_NOT_ANNOUNCED = 'dates not announced yet';
/** HOME-TRAVEL-01: the line between two dated events when the second starts the day after the first ends. */
export const BACK_TO_BACK = 'Back to back';
/** HOME-TRAVEL-01: the line between two dated events when the second starts on or before the first ends — drawn in gold. */
export const OVERLAPS = 'Overlaps the one above';
/**
 * HOME-TRAVEL-01 — Q1, ruled by Alex 2026-11-12 (yes to the designer's recommendation: "keep its row, say it is no longer listed, and give it its ×
 * to remove it"): where the dates go on the row of an event the catalog no longer holds — a deploy renamed or removed it while the guest's tab
 * kept its id. The row is never dropped silently and never stands in for another event.
 */
export const NO_LONGER_LISTED = 'No longer listed';
/**
 * HOME-TRAVEL-01 — Q2, ruled by Alex 2026-11-12 (yes to the designer's recommendation: "say so where they pressed, and add nothing"): the line under
 * the pressed button when the browser refuses to save the trip (private mode, a full quota). The trip stays as it was.
 */
export const NOT_SAVED_ADD = "Your browser didn't save this — nothing was added.";
/** HOME-TRAVEL-01 — Q2: the same, for a press that would have taken an event out (In your trip, or the trip card's ×). */
export const NOT_SAVED_REMOVE = "Your browser didn't save this — nothing was taken out.";

/** HOME-TRAVEL-01: "1 event" · "3 events". */
export function eventCountWords(n: number): string {
  return n === 1 ? `${n} event` : `${n} events`;
}

/** HOME-TRAVEL-01: the days strictly between two dated events — "Back to back" at 0, "1 day between", "{n} days between". */
export function daysBetweenWords(days: number): string {
  if (!Number.isInteger(days) || days < 0) throw new GuestTripWordsError(`${days} is not a count of days — an overlap has its own words`);
  if (days === 0) return BACK_TO_BACK;
  return days === 1 ? '1 day between' : `${days} days between`;
}

/** HOME-TRAVEL-01: the round ×'s name for a screen reader — "Remove Australian Open 2027". */
export function removeWords(name: string): string {
  return `Remove ${name}`;
}

export class GuestTripWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuestTripWordsError';
  }
}

/**
 * HOME-TRAVEL-01 (the README's "Focus"): where the focus goes when an event's × is pressed — the next event's ×; if there is none, the one before;
 * with no event left, null: the box's open tab takes it. `ids` are the trip's events in the card's order.
 */
export function focusAfterRemove(ids: readonly string[], id: string): string | null {
  const at = ids.indexOf(id);
  if (at < 0) throw new GuestTripWordsError(`${id} is not one of the trip's events — the card draws no × for it`);
  return ids[at + 1] ?? ids[at - 1] ?? null;
}

/** HOME-TRAVEL-01: the line between an event and the dated event above it. */
export interface TripGap {
  words: string;
  /** The second starts on or before the first ends — the line is drawn in gold. */
  overlap: boolean;
}

/**
 * HOME-TRAVEL-01: one event of the trip, as the card draws it. An event the catalog no longer holds (Q1, Alex 2026-11-12) has no row: its name is the
 * stored id, its dates NO_LONGER_LISTED, no place and no Stay near it → — and its ×.
 */
export interface TripEvent {
  /** The stored catalog id — the × takes it out by this. */
  id: string;
  /** The catalog's row; null when the catalog no longer holds the id. */
  row: Experience | null;
  /** Its name — the row's, or the stored id. */
  name: string;
  /** Its dates — tripWhenWords; NO_LONGER_LISTED with no row. */
  when: string;
  /** "{city}, {country}"; null with no row. */
  place: string | null;
  /** Stay near it → is drawn (canStayNear); never with no row. */
  stay: boolean;
  /** The line above it — only between two dated events in a row; null otherwise. */
  gap: TripGap | null;
}

/** HOME-TRAVEL-01: the trip's events, in the card's order, and the summary over the listed ones (null when the trip holds no event the catalog lists). */
export interface TripEventsView {
  events: TripEvent[];
  summary: string | null;
}

/** HOME-TRAVEL-01: the line between two dated events in a row — the days strictly between the first's end and the second's start. */
export function tripGap(first: Experience, second: Experience): TripGap {
  if (first.end === null || second.start === null) throw new GuestTripWordsError(`${first.id} → ${second.id}: a gap is drawn between two dated events only`);
  const days = dayNumber(second.start) - dayNumber(first.end) - 1;
  return days < 0 ? { words: OVERLAPS, overlap: true } : { words: daysBetweenWords(days), overlap: false };
}

/**
 * HOME-TRAVEL-01: the trip's events as the card draws them, from the stored ids (in the order added), on the server's `today`.
 * The catalog is read here, never stored: every word and date comes from `rows` (EXPERIENCES). An id stored twice is refused by
 * name — the writers never store one twice. Q1 (Alex, 2026-11-12: yes): an id the catalog no longer holds keeps its row — among the events
 * without dates, in the order added — saying it is no longer listed, with its ×; it counts in no summary and opens no gap.
 */
export function tripEventsView(ids: readonly string[], today: string, rows: readonly Experience[] = EXPERIENCES): TripEventsView {
  const added: Array<{ id: string; row: Experience | null }> = ids.map((id, at) => {
    if (ids.indexOf(id) !== at) throw new GuestTripWordsError(`the stored trip holds ${id} twice — the writers add an event once`);
    return { id, row: rows.find((r) => r.id === id) ?? null };
  });
  // A string compare on 'YYYY-MM-DD' (no locale), and Array.prototype.sort is stable: dated events that start the same day keep
  // the order they were added in.
  const startOf = (row: Experience): string => row.start as string;
  const isDated = (row: Experience | null): row is Experience => row !== null && isUpcoming(row, today);
  const dated = added.map((a) => a.row).filter(isDated).sort((a, b) => (startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0));
  const undated = added.filter((a) => !isDated(a.row));
  const events: TripEvent[] = [
    ...dated.map((row, at): TripEvent => ({
      id: row.id, row, name: row.name, when: tripWhenWords(row, today), place: `${row.city}, ${row.country}`, stay: canStayNear(row),
      gap: at > 0 ? tripGap(dated[at - 1], row) : null,
    })),
    ...undated.map(({ id, row }): TripEvent => (row === null
      ? { id, row: null, name: id, when: NO_LONGER_LISTED, place: null, stay: false, gap: null }
      : { id, row, name: row.name, when: tripWhenWords(row, today), place: `${row.city}, ${row.country}`, stay: canStayNear(row), gap: null })),
  ];
  const listed = events.filter((e) => e.row !== null).length;
  if (listed === 0) return { events, summary: null };
  const latest = dated.reduce((end, row) => ((row.end as string) > end ? (row.end as string) : end), dated.length === 0 ? '' : (dated[0].end as string));
  const dates = dated.length === 0 ? DATES_NOT_ANNOUNCED : dateWords(dated[0].start as string, latest);
  return { events, summary: `${eventCountWords(listed)} · ${dates}` };
}
