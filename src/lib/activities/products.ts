/**
 * products — ONE ACTIVITY, WHAT THE OPERATOR STATES (ACTIVITY-01, 2026-09-22).
 *
 * The vendor's POST /products/search answer is products[] (ProductSummary) with a
 * totalCount. The old client normalized each product with `|| 0` and `|| null`
 * (a 0 price collapsed, an unrated product became a 0 rating and was then
 * DROPPED by a hidden re-sort), typed a Viator rating `googleRating`, read a
 * fixed duration only, and never read the flags, the currency, the extra
 * charges or the review sources. This leaf reads what the payload carries,
 * tri-state: a field the operator did not state is null and renders
 * "not stated by the operator" — never a default, never inferred from a price,
 * never hidden.
 *
 *   · identity: the vendor's productCode — a product appears once, in the
 *     vendor's order (the vendor sorts; nothing here re-sorts or drops).
 *   · the price: pricing.summary.fromPrice — a 0 IS a price (statedNumber) —
 *     with the currency the answer carried (pricing.currency, per product) and
 *     the basis the vendor documents for that field: "Lowest per-person retail
 *     price … for a group of at least two standard participants". Where the
 *     operator states extra charges (pricing.extraChargesSummary — "the highest
 *     amount that a traveler could be asked to pay in-destination"), the card
 *     states both figures and the all-in price, in words, never one number.
 *   · the duration: fixedDurationInMinutes, or variableDurationFromMinutes –
 *     ToMinutes, or the vendor's unstructured text, or not stated.
 *   · the flags: the vendor's list asserts PRESENCE only ("may include any of
 *     NEW_ON_VIATOR, FREE_CANCELLATION, SKIP_THE_LINE, PRIVATE_TOUR,
 *     SPECIAL_OFFER, LIKELY_TO_SELL_OUT"), so a present flag is true and an
 *     absent one is the operator's silence (null) — an absent FREE_CANCELLATION
 *     is "cancellation policy not stated by the operator", never non-refundable.
 *   · the reviews: reviews.combinedAverageRating (out of 5) and totalReviews,
 *     with the sources named (VIATOR, TRIPADVISOR); an unrated product is shown
 *     as not stated — not hidden, not dropped.
 *   · the place: destinations[] carries a numeric destination REF ("only the
 *     primary destination ID is returned") — the name is resolved by the caller
 *     from the app's own destination map (injected, so this leaf stays pure);
 *     the product summary documents NO coordinates, so none are modelled.
 *   · the link: productUrl, validated by the injected validator (the affiliate
 *     gate) or null — "no booking link stated by the operator".
 *   · the benchmark: the lowest from-price meeting the filters, ranked on the
 *     all-in figure where the operator states extra charges (and the line says
 *     so); a selection's difference explained from STATED attributes only.
 *   · the on-screen filter contract: price range, rating floor, duration window,
 *     the flags, sort, count — what the vendor takes rides the request on SEARCH
 *     (src/lib/activities/searchContract.ts); a control at "any" sends nothing.
 *
 * Probed on the captured Phuket answer (src/lib/__tests__/fixtureViatorSearch.
 * phuket-thailand.json — 50 of 1,915, every product priced in USD, 6 with extra
 * charges, 34 fixed and 16 variable durations, 2 unrated).
 *
 * PURE: no fetch, no env. The one tri-state helper is src/lib/travel/stated.ts.
 */

import { type Stated, stated, statedBoolean, statedNumber, statedString } from '@/lib/travel/stated';
import { VENDOR_DEFAULT_COUNT, type ActivityFlag, type ActivitySort } from '@/lib/activities/searchContract';

/** What a product shows when the payload carried no value for a field. */
export const NOT_STATED = 'not stated by the operator';

/** The basis the vendor documents for pricing.summary.fromPrice. */
export const FROM_PRICE_BASIS = 'from-price per person, as stated by the operator';

// ─── The vendor's shape, read structurally ───────────────────────────────────

export interface RawProductSummary {
  productCode?: string;
  title?: string;
  description?: string;
  images?: Array<{ imageSource?: string; caption?: string; isCover?: boolean; variants?: Array<{ height?: number; width?: number; url?: string }> }>;
  reviews?: { sources?: Array<{ provider?: string; totalCount?: number; averageRating?: number }>; totalReviews?: number; combinedAverageRating?: number };
  duration?: { fixedDurationInMinutes?: number; variableDurationFromMinutes?: number; variableDurationToMinutes?: number; unstructuredDuration?: string };
  confirmationType?: string;
  itineraryType?: string;
  pricing?: {
    summary?: { fromPrice?: number; fromPriceBeforeDiscount?: number };
    currency?: string;
    extraChargesSummary?: { fromPrice?: number; fromPriceBeforeDiscount?: number; extraCharges?: number };
  };
  productUrl?: string;
  destinations?: Array<{ ref?: string; primary?: boolean }>;
  tags?: number[];
  flags?: string[];
  translationInfo?: { containsMachineTranslatedText?: boolean; translationSource?: string };
}

export interface RawProductSearch {
  products?: RawProductSummary[];
  totalCount?: number;
}

// ─── The product as the screen shows it ──────────────────────────────────────

export type ActivityDuration =
  | { kind: 'fixed'; minutes: number }
  | { kind: 'variable'; fromMinutes: number; toMinutes: number }
  | { kind: 'unstructured'; text: string };

export interface ActivityReviewSource {
  provider: Stated<string>;
  totalCount: Stated<number>;
  averageRating: Stated<number>;
}

export interface ActivityCardView {
  productCode: string;
  name: string;
  description: Stated<string>;
  photoUrl: Stated<string>;
  /** pricing.summary.fromPrice — a 0 is a price. */
  price: Stated<number>;
  priceBeforeDiscount: Stated<number>;
  /** pricing.currency — the answer's own, carried on every row; never converted. */
  currency: Stated<string>;
  /** FROM_PRICE_BASIS when the price is stated, else null. */
  priceBasis: Stated<string>;
  /** pricing.extraChargesSummary.extraCharges — paid in destination, omitted by the from-price. */
  extraCharges: Stated<number>;
  /** pricing.extraChargesSummary.fromPrice — the from-price with the extra charges. */
  allInPrice: Stated<number>;
  allInPriceBeforeDiscount: Stated<number>;
  duration: Stated<ActivityDuration>;
  /** The vendor's flags as carried. */
  flags: string[];
  /** A present flag is true; an absent one is the operator's silence (null) — never false. */
  freeCancellation: Stated<boolean>;
  privateTour: Stated<boolean>;
  skipTheLine: Stated<boolean>;
  specialOffer: Stated<boolean>;
  newOnViator: Stated<boolean>;
  likelyToSellOut: Stated<boolean>;
  /** reviews.combinedAverageRating, out of 5. */
  rating: Stated<number>;
  reviewCount: Stated<number>;
  reviewSources: ActivityReviewSource[];
  /** confirmationType as the vendor states it (INSTANT · MANUAL · INSTANT_THEN_MANUAL). */
  confirmationType: Stated<string>;
  itineraryType: Stated<string>;
  /** The primary destination's numeric ref, and its name from the app's map when the map knows it. */
  destinationRef: Stated<string>;
  destinationName: Stated<string>;
  /** The validated outbound link, or null — "no booking link stated by the operator". */
  productUrl: Stated<string>;
  machineTranslated: Stated<boolean>;
}

/** What the caller injects so the leaf stays pure: the affiliate gate and the destination map. */
export interface ActivityCardResolvers {
  validateUrl: (url: string) => string | null;
  destinationNameOf: (ref: string) => string | null;
}

/** A present flag → true; an absent flag → null (the list asserts presence only). */
export function flagOf(flags: readonly string[], flag: ActivityFlag): Stated<boolean> {
  return flags.includes(flag) ? true : null;
}

export function durationOf(d: RawProductSummary['duration']): Stated<ActivityDuration> {
  const fixed = statedNumber(d?.fixedDurationInMinutes);
  if (fixed !== null) return { kind: 'fixed', minutes: fixed };
  const from = statedNumber(d?.variableDurationFromMinutes);
  const to = statedNumber(d?.variableDurationToMinutes);
  if (from !== null && to !== null) return { kind: 'variable', fromMinutes: from, toMinutes: to };
  const text = statedString(d?.unstructuredDuration);
  if (text !== null) return { kind: 'unstructured', text };
  return null;
}

/** The cover image (the vendor's isCover, else the first), at the smallest variant at least 400px wide, else its first variant. */
export function photoOf(images: RawProductSummary['images']): Stated<string> {
  const list = Array.isArray(images) ? images : [];
  const cover = list.find((i) => i?.isCover === true) ?? list[0];
  const variants = Array.isArray(cover?.variants) ? cover!.variants!.filter((v) => typeof v?.url === 'string' && v.url !== '') : [];
  const wide = variants.filter((v) => typeof v.width === 'number' && v.width >= 400).sort((a, b) => (a.width as number) - (b.width as number));
  return statedString((wide[0] ?? variants[0])?.url);
}

export function activityCardOf(p: RawProductSummary, index: number, resolvers: ActivityCardResolvers): ActivityCardView {
  const flags = Array.isArray(p.flags) ? p.flags.filter((f): f is string => typeof f === 'string') : [];
  const summary = p.pricing?.summary;
  const extra = p.pricing?.extraChargesSummary;
  const price = statedNumber(summary?.fromPrice);
  const primary = (Array.isArray(p.destinations) ? p.destinations : []).find((d) => d?.primary === true) ?? p.destinations?.[0];
  const destinationRef = statedString(primary?.ref);
  const rawUrl = statedString(p.productUrl);
  const sources = Array.isArray(p.reviews?.sources) ? p.reviews!.sources! : [];
  return {
    productCode: statedString(p.productCode) ?? `product:${index}`,
    name: statedString(p.title) ?? `product ${statedString(p.productCode) ?? index}`,
    description: statedString(p.description),
    photoUrl: photoOf(p.images),
    price,
    priceBeforeDiscount: statedNumber(summary?.fromPriceBeforeDiscount),
    currency: statedString(p.pricing?.currency),
    priceBasis: price === null ? null : FROM_PRICE_BASIS,
    extraCharges: statedNumber(extra?.extraCharges),
    allInPrice: statedNumber(extra?.fromPrice),
    allInPriceBeforeDiscount: statedNumber(extra?.fromPriceBeforeDiscount),
    duration: durationOf(p.duration),
    flags,
    freeCancellation: flagOf(flags, 'FREE_CANCELLATION'),
    privateTour: flagOf(flags, 'PRIVATE_TOUR'),
    skipTheLine: flagOf(flags, 'SKIP_THE_LINE'),
    specialOffer: flagOf(flags, 'SPECIAL_OFFER'),
    newOnViator: flagOf(flags, 'NEW_ON_VIATOR'),
    likelyToSellOut: flagOf(flags, 'LIKELY_TO_SELL_OUT'),
    rating: statedNumber(p.reviews?.combinedAverageRating),
    reviewCount: statedNumber(p.reviews?.totalReviews),
    reviewSources: sources.map((s) => ({ provider: statedString(s?.provider), totalCount: statedNumber(s?.totalCount), averageRating: statedNumber(s?.averageRating) })),
    confirmationType: statedString(p.confirmationType),
    itineraryType: statedString(p.itineraryType),
    destinationRef,
    destinationName: destinationRef === null ? null : resolvers.destinationNameOf(destinationRef),
    productUrl: rawUrl === null ? null : resolvers.validateUrl(rawUrl),
    machineTranslated: statedBoolean(p.translationInfo?.containsMachineTranslatedText),
  };
}

/** A product appears once, in the vendor's order; a repeated productCode keeps its first appearance. Nothing re-sorted, nothing dropped for its rating. */
export function activityCardsOf(raw: RawProductSearch, resolvers: ActivityCardResolvers): { cards: ActivityCardView[]; totalCount: Stated<number> } {
  const seen = new Set<string>();
  const cards: ActivityCardView[] = [];
  const products = Array.isArray(raw?.products) ? raw.products : [];
  products.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const card = activityCardOf(p, i, resolvers);
    if (seen.has(card.productCode)) return;
    seen.add(card.productCode);
    cards.push(card);
  });
  return { cards, totalCount: statedNumber(raw?.totalCount) };
}

// ─── The words ───────────────────────────────────────────────────────────────

/**
 * "1–50 of 1,915 stated by the vendor" — the rows shown so far against the total the
 * vendor states for the filters (SHOW THEM ALL: the pages reveal it, no client cap);
 * "1–50 · total not stated by the vendor" when it stated none; "0 of 1,915 …" when
 * the page held nothing.
 */
export function countLine(cards: readonly ActivityCardView[], totalCount: Stated<number>): string {
  const n = cards.length;
  const shown = n === 0 ? '0' : `1–${n.toLocaleString('en-US')}`;
  if (totalCount === null) return `${shown} · total not stated by the vendor`;
  return `${shown} of ${totalCount.toLocaleString('en-US')} stated by the vendor`;
}

/** The rows one "Next" press asks for: the screen's count, else the vendor's documented default. */
export function pageSizeOf(ui: ActivityUiFilters): number {
  return ui.count === 'vendor' ? VENDOR_DEFAULT_COUNT : Number(ui.count);
}

/** Whether the vendor states more rows than are shown: null when it stated no total (the next page decides). */
export function moreStated(shown: number, totalCount: Stated<number>): Stated<boolean> {
  return totalCount === null ? null : shown < totalCount;
}

/** An amount in the answer's currency: "$77.66" for USD, "2520.00 THB" otherwise; a null currency is named. */
export function money(amount: number, currency: Stated<string>): string {
  const fixed = amount.toFixed(2);
  if (currency === null) return `${fixed} (currency ${NOT_STATED})`;
  return currency === 'USD' ? `$${fixed}` : `${fixed} ${currency}`;
}

/** "9h" · "1h 30m" · "45m" */
export function minutesText(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** The duration as the screen says it, or the operator's silence. */
export function durationText(d: Stated<ActivityDuration>): string {
  if (d === null) return `duration ${NOT_STATED}`;
  if (d.kind === 'fixed') return minutesText(d.minutes);
  if (d.kind === 'variable') return `${minutesText(d.fromMinutes)}–${minutesText(d.toMinutes)} (variable, stated by the operator)`;
  return `${d.text} (as stated by the operator)`;
}

/** "from $77.66" — the from-price with its currency, or the operator's silence. */
export function priceText(card: ActivityCardView): string {
  if (card.price === null) return `price ${NOT_STATED}`;
  return `from ${money(card.price, card.currency)}`;
}

/** "+ $12.03 extra charges stated by the operator · $89.69 all-in", or null when the operator states none. */
export function extraChargesText(card: ActivityCardView): string | null {
  if (card.extraCharges === null && card.allInPrice === null) return null;
  const parts: string[] = [];
  if (card.extraCharges !== null) parts.push(`+ ${money(card.extraCharges, card.currency)} extra charges stated by the operator`);
  if (card.allInPrice !== null) parts.push(`${money(card.allInPrice, card.currency)} all-in`);
  return parts.join(' · ');
}

/** "4.8/5 · 3,497 reviews (Viator 1,732 · Tripadvisor 1,765)", or the operator's silence. */
export function ratingText(card: ActivityCardView): string {
  if (card.rating === null) return `rating ${NOT_STATED}`;
  const out = [`${card.rating.toFixed(1)}/5`];
  if (card.reviewCount !== null) out.push(`${card.reviewCount.toLocaleString('en-US')} review${card.reviewCount === 1 ? '' : 's'}`);
  const named = card.reviewSources
    .filter((s) => s.provider !== null && s.totalCount !== null)
    .map((s) => `${providerName(s.provider as string)} ${(s.totalCount as number).toLocaleString('en-US')}`);
  return named.length ? `${out.join(' · ')} (${named.join(' · ')})` : out.join(' · ');
}

function providerName(p: string): string {
  if (p === 'VIATOR') return 'Viator';
  if (p === 'TRIPADVISOR') return 'Tripadvisor';
  return p;
}

/** The words a tri-state attribute renders as — the one helper, bound to the operator's phrase. */
export function statedText(v: Stated<boolean> | undefined, yes: string, no: string): string {
  return stated(v, yes, no, NOT_STATED);
}

/** The cancellation line: a present FREE_CANCELLATION states it; its absence is the operator's silence. */
export function cancellationText(card: ActivityCardView): string {
  return card.freeCancellation === true ? 'free cancellation stated by the operator' : `cancellation policy ${NOT_STATED}`;
}

// ─── The benchmark ───────────────────────────────────────────────────────────

/** The figure a product ranks on: the all-in price where the operator states extra charges, else the from-price; null when neither is stated. */
export function rankPrice(card: ActivityCardView): Stated<number> {
  return card.allInPrice ?? card.price;
}

export function lowestPrice(cards: readonly ActivityCardView[]): { card: ActivityCardView; figure: number } | null {
  let best: { card: ActivityCardView; figure: number } | null = null;
  for (const card of cards) {
    const figure = rankPrice(card);
    if (figure === null) continue;
    if (!best || figure < best.figure) best = { card, figure };
  }
  return best;
}

/** "Lowest from-price meeting your filters: $36.98 — X (ranked on the all-in figure where the operator states extra charges)." */
export function lowestPriceLine(low: { card: ActivityCardView; figure: number } | null): string | null {
  if (!low) return null;
  const c = low.card;
  const extra = extraChargesText(c);
  const figure = c.price === null ? money(low.figure, c.currency) : money(c.price, c.currency);
  return `Lowest from-price meeting your filters: ${figure}${extra ? ` (${extra})` : ''} — ${c.name}. Ranked on the all-in figure where the operator states extra charges.`;
}

/** The attributes a difference is explained from — every one tri-state. */
export const DIFFERENCE_ATTRIBUTES: ReadonlyArray<{ key: 'freeCancellation' | 'privateTour' | 'skipTheLine'; label: string }> = [
  { key: 'freeCancellation', label: 'free cancellation' },
  { key: 'privateTour', label: 'private tour' },
  { key: 'skipTheLine', label: 'skip the line' },
];

export interface PriceDifference {
  /** selected − lowest on the ranking figure, in the selection's currency; null when the two are not in one currency. */
  delta: number | null;
  currency: Stated<string>;
  reasons: string[];
  unstated: string[];
  line: string;
}

/** A selection against the lowest, explained from stated attributes only — never from the price; never across two currencies. */
export function priceDifference(selected: ActivityCardView, lowest: ActivityCardView): PriceDifference {
  const reasons: string[] = [];
  const unstated: string[] = [];
  for (const { key, label } of DIFFERENCE_ATTRIBUTES) {
    const sv = selected[key], lv = lowest[key];
    if (sv === null || lv === null) { unstated.push(label); continue; }
    if (sv === true && lv === false) reasons.push(label);
  }
  if (selected.confirmationType !== null && lowest.confirmationType !== null) {
    if (selected.confirmationType === 'INSTANT' && lowest.confirmationType !== 'INSTANT') reasons.push('instant confirmation');
  } else unstated.push('confirmation');
  if (selected.duration !== null && lowest.duration !== null) {
    const a = durationText(selected.duration), b = durationText(lowest.duration);
    if (a !== b) reasons.push(`duration ${a} vs ${b}`);
  } else unstated.push('duration');
  const currency = selected.currency;
  const sf = rankPrice(selected), lf = rankPrice(lowest);
  let line: string;
  let delta: number | null = null;
  if (selected.productCode === lowest.productCode) {
    line = 'This is the lowest from-price meeting your filters.';
  } else if (sf === null || lf === null) {
    line = `The difference cannot be computed — a price is ${NOT_STATED}.`;
  } else if (selected.currency === null || lowest.currency === null || selected.currency !== lowest.currency) {
    line = `Priced in ${selected.currency ?? `a currency ${NOT_STATED}`}; the lowest in ${lowest.currency ?? `a currency ${NOT_STATED}`} — no conversion, no comparison.`;
  } else {
    delta = Math.round((sf - lf) * 100) / 100;
    if (delta === 0) line = 'This matches the lowest from-price meeting your filters.';
    else {
      const over = `${delta > 0 ? '+' : '−'}${money(Math.abs(delta), currency)} ${delta > 0 ? 'over' : 'under'} the lowest`;
      if (reasons.length && unstated.length) line = `${over} for: ${reasons.join(', ')}; ${unstated.join(', ')} — reason ${NOT_STATED}.`;
      else if (reasons.length) line = `${over} for: ${reasons.join(', ')}.`;
      else if (unstated.length) line = `${over} — reason ${NOT_STATED} (${unstated.join(', ')} unstated).`;
      else line = `${over} — the operator states no difference in ${DIFFERENCE_ATTRIBUTES.map((a) => a.label).join(', ')}, confirmation, duration.`;
    }
  }
  return { delta, currency, reasons, unstated, line };
}

// ─── The on-screen filter contract ──────────────────────────────────────────

export const RATING_OPTIONS = ['any', '3', '4'] as const;
export const DURATION_OPTIONS = ['any', 'under2h', '2to6h', 'over6h'] as const;
export const ACTIVITY_SORT_OPTIONS = ['vendor', 'PRICE', 'TRAVELER_RATING', 'ITINERARY_DURATION', 'DATE_ADDED'] as const;
export const COUNT_OPTIONS = ['vendor', '25', '50'] as const;

export interface ActivityUiFilters {
  /** In the sent currency; '' = no bound. Rides the request as lowestPrice / highestPrice. */
  priceMin: string;
  priceMax: string;
  /** ratingFrom — the vendor filters "greater than this value". */
  rating: (typeof RATING_OPTIONS)[number];
  /** durationInMinutes from / to. */
  duration: (typeof DURATION_OPTIONS)[number];
  freeCancellation: boolean;
  privateTour: boolean;
  sort: (typeof ACTIVITY_SORT_OPTIONS)[number];
  count: (typeof COUNT_OPTIONS)[number];
}

/** Every control at "any" — nothing sent, the vendor's defaults apply (DEFAULT sort, 10 results). */
export const DEFAULT_ACTIVITY_FILTERS: ActivityUiFilters = { priceMin: '', priceMax: '', rating: 'any', duration: 'any', freeCancellation: false, privateTour: false, sort: 'vendor', count: 'vendor' };

/** The duration windows the screen offers, in the vendor's minutes. */
export const DURATION_WINDOWS: Record<Exclude<ActivityUiFilters['duration'], 'any'>, { from?: number; to?: number }> = {
  under2h: { to: 120 },
  '2to6h': { from: 120, to: 360 },
  over6h: { from: 360 },
};

export const SORT_LABEL: Record<ActivityUiFilters['sort'], string> = {
  vendor: "the vendor's order", PRICE: 'price, low to high', TRAVELER_RATING: 'traveler rating, high to low', ITINERARY_DURATION: 'duration', DATE_ADDED: 'date added',
};

function bound(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The query parameters the container sends — only what the screen set; "any" sends nothing. */
export function activitySearchParamsOf(ui: ActivityUiFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const min = bound(ui.priceMin), max = bound(ui.priceMax);
  if (min !== null) out.lowestPrice = String(min);
  if (max !== null && max > 0) out.highestPrice = String(max);
  if (ui.rating !== 'any') out.ratingFrom = ui.rating;
  if (ui.duration !== 'any') {
    const w = DURATION_WINDOWS[ui.duration];
    if (w.from !== undefined) out.durationFrom = String(w.from);
    if (w.to !== undefined) out.durationTo = String(w.to);
  }
  const flags: string[] = [];
  if (ui.freeCancellation) flags.push('FREE_CANCELLATION');
  if (ui.privateTour) flags.push('PRIVATE_TOUR');
  if (flags.length) out.flags = flags.join(',');
  if (ui.sort === 'PRICE') { out.sort = 'PRICE'; out.order = 'ASCENDING'; }
  else if (ui.sort === 'TRAVELER_RATING') { out.sort = 'TRAVELER_RATING'; out.order = 'DESCENDING'; }
  else if (ui.sort !== 'vendor') out.sort = ui.sort;
  if (ui.count !== 'vendor') out.count = ui.count;
  return out;
}

/** What the next search asks the vendor — stated on screen so no default narrows silently. */
export function activityFiltersStatement(ui: ActivityUiFilters, sentCurrency: string): string {
  const min = bound(ui.priceMin), max = bound(ui.priceMax);
  const range = min === null && (max === null || max === 0) ? 'from-price: any'
    : `from-price ${min !== null ? `from ${min}` : ''}${min !== null && max !== null && max > 0 ? ' ' : ''}${max !== null && max > 0 ? `to ${max}` : ''} ${sentCurrency}`;
  const window = ui.duration === 'any' ? 'duration: any' : ui.duration === 'under2h' ? 'duration up to 2h' : ui.duration === '2to6h' ? 'duration 2h to 6h' : 'duration 6h and up';
  return [
    range,
    ui.rating === 'any' ? "rating: any (the vendor's default)" : `rating above ${ui.rating} (the vendor's floor)`,
    window,
    ui.freeCancellation ? 'free cancellation only' : 'free cancellation: not required',
    ui.privateTour ? 'private tours only' : 'private tour: not required',
    `sort: ${SORT_LABEL[ui.sort]}`,
    ui.count === 'vendor' ? "results: the vendor's default (10)" : `results: ${ui.count}`,
    `currency sent: ${sentCurrency}`,
  ].join(' · ');
}

export type { ActivitySort };
