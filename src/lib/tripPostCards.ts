/**
 * TRIPPOST-01 (Alex, 2026-11-05) — THE TRIP POST CARDS. What a stop's card on the guest
 * landing shows once Alex has written that stop up: the post's title, its one line, and
 * where he stayed with what it cost. One entry per post, keyed by its WAS_HERE stop id
 * (src/lib/wasHere.ts). THIS FILE IS DATA AND PURE FUNCTIONS: no fetch, no env, no clock,
 * no React (the wasHere.ts rule). Zero imports: server- and client-safe.
 *
 * WHY A LEAF OF ITS OWN. The landing is a client component (Landing.tsx → WasHereSection.tsx).
 * It imports this leaf and never src/lib/tripPosts.ts, so no post body ships in the home
 * page's JavaScript. The post itself — the days, the lessons, the picks — lives in
 * tripPosts.ts and is read by the server page src/app/my-trip/[id]/page.tsx.
 *
 * THE SHAPE. Every entry is exactly { stopId, title, cardLine, stay }:
 *   · stopId names a WAS_HERE row — the build checks it exists and that tripPosts.ts holds
 *     a post for every card and a card for every post;
 *   · title is the post's title (the page's h1 and the card's link); cardLine its one line
 *     on the card;
 *   · stay is exactly { name, area, amountCents } — where he stayed and what it cost, in
 *     integer cents, printed by the one money formatter (src/lib/books/functionalCurrency.ts).
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts). It refuses by
 * name: an empty or duplicate stopId; an entry whose keys are not exactly the four; an empty
 * title or cardLine; a stay whose keys are not exactly the three; an empty stay name or area;
 * a stay amountCents that is not a positive safe integer.
 */

export interface TripPostStay {
  name: string;
  area: string;
  /** Integer cents. */
  amountCents: number;
}

export interface TripPostCard {
  /** A WAS_HERE id. */
  stopId: string;
  title: string;
  cardLine: string;
  stay: TripPostStay;
}

/** The four keys every card carries, in the ruled order. */
export const TRIP_POST_CARD_FIELDS = ['stopId', 'title', 'cardLine', 'stay'] as const;
/** The three keys of a stay. */
export const TRIP_POST_STAY_FIELDS = ['name', 'area', 'amountCents'] as const;

export const TRIP_POST_CARDS: readonly TripPostCard[] = [
  { stopId: 'canggu-2026-07', title: 'Thirty days in Canggu with no plan.', cardLine: 'Every day of it: where I ate, what I did, what it cost, and what I’d do differently.', stay: { name: 'The Daun', area: 'Canggu', amountCents: 70814 } },
];

export class TripPostCardsLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripPostCardsLawError';
  }
}

const keysOf = (value: object): string => Object.keys(value).sort().join(',');
const nonEmpty = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

/** THE LAW. Throws on failure by default; returns the violations list when asked not to throw. `cards` is injectable for tests. */
export function tripPostCardsLaw(opts: { throwOnFail?: boolean; cards?: readonly TripPostCard[] } = {}): string[] {
  const violations: string[] = [];
  const cards = opts.cards ?? TRIP_POST_CARDS;
  const ids = new Set<string>();
  const wantKeys = [...TRIP_POST_CARD_FIELDS].sort().join(',');
  const wantStayKeys = [...TRIP_POST_STAY_FIELDS].sort().join(',');
  for (const card of cards) {
    const who = nonEmpty(card.stopId) ? card.stopId : '(no stopId)';
    if (!nonEmpty(card.stopId)) violations.push(`${who}: empty stopId`);
    if (keysOf(card) !== wantKeys) violations.push(`${who}: keys are [${Object.keys(card).join(', ')}] — a card carries exactly the four ruled fields`);
    if (ids.has(card.stopId)) violations.push(`${who}: duplicate stopId`);
    ids.add(card.stopId);
    if (!nonEmpty(card.title)) violations.push(`${who}: empty title`);
    if (!nonEmpty(card.cardLine)) violations.push(`${who}: empty cardLine`);
    if (card.stay === null || typeof card.stay !== 'object') { violations.push(`${who}: stay is not an object`); continue; }
    if (keysOf(card.stay) !== wantStayKeys) violations.push(`${who}: stay keys are [${Object.keys(card.stay).join(', ')}] — a stay carries exactly name, area, amountCents`);
    if (!nonEmpty(card.stay.name)) violations.push(`${who}: empty stay name`);
    if (!nonEmpty(card.stay.area)) violations.push(`${who}: empty stay area`);
    const cents = card.stay.amountCents;
    if (typeof cents !== 'number' || !Number.isSafeInteger(cents) || cents <= 0) violations.push(`${who}: stay amountCents ${JSON.stringify(cents)} is not a positive whole number of cents`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new TripPostCardsLawError(`TRIP POST CARDS LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

/** The card for a stop — or null when Alex has not written that stop up. */
export function cardOf(stopId: string): TripPostCard | null {
  return TRIP_POST_CARDS.find((c) => c.stopId === stopId) ?? null;
}

tripPostCardsLaw();
