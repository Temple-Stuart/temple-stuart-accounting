/**
 * product — WHAT THE OPERATOR STATES ABOUT THE PRODUCT (ACTIVITY-01 STEP 4, 2026-09-22).
 *
 * The vendor's GET /products/{product-code} answer (docs.viator.com/partner-api/
 * technical, operationId products; ✅ for a Basic-access Affiliate) is the ACTIVE
 * product's stated facts the Save is built from — never typed on this side:
 *
 *   · the party form: pricingInfo.type (PER_PERSON | UNIT) and pricingInfo.ageBands[]
 *     { ageBand, startAge, endAge, minTravelersPerBooking, maxTravelersPerBooking },
 *     bookingRequirements { minTravelersPerBooking, maxTravelersPerBooking,
 *     requiresAdultForBooking } — the captured 27424P2 states CHILD 3–12 (min 0,
 *     max 28) and ADULT 13–70 (min 1, max 28), 1–28 per booking, an adult required;
 *   · timeZone — the IANA zone the product operates in (27424P2: Asia/Bangkok), the
 *     one source of the instant the commit writes;
 *   · productOptions[] { productOptionCode, title } — the names the schedule's option
 *     codes carry on screen (27424P2: TG14 "Small Group Only 20 People", …);
 *   · cancellationPolicy { type, description, refundEligibility[] } — as stated;
 *   · itinerary.duration — fixedDurationInMinutes (27424P2: 540) or the variable range;
 *   · exclusions[] — the operator's own words for what is paid in destination
 *     (27424P2: "National Park Fees 400THB/adult and 200THB/child"), the itemization
 *     beside the schedule's extra-charge figure.
 *
 * A field the product does not carry is null and renders "not stated by the
 * operator". The 2.6 MB answer is read whole; only these facts leave the route.
 *
 * PURE: no fetch, no env. The one tri-state helper is src/lib/travel/stated.ts.
 */

import { type Stated, statedBoolean, statedNumber, statedString } from '@/lib/travel/stated';
import { durationOf, type ActivityDuration, type RawProductSummary } from '@/lib/activities/products';

export const NOT_STATED = 'not stated by the operator';

/** The documented age bands. */
export const AGE_BANDS = ['ADULT', 'SENIOR', 'YOUTH', 'CHILD', 'INFANT', 'TRAVELER'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

// ─── The vendor's shape, read structurally ───────────────────────────────────

export interface RawProduct {
  status?: string;
  productCode?: string;
  title?: string;
  timeZone?: string;
  lastUpdatedAt?: string;
  pricingInfo?: { type?: string; unitType?: string; ageBands?: Array<{ ageBand?: string; startAge?: number; endAge?: number; minTravelersPerBooking?: number; maxTravelersPerBooking?: number }> };
  bookingRequirements?: { minTravelersPerBooking?: number; maxTravelersPerBooking?: number; requiresAdultForBooking?: boolean };
  cancellationPolicy?: { type?: string; description?: string; cancelIfBadWeather?: boolean; cancelIfInsufficientTravelers?: boolean; refundEligibility?: Array<{ dayRangeMin?: number; dayRangeMax?: number; percentageRefundable?: number }> };
  productOptions?: Array<{ productOptionCode?: string; title?: string; description?: string }>;
  itinerary?: { itineraryType?: string; duration?: RawProductSummary['duration'] };
  exclusions?: Array<{ category?: string; type?: string; description?: string; otherDescription?: string }>;
  productUrl?: string;
}

// ─── The facts as the screen and the commit use them ─────────────────────────

export interface ProductBand {
  ageBand: string;
  startAge: Stated<number>;
  endAge: Stated<number>;
  minTravelersPerBooking: Stated<number>;
  maxTravelersPerBooking: Stated<number>;
}

export interface ProductFacts {
  productCode: string;
  status: Stated<string>;
  title: Stated<string>;
  timeZone: Stated<string>;
  lastUpdatedAt: Stated<string>;
  pricingType: Stated<string>;
  unitType: Stated<string>;
  bands: ProductBand[];
  minTravelersPerBooking: Stated<number>;
  maxTravelersPerBooking: Stated<number>;
  requiresAdultForBooking: Stated<boolean>;
  cancellationType: Stated<string>;
  cancellationDescription: Stated<string>;
  refundEligibility: Array<{ dayRangeMin: Stated<number>; dayRangeMax: Stated<number>; percentageRefundable: Stated<number> }>;
  options: Array<{ productOptionCode: string; title: Stated<string> }>;
  duration: Stated<ActivityDuration>;
  /** The operator's own words for what is excluded — the in-destination charges among them. */
  exclusions: string[];
}

export function productFactsOf(raw: RawProduct): ProductFacts {
  const bands = (Array.isArray(raw.pricingInfo?.ageBands) ? raw.pricingInfo!.ageBands! : [])
    .map((b) => ({ ageBand: statedString(b?.ageBand), startAge: statedNumber(b?.startAge), endAge: statedNumber(b?.endAge), minTravelersPerBooking: statedNumber(b?.minTravelersPerBooking), maxTravelersPerBooking: statedNumber(b?.maxTravelersPerBooking) }))
    .filter((b): b is ProductBand => b.ageBand !== null) as ProductBand[];
  const options = (Array.isArray(raw.productOptions) ? raw.productOptions : [])
    .map((o) => ({ productOptionCode: statedString(o?.productOptionCode), title: statedString(o?.title) }))
    .filter((o): o is { productOptionCode: string; title: Stated<string> } => o.productOptionCode !== null);
  const exclusions = (Array.isArray(raw.exclusions) ? raw.exclusions : [])
    .map((e) => statedString(e?.otherDescription) ?? statedString(e?.description))
    .filter((t): t is string => t !== null);
  const refunds = (Array.isArray(raw.cancellationPolicy?.refundEligibility) ? raw.cancellationPolicy!.refundEligibility! : [])
    .map((r) => ({ dayRangeMin: statedNumber(r?.dayRangeMin), dayRangeMax: statedNumber(r?.dayRangeMax), percentageRefundable: statedNumber(r?.percentageRefundable) }));
  return {
    productCode: statedString(raw.productCode) ?? '',
    status: statedString(raw.status),
    title: statedString(raw.title),
    timeZone: statedString(raw.timeZone),
    lastUpdatedAt: statedString(raw.lastUpdatedAt),
    pricingType: statedString(raw.pricingInfo?.type),
    unitType: statedString(raw.pricingInfo?.unitType),
    bands,
    minTravelersPerBooking: statedNumber(raw.bookingRequirements?.minTravelersPerBooking),
    maxTravelersPerBooking: statedNumber(raw.bookingRequirements?.maxTravelersPerBooking),
    requiresAdultForBooking: statedBoolean(raw.bookingRequirements?.requiresAdultForBooking),
    cancellationType: statedString(raw.cancellationPolicy?.type),
    cancellationDescription: statedString(raw.cancellationPolicy?.description),
    refundEligibility: refunds,
    options,
    duration: durationOf(raw.itinerary?.duration),
    exclusions,
  };
}

/** The title the operator gives an option code, or the operator's silence. */
export function optionTitleOf(facts: ProductFacts, productOptionCode: string): Stated<string> {
  return facts.options.find((o) => o.productOptionCode === productOptionCode)?.title ?? null;
}

/** The party: travellers per age band, as the founder entered them. */
export type Party = Record<string, number>;

/** How many travellers the party holds. */
export function partySize(party: Party): number {
  return Object.values(party).reduce((n, c) => n + (Number.isInteger(c) && c > 0 ? c : 0), 0);
}

/** "2 adults · 1 child" */
export function partyText(party: Party): string {
  const parts = Object.entries(party).filter(([, c]) => Number.isInteger(c) && c > 0).map(([band, c]) => `${c} ${band.toLowerCase()}${c === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'no travellers';
}

/**
 * The product's stated booking rules against the party: every band's min / max,
 * the booking's min / max, an adult (ADULT or SENIOR) when the operator requires
 * one. Refuses by name; a rule the operator did not state is not applied.
 */
export function partyMeetsProduct(facts: ProductFacts, party: Party): { ok: true } | { refused: string } {
  const size = partySize(party);
  for (const [band, count] of Object.entries(party)) {
    if (!Number.isInteger(count) || count < 0) return { refused: `${band}: a whole number of travellers is required` };
    const stated = facts.bands.find((b) => b.ageBand === band);
    if (!stated) return { refused: `${band}: the operator states no such age band` };
    if (stated.minTravelersPerBooking !== null && count < stated.minTravelersPerBooking) return { refused: `${band}: the operator requires at least ${stated.minTravelersPerBooking}` };
    if (stated.maxTravelersPerBooking !== null && count > stated.maxTravelersPerBooking) return { refused: `${band}: the operator allows at most ${stated.maxTravelersPerBooking}` };
  }
  for (const b of facts.bands) {
    if (b.minTravelersPerBooking !== null && b.minTravelersPerBooking > 0 && (party[b.ageBand] ?? 0) < b.minTravelersPerBooking) return { refused: `${b.ageBand}: the operator requires at least ${b.minTravelersPerBooking}` };
  }
  if (facts.minTravelersPerBooking !== null && size < facts.minTravelersPerBooking) return { refused: `the operator requires at least ${facts.minTravelersPerBooking} traveller${facts.minTravelersPerBooking === 1 ? '' : 's'} per booking` };
  if (facts.maxTravelersPerBooking !== null && size > facts.maxTravelersPerBooking) return { refused: `the operator allows at most ${facts.maxTravelersPerBooking} travellers per booking` };
  if (facts.requiresAdultForBooking === true && (party.ADULT ?? 0) + (party.SENIOR ?? 0) < 1) return { refused: 'the operator requires an adult (ADULT or SENIOR) in the party' };
  return { ok: true };
}

/** "cancellation: STANDARD — For a full refund, cancel at least 24 hours before…" or the operator's silence. */
export function cancellationStatement(facts: ProductFacts): string {
  if (facts.cancellationType === null && facts.cancellationDescription === null) return `cancellation policy ${NOT_STATED}`;
  return [facts.cancellationType, facts.cancellationDescription].filter((s): s is string => s !== null).join(' — ');
}
