/**
 * DAY-01 STEP 1 — WHICH SOURCES THE CALENDAR RENDERS, BY NAME.
 *
 * WHAT THIS REPLACES. HubCalendar.tsx held `raw.filter((e) => e.source === 'trip')`
 * — one bare string against one column. Every other calendar_events row the app
 * writes (a home bill, a planned purchase, a personal/auto/growth/health budget
 * line, an agenda item) was fetched by /api/calendar and then thrown away in the
 * browser. The filter was not a decision anyone recorded; it arrived with the
 * component when the Hub's calendar was lifted out of /hub, and nothing since
 * revisited it.
 *
 * THE RULE NOW. A source renders when it is named here with a reason. A source
 * that does not render is named in EXCLUDED_CALENDAR_SOURCES with a reason.
 * Nothing is excluded by silence — that is how the trip filter survived.
 *
 * THE CENSUS THIS IS DERIVED FROM (DAY-01 STEP 0.2, every INSERT INTO
 * calendar_events in src/):
 *   trip      — trips/[id]/commit/route.ts:187 and trips/[id]/vendor-commit/route.ts:425
 *   agenda    — agenda/[id]/route.ts:84
 *   home      — home/[id]/route.ts:83
 *   shopping  — shopping/[id]/route.ts:83 and shopping/commit/route.ts:84
 *   personal · auto · growth · health
 *             — budget/[module]/[id]/route.ts:104, where the source IS the module
 *               (:33 `const MODULE = mod`, gated by COLLAPSED_MODULES)
 * /api/calendar/route.ts:113-119 independently enumerates the same seven
 * money sources in its summary totals, which is the second witness for this list.
 *
 * EVENT-01 adds the ninth: `manual`, written by the route this repo did not have
 * until then (src/app/api/calendar/events/route.ts). It is a NEW value, never a
 * reuse — every other source names the system that produced the row, and a
 * hand-entered event was produced by the person.
 *
 * ONEOFF-01 closes that writer: the calendar authors nothing, and a one-off is
 * a routine planned in Tasks. `manual` STAYS in the allowlist because the rows
 * it already has are the calendar's own — they render, and their owner may
 * correct or remove them. The census below is untouched: it describes what
 * exists.
 */

/** A source the calendar renders, and why. */
export interface CalendarSourceRule {
  /** The literal written to calendar_events.source. */
  readonly source: string;
  /** The legend label. */
  readonly label: string;
  /** The writer, file:line — the evidence this source exists. */
  readonly writtenBy: string;
  /** One line: why this source belongs on the day. */
  readonly why: string;
  /**
   * The legend chip and grid tile this source wears. Each source keeps its own
   * colour so a day reads at a glance; the per-ROW icon written into
   * calendar_events.icon still wins on the row itself, and this is the fallback
   * for a row whose writer left the column null.
   */
  readonly icon: string;
  readonly tint: { readonly text: string; readonly bg: string; readonly dot: string; readonly badge: string };
}

/**
 * The tailwind quartet per colour, written OUT IN FULL. Tailwind's scanner reads
 * source text, so a template-built class name (`text-${c}-600`) is never emitted
 * and the chip would silently render unstyled. Literals only.
 */
const TINTS = {
  cyan:   { text: 'text-cyan-600',   bg: 'bg-cyan-50',   dot: 'bg-cyan-500',   badge: 'bg-cyan-400' },
  violet: { text: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500', badge: 'bg-violet-400' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500', badge: 'bg-orange-400' },
  pink:   { text: 'text-pink-600',   bg: 'bg-pink-50',   dot: 'bg-pink-500',   badge: 'bg-pink-400' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500', badge: 'bg-purple-400' },
  slate:  { text: 'text-slate-600',  bg: 'bg-slate-50',  dot: 'bg-slate-500',  badge: 'bg-slate-400' },
  blue:   { text: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500',   badge: 'bg-blue-400' },
  green:  { text: 'text-green-600',  bg: 'bg-green-50',  dot: 'bg-green-500',  badge: 'bg-green-400' },
  rose:   { text: 'text-rose-600',   bg: 'bg-rose-50',   dot: 'bg-rose-500',   badge: 'bg-rose-400' },
  amber:  { text: 'text-amber-600',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  badge: 'bg-amber-400' },
} as const;

/**
 * THE ALLOWLIST. Every source below writes a `start_date`, so every one of them
 * is part of a day. Ordered as the day reads: what you travel to, what you
 * planned, what you owe.
 */
export const CALENDAR_SOURCES: readonly CalendarSourceRule[] = [
  {
    source: 'manual',
    icon: '\u270D\ufe0f',
    tint: TINTS.rose,
    label: 'Added by hand',
    // ONEOFF-01: no writer INSERTS this source any more — POST is gone. The two
    // citations are the correction and the removal of a row that already exists.
    writtenBy: 'src/app/api/calendar/events/route.ts:107 (PATCH) · :134 (DELETE) — no POST since ONEOFF-01',
    why: 'an event the person entered by hand before ONEOFF-01 — food, the gym, a haircut. No new rows since ONEOFF-01; existing rows render and remain editable. A one-off is a routine planned in Tasks now, and it logs here like every other routine',
  },
  {
    source: 'trip',
    icon: '✈️',
    tint: TINTS.cyan,
    label: 'Trips',
    writtenBy: 'src/app/api/trips/[id]/commit/route.ts:187 · src/app/api/trips/[id]/vendor-commit/route.ts:425',
    why: 'the trip itself and every committed flight, hotel, transfer and activity — the only source that carries a time of day and coordinates',
  },
  {
    source: 'agenda',
    icon: '📋',
    tint: TINTS.violet,
    label: 'Agenda',
    writtenBy: 'src/app/api/agenda/[id]/route.ts:84',
    why: 'a committed agenda item with its own date, budget and account — written since the agenda commit shipped and, until this PR, never rendered anywhere',
  },
  {
    source: 'home',
    icon: '🏠',
    tint: TINTS.orange,
    label: 'Home',
    writtenBy: 'src/app/api/home/[id]/route.ts:83',
    why: 'a household bill falling on this date — rent, utilities, the recurring ones',
  },
  {
    source: 'shopping',
    icon: '🛒',
    tint: TINTS.pink,
    label: 'Shopping',
    writtenBy: 'src/app/api/shopping/[id]/route.ts:83 · src/app/api/shopping/commit/route.ts:84',
    why: 'a purchase planned for this date',
  },
  {
    source: 'personal',
    icon: '👤',
    tint: TINTS.purple,
    label: 'Personal',
    writtenBy: 'src/app/api/budget/[module]/[id]/route.ts:104 (MODULE = personal)',
    why: 'a personal budget line dated to this day',
  },
  {
    source: 'auto',
    icon: '🚗',
    tint: TINTS.slate,
    label: 'Auto',
    writtenBy: 'src/app/api/budget/[module]/[id]/route.ts:104 (MODULE = auto)',
    why: 'a vehicle cost dated to this day',
  },
  {
    source: 'growth',
    icon: '📚',
    tint: TINTS.blue,
    label: 'Growth',
    writtenBy: 'src/app/api/budget/[module]/[id]/route.ts:104 (MODULE = growth)',
    why: 'a learning or growth cost dated to this day',
  },
  {
    source: 'health',
    icon: '💪',
    tint: TINTS.green,
    label: 'Health',
    writtenBy: 'src/app/api/budget/[module]/[id]/route.ts:104 (MODULE = health)',
    why: 'a health cost dated to this day',
  },
  {
    // CAL-01 (2026-09-23): a PAID BOOKING, and deliberately NOT `trip`.
    //
    // `trip` is what a person PLANNED — vendor-commit writes it when an option is
    // committed to an itinerary. This is what they PAID FOR: a reservation that
    // exists at the provider and has been charged. The two must be told apart by
    // this column alone, because the deferred budget retro-map will query on
    // (source, source_id) to find the bookings it has to map, and a planned item
    // is not a booking. source_id is the reservation id.
    source: 'reservation',
    icon: '🏨',
    tint: TINTS.amber,
    label: 'Bookings',
    writtenBy: 'src/lib/calendar/prismaBookingCalendar.ts:34, from src/app/api/travel/liteapi/book/route.ts:256 (stays) · src/app/api/travel/liteapi/flights/book/route.ts:257 (flights — writes no row, see CAL-01)',
    why: 'a room you have paid for, on the days you are in it — written when the booking is confirmed and the money has moved, not when a trip was planned. A flight booking writes nothing here: its landed payload carries no date of travel, so it has no day to sit on',
  },
] as const;

/** A source NOT rendered from calendar_events, named, with the reason. */
export interface ExcludedCalendarSource {
  readonly source: string;
  readonly why: string;
}

/**
 * EXCLUDED BY NAME. These two arrive on the grid already — they are merged from
 * their OWN loaders in HubCalendar, not from calendar_events — so admitting them
 * to this allowlist would double every block on the day.
 */
export const EXCLUDED_CALENDAR_SOURCES: readonly ExcludedCalendarSource[] = [
  {
    source: 'project',
    why: 'not a calendar_events row — daily-plan blocks arrive through mapOperationsBlocks from /api/operations/daily-plan/items and are merged separately; admitting it here would draw each block twice',
  },
  {
    source: 'routines',
    why: 'not a calendar_events row — routine occurrences arrive through mapOperationsRoutines from /api/hub/operations-routines and are merged separately; admitting it here would draw each occurrence twice',
  },
] as const;

/** The set the filter uses — built from the list above, never retyped. */
const RENDERED = new Set(CALENDAR_SOURCES.map((s) => s.source));

/** Does the calendar render a calendar_events row with this source? */
export function isRenderedCalendarSource(source: string | null | undefined): boolean {
  return source != null && RENDERED.has(source);
}

/**
 * EVENT-01 — what a hand-entered event records. The one value that route writes.
 * Named here, beside the allowlist, so the writer and the reader cannot drift.
 */
export const MANUAL_EVENT_SOURCE = 'manual';

/** Is this row one the person entered themselves? DISPLAY and EDITABILITY only. */
export function isManualEvent(source: string | null | undefined): boolean {
  return source === MANUAL_EVENT_SOURCE;
}

/** The word a surface shows next to a hand-entered event — TRADE-LOG-01's own. */
export const MANUAL_EVENT_BADGE = 'hand-entered';

/** The day the allowlist was set, with the census behind it. */
export const CALENDAR_SOURCES_SET_ON = '2026-09-16';

export class CalendarSourcesLawError extends Error {
  constructor(message: string) {
    super(`CALENDAR SOURCES LAW: ${message}`);
    this.name = 'CalendarSourcesLawError';
  }
}

/**
 * The law over the list, run at module scope and again at build: every entry
 * carries a source, a label, its writer's citation and a reason; no source is
 * both rendered and excluded; nothing is named twice.
 */
export function calendarSourcesLaw(
  rendered: readonly CalendarSourceRule[] = CALENDAR_SOURCES,
  excluded: readonly ExcludedCalendarSource[] = EXCLUDED_CALENDAR_SOURCES,
): void {
  const seen = new Set<string>();
  for (const r of rendered) {
    if (!r.source) throw new CalendarSourcesLawError('an entry with no source');
    if (seen.has(r.source)) throw new CalendarSourcesLawError(`${r.source} is named twice`);
    seen.add(r.source);
    if (!r.label) throw new CalendarSourcesLawError(`${r.source} has no legend label`);
    if (!r.why) throw new CalendarSourcesLawError(`${r.source} carries no reason — a source renders because someone said why`);
    if (!/:\d+/.test(r.writtenBy)) throw new CalendarSourcesLawError(`${r.source} cites no writer at file:line — the list is derived from the census, not guessed`);
  }
  for (const e of excluded) {
    if (!e.why) throw new CalendarSourcesLawError(`${e.source} is excluded with no reason — exclusion is a decision, not an omission`);
    if (seen.has(e.source)) throw new CalendarSourcesLawError(`${e.source} is both rendered and excluded`);
  }
}

calendarSourcesLaw();
