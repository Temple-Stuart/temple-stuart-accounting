/**
 * TRIPPOST-01 (Alex, 2026-11-05) — THE WORDS a trip post and its card are shown in. PURE: no
 * clock, no locale call, no fetch, no React. It takes the stop's row, its card and its post as
 * arguments and never looks one up. It imports the two leaves with `import type` ONLY — so the
 * landing (a client component) can import this file without pulling a post body into its
 * JavaScript. The dates come from the one date module (src/lib/experienceWords.ts), the stay and
 * the stop number from src/lib/wasHereWords.ts, every dollar figure from the one money formatter
 * (src/lib/books/functionalCurrency.ts functionalMoneyWords — integer cents in, "$708.14" out).
 *
 *   tripPostHref(id)              "/my-trip/canggu-2026-07" — the post's page
 *   stopNumber(rows, id)          the row's place in tripOrder, 1-based
 *   postEyebrow(n)                "My trip · Stop 1"
 *   postMeta(row, card)           ["Canggu, Bali, Indonesia", "Jul 1–30, 2026", "Stayed at The Daun · $708.14"]
 *   stayLine(card)                "Stayed at The Daun · $708.14"
 *   costRows(row, card, post)     the stay first ("Where I stayed"), then each cost — a null
 *                                 amount says NOT_IN_LOG, never $0
 *   dayLabel(date)                "Wed Jul 1"
 *   weekEyebrow(n, week)          "Week 1 · Jul 1–7, 2026"
 *   weekCount(week)               "7 days" · "1 day"
 *   chipLabel(kind)               "Brunch" · "Dinner" · "Activity" · "Entertainment"
 *   bookLine(row)                 "Going to Canggu, Bali? Book the stay and the flight here."
 *   writtenLine(post)             "Written Nov 5, 2026"
 */

import type { WasHereRow } from './wasHere';
import type { TripPostCard } from './tripPostCards';
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

/** Where every post lives: src/app/my-trip/[id]/page.tsx. */
export const TRIP_POST_BASE = '/my-trip';
/** The first cost row's words — the stay the card carries. */
export const WHERE_I_STAYED = 'Where I stayed';
/** A cost whose amount is not in Alex's log says so — never $0, never a guess. */
export const NOT_IN_LOG = 'not in my log yet';

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

export function stayLine(card: TripPostCard): string {
  return `Stayed at ${card.stay.name} · ${functionalMoneyWords(card.stay.amountCents)}`;
}

export function postMeta(row: WasHereRow, card: TripPostCard): [string, string, string] {
  return [`${row.city}, ${row.country}`, stayWords(row), stayLine(card)];
}

export interface CostRowWords {
  what: string;
  detail: string;
  amount: string;
}

export function costRows(row: WasHereRow, card: TripPostCard, post: TripPost): CostRowWords[] {
  return [
    { what: WHERE_I_STAYED, detail: `${card.stay.name}, ${card.stay.area} · ${stayWords(row)}`, amount: functionalMoneyWords(card.stay.amountCents) },
    ...post.costs.map((c) => ({ what: c.what, detail: c.detail, amount: c.amountCents === null ? NOT_IN_LOG : functionalMoneyWords(c.amountCents) })),
  ];
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
