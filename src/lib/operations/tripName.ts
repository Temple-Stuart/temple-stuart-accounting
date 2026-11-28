/**
 * tripName — THE TRIP NAME, READ AS A TRIP (SHEET-01, Alex, 2026-11-28). PURE: no request, no clock, no Prisma.
 *
 * His sheet names each row's trip in its Trip Name column — the place, then the trip's dates in parentheses: "Pine Cove, Lake
 * District, Norland (April 2 - 6, 2028)". A trip is a STAY (src/lib/operations/stay.ts): a place from a first day to a last day,
 * both inclusive, and one user's stays never share a day. The paste (pasteRows.ts readPaste) hands the distinct names in; here:
 *   · readTripName — one name: the place by stay.ts stayInput's own place rule, and its two days, in three shapes. Refused by name;
 *     nothing is guessed ("???" is no day).
 *   · tripsOf — the distinct names in order: the trips read and the names refused. THE SHARED DAY: his sheet puts a travel day's
 *     rows under the trip that BEGINS on it, and two stays may not share a day — so a trip longer than one day ends the day before
 *     when another trip begins on its last day.
 *   · tripAddsOf — each trip against the stays that stand: it stands, it meets a stay (or a trip of this paste added before it),
 *     or it is added.
 *   · the words. The leaf (ledger/PasteRows.tsx) shows them; the save (pasteSave.ts runPaste) writes the added ones first.
 */
import { isIsoDay } from '@/lib/budget/days';
import { overlapWords, overlaps, stayInput, type StayRow } from '@/lib/operations/stay';

// ── 1 · ONE NAME ────────────────────────────────────────────────────────────

/** A trip read: its place and its two days ('YYYY-MM-DD', both inclusive), and the name it was read from. */
export interface Trip {
  readonly name: string;
  readonly place: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export type TripNameRead = { readonly ok: true; readonly place: string; readonly startsOn: string; readonly endsOn: string } | { readonly ok: false; readonly why: string };

export const TRIP_NO_DATES_WORDS = 'no dates in parentheses after the place';
export const tripDatesWords = (dates: string): string => `${JSON.stringify(dates)} is not "Month D - Month D, YYYY"`;
export const tripMonthWords = (word: string): string => `${JSON.stringify(word)} is not a month`;
export const tripDayWords = (day: string): string => `${day} is not a day`;
export const tripBackwardsWords = (startsOn: string, endsOn: string): string => `its last day ${endsOn} is before its first ${startsOn}`;

/** The months by their full English names, in order. */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const;
/** A month's number (1–12) by its full name, any case — or null. */
const monthOf = (word: string): number | null => {
  const at = MONTHS.indexOf(word.toLowerCase() as (typeof MONTHS)[number]);
  return at < 0 ? null : at + 1;
};
const isoOf = (year: number, month: number, day: number): string => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** The text cleaned: trimmed, runs of spaces one. */
const cleanOf = (text: string): string => text.trim().replace(/\s+/g, ' ');
/** The place and the dates: the text before the LAST " (", and what stands inside the closing parenthesis that ends the text. */
const splitOf = (text: string): { readonly place: string; readonly dates: string } | null => {
  const open = text.lastIndexOf(' (');
  if (open < 0 || !text.endsWith(')')) return null;
  return { place: text.slice(0, open), dates: text.slice(open + 2, -1) };
};
/** The first day as "Month D" or "Month D, YYYY"; the last as "D, YYYY" or "Month D, YYYY". The dash between, spaces around it optional. */
const FIRST_RE = /^([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?$/;
const LAST_RE = /^(?:([A-Za-z]+) )?(\d{1,2}), (\d{4})$/;

/**
 * ONE NAME, READ. Three shapes: "Month D - D, YYYY", "Month D - Month D, YYYY", "Month D, YYYY - Month D, YYYY". A first day with no
 * year takes the last day's year — or the year before, when its month comes after the last day's. Each day is a real day (days.ts
 * isIsoDay) and the last is on or after the first. Then the place, by stay.ts stayInput's own place rule (its message, prefixed "the
 * place — "). The first refusal is the answer.
 */
export function readTripName(text: string): TripNameRead {
  const split = splitOf(cleanOf(text));
  if (split === null) return { ok: false, why: TRIP_NO_DATES_WORDS };
  const halves = split.dates.split(/ ?- ?/);
  const first = halves.length === 2 ? FIRST_RE.exec(halves[0]) : null;
  const last = halves.length === 2 ? LAST_RE.exec(halves[1]) : null;
  // The three shapes, and no fourth: a first day with its own year needs a last day with its own month.
  if (first === null || last === null || (first[3] !== undefined && last[1] === undefined)) return { ok: false, why: tripDatesWords(split.dates) };
  const firstMonth = monthOf(first[1]);
  if (firstMonth === null) return { ok: false, why: tripMonthWords(first[1]) };
  const lastMonth = last[1] === undefined ? firstMonth : monthOf(last[1]);
  if (lastMonth === null) return { ok: false, why: tripMonthWords(last[1]) };
  const lastYear = Number(last[3]);
  const firstYear = first[3] !== undefined ? Number(first[3]) : firstMonth > lastMonth ? lastYear - 1 : lastYear;
  const startsOn = isoOf(firstYear, firstMonth, Number(first[2]));
  if (!isIsoDay(startsOn)) return { ok: false, why: tripDayWords(startsOn) };
  const endsOn = isoOf(lastYear, lastMonth, Number(last[2]));
  if (!isIsoDay(endsOn)) return { ok: false, why: tripDayWords(endsOn) };
  if (endsOn < startsOn) return { ok: false, why: tripBackwardsWords(startsOn, endsOn) };
  const stay = stayInput({ place: split.place, starts_on: startsOn, ends_on: endsOn });
  if (!stay.ok) {
    if (stay.field !== 'place') throw new Error(`tripName: stay.ts refused ${stay.field} of two days read whole — ${stay.message}`);
    return { ok: false, why: `the place — ${stay.message}` };
  }
  return { ok: true, place: stay.value.place, startsOn, endsOn };
}

/** A refused name's first day, when it reads alone — "Month D, YYYY" before the dash — or null. Its last day is not read. */
function firstDayOf(name: string): string | null {
  const split = splitOf(cleanOf(name));
  if (split === null) return null;
  const head = /^([A-Za-z]+) (\d{1,2}), (\d{4}) ?-/.exec(split.dates);
  if (head === null) return null;
  const month = monthOf(head[1]);
  if (month === null) return null;
  const day = isoOf(Number(head[3]), month, Number(head[2]));
  return isIsoDay(day) ? day : null;
}

// ── 2 · THE PASTE'S NAMES ───────────────────────────────────────────────────

/** A name not read as a trip, and why. */
export interface TripRefused {
  readonly name: string;
  readonly why: string;
}

const DAY_MS = 86_400_000;
const dayBefore = (day: string): string => new Date(Date.parse(`${day}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);

/**
 * THE PASTE'S TRIPS — over the distinct names, in order: each read, or refused with its reason. THE SHARED DAY: a trip longer than one
 * day ends the day before when another trip begins on its last day — another trip read, or a refused name whose first day reads.
 * A one-day trip keeps its day.
 */
export function tripsOf(names: readonly string[]): { readonly trips: readonly Trip[]; readonly refused: readonly TripRefused[] } {
  const distinct = names.filter((name, i) => names.indexOf(name) === i);
  const read: Trip[] = [];
  const refused: TripRefused[] = [];
  for (const name of distinct) {
    const trip = readTripName(name);
    if (trip.ok) read.push({ name, place: trip.place, startsOn: trip.startsOn, endsOn: trip.endsOn });
    else refused.push({ name, why: trip.why });
  }
  const begins = [...read.map((t) => ({ name: t.name, day: t.startsOn })), ...refused.flatMap((r) => { const day = firstDayOf(r.name); return day === null ? [] : [{ name: r.name, day }]; })];
  const trips = read.map((t) => (t.startsOn < t.endsOn && begins.some((b) => b.name !== t.name && b.day === t.endsOn) ? { ...t, endsOn: dayBefore(t.endsOn) } : t));
  return { trips, refused };
}

// ── 3 · AGAINST THE STAYS THAT STAND ────────────────────────────────────────

/** A trip against what stands: added; standing already (a stay of that place, that first day and that last day); or meeting a stay, or a trip of this paste added before it — said, and not written. */
export type TripAdd =
  | { readonly kind: 'add'; readonly trip: Trip }
  | { readonly kind: 'stands'; readonly trip: Trip }
  | { readonly kind: 'meets'; readonly trip: Trip; readonly words: string };

export const pasteTripMeetsWords = (trip: Trip, other: Trip): string => `${trip.startsOn} to ${trip.endsOn} meets the trip "${other.place}" of this paste (${other.startsOn} to ${other.endsOn})`;

/** One entry a trip, in the trips' order. */
export function tripAddsOf(trips: readonly Trip[], stays: readonly StayRow[]): TripAdd[] {
  const added: Trip[] = [];
  return trips.map((trip): TripAdd => {
    const span = { startsOn: trip.startsOn, endsOn: trip.endsOn };
    if (stays.some((s) => s.place === trip.place && s.starts_on === trip.startsOn && s.ends_on === trip.endsOn)) return { kind: 'stands', trip };
    const stay = stays.find((s) => overlaps({ startsOn: s.starts_on, endsOn: s.ends_on }, span));
    if (stay !== undefined) return { kind: 'meets', trip, words: overlapWords(span, stay) };
    const earlier = added.find((a) => overlaps(a, span));
    if (earlier !== undefined) return { kind: 'meets', trip, words: pasteTripMeetsWords(trip, earlier) };
    added.push(trip);
    return { kind: 'add', trip };
  });
}

// ── 4 · THE WORDS ───────────────────────────────────────────────────────────

export const PASTE_TRIPS_WORDS = 'adds these trips — the place of every row on their days:';
export const tripWords = (trip: Pick<Trip, 'place' | 'startsOn' | 'endsOn'>): string => `${trip.place} · ${trip.startsOn} → ${trip.endsOn}`;
export const tripAddWords = (entry: TripAdd): string =>
  entry.kind === 'add' ? tripWords(entry.trip) : entry.kind === 'stands' ? `${tripWords(entry.trip)} — already a trip` : `${tripWords(entry.trip)} — not written: ${entry.words}`;
export const tripRefusedWords = (refused: TripRefused): string => `Trip Name ${JSON.stringify(refused.name)} — not read as a trip: ${refused.why}`;
