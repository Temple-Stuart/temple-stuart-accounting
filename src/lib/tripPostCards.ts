/**
 * TRIPPOST-01 (Alex, 2026-11-05) — THE TRIP POST CARDS. What a stop's card on the guest
 * landing shows once Alex has written that stop up: the post's title and its one line
 * (TRIPCARDS-01: what a stop cost — stay, motorbike, flight in — moved to
 * src/lib/tripCosts.ts, a row for every stop). One entry per post, keyed by its WAS_HERE stop id
 * (src/lib/wasHere.ts). THIS FILE IS DATA AND PURE FUNCTIONS: no fetch, no env, no clock,
 * no React (the wasHere.ts rule). Zero imports: server- and client-safe.
 *
 * WHY A LEAF OF ITS OWN. The landing is a client component (Landing.tsx → WasHereSection.tsx).
 * It imports this leaf and never src/lib/tripPosts.ts, so no post body ships in the home
 * page's JavaScript. The post itself — the days, the lessons, the picks — lives in
 * tripPosts.ts and is read by the server page src/app/my-trip/[id]/page.tsx.
 *
 * THE SHAPE. Every entry is exactly { stopId, title, cardLine }:
 *   · stopId names a WAS_HERE row — the build checks it exists and that tripPosts.ts holds
 *     a post for every card and a card for every post;
 *   · title is the post's title (the page's h1 and the card's link); cardLine its one line
 *     on the card.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts). It refuses by
 * name: an empty or duplicate stopId; an entry whose keys are not exactly the three; an empty
 * title or cardLine.
 */

export interface TripPostCard {
  /** A WAS_HERE id. */
  stopId: string;
  title: string;
  cardLine: string;
}

/** The three keys every card carries, in the ruled order. */
export const TRIP_POST_CARD_FIELDS = ['stopId', 'title', 'cardLine'] as const;

export const TRIP_POST_CARDS: readonly TripPostCard[] = [
  { stopId: 'canggu-2026-07', title: 'Thirty days in Canggu with no plan.', cardLine: 'Every day of it: where I ate, what I did, what it cost, and what I’d do differently.' },
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
  for (const card of cards) {
    const who = nonEmpty(card.stopId) ? card.stopId : '(no stopId)';
    if (!nonEmpty(card.stopId)) violations.push(`${who}: empty stopId`);
    if (keysOf(card) !== wantKeys) violations.push(`${who}: keys are [${Object.keys(card).join(', ')}] — a card carries exactly the three ruled fields`);
    if (ids.has(card.stopId)) violations.push(`${who}: duplicate stopId`);
    ids.add(card.stopId);
    if (!nonEmpty(card.title)) violations.push(`${who}: empty title`);
    if (!nonEmpty(card.cardLine)) violations.push(`${who}: empty cardLine`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new TripPostCardsLawError(`TRIP POST CARDS LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

/** The card for a stop — or null when Alex has not written that stop up. */
export function cardOf(stopId: string): TripPostCard | null {
  return TRIP_POST_CARDS.find((c) => c.stopId === stopId) ?? null;
}

tripPostCardsLaw();
