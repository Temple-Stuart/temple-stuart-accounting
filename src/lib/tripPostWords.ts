/**
 * TRIPPOST-01 (Alex, 2026-11-05) — THE WORDS a stop's page and its card are shown in. PURE: no
 * clock, no locale call, no fetch, no React. It takes the stop's row, its costs and its post as
 * arguments and never looks one up. It imports the leaves with `import type` ONLY — so the
 * landing (a client component) can import this file without pulling a post body into its
 * JavaScript. The dates come from the one date module (src/lib/experienceWords.ts), the stay and
 * the stop number from src/lib/wasHereWords.ts, every dollar figure from the one money formatter
 * (src/lib/books/functionalCurrency.ts functionalMoneyWords — integer cents in, "$708.14" out).
 *
 * TRIPCARDS-01 (Alex, 2026-11-05): every stop has a page, and its card is the stop and what it
 * cost — the stay, the motorbike, the flight in, from src/lib/tripCosts.ts.
 *
 *   tripPostHref(id)              "/my-trip/canggu-2026-07" — the stop's page
 *   stopNumber(rows, id)          the row's place in tripOrder, 1-based
 *   postEyebrow(n)                "My trip · Stop 1"
 *   stopHeading(row)              "Canggu, Bali, Indonesia" — the page's h1 while the stop is not
 *                                 written up (a written one's h1 is its post's title)
 *   postMeta(row)                 ["Canggu, Bali, Indonesia", "Jul 1–30, 2026"]
 *   stopCostRows(costs)           Stay · Motorbike · Flight in: the name and the amount — a stop
 *                                 with none says NOT_APPLICABLE, one not in his log NOT_IN_LOG,
 *                                 never $0 — and, beside the words, the line's own kind (paid ·
 *                                 none · unknown), which the card paints by (TRIPCARDS-03)
 *   costRows(costs, post)         the stop's three, then the post's own costs, in order
 *   unwrittenLine(row)            a stop not written up says so: booked ahead ("Coming up …")
 *                                 or lived and not yet written
 *   dayLabel(date)                "Wed Jul 1"
 *   weekEyebrow(n, week)          "Week 1 · Jul 1–7, 2026"
 *   weekCount(week)               "7 days" · "1 day"
 *   chipLabel(kind)               "Brunch" · "Dinner" · "Activity" · "Entertainment"
 *   bookLine(row)                 "Going to Canggu, Bali? Book the stay and the flight here."
 *   writtenLine(post)             "Written Nov 5, 2026"
 */

import type { WasHereRow } from './wasHere';
import type { TripCostLine, TripCosts } from './tripCosts';
import type { TripPost, TripPostChipKind, TripPostWeek } from './tripPosts';
import { dateWords, dayWords, shortDayWords, weekdayWords } from './experienceWords';
import { stayWords, stopWords, tripOrder } from './wasHereWords';
import { functionalMoneyWords } from './books/functionalCurrency';

export class TripPostWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripPostWordsError';
  }
}

/** Where every stop's page lives: src/app/my-trip/[id]/page.tsx. */
export const TRIP_POST_BASE = '/my-trip';
/** A cost whose amount is not in Alex's log says so — never $0, never a guess. */
export const NOT_IN_LOG = 'not in my log yet';
/** A cost he never had ("n/a" in his sheet — no motorbike: he took Grab). */
export const NOT_APPLICABLE = 'n/a';
/** The three a stop's costs name, in Alex's order (2026-11-05): the stay, the motorbike, the flight in. */
export const STOP_COST_LABELS = { stay: 'Stay', moto: 'Motorbike', flightIn: 'Flight in' } as const;
/** Under a page's costs when the stop has no post yet. */
export const UNWRITTEN_COST_NOTE = 'These are the stay, the motorbike and the flight in. The rest of what I spent isn’t in my log yet.';

export function tripPostHref(stopId: string): string {
  return `${TRIP_POST_BASE}/${stopId}`;
}

/** The stop's number in the trip — its place in tripOrder, 1-based; a stop that is not in the log is refused by name. */
export function stopNumber(rows: readonly WasHereRow[], stopId: string): number {
  const index = tripOrder(rows).findIndex((r) => r.id === stopId);
  if (index === -1) throw new TripPostWordsError(`"${stopId}" is not a stop in the trip log`);
  return index + 1;
}

export function postEyebrow(n: number): string {
  return `My trip · ${stopWords(n)}`;
}

/** The place, as the page's heading for a stop not written up yet. */
export function stopHeading(row: WasHereRow): string {
  return `${row.city}, ${row.country}`;
}

export function postMeta(row: WasHereRow): [string, string] {
  return [stopHeading(row), stayWords(row)];
}

export interface CostRowWords {
  what: string;
  /** The stay, the rental or the airline — empty when the stop had none or the log has no figure. */
  detail: string;
  amount: string;
  /**
   * TRIPCARDS-03 (Alex's brief, 2026-11-12): what kind of line the words came from — paid, none or unknown — carried BESIDE
   * them, so the card paints an amount by its line's kind (paid in gold; none and unknown muted) and never reads the kind back
   * out of the words. A stop's own three carry their line's kind; a post's own cost is paid, or unknown while its amountCents
   * is null (not in the log). The stop's page reads what, detail and amount only.
   */
  kind: TripCostLine['kind'];
}

function costLineWords(what: string, line: TripCostLine): CostRowWords {
  switch (line.kind) {
    case 'paid': return { what, detail: line.name, amount: functionalMoneyWords(line.amountCents), kind: line.kind };
    case 'none': return { what, detail: '', amount: NOT_APPLICABLE, kind: line.kind };
    case 'unknown': return { what, detail: '', amount: NOT_IN_LOG, kind: line.kind };
  }
}

/** The stop's own three, in Alex's order: the stay, the motorbike, the flight in. */
export function stopCostRows(costs: TripCosts): CostRowWords[] {
  return [
    costLineWords(STOP_COST_LABELS.stay, costs.stay),
    costLineWords(STOP_COST_LABELS.moto, costs.moto),
    costLineWords(STOP_COST_LABELS.flightIn, costs.flightIn),
  ];
}

/** The stop's three, then — when the stop is written up — the post's own costs, in order. */
export function costRows(costs: TripCosts, post: TripPost | null): CostRowWords[] {
  const own = post === null ? [] : post.costs.map((c): CostRowWords => (c.amountCents === null
    ? { what: c.what, detail: c.detail, amount: NOT_IN_LOG, kind: 'unknown' }
    : { what: c.what, detail: c.detail, amount: functionalMoneyWords(c.amountCents), kind: 'paid' }));
  return [...stopCostRows(costs), ...own];
}

/** A stop not written up says which it is: booked ahead (its start after the day it was entered — "stayed", since he may have visited on a day trip; TRIPPHOTO-08), or lived and not yet written. */
export function unwrittenLine(row: WasHereRow): string {
  return row.start > row.writtenOn
    ? `Coming up — booked as of ${dayWords(row.writtenOn)}. I haven’t stayed here yet.`
    : 'I haven’t written this stop up yet.';
}

export function dayLabel(date: string): string {
  return `${weekdayWords(date)} ${shortDayWords(date)}`;
}

export function weekEyebrow(n: number, week: TripPostWeek): string {
  if (week.days.length === 0) throw new TripPostWordsError(`week ${n} has no days`);
  return `Week ${n} · ${dateWords(week.days[0].date, week.days[week.days.length - 1].date)}`;
}

export function weekCount(week: TripPostWeek): string {
  return week.days.length === 1 ? '1 day' : `${week.days.length} days`;
}

const CHIP_LABELS: Readonly<Record<TripPostChipKind, string>> = {
  brunch: 'Brunch',
  dinner: 'Dinner',
  activity: 'Activity',
  entertainment: 'Entertainment',
};

export function chipLabel(kind: TripPostChipKind): string {
  return CHIP_LABELS[kind];
}

export function bookLine(row: WasHereRow): string {
  return `Going to ${row.city}? Book the stay and the flight here.`;
}

export function writtenLine(post: TripPost): string {
  return `Written ${dayWords(post.writtenOn)}`;
}
