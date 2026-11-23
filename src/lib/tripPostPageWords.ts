/**
 * TRIPPOST-02 (Alex, 2026-11-23) — THE NEW WORDS of a stop's page, each typed ONCE, here (ruling f): the handoff's New words table
 * (design-refs/trippost-02/README.md). Every word already on the page is read from the home that README's Words table names
 * (src/lib/tripPostWords.ts, wasHereWords.ts, experienceWords.ts, footerWords.ts, the post and the stop themselves), and the page's
 * JSX types none. PURE: no clock, no locale call, no fetch, no React. It takes the figures (src/lib/tripFigures.ts) and the leaves'
 * rows as arguments and never looks one up; every amount is printed by the one money formatter (functionalMoneyWords).
 *
 * Source ↗ is the events band's own word (SOURCE_LINK, src/components/landing/ExperiencesSection.tsx). That file is a client
 * module, whose exports reach a server component as references, never strings, so the word is copied here once; the test holds
 * the two equal.
 *
 *   stopCountWords(n, stops)       "Stop 1 of 10"
 *   tileWords(row, figures)        the four figures: their labels, each value (a number, or why not in words) and its sum
 *   fixedNoteWords(figures)        "stay + motorbike + flight in" · "stay + flight in · motorbike not in my log yet"
 *   totalLabel(figures)            "Fixed bookings total" · "Fixed bookings in my log"
 *   stayDetailWords · motoDetailWords  "29 nights" · "27 days · Jul 3–30, 2026"
 *   shareNoteWords · splitBarWords · splitRows  the day's share: how it was worked out, the bar's words, each line's sum
 *   routineKeyWords · routineBarWords  "Activity · 2h" · "A day in 24 hours: activity 2 hours, …"
 *   numberedEyebrow(n, words)      "01 / The experience"
 *   dayOfWords(n, days)            "Day 1 of 30"
 *   pagerBeforeWords · pagerAfterWords  "← Stop 0" · "Stop 2 →"
 *   stopsAround(rows, stopId)      the stop before and the stop after, from the footer's own list (ruling d)
 *   eventKindWords(event)          the event block's first line: its category, and its series where it has one
 */

import type { WasHereRow } from './wasHere';
import type { TripMotoDays } from './tripCosts';
import type { TripPostRoutineKind } from './tripPosts';
import type { LineFigure, StopFigures } from './tripFigures';
import { experienceCategoryLabel, type Experience } from './experiences';
import { dateWords } from './experienceWords';
import { stayWords, stopWords } from './wasHereWords';
import { NOT_APPLICABLE, NOT_IN_LOG, STOP_COST_LABELS, tripPostHref } from './tripPostWords';
import { footerStoryLinks, storyLinkParts } from './footerWords';
import { functionalMoneyWords } from './books/functionalCurrency';

export class TripPostPageWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripPostPageWordsError';
  }
}

/** Between two parts of one line. */
export const JOIN = ' · ';

// ── THE CRUMB ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "Stop 1 of 10": the stop's number, by stopWords, of the stops in the log. */
export function stopCountWords(n: number, stops: number): string {
  return `${stopWords(n)} of ${stops}`;
}

// ── THE FOUR FIGURES ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export const TILE_LABELS = { duration: 'Duration', stay: 'Stay / night', moto: 'Motorbike / day', fixed: 'Fixed bookings' } as const;

export function nightsUnit(n: number): string {
  return n === 1 ? 'night' : 'nights';
}

/** "29 nights" · "1 night". */
export function nightsWords(n: number): string {
  return `${n} ${nightsUnit(n)}`;
}

export function daysUnit(n: number): string {
  return n === 1 ? 'day' : 'days';
}

/** "27 days" · "1 day". */
export function daysWords(n: number): string {
  return `${n} ${daysUnit(n)}`;
}

/** A rate's sum: "$708.14 ÷ 29 nights" · "$131.79 ÷ 27 days". */
export function spreadWords(amountCents: number, over: number, per: 'nights' | 'days'): string {
  return `${functionalMoneyWords(amountCents)} ÷ ${per === 'nights' ? nightsWords(over) : daysWords(over)}`;
}

/** A paid amount with nothing yet to spread it across: "$63.53 total". */
export function totalWords(amountCents: number): string {
  return `${functionalMoneyWords(amountCents)} total`;
}

/** A tile's value: a figure (a count with its unit, or an amount), or, where the figure cannot be worked out, why — in words. */
export type TileValue = { kind: 'figure'; text: string; unit: string | null } | { kind: 'words'; text: string };

export interface TileWords {
  label: string;
  value: TileValue;
  /** The sum it came from — null where there is none to show. */
  note: string | null;
}

/** The three lines of a stop, in the costs' own order, with their labels and what each is spread across. */
const LINES = [
  { key: 'stay', label: STOP_COST_LABELS.stay, per: 'nights' },
  { key: 'moto', label: STOP_COST_LABELS.moto, per: 'days' },
  { key: 'flightIn', label: STOP_COST_LABELS.flightIn, per: 'nights' },
] as const;

/** The costs' labels in small letters: stay · motorbike · flight in. */
const small = (label: string): string => label.toLowerCase();

function rateTile(label: string, line: LineFigure, per: 'nights' | 'days'): TileWords {
  switch (line.kind) {
    case 'none': return { label, value: { kind: 'words', text: NOT_APPLICABLE }, note: null };
    case 'unknown': return { label, value: { kind: 'words', text: NOT_IN_LOG }, note: null };
    case 'paid': return line.spread === null
      ? { label, value: { kind: 'words', text: NOT_IN_LOG }, note: totalWords(line.amountCents) }
      : { label, value: { kind: 'figure', text: functionalMoneyWords(line.spread.rateCents), unit: null }, note: spreadWords(line.amountCents, line.spread.over, per) };
  }
}

/** What the fixed bookings hold: the lines paid, then the lines not in his log, named. A line he never had is in neither. */
export function fixedNoteWords(figures: StopFigures): string {
  const paid = LINES.filter((l) => figures[l.key].kind === 'paid').map((l) => small(l.label));
  const missing = LINES.filter((l) => figures[l.key].kind === 'unknown').map((l) => small(l.label));
  const parts: string[] = [];
  if (paid.length > 0) parts.push(paid.join(' + '));
  if (missing.length > 0) parts.push(`${missing.join(', ')} ${NOT_IN_LOG}`);
  return parts.join(JOIN);
}

/** The four figures — how long, the stay a night, the motorbike a day, the fixed bookings — each with its sum. */
export function tileWords(row: WasHereRow, figures: StopFigures): TileWords[] {
  const duration: TileWords = figures.nights === null
    ? { label: TILE_LABELS.duration, value: { kind: 'words', text: NOT_IN_LOG }, note: stayWords(row) }
    : { label: TILE_LABELS.duration, value: { kind: 'figure', text: String(figures.nights), unit: nightsUnit(figures.nights) }, note: stayWords(row) };
  const note = fixedNoteWords(figures);
  const everyNone = LINES.every((l) => figures[l.key].kind === 'none');
  const fixed: TileWords = figures.fixedCents === null
    ? { label: TILE_LABELS.fixed, value: { kind: 'words', text: everyNone ? NOT_APPLICABLE : NOT_IN_LOG }, note: note === '' ? null : note }
    : { label: TILE_LABELS.fixed, value: { kind: 'figure', text: functionalMoneyWords(figures.fixedCents), unit: null }, note };
  return [duration, rateTile(TILE_LABELS.stay, figures.stay, 'nights'), rateTile(TILE_LABELS.moto, figures.moto, 'days'), fixed];
}

// ── WHAT IT COST ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const BREAKDOWN_LABEL = 'Booking breakdown';
export const TOTAL_LABEL = 'Fixed bookings total';
export const TOTAL_IN_LOG_LABEL = 'Fixed bookings in my log';
export const TOTAL_NOTE = 'Excludes meals, activities and other spending';
export const ALSO_IN_LOG = 'Also in my log';

/** The breakdown's total: "Fixed bookings total" — "Fixed bookings in my log" while a line is not in his log. */
export function totalLabel(figures: StopFigures): string {
  return LINES.some((l) => figures[l.key].kind === 'unknown') ? TOTAL_IN_LOG_LABEL : TOTAL_LABEL;
}

/** The fixed bookings in the breakdown's total: the amount — or, where no line is paid, why not, in words. */
export function totalAmountWords(figures: StopFigures): string {
  if (figures.fixedCents !== null) return functionalMoneyWords(figures.fixedCents);
  return LINES.every((l) => figures[l.key].kind === 'none') ? NOT_APPLICABLE : NOT_IN_LOG;
}

/** The stay's own line in the breakdown: "29 nights" — null where the stay is not paid or has no end yet. */
export function stayDetailWords(figures: StopFigures): string | null {
  return figures.stay.kind === 'paid' && figures.nights !== null ? nightsWords(figures.nights) : null;
}

/** The rental's own line in the breakdown: "27 days · Jul 3–30, 2026" — null where his log holds no days for it. */
export function motoDetailWords(figures: StopFigures, motoDays: TripMotoDays | null): string | null {
  return figures.moto.kind === 'paid' && figures.motoDays !== null && motoDays !== null ? `${daysWords(figures.motoDays)}${JOIN}${dateWords(motoDays.from, motoDays.to)}` : null;
}

export const SHARE_LABEL = 'Daily cost allocation';
export const PER_DAY = '/ day';
export const REST_LABEL = 'The rest';

/** The section's line where a day's share is drawn. */
export const COSTS_INTRO_SHARED = 'Verified booking figures from the travel log. Shared costs are allocated by stay duration; unrecorded daily expenses are not assumed to be zero.';
/** The section's line where it is not. */
export const COSTS_INTRO = 'Verified booking figures from the travel log. Unrecorded daily expenses are not assumed to be zero.';

/** How a day's share was worked out: "Fixed bookings normalized over the 29-night stay; motorbike over its 27 rental days." — no motorbike clause where there is none. */
export function shareNoteWords(figures: StopFigures): string {
  if (figures.nights === null) throw new TripPostPageWordsError('shareNoteWords: a stay with no end has no day\'s share');
  const moto = figures.moto.kind === 'paid' && figures.moto.spread !== null ? `; motorbike over its ${figures.moto.spread.over} rental ${daysUnit(figures.moto.spread.over)}` : '';
  return `Fixed bookings normalized over the ${figures.nights}-night stay${moto}.`;
}

/** One line of the day's share: its key, its label, its sum and its rate. */
export interface SplitRow {
  key: 'stay' | 'moto' | 'flightIn';
  name: string;
  sum: string;
  rateCents: number;
  rate: string;
}

/** The day's share, line by line: every line paid, in the costs' order. */
export function splitRows(figures: StopFigures): SplitRow[] {
  const rows: SplitRow[] = [];
  for (const l of LINES) {
    const line = figures[l.key];
    if (line.kind !== 'paid') continue;
    if (line.spread === null) throw new TripPostPageWordsError(`splitRows: the ${small(l.label)} has no rate, so no day's share is drawn`);
    rows.push({ key: l.key, name: l.label, sum: spreadWords(line.amountCents, line.spread.over, l.per), rateCents: line.spread.rateCents, rate: functionalMoneyWords(line.spread.rateCents) });
  }
  return rows;
}

/** The day's bar, for a screen reader: "A day from the fixed bookings: stay $24.42, motorbike $4.88, flight in $28.87". */
export function splitBarWords(figures: StopFigures): string {
  return `A day from the fixed bookings: ${splitRows(figures).map((r) => `${small(r.name)} ${r.rate}`).join(', ')}`;
}

// ── THE SECTIONS ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The tabs' name for a screen reader. */
export const TABS_LABEL = 'On this page';

/** The seven sections a written-up stop can draw, in the page's order. */
export type PostSectionKey = 'story' | 'routine' | 'favorites' | 'costs' | 'journal' | 'learned' | 'on';

/** Each section's tab (also its name for a screen reader), its small heading and its heading. */
export const SECTION_WORDS: Readonly<Record<PostSectionKey, { tab: string; eyebrow: string; title: string }>> = {
  story: { tab: 'The story', eyebrow: 'The experience', title: 'The short version.' },
  routine: { tab: 'Daily routine', eyebrow: 'How I structure my day', title: '24 hours. Intentionally spent.' },
  favorites: { tab: 'My favorites', eyebrow: 'Experienced firsthand', title: 'Places worth returning to.' },
  costs: { tab: 'Real costs', eyebrow: 'Transparent spending', title: 'What it actually cost.' },
  journal: { tab: 'Daily journal', eyebrow: 'Day by day', title: 'The daily journal.' },
  learned: { tab: 'What I learned', eyebrow: 'What I would tell someone going', title: 'What I learned the hard way.' },
  on: { tab: 'What was on', eyebrow: 'While I was there', title: 'What was on while I was there.' },
};

/** A whole number as two digits: "01" — a section's number, a lesson's. */
export function twoDigits(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n > 99) throw new TripPostPageWordsError(`twoDigits: ${n} is not a whole number from 0 to 99`);
  return n < 10 ? `0${n}` : String(n);
}

/** A section's small heading with its number by its place: "01 / The experience". */
export function numberedEyebrow(n: number, words: string): string {
  return `${twoDigits(n)} / ${words}`;
}

export const ROUTINE_INTRO = 'The daily structure I aim for, rather than a claim that every day follows it perfectly.';
export const FAVORITES_INTRO = 'My favorite discoveries from the stop. Real vendors, personal impressions, and the experiences that stood out.';
export const JOURNAL_INTRO = 'Pick a day to see what happened, where I ate, and how the day actually unfolded.';

// ── THE DAY HE AIMS FOR ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const ROUTINE_KIND_LABELS: Readonly<Record<TripPostRoutineKind, string>> = {
  activity: 'Activity',
  meals: 'Meals',
  focus: 'Focus',
  entertainment: 'Entertainment',
  sleep: 'Sleep',
};

/** A key's entry: "Activity · 2h". */
export function routineKeyWords(kind: TripPostRoutineKind, hours: number): string {
  return `${ROUTINE_KIND_LABELS[kind]}${JOIN}${hours}h`;
}

/** The bar, for a screen reader: "A day in 24 hours: activity 2 hours, meals 2 hours, …" — each kind once, its hours summed. */
export function routineBarWords(totals: readonly { kind: TripPostRoutineKind; hours: number }[]): string {
  return `A day in 24 hours: ${totals.map((t) => `${small(ROUTINE_KIND_LABELS[t.kind])} ${t.hours} ${t.hours === 1 ? 'hour' : 'hours'}`).join(', ')}`;
}

// ── HIS FAVORITES, THE JOURNAL, WHAT HE LEARNED ────────────────────────────────────────────────────────────────────────────────

/** Opens that day in the journal. */
export const READ_THAT_DAY = 'Read that day →';

/** "Day 1 of 30": the open day's place among the post's days. */
export function dayOfWords(n: number, days: number): string {
  return `Day ${n} of ${days}`;
}

/** A day's seat in the calendar: its date's own two digits, "01". */
export function calendarDayWords(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new TripPostPageWordsError(`calendarDayWords: "${iso}" is not YYYY-MM-DD`);
  return iso.slice(8, 10);
}

export const EARLIER_DAY = 'Earlier day';
export const LATER_DAY = 'Later day';
export const TAKEAWAY_LABEL = 'The big takeaway';

// ── WHAT WAS ON, THE STOPS AROUND IT ───────────────────────────────────────────────────────────────────────────────────────────

/** An event's link to its source — the events band's own word, copied from SOURCE_LINK (see the header). */
export const SOURCE_WORD = 'Source ↗';

/** The event block's first line: its category, and its series where it has one ("Surf · WSL Championship Tour"). */
export function eventKindWords(event: Pick<Experience, 'category' | 'series'>): string {
  return event.series === null ? experienceCategoryLabel(event.category) : `${experienceCategoryLabel(event.category)}${JOIN}${event.series}`;
}

/** The two stops' name for a screen reader. */
export const PAGER_LABEL = 'More stops';

/** The stop before: "← Stop 0". */
export function pagerBeforeWords(stop: string): string {
  return `← ${stop}`;
}

/** The stop after: "Stop 2 →". */
export function pagerAfterWords(stop: string): string {
  return `${stop} →`;
}

/** A stop beside this one: its stop, its place, and where it opens. */
export interface StopAround {
  stop: string;
  place: string;
  href: string;
}

/**
 * The stop before and the stop after (ruling d), from the footer's own list, so the two never disagree: footerStoryLinks — Stop 0
 * first, then every stop in trip order — each split by storyLinkParts. This stop is the entry whose href is its page; before it is
 * the entry before, after it the entry after; the last stop has none after it. A stop the list does not hold is refused by name.
 */
export function stopsAround(rows: readonly WasHereRow[], stopId: string): { before: StopAround | null; after: StopAround | null } {
  const entries: StopAround[] = footerStoryLinks(rows).map((link) => ({ ...storyLinkParts(link.label), href: link.href }));
  const at = entries.findIndex((e) => e.href === tripPostHref(stopId));
  if (at === -1) throw new TripPostPageWordsError(`stopsAround: "${stopId}" is not in the footer's story list`);
  return { before: at > 0 ? entries[at - 1] : null, after: at < entries.length - 1 ? entries[at + 1] : null };
}
