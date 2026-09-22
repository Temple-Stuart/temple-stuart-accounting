/**
 * fares — A FLIGHT APPEARS ONCE, AND A FARE SAYS WHAT IT BUYS (FLIGHT-01, 2026-09-22).
 *
 * The vendor's rates answer is journeys × offers: the same physical flight —
 * one marketing carrier, one flight number, one departure instant per segment —
 * arrives once per fare family and once more per ticketing intermediary, and
 * the picker flattened all of it into a list (a BKK→HKT search: 360 rows, one
 * Vietjet 06:50 six times). This leaf is the pure half of the fix:
 *
 *   · IDENTITY — flightIdentityOf(): a flight is its segments' marketing
 *     carrier + flight number + departure timestamp, in order (a round trip
 *     joins both directions). An offer whose segments cannot be identified is
 *     its own flight — never merged by guess.
 *   · GROUPING — groupFlights(): one row per identity, in the vendor's order of
 *     first appearance; its fares sorted by price; the cheapest is the headline.
 *   · WHAT A FARE BUYS — FareAttributes is TRI-STATE: true / false / null, where
 *     null means the payload did not carry the field and renders as
 *     NOT_STATED. Nothing here reads a price to decide an attribute.
 *   · THE BENCHMARK — lowestFare() is the lowest-logical-fare line; fareDifference()
 *     explains a selection against it from STATED attributes only, and names
 *     the attributes the carrier left unstated instead of guessing them.
 *   · THE CONTRACT — searchRequestOf() turns the on-screen filters into the
 *     vendor's own FlightSearchFilters / FlightSort, omitting whatever the
 *     screen left at "any" so the vendor's defaults apply; filtersStatement()
 *     says so on screen. A search is sent only when the container sends it.
 */

import type { FlightSearchFilters, FlightSort } from '@/lib/liteapiFlightsClient';
import type { FlightOffer } from '@/components/trips/FlightPickerView';
// HOTEL-01 (2026-09-22): the tri-state type and its words come from the ONE helper
// (src/lib/travel/stated.ts) — this leaf binds them to the carrier's phrase.
import { type Stated, stated } from '@/lib/travel/stated';

/** What a fare shows when the payload carried no value for a field. */
export const NOT_STATED = 'not stated by the carrier';

/** True / false / null — null is the carrier's silence, never a default (the one helper's type). */
export type { Stated };

export interface FareAttributes {
  /** segmentFares[].cabin — the cabin of the first segment, or 'mixed' when segments differ. */
  cabin: Stated<string>;
  /** fare.family (the vendor's fare-family label). */
  fareFamily: Stated<string>;
  /** segmentFares[0].fareBasisCode. */
  fareBasisCode: Stated<string>;
  /** baggage.hasCheckedBag. */
  checkedBag: Stated<boolean>;
  /** The included checked-bag line the vendor states (pieces · weight), when it states one. */
  checkedBagDetail: Stated<string>;
  /** baggage.hasCarryOnBag. */
  carryOnBag: Stated<boolean>;
  carryOnDetail: Stated<string>;
  /** terms.changeable / terms.refundable. */
  changeable: Stated<boolean>;
  refundable: Stated<boolean>;
  /** terms.changeFee / terms.refundFee as the vendor states them ("$75 before departure"), when stated. */
  changeFee: Stated<string>;
  refundFee: Stated<string>;
}

/** One segment as the row shows it — carrier, number, airports (with names when the payload names them), clock. */
export interface FlightSegmentView {
  marketingCode: Stated<string>;
  marketingName: Stated<string>;
  operatingCode: Stated<string>;
  operatingName: Stated<string>;
  marketingNumber: Stated<string>;
  operatingNumber: Stated<string>;
  originCode: Stated<string>;
  originName: Stated<string>;
  destinationCode: Stated<string>;
  destinationName: Stated<string>;
  /** ISO 8601 local, as the vendor sends it. */
  departureTime: Stated<string>;
  arrivalTime: Stated<string>;
}

/** The identity of one segment, or null when the payload cannot identify it. */
export function segmentIdentity(s: FlightSegmentView): string | null {
  if (!s.marketingCode || !s.marketingNumber || !s.departureTime) return null;
  return `${s.marketingCode}${s.marketingNumber}@${s.departureTime}`;
}

/**
 * The identity of a flight: every segment's identity in order; a round trip
 * joins the return after '||'. Null when any segment cannot be identified —
 * the caller then keys the offer on itself.
 */
export function flightIdentityOf(outbound: readonly FlightSegmentView[] | undefined, ret?: readonly FlightSegmentView[] | null): string | null {
  if (!outbound || outbound.length === 0) return null;
  const out = outbound.map(segmentIdentity);
  if (out.some((k) => k === null)) return null;
  const back = ret && ret.length > 0 ? ret.map(segmentIdentity) : [];
  if (back.some((k) => k === null)) return null;
  return back.length ? `${out.join('|')}||${back.join('|')}` : out.join('|');
}

export interface FlightGroup {
  /** The identity, or `offer:<id>` for an offer that could not be identified. */
  key: string;
  /** The first offer the vendor listed for this flight — the row's segments, times, duration, stops. */
  representative: FlightOffer;
  /** Every fare for this flight, cheapest first. */
  fares: FlightOffer[];
  /** The cheapest fare — the row's headline. */
  cheapest: FlightOffer;
}

/** One row per flight, in the vendor's order of first appearance; fares by price. */
export function groupFlights(offers: readonly FlightOffer[]): FlightGroup[] {
  const byKey = new Map<string, FlightOffer[]>();
  const order: string[] = [];
  for (const o of offers) {
    const key = o.flightKey ?? `offer:${o.id}`;
    const list = byKey.get(key);
    if (list) list.push(o);
    else { byKey.set(key, [o]); order.push(key); }
  }
  return order.map((key) => {
    const list = byKey.get(key)!;
    const fares = [...list].sort((a, b) => a.price - b.price);
    return { key, representative: list[0], fares, cheapest: fares[0] };
  });
}

/** "N flights · M fares" */
export function countLine(groups: readonly FlightGroup[]): string {
  const fares = groups.reduce((n, g) => n + g.fares.length, 0);
  return `${groups.length} flight${groups.length === 1 ? '' : 's'} · ${fares} fare${fares === 1 ? '' : 's'}`;
}

/** The row's carrier: the airline that flies it; "operated by X" is the row's own line when marketing ≠ operating. */
export function carrierLineOf(seg: FlightSegmentView | undefined): { name: string; operatedBy: string | null } {
  if (!seg) return { name: 'Flight', operatedBy: null };
  const marketing = seg.marketingName ?? seg.marketingCode ?? null;
  const operating = seg.operatingName ?? seg.operatingCode ?? null;
  const differs = !!marketing && !!operating && marketing !== operating;
  return {
    name: marketing ?? operating ?? 'Flight',
    operatedBy: differs ? operating : null,
  };
}

export function stopsText(stops: number): string {
  if (stops === 0) return 'nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

/** The lowest fare among the rows — the lowest-logical-fare benchmark. Null when there are no fares. */
export function lowestFare(groups: readonly FlightGroup[]): { fare: FlightOffer; group: FlightGroup } | null {
  let best: { fare: FlightOffer; group: FlightGroup } | null = null;
  for (const g of groups) {
    const f = g.cheapest;
    if (!best || f.price < best.fare.price) best = { fare: f, group: g };
  }
  return best;
}

/** "Lowest fare meeting your filters: $41.46 — Thai AirAsia 14:15 nonstop." */
export function lowestFareLine(low: { fare: FlightOffer; group: FlightGroup } | null): string | null {
  if (!low) return null;
  const rep = low.group.representative;
  const seg = rep.outboundSegments?.[0];
  const carrier = carrierLineOf(seg);
  const who = carrier.operatedBy ? `${carrier.name} (operated by ${carrier.operatedBy})` : carrier.name;
  const time = rep.outbound?.departure.localTime ?? '';
  const stops = stopsText(rep.outbound?.stops ?? 0);
  return `Lowest fare meeting your filters: ${money(low.fare.price, low.fare.currency)} — ${[who, time, stops].filter(Boolean).join(' ')}.`;
}

export function money(amount: number, currency: string): string {
  const fixed = amount.toFixed(2);
  return currency === 'USD' ? `$${fixed}` : `${fixed} ${currency}`;
}

/** The attributes a difference is explained from — every one tri-state. */
const DIFFERENCE_ATTRIBUTES: ReadonlyArray<{ key: keyof FareAttributes; label: string }> = [
  { key: 'refundable', label: 'refundable' },
  { key: 'changeable', label: 'changeable' },
  { key: 'checkedBag', label: 'checked bag' },
  { key: 'carryOnBag', label: 'carry-on bag' },
  { key: 'cabin', label: 'cabin' },
];

export interface FareDifference {
  /** selected − lowest, in the fare's currency. */
  delta: number;
  currency: string;
  /** The STATED attributes the selected fare has that the lowest lacks (or differs in). */
  reasons: string[];
  /** The attributes the carrier left unstated on either fare — the line names them instead of guessing. */
  unstated: string[];
  line: string;
}

/**
 * "+$74.63 over the lowest fare for: refundable, checked bag." — computed from
 * the two fares' STATED attributes. An attribute unstated on either side is
 * named as "reason not stated by the carrier", never inferred from the price.
 */
export function fareDifference(selected: FlightOffer, lowest: FlightOffer): FareDifference {
  const delta = Math.round((selected.price - lowest.price) * 100) / 100;
  const currency = selected.currency;
  const reasons: string[] = [];
  const unstated: string[] = [];
  const s = selected.fare, l = lowest.fare;
  for (const { key, label } of DIFFERENCE_ATTRIBUTES) {
    const sv = s ? s[key] : null;
    const lv = l ? l[key] : null;
    if (sv === null || sv === undefined || lv === null || lv === undefined) { unstated.push(label); continue; }
    if (key === 'cabin') { if (sv !== lv) reasons.push(`cabin ${String(sv)}`); continue; }
    if (sv === true && lv === false) reasons.push(label);
  }
  let line: string;
  if (selected.id === lowest.id || delta === 0) {
    line = 'This is the lowest fare meeting your filters.';
  } else {
    const over = `${delta > 0 ? '+' : '−'}${money(Math.abs(delta), currency)} ${delta > 0 ? 'over' : 'under'} the lowest fare`;
    if (reasons.length && unstated.length) line = `${over} for: ${reasons.join(', ')}; ${unstated.join(', ')} — reason not stated by the carrier.`;
    else if (reasons.length) line = `${over} for: ${reasons.join(', ')}.`;
    else if (unstated.length) line = `${over} — reason not stated by the carrier (${unstated.join(', ')} unstated).`;
    else line = `${over} — the carrier states no difference in ${DIFFERENCE_ATTRIBUTES.map((a) => a.label).join(', ')}.`;
  }
  return { delta, currency, reasons, unstated, line };
}

// ─── The on-screen filter contract ──────────────────────────────────────────

export const CABIN_OPTIONS = ['any', 'ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const;
export const STOPS_OPTIONS = ['any', 'nonstop', 'one'] as const;
export const DEPARTURE_OPTIONS = ['any', 'morning', 'afternoon', 'evening'] as const;
export const SORT_OPTIONS = ['vendor', 'price', 'duration', 'departure'] as const;

export interface FlightUiFilters {
  cabin: (typeof CABIN_OPTIONS)[number];
  stops: (typeof STOPS_OPTIONS)[number];
  refundableOnly: boolean;
  checkedBag: boolean;
  departure: (typeof DEPARTURE_OPTIONS)[number];
  sort: (typeof SORT_OPTIONS)[number];
}

/** Every control at "any" — nothing sent, the vendor's defaults apply. */
export const DEFAULT_UI_FILTERS: FlightUiFilters = { cabin: 'any', stops: 'any', refundableOnly: false, checkedBag: false, departure: 'any', sort: 'vendor' };

/** The departure windows the screen offers, as the HH:MM the vendor filters on. */
export const DEPARTURE_WINDOWS: Record<Exclude<FlightUiFilters['departure'], 'any'>, { after: string; before: string }> = {
  morning: { after: '05:00', before: '11:59' },
  afternoon: { after: '12:00', before: '17:59' },
  evening: { after: '18:00', before: '23:59' },
};

export const CABIN_LABEL: Record<FlightUiFilters['cabin'], string> = {
  any: 'any cabin', ECONOMY: 'economy', PREMIUM_ECONOMY: 'premium economy', BUSINESS: 'business', FIRST: 'first',
};

/**
 * The request the container sends — only what the screen set; a control at
 * "any" sends nothing, so the vendor's own default applies (no default
 * invented here). A cabin is sent with cabinClassMatch 'exactly': the screen
 * says "business", the vendor returns business.
 */
export function searchRequestOf(ui: FlightUiFilters): { filters?: FlightSearchFilters; sort?: FlightSort } {
  const filters: FlightSearchFilters = {};
  if (ui.cabin !== 'any') { filters.cabinClass = ui.cabin; filters.cabinClassMatch = 'exactly'; }
  if (ui.stops === 'nonstop') filters.maxStops = 0;
  if (ui.stops === 'one') filters.maxStops = 1;
  if (ui.refundableOnly) filters.refundableOnly = true;
  if (ui.checkedBag) filters.includesCheckedBag = true;
  if (ui.departure !== 'any') { filters.departureTimeAfter = DEPARTURE_WINDOWS[ui.departure].after; filters.departureTimeBefore = DEPARTURE_WINDOWS[ui.departure].before; }
  const out: { filters?: FlightSearchFilters; sort?: FlightSort } = {};
  if (Object.keys(filters).length) out.filters = filters;
  if (ui.sort !== 'vendor') out.sort = { sortBy: ui.sort, sortOrder: 'asc' };
  return out;
}

/** What the screen says it asked for — including, in words, where the vendor's default applies. */
export function filtersStatement(ui: FlightUiFilters): string {
  const parts = [
    ui.cabin === 'any' ? 'cabin: any (the vendor\'s default)' : `cabin: ${CABIN_LABEL[ui.cabin]}, exact match`,
    ui.stops === 'any' ? 'stops: any (the vendor\'s default)' : ui.stops === 'nonstop' ? 'nonstop only' : 'up to 1 stop',
    ui.refundableOnly ? 'refundable only' : 'refundable: not required',
    ui.checkedBag ? 'checked bag included' : 'checked bag: not required',
    ui.departure === 'any' ? 'departure: any time' : `departure ${ui.departure} (${DEPARTURE_WINDOWS[ui.departure].after}–${DEPARTURE_WINDOWS[ui.departure].before})`,
    ui.sort === 'vendor' ? 'sort: the vendor\'s default order' : `sort: ${ui.sort}, ascending`,
  ];
  return parts.join(' · ');
}

/** The words a tri-state attribute renders as — the one helper, bound to the carrier's phrase. */
export function statedText(v: Stated<boolean> | undefined, yes: string, no: string): string {
  return stated(v, yes, no, NOT_STATED);
}
