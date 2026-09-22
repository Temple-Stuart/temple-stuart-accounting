/**
 * schedule — THE START TIMES AND THE PRICE THE OPERATOR PUBLISHES (ACTIVITY-01 STEP 4,
 * 2026-09-22, the Basic-access path: the Save reads the schedule and the vendor's
 * stated rate because /availability/check answered 403 FORBIDDEN "Endpoint access
 * denied" to this key; CHECK-01 replaces this path when Full-access is granted).
 *
 * The vendor's GET /availability/schedules/{product-code} (docs.viator.com/partner-
 * api/technical, operationId availabilitySchedules; ✅ for a Basic-access Affiliate)
 * is PUBLISHED start times with unavailable dates — not a live seat check — priced
 * in the SUPPLIER's currency ("The pricing is returned in the supplier's currency";
 * the captured 27424P2 answers in THB). Its shape, read here as documented:
 *   bookableItems[] { productOptionCode, seasons[] { startDate, endDate?,
 *   pricingRecords[] { daysOfWeek[], timedEntries?[] { startTime, unavailableDates?[]
 *   { date, reason } }, unavailableDates?[] { date, reason }, pricingDetails[]
 *   { ageBand, pricingPackageType (PER_PERSON | UNIT), minTravelers, maxTravelers,
 *   price.original.recommendedRetailPrice, price.special? { recommendedRetailPrice,
 *   offerStartDate, offerEndDate, travelStartDate, travelEndDate } } } } },
 *   currency, summary.fromPrice, extraChargesSummary { fromPrice, extraCharges }.
 *
 *   · startTimesOn(schedule, date, asOf): per option, the season holding the date —
 *     "if [endDate] is not returned … the season extends 384 days into the future
 *     from the present time" (the read's as-of) — then the pricing record whose
 *     daysOfWeek holds the weekday, then its timed entries; a date named in the
 *     RECORD's unavailableDates or the ENTRY's is refused with the vendor's reason
 *     VERBATIM (NOT_OPERATING · SOLD_OUT — never mapped); no timed entry on the
 *     date → "no start time stated by the operator for <date>" and the Save carries
 *     no clock. Never a default. No zone conversion.
 *   · partyCost(details, party, date, asOf): per band, PER_PERSON → price × count,
 *     UNIT → unit price × units, anything else REFUSES; min / max travellers from
 *     the payload; the SPECIAL price only when the read's date is inside offerStart
 *     / offerEnd AND the travel date inside travelStart / travelEnd, named; else
 *     the original, named. The figure is the supplier's currency, never converted
 *     here (src/lib/activities/fx.ts converts, labelled).
 *   · extraChargesFor(schedule, travellers): extraChargesSummary.extraCharges is
 *     "the highest amount that a traveler could be asked to pay in-destination" —
 *     one per-traveller figure; the party's figure is that × travellers, and the
 *     product's exclusion text itemizes it in the operator's words.
 *
 * Probed on the captured 27424P2 schedule (fixtureViatorSchedule.27424p2.json):
 * seven options, every season open-ended, TG29 04:30 and TG30 07:30 sold out on
 * 2026-09-23, adult and child bands PER_PERSON, a special price through 15 October.
 *
 * PURE: no fetch, no env. The one tri-state helper is src/lib/travel/stated.ts.
 */

import { type Stated, statedNumber, statedString } from '@/lib/travel/stated';
import type { Party } from '@/lib/activities/product';

export const NOT_STATED = 'not stated by the operator';
/** The docs: a season with no endDate "extends 384 days into the future from the present time". */
export const SEASON_OPEN_DAYS = 384;
export const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

// ─── The vendor's shape, read structurally ───────────────────────────────────

export interface RawUnavailableDate { date?: string; reason?: string }
export interface RawPricingDetails {
  ageBand?: string;
  pricingPackageType?: string;
  minTravelers?: number;
  maxTravelers?: number;
  price?: {
    original?: { recommendedRetailPrice?: number };
    special?: { recommendedRetailPrice?: number; offerStartDate?: string; offerEndDate?: string; travelStartDate?: string; travelEndDate?: string };
  };
}
export interface RawPricingRecord {
  daysOfWeek?: string[];
  timedEntries?: Array<{ startTime?: string; unavailableDates?: RawUnavailableDate[] }>;
  unavailableDates?: RawUnavailableDate[];
  pricingDetails?: RawPricingDetails[];
}
export interface RawSeason { startDate?: string; endDate?: string; pricingRecords?: RawPricingRecord[] }
export interface RawBookableItem { productOptionCode?: string; seasons?: RawSeason[] }
export interface RawSchedule {
  productCode?: string;
  currency?: string;
  summary?: { fromPrice?: number; fromPriceBeforeDiscount?: number };
  extraChargesSummary?: { fromPrice?: number; fromPriceBeforeDiscount?: number; extraCharges?: number };
  bookableItems?: RawBookableItem[];
}

// ─── Dates, on the calendar the vendor states them on (no zone conversion) ───

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateText(s: unknown): s is string {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** The weekday of a YYYY-MM-DD, as the vendor names it. */
export function weekdayOf(date: string): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** YYYY-MM-DD plus whole days. */
export function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A season holds a date from its startDate to its endDate, or to 384 days after the read when it states none. */
export function seasonHolds(season: RawSeason, date: string, asOfDate: string): boolean {
  const start = statedString(season.startDate);
  if (start === null || !isDateText(start)) return false;
  const end = statedString(season.endDate);
  const last = end !== null && isDateText(end) ? end : plusDays(asOfDate, SEASON_OPEN_DAYS);
  return start <= date && date <= last;
}

// ─── The start times on a date ───────────────────────────────────────────────

export interface StartTimeOn {
  startTime: string;
  /** The vendor's reason for the date, verbatim, or null when the entry does not name it. */
  unavailable: Stated<string>;
}

export interface OptionOn {
  productOptionCode: Stated<string>;
  /** Why the option carries no start time on the date, or null when it does. */
  refused: Stated<string>;
  /** The vendor's reason when the RECORD names the date (the whole option is unavailable that day). */
  dayUnavailable: Stated<string>;
  startTimes: StartTimeOn[];
  /** The record's pricing details for the date, as stated. */
  pricingDetails: RawPricingDetails[];
}

function reasonFor(list: RawUnavailableDate[] | undefined, date: string): Stated<string> {
  const hit = (Array.isArray(list) ? list : []).find((u) => statedString(u?.date) === date);
  if (!hit) return null;
  return statedString(hit.reason) ?? 'unavailable (reason not stated by the operator)';
}

/**
 * Every option's published start times on `date`, read as of `asOf` (the read's
 * timestamp — the open-ended season's end is measured from it).
 */
export function startTimesOn(schedule: RawSchedule, date: string, asOf: string): OptionOn[] {
  const asOfDate = asOf.slice(0, 10);
  const weekday = weekdayOf(date);
  const items = Array.isArray(schedule.bookableItems) ? schedule.bookableItems : [];
  return items.map((item) => {
    const code = statedString(item?.productOptionCode);
    const season = (Array.isArray(item?.seasons) ? item.seasons! : []).find((s) => seasonHolds(s, date, asOfDate));
    if (!season) return { productOptionCode: code, refused: `no season stated by the operator holds ${date}`, dayUnavailable: null, startTimes: [], pricingDetails: [] };
    const record = (Array.isArray(season.pricingRecords) ? season.pricingRecords : []).find((r) => Array.isArray(r?.daysOfWeek) && r.daysOfWeek.includes(weekday));
    if (!record) return { productOptionCode: code, refused: `the operator states no pricing record for a ${weekday.toLowerCase()} in the season holding ${date}`, dayUnavailable: null, startTimes: [], pricingDetails: [] };
    const dayUnavailable = reasonFor(record.unavailableDates, date);
    const details = Array.isArray(record.pricingDetails) ? record.pricingDetails : [];
    if (!Array.isArray(record.timedEntries) || record.timedEntries.length === 0) {
      return { productOptionCode: code, refused: `no start time stated by the operator for ${date}`, dayUnavailable, startTimes: [], pricingDetails: details };
    }
    const startTimes = record.timedEntries
      .map((t) => ({ startTime: statedString(t?.startTime), unavailable: reasonFor(t?.unavailableDates, date) }))
      .filter((t): t is StartTimeOn => t.startTime !== null);
    if (startTimes.length === 0) return { productOptionCode: code, refused: `no start time stated by the operator for ${date}`, dayUnavailable, startTimes: [], pricingDetails: details };
    return { productOptionCode: code, refused: dayUnavailable, dayUnavailable, startTimes, pricingDetails: details };
  });
}

/** "no start time stated by the operator for 2026-09-23" */
export function noStartTimeText(date: string): string {
  return `no start time stated by the operator for ${date}`;
}

// ─── The party's cost in the supplier's currency ─────────────────────────────

export interface PriceLine {
  ageBand: string;
  count: number;
  pricingPackageType: string;
  /** The unit price the operator stated, and which one: the original or the special (with its windows). */
  unitPrice: number;
  basis: 'original' | 'special';
  subtotal: number;
}

export interface PartyCost {
  currency: Stated<string>;
  lines: PriceLine[];
  /** The party's total, the supplier's currency, before extra charges. */
  total: number;
}

function inWindow(date: string, from: Stated<string>, to: Stated<string>): boolean {
  if (from === null || to === null || !isDateText(from) || !isDateText(to)) return false;
  return from <= date && date <= to;
}

/**
 * The party's cost from the record's pricingDetails, one method: per band the
 * operator priced, PER_PERSON → price × count, UNIT → price × units; the special
 * price only when the read's date sits inside its offer window AND the travel date
 * inside its travel window. Refuses by name: a band the operator did not price, a
 * count outside its min / max, a package type the docs do not name.
 */
export function partyCost(details: readonly RawPricingDetails[], party: Party, date: string, asOf: string, currency: Stated<string>): PartyCost | { refused: string } {
  const asOfDate = asOf.slice(0, 10);
  const lines: PriceLine[] = [];
  for (const [band, count] of Object.entries(party)) {
    if (!Number.isInteger(count) || count < 0) return { refused: `${band}: a whole number of travellers is required` };
    if (count === 0) continue;
    const d = details.find((x) => statedString(x?.ageBand) === band);
    if (!d) return { refused: `${band}: the operator states no price for this band on ${date}` };
    const type = statedString(d.pricingPackageType);
    if (type !== 'PER_PERSON' && type !== 'UNIT') return { refused: `${band}: the operator's pricing package type ${type === null ? 'is not stated' : `"${type}"`} is not one this reader prices (PER_PERSON, UNIT)` };
    const min = statedNumber(d.minTravelers), max = statedNumber(d.maxTravelers);
    if (min !== null && count < min) return { refused: `${band}: the operator requires at least ${min} for this price` };
    if (max !== null && count > max) return { refused: `${band}: the operator allows at most ${max} for this price` };
    const original = statedNumber(d.price?.original?.recommendedRetailPrice);
    if (original === null) return { refused: `${band}: the operator states no recommendedRetailPrice` };
    const sp = d.price?.special;
    const special = statedNumber(sp?.recommendedRetailPrice);
    const useSpecial = special !== null && inWindow(asOfDate, statedString(sp?.offerStartDate), statedString(sp?.offerEndDate)) && inWindow(date, statedString(sp?.travelStartDate), statedString(sp?.travelEndDate));
    const unitPrice = useSpecial ? special : original;
    const subtotal = Math.round(unitPrice * count * 100) / 100;
    lines.push({ ageBand: band, count, pricingPackageType: type, unitPrice, basis: useSpecial ? 'special' : 'original', subtotal });
  }
  if (lines.length === 0) return { refused: 'the party holds no travellers' };
  return { currency, lines, total: Math.round(lines.reduce((n, l) => n + l.subtotal, 0) * 100) / 100 };
}

export interface ExtraCharges {
  /** extraChargesSummary.extraCharges — the operator's per-traveller in-destination figure. */
  perTraveller: number;
  travellers: number;
  /** perTraveller × travellers, the supplier's currency. */
  total: number;
}

/** The party's in-destination charges from the schedule's stated per-traveller figure, or null when the operator states none. */
export function extraChargesFor(schedule: RawSchedule, travellers: number): Stated<ExtraCharges> {
  const per = statedNumber(schedule.extraChargesSummary?.extraCharges);
  if (per === null) return null;
  return { perTraveller: per, travellers, total: Math.round(per * travellers * 100) / 100 };
}

/** "2 × ADULT at 3,510.00 THB (special) = 7,020.00 THB" */
export function priceLineText(line: PriceLine, currency: Stated<string>): string {
  const cur = currency ?? `(currency ${NOT_STATED})`;
  return `${line.count} × ${line.ageBand} at ${line.unitPrice.toFixed(2)} ${cur} (${line.basis}${line.pricingPackageType === 'UNIT' ? ', per unit' : ''}) = ${line.subtotal.toFixed(2)} ${cur}`;
}
