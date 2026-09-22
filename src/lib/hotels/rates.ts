/**
 * rates — A HOTEL APPEARS ONCE, AND A RATE SAYS WHAT IT BUYS (HOTEL-01, 2026-09-22).
 *
 * The vendor's /hotels/rates answer is one item per hotel holding roomTypes[]
 * × rates[] — room × board × cancellation, many rates under one roof. The old
 * mapper kept ONE (the first with a price) and dropped the rest with every
 * attribute. This leaf keeps them all, tri-state from the payload: a field the
 * vendor did not carry is null and renders "not stated by the property", never a
 * default and never inferred from the price.
 *
 *   · identity: the vendor's hotelId — a hotel appears once, its rates beneath it.
 *   · the headline: the cheapest rate meeting the filters, per night AND the stay
 *     total with the nights count (per night = total ÷ nights, nights from the
 *     dates the rates were quoted for — the vendor quotes no per-night figure).
 *   · the benchmark: the lowest rate across the answer, and a selection's
 *     difference explained from STATED attributes only (refundable, breakfast,
 *     taxes included, the room) — an unstated one is named as unstated.
 *   · the on-screen filter contract: stars, refundable only, a per-night price
 *     range, sort — what the vendor takes rides the request on SEARCH; the price
 *     range narrows the rates on this page and the screen says so, because the
 *     vendor documents no price range.
 *
 * HOTEL-02 (2026-09-22): the rates answer carries NO check-in / check-out clock —
 * the vendor states a property's times only in its per-hotel content, which the
 * commit reads once (src/lib/hotels/stayTimes.ts). The card fields that modelled
 * a clock the search never had are gone; nothing on this leaf is a time.
 *
 * PURE: no fetch, no env. The one tri-state helper is src/lib/travel/stated.ts.
 */

import { type Stated, stated, statedBoolean, statedNumber, statedString } from '@/lib/travel/stated';
import type { HotelSearchFilters } from '@/lib/hotels/searchContract';

/** What a hotel or a rate shows when the payload carried no value for a field. */
export const NOT_STATED = 'not stated by the property';

// ─── The vendor's shape, read structurally (the client's type is module-private) ─

export interface RawHotelRate {
  rateId?: string;
  offerId?: string;
  name?: string;
  boardType?: string;
  boardName?: string;
  maxOccupancy?: number;
  retailRate?: {
    total?: Array<{ amount?: number; currency?: string }>;
    suggestedSellingPrice?: Array<{ amount?: number; currency?: string }>;
    taxesAndFees?: Array<{ included?: boolean; description?: string; amount?: number; currency?: string }> | null;
  };
  offerRetailRate?: { amount?: number; currency?: string };
  cancellationPolicies?: {
    refundableTag?: string;
    cancelPolicyInfos?: Array<{ cancelTime?: string; amount?: number; currency?: string; type?: string }> | null;
  };
}

export interface RawHotelRates {
  hotelId: string;
  hotel?: {
    name?: string;
    address?: string;
    city?: string;
    stars?: number;
    starRating?: number;
    rating?: number;
    reviewCount?: number;
    reviewScore?: number;
    main_photo?: string;
    thumbnail?: string;
    hotelImages?: Array<{ url: string }>;
  };
  nights?: number;
  checkinDate?: string;
  checkoutDate?: string;
  roomTypes?: Array<{ offerId?: string; rates?: RawHotelRate[] }>;
}

// ─── The rate and the hotel as the screen shows them ─────────────────────────

export interface HotelRateView {
  rateId: string;
  /** What /rates/prebook needs — the rate's own offerId, else its room type's. */
  offerId: Stated<string>;
  roomName: Stated<string>;
  boardType: Stated<string>;
  boardName: Stated<string>;
  /** Breakfast: BI/HB/FB/AI state it, RO states none, anything else is unstated. */
  breakfast: Stated<boolean>;
  /** RFN states refundable, NRFN states not, anything else is unstated. */
  refundable: Stated<boolean>;
  /** The earliest cancellation step the vendor states (ISO datetime), else null. */
  cancelDeadline: Stated<string>;
  /** The stay total the vendor quoted, and its currency. */
  total: number;
  currency: string;
  /** total ÷ nights, to the cent — null when the nights are not stated. */
  perNight: Stated<number>;
  /** Every listed tax/fee included → true; any listed as not included → false; none listed → null. */
  taxesIncluded: Stated<boolean>;
  maxOccupancy: Stated<number>;
}

export interface HotelCardView {
  hotelId: string;
  name: string;
  stars: Stated<number>;
  guestRating: Stated<number>;
  reviewCount: Stated<number>;
  address: Stated<string>;
  city: Stated<string>;
  photoUrl: Stated<string>;
  images: string[];
  nights: Stated<number>;
  checkinDate: Stated<string>;
  checkoutDate: Stated<string>;
  /** The hotel's rates, cheapest first. */
  rates: HotelRateView[];
}

/** The stay total a rate quotes — total, else the suggested price, else the offer price; null when none. */
function quotedTotal(r: RawHotelRate): { total: number; currency: string } | null {
  const t = r.retailRate?.total?.[0];
  if (t && typeof t.amount === 'number' && t.amount > 0 && typeof t.currency === 'string') return { total: t.amount, currency: t.currency };
  const s = r.retailRate?.suggestedSellingPrice?.[0];
  if (s && typeof s.amount === 'number' && s.amount > 0 && typeof s.currency === 'string') return { total: s.amount, currency: s.currency };
  const o = r.offerRetailRate;
  if (o && typeof o.amount === 'number' && o.amount > 0 && typeof o.currency === 'string') return { total: o.amount, currency: o.currency };
  return null;
}

const BOARD_WITH_BREAKFAST = new Set(['BI', 'HB', 'FB', 'AI']);

export function breakfastOf(boardType: Stated<string>): Stated<boolean> {
  if (boardType === null) return null;
  const code = boardType.trim().toUpperCase();
  if (BOARD_WITH_BREAKFAST.has(code)) return true;
  if (code === 'RO') return false;
  return null;
}

export function refundableOf(tag: unknown): Stated<boolean> {
  const t = statedString(tag)?.trim().toUpperCase() ?? null;
  if (t === 'RFN') return true;
  if (t === 'NRFN') return false;
  return null;
}

function taxesIncludedOf(rows: unknown): Stated<boolean> {
  const list = Array.isArray(rows) ? (rows as Array<{ included?: unknown }>).filter((x) => x && typeof x === 'object') : [];
  const stated = list.map((x) => statedBoolean(x.included)).filter((v): v is boolean => v !== null);
  if (stated.length === 0) return null;
  return stated.every(Boolean);
}

function cancelDeadlineOf(policies: RawHotelRate['cancellationPolicies']): Stated<string> {
  const infos = Array.isArray(policies?.cancelPolicyInfos) ? policies!.cancelPolicyInfos! : [];
  const times = infos.map((i) => statedString(i?.cancelTime)).filter((t): t is string => t !== null).sort();
  return times[0] ?? null;
}

export function perNightOf(total: number, nights: Stated<number>): Stated<number> {
  if (nights === null || nights < 1) return null;
  return Math.round((total / nights) * 100) / 100;
}

export function rateViewOf(r: RawHotelRate, roomTypeOfferId: string | undefined, nights: Stated<number>, index: number): HotelRateView | null {
  const q = quotedTotal(r);
  if (!q) return null;
  const boardType = statedString(r.boardType);
  return {
    rateId: statedString(r.rateId) ?? statedString(r.offerId) ?? `rate:${index}`,
    offerId: statedString(r.offerId) ?? statedString(roomTypeOfferId),
    roomName: statedString(r.name),
    boardType,
    boardName: statedString(r.boardName),
    breakfast: breakfastOf(boardType),
    refundable: refundableOf(r.cancellationPolicies?.refundableTag),
    cancelDeadline: cancelDeadlineOf(r.cancellationPolicies),
    total: q.total,
    currency: q.currency,
    perNight: perNightOf(q.total, nights),
    taxesIncluded: taxesIncludedOf(r.retailRate?.taxesAndFees),
    maxOccupancy: statedNumber(r.maxOccupancy),
  };
}

/** One hotel → its card: the hotel's stated facts and every priced rate, cheapest first. */
export function hotelCardOf(h: RawHotelRates): HotelCardView {
  const meta = h.hotel ?? {};
  const nights = statedNumber(h.nights);
  const rates: HotelRateView[] = [];
  let i = 0;
  for (const room of h.roomTypes ?? []) {
    for (const r of room.rates ?? []) {
      const v = rateViewOf(r, room.offerId, nights, i++);
      if (v) rates.push(v);
    }
  }
  rates.sort((a, b) => a.total - b.total);
  return {
    hotelId: h.hotelId,
    name: statedString(meta.name) ?? h.hotelId,
    stars: statedNumber(meta.starRating) ?? statedNumber(meta.stars),
    guestRating: statedNumber(meta.rating) ?? statedNumber(meta.reviewScore),
    reviewCount: statedNumber(meta.reviewCount),
    address: statedString(meta.address),
    city: statedString(meta.city),
    photoUrl: statedString(meta.main_photo) ?? statedString(meta.thumbnail) ?? statedString(meta.hotelImages?.[0]?.url),
    images: (meta.hotelImages ?? []).map((img) => img?.url).filter((u): u is string => typeof u === 'string' && u !== ''),
    nights,
    checkinDate: statedString(h.checkinDate),
    checkoutDate: statedString(h.checkoutDate),
    rates,
  };
}

/** A hotel appears once: the answer's items keyed by hotelId, in first-appearance order; a repeat merges its rates. */
export function hotelCardsOf(items: readonly RawHotelRates[]): HotelCardView[] {
  const byId = new Map<string, HotelCardView>();
  for (const h of items) {
    const card = hotelCardOf(h);
    const seen = byId.get(card.hotelId);
    if (!seen) byId.set(card.hotelId, card);
    else {
      const known = new Set(seen.rates.map((r) => r.rateId));
      seen.rates = [...seen.rates, ...card.rates.filter((r) => !known.has(r.rateId))].sort((a, b) => a.total - b.total);
    }
  }
  return [...byId.values()];
}

export function countLine(cards: readonly HotelCardView[]): string {
  const rates = cards.reduce((n, c) => n + c.rates.length, 0);
  return `${cards.length} hotel${cards.length === 1 ? '' : 's'} · ${rates} rate${rates === 1 ? '' : 's'}`;
}

/** The stars as the screen says them: "3★", or the property's silence. */
export function starsText(stars: Stated<number>): string {
  return stars === null ? `stars ${NOT_STATED}` : `${stars}★`;
}

export function money(amount: number, currency: string): string {
  const fixed = amount.toFixed(2);
  return currency === 'USD' ? `$${fixed}` : `${fixed} ${currency}`;
}

/** A per-night figure as the screen says it, or the total when the nights are unstated. */
export function rateHeadline(r: HotelRateView): string {
  return r.perNight === null ? `${money(r.total, r.currency)} total` : `${money(r.perNight, r.currency)}/night`;
}

// ─── The benchmark ───────────────────────────────────────────────────────────

export function lowestRate(cards: readonly HotelCardView[]): { rate: HotelRateView; card: HotelCardView } | null {
  let best: { rate: HotelRateView; card: HotelCardView } | null = null;
  for (const card of cards) for (const rate of card.rates) if (!best || rate.total < best.rate.total) best = { rate, card };
  return best;
}

/** "Lowest rate meeting your filters: $38.00/night — Ibis Phuket Kata, 3★." */
export function lowestRateLine(low: { rate: HotelRateView; card: HotelCardView } | null): string | null {
  if (!low) return null;
  return `Lowest rate meeting your filters: ${rateHeadline(low.rate)} — ${low.card.name}, ${starsText(low.card.stars)}.`;
}

export const DIFFERENCE_ATTRIBUTES: ReadonlyArray<{ key: 'refundable' | 'breakfast' | 'taxesIncluded'; label: string }> = [
  { key: 'refundable', label: 'refundable' },
  { key: 'breakfast', label: 'breakfast' },
  { key: 'taxesIncluded', label: 'taxes included' },
];

export interface RateDifference {
  /** Per night when both state their nights, else the stay total. */
  delta: number;
  perNight: boolean;
  currency: string;
  reasons: string[];
  unstated: string[];
  line: string;
}

/** A selection against the lowest rate, explained from stated attributes only. */
export function rateDifference(selected: HotelRateView, lowest: HotelRateView): RateDifference {
  const perNight = selected.perNight !== null && lowest.perNight !== null;
  const delta = Math.round(((perNight ? selected.perNight! - lowest.perNight! : selected.total - lowest.total)) * 100) / 100;
  const currency = selected.currency;
  const reasons: string[] = [];
  const unstated: string[] = [];
  for (const { key, label } of DIFFERENCE_ATTRIBUTES) {
    const sv = selected[key];
    const lv = lowest[key];
    if (sv === null || lv === null) { unstated.push(label); continue; }
    if (sv === true && lv === false) reasons.push(label);
  }
  if (selected.roomName !== null && lowest.roomName !== null && selected.roomName !== lowest.roomName) reasons.push(`room: ${selected.roomName}`);
  else if (selected.roomName === null || lowest.roomName === null) unstated.push('room');
  const unit = perNight ? '/night' : '';
  let line: string;
  if (selected.rateId === lowest.rateId || delta === 0) {
    line = 'This is the lowest rate meeting your filters.';
  } else {
    const over = `${delta > 0 ? '+' : '−'}${money(Math.abs(delta), currency)}${unit} ${delta > 0 ? 'over' : 'under'} the lowest`;
    if (reasons.length && unstated.length) line = `${over} for: ${reasons.join(', ')}; ${unstated.join(', ')} — reason ${NOT_STATED}.`;
    else if (reasons.length) line = `${over} for: ${reasons.join(', ')}.`;
    else if (unstated.length) line = `${over} — reason ${NOT_STATED} (${unstated.join(', ')} unstated).`;
    else line = `${over} — the property states no difference in ${DIFFERENCE_ATTRIBUTES.map((a) => a.label).join(', ')}, room.`;
  }
  return { delta, perNight, currency, reasons, unstated, line };
}

// ─── The on-screen filter contract ──────────────────────────────────────────

export const STARS_OPTIONS = ['any', '3', '4', '5'] as const;
export const HOTEL_SORT_OPTIONS = ['vendor', 'price'] as const;

export interface HotelUiFilters {
  stars: (typeof STARS_OPTIONS)[number];
  refundableOnly: boolean;
  /** Per night, in the quoted currency; '' = no bound. Narrows on this page — the vendor takes no price range. */
  priceMin: string;
  priceMax: string;
  sort: (typeof HOTEL_SORT_OPTIONS)[number];
}

export const DEFAULT_HOTEL_FILTERS: HotelUiFilters = { stars: 'any', refundableOnly: false, priceMin: '', priceMax: '', sort: 'vendor' };

/** "3+" → the vendor's star list from 3 to 5 in halves; "5" → [5]. */
export function starRatingListOf(stars: HotelUiFilters['stars']): number[] | null {
  if (stars === 'any') return null;
  const from = Number(stars);
  const out: number[] = [];
  for (let s = from; s <= 5; s += 0.5) out.push(s);
  return out;
}

/** The query parameters the container sends — only what the screen set; "any" sends nothing. */
export function hotelSearchParamsOf(ui: HotelUiFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const stars = starRatingListOf(ui.stars);
  if (stars) out.starRating = stars.join(',');
  if (ui.refundableOnly) out.refundableRatesOnly = 'true';
  if (ui.sort === 'price') { out.sort = 'price'; out.sortDirection = 'ascending'; }
  return out;
}

/** The contract the route forwards for those parameters — the same words, typed. */
export function hotelFiltersOf(ui: HotelUiFilters): HotelSearchFilters {
  const f: HotelSearchFilters = {};
  const stars = starRatingListOf(ui.stars);
  if (stars) f.starRating = stars;
  if (ui.refundableOnly) f.refundableRatesOnly = true;
  if (ui.sort === 'price') f.sort = [{ field: 'price', direction: 'ascending' }];
  return f;
}

function bound(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The per-night range, applied on this page to the rates the vendor returned. A rate with no per-night figure is kept only when no bound is set. */
export function rateMeetsRange(r: HotelRateView, ui: HotelUiFilters): boolean {
  const min = bound(ui.priceMin), max = bound(ui.priceMax);
  if (min === null && max === null) return true;
  if (r.perNight === null) return false;
  if (min !== null && r.perNight < min) return false;
  if (max !== null && r.perNight > max) return false;
  return true;
}

/** The cards with only the rates meeting the page's range; a hotel with none left is dropped. */
export function applyRange(cards: readonly HotelCardView[], ui: HotelUiFilters): HotelCardView[] {
  return cards.map((c) => ({ ...c, rates: c.rates.filter((r) => rateMeetsRange(r, ui)) })).filter((c) => c.rates.length > 0);
}

/** What the next search asks the vendor, and what narrows on this page — stated on screen so no default narrows silently. */
export function hotelFiltersStatement(ui: HotelUiFilters): string {
  const min = bound(ui.priceMin), max = bound(ui.priceMax);
  const range = min === null && max === null ? 'price per night: any'
    : `price per night: ${min !== null ? `from ${min}` : ''}${min !== null && max !== null ? ' ' : ''}${max !== null ? `to ${max}` : ''} (applied on this page — the vendor takes no price range)`;
  return [
    ui.stars === 'any' ? "stars: any (the vendor's default)" : `stars: ${ui.stars}★ and up`,
    ui.refundableOnly ? 'refundable only' : 'refundable: not required',
    range,
    ui.sort === 'vendor' ? "sort: the vendor's default order" : 'sort: price, low to high',
  ].join(' · ');
}

/** The words a tri-state attribute renders as — the one helper, bound to the property's phrase. */
export function statedText(v: Stated<boolean> | undefined, yes: string, no: string): string {
  return stated(v, yes, no, NOT_STATED);
}
