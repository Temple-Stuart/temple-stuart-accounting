/**
 * quote — WHAT THE SERVER READ FROM VIATOR, AND NOTHING ELSE (ACTIVITY-01 STEP 4b, 2026-09-22).
 *
 * A QUOTE is the options route's own reading of one bookable pick: one product option
 * at one published start time on one date, for one signed-in founder. It carries the
 * facts the price and the clock follow from — the band unit price that applies ON THE
 * DATE and which one it is (the original, or the special with the windows that made it
 * apply), the operator's per-price and per-booking limits, whether an adult is
 * required, the supplier's currency, the in-destination charge per traveller, the
 * vendor's rate with its own expiry, the stated duration, the stated zone, the
 * cancellation policy, and when it was read.
 *
 * The route seals it (src/lib/activities/quoteSeal.ts) and hands the pair to the
 * browser. The browser prices parties against it and posts back the quote, its seal
 * and the party — NO FIGURE. vendor-commit verifies the seal and then recomputes the
 * native cost, the extra charges, the total, the note, the start and the end from the
 * sealed quote alone. A quote whose bytes changed does not verify; a quote issued for
 * another user is refused; a quote older than QUOTE_MAX_AGE_MINUTES is refused.
 *
 * WHY THE SPECIAL PRICE IS RESOLVED HERE, at seal time: partyCost takes the special
 * only when the READ's date sits inside the offer window and the TRAVEL date inside
 * the travel window (src/lib/activities/schedule.ts). Both dates are known when the
 * route reads the schedule, so the unit price that applies is settled then, sealed,
 * and cannot be re-argued by a caller who sends a different clock.
 *
 * An unavailable start time is quoted too, carrying the vendor's reason VERBATIM, so
 * the screen can show what the operator said and price it for comparison — and the
 * commit refuses it by that same reason. A row the operator did not publish carries
 * no quote at all.
 *
 * PURE: no fetch, no env, no clock of its own (every `now` is passed in).
 */

import { type Stated, statedBoolean, statedNumber, statedString } from '@/lib/travel/stated';
import { durationText, type ActivityDuration } from '@/lib/activities/products';
import { type Party, type ProductFacts, partyMeetsProduct, partySize } from '@/lib/activities/product';
import { isDateText, type ExtraCharges, type OptionOn, type PriceLine, type RawPricingDetails } from '@/lib/activities/schedule';
import { CALCULATED, RATE_SOURCE, type RateRecord, isExpired } from '@/lib/activities/fx';
import { NOT_STATED, type ViatorSave, activitySaveNoteOf, endTimeOf, totalOf } from '@/lib/activities/save';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How long a sealed quote may be acted on: ONE Save session against a PUBLISHED
 * timetable. The schedule endpoint answers published start times and prices, not a
 * live seat check, so a quote does not go stale in seconds the way a live hold would
 * — but the vendor's own rate carries its own expiry (honoured separately and always),
 * and the operator can republish. Thirty minutes is a stated policy, not a guess: long
 * enough to fill the party form and pick a time, short enough that a Save is answering
 * what the server actually read. Past it the founder checks availability again.
 */
export const QUOTE_MAX_AGE_MINUTES = 30;

/** The unit price the operator states for one age band on the quote's date, and the limits around it. */
export interface QuoteBand {
  ageBand: string;
  /** PER_PERSON or UNIT, as the operator states it — anything else never reaches a quote. */
  pricingPackageType: string;
  /** The price that applies ON the date: the special when both windows held at the read, else the original. */
  unitPrice: number;
  basis: 'original' | 'special';
  /** The special's own windows, as stated, so the sealed quote says why that price applied. */
  offerStartDate: Stated<string>;
  offerEndDate: Stated<string>;
  travelStartDate: Stated<string>;
  travelEndDate: Stated<string>;
  /** The operator's minimum / maximum travellers for THIS price (the pricing record). */
  min: Stated<number>;
  max: Stated<number>;
  /** The operator's minimum / maximum for this band PER BOOKING (the product). */
  minPerBooking: Stated<number>;
  maxPerBooking: Stated<number>;
}

export interface ViatorQuote {
  v: 1;
  /** The signed-in founder this quote was issued to — the commit refuses anyone else's. */
  userId: string;
  productCode: string;
  productOptionCode: string;
  optionTitle: Stated<string>;
  title: string;
  date: string;
  /** The published start time, or null when the operator publishes none for the date. */
  startTime: Stated<string>;
  /** The vendor's reason this start time cannot be taken, VERBATIM, or null. */
  unavailable: Stated<string>;
  /** The operator's stated IANA zone, or null — never guessed. */
  timeZone: Stated<string>;
  /** The duration as stated: fixed minutes, a variable range, or the operator's own text. */
  duration: Stated<ActivityDuration>;
  bands: QuoteBand[];
  /** The operator's per-booking limits across all bands. */
  minPerBooking: Stated<number>;
  maxPerBooking: Stated<number>;
  requiresAdultForBooking: Stated<boolean>;
  /** The SUPPLIER's currency — what the bands and the extra charge are stated in. */
  currency: string;
  /** extraChargesSummary.extraCharges, per traveller, or null when the operator states none. */
  extraPerTraveller: Stated<number>;
  /** The vendor's own rate to the plan's currency, or null when the schedule already answers in it. */
  rate: RateRecord | null;
  cancellation: string;
  /** When the route read the schedule. */
  asOf: string;
}

// ─── Building the quote (the options route, from what it just read) ───────────

function bandOf(d: RawPricingDetails, date: string, asOfDate: string, facts: ProductFacts): QuoteBand | { refused: string } {
  const ageBand = statedString(d?.ageBand);
  if (ageBand === null) return { refused: 'the operator prices a band it does not name' };
  const type = statedString(d.pricingPackageType);
  if (type !== 'PER_PERSON' && type !== 'UNIT') return { refused: `${ageBand}: the operator's pricing package type ${type === null ? 'is not stated' : `"${type}"`} is not one this reader prices (PER_PERSON, UNIT)` };
  const original = statedNumber(d.price?.original?.recommendedRetailPrice);
  if (original === null) return { refused: `${ageBand}: the operator states no recommendedRetailPrice` };
  const sp = d.price?.special;
  const special = statedNumber(sp?.recommendedRetailPrice);
  const offerStartDate = statedString(sp?.offerStartDate), offerEndDate = statedString(sp?.offerEndDate);
  const travelStartDate = statedString(sp?.travelStartDate), travelEndDate = statedString(sp?.travelEndDate);
  const held = (d1: string, from: Stated<string>, to: Stated<string>): boolean => from !== null && to !== null && isDateText(from) && isDateText(to) && from <= d1 && d1 <= to;
  const useSpecial = special !== null && held(asOfDate, offerStartDate, offerEndDate) && held(date, travelStartDate, travelEndDate);
  const booking = facts.bands.find((b) => b.ageBand === ageBand);
  return {
    ageBand,
    pricingPackageType: type,
    unitPrice: useSpecial ? special : original,
    basis: useSpecial ? 'special' : 'original',
    offerStartDate: useSpecial ? offerStartDate : null,
    offerEndDate: useSpecial ? offerEndDate : null,
    travelStartDate: useSpecial ? travelStartDate : null,
    travelEndDate: useSpecial ? travelEndDate : null,
    min: statedNumber(d.minTravelers),
    max: statedNumber(d.maxTravelers),
    minPerBooking: booking?.minTravelersPerBooking ?? null,
    maxPerBooking: booking?.maxTravelersPerBooking ?? null,
  };
}

export interface QuotedStartTime {
  startTime: Stated<string>;
  unavailable: Stated<string>;
  quote: ViatorQuote | null;
  /** Why this row carries no quote (the operator prices nothing this reader can price), or null. */
  refused: Stated<string>;
}

/**
 * Every quote one option offers on the date: one per published start time (an
 * unavailable one included, carrying the vendor's reason), or a single startTime-null
 * quote when the operator publishes no time for the date but still prices the day.
 */
export function quotesForOption(
  userId: string,
  facts: ProductFacts,
  option: OptionOn,
  date: string,
  currency: string,
  extraPerTraveller: Stated<number>,
  rate: RateRecord | null,
  asOf: string,
): QuotedStartTime[] {
  if (option.productOptionCode === null || option.refused !== null) return [];
  const asOfDate = asOf.slice(0, 10);
  const bands: QuoteBand[] = [];
  for (const d of option.pricingDetails) {
    const band = bandOf(d, date, asOfDate, facts);
    if ('refused' in band) continue; // a band this reader cannot price is left out; a party naming it is refused at the recompute.
    bands.push(band);
  }
  const base = {
    v: 1 as const,
    userId,
    productCode: facts.productCode,
    productOptionCode: option.productOptionCode,
    optionTitle: facts.options.find((o) => o.productOptionCode === option.productOptionCode)?.title ?? null,
    title: facts.title ?? '',
    date,
    timeZone: facts.timeZone,
    duration: facts.duration,
    bands,
    minPerBooking: facts.minTravelersPerBooking,
    maxPerBooking: facts.maxTravelersPerBooking,
    requiresAdultForBooking: facts.requiresAdultForBooking,
    currency,
    extraPerTraveller,
    rate,
    cancellation: cancellationOf(facts),
    asOf,
  };
  if (bands.length === 0) return [{ startTime: null, unavailable: null, quote: null, refused: `the operator prices no age band this reader can price for ${date}` }];
  const rows = option.startTimes.length > 0
    ? option.startTimes.map((s) => ({ startTime: s.startTime as Stated<string>, unavailable: s.unavailable }))
    : [{ startTime: null as Stated<string>, unavailable: option.dayUnavailable }];
  return rows.map((r) => ({ startTime: r.startTime, unavailable: r.unavailable, refused: null, quote: { ...base, startTime: r.startTime, unavailable: r.unavailable } }));
}

/** The cancellation sentence the quote seals — the product's own words, or its silence. */
function cancellationOf(facts: ProductFacts): string {
  if (facts.cancellationType === null && facts.cancellationDescription === null) return `cancellation policy ${NOT_STATED}`;
  return [facts.cancellationType, facts.cancellationDescription].filter((s): s is string => s !== null).join(' — ');
}

// ─── Reading a quote back (vendor-commit, after the seal verified) ────────────

function readBand(v: unknown): QuoteBand | { refused: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return { refused: 'viatorQuote.bands must hold objects' };
  const b = v as Record<string, unknown>;
  const ageBand = statedString(b.ageBand); if (ageBand === null) return { refused: 'viatorQuote.bands[].ageBand is required' };
  const pricingPackageType = statedString(b.pricingPackageType);
  if (pricingPackageType !== 'PER_PERSON' && pricingPackageType !== 'UNIT') return { refused: `${ageBand}: viatorQuote.bands[].pricingPackageType must be PER_PERSON or UNIT` };
  const unitPrice = statedNumber(b.unitPrice); if (unitPrice === null || unitPrice < 0) return { refused: `${ageBand}: viatorQuote.bands[].unitPrice must be a non-negative number` };
  const basis = b.basis; if (basis !== 'original' && basis !== 'special') return { refused: `${ageBand}: viatorQuote.bands[].basis must be 'original' or 'special'` };
  return {
    ageBand, pricingPackageType, unitPrice, basis,
    offerStartDate: statedString(b.offerStartDate), offerEndDate: statedString(b.offerEndDate),
    travelStartDate: statedString(b.travelStartDate), travelEndDate: statedString(b.travelEndDate),
    min: statedNumber(b.min), max: statedNumber(b.max),
    minPerBooking: statedNumber(b.minPerBooking), maxPerBooking: statedNumber(b.maxPerBooking),
  };
}

function readDuration(v: unknown): Stated<ActivityDuration> | { refused: string } {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return { refused: 'viatorQuote.duration must be the stated duration or null' };
  const d = v as Record<string, unknown>;
  if (d.kind === 'fixed') { const m = statedNumber(d.minutes); return m === null || m < 0 ? { refused: 'viatorQuote.duration.minutes must be a non-negative number' } : { kind: 'fixed', minutes: m }; }
  if (d.kind === 'variable') {
    const from = statedNumber(d.fromMinutes), to = statedNumber(d.toMinutes);
    if (from === null || to === null || from < 0 || to < from) return { refused: 'viatorQuote.duration must carry a variable range the operator stated' };
    return { kind: 'variable', fromMinutes: from, toMinutes: to };
  }
  if (d.kind === 'unstructured') { const t = statedString(d.text); return t === null ? { refused: 'viatorQuote.duration.text is required' } : { kind: 'unstructured', text: t }; }
  return { refused: 'viatorQuote.duration.kind must be fixed, variable or unstructured' };
}

/** vendor-commit's reader: the posted quote, every field typed, or refused by name. */
export function readViatorQuote(input: unknown): ViatorQuote | { refused: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { refused: 'viatorQuote must be an object' };
  const q = input as Record<string, unknown>;
  if (q.v !== 1) return { refused: 'viatorQuote.v must be 1' };
  const userId = statedString(q.userId); if (userId === null) return { refused: 'viatorQuote.userId is required' };
  const productCode = statedString(q.productCode); if (productCode === null) return { refused: 'viatorQuote.productCode is required' };
  const productOptionCode = statedString(q.productOptionCode); if (productOptionCode === null) return { refused: 'viatorQuote.productOptionCode is required' };
  const title = statedString(q.title) ?? '';
  const date = statedString(q.date); if (date === null || !DATE.test(date)) return { refused: 'viatorQuote.date must be YYYY-MM-DD' };
  const startTime = statedString(q.startTime); if (startTime !== null && !HHMM.test(startTime)) return { refused: 'viatorQuote.startTime must be HH:MM or null' };
  const currency = statedString(q.currency); if (currency === null) return { refused: 'viatorQuote.currency is required' };
  const duration = readDuration(q.duration); if (duration !== null && 'refused' in duration) return duration;
  const rawBands = q.bands; if (!Array.isArray(rawBands) || rawBands.length === 0) return { refused: 'viatorQuote.bands must hold at least one priced age band' };
  const bands: QuoteBand[] = [];
  for (const raw of rawBands) { const b = readBand(raw); if ('refused' in b) return b; bands.push(b); }
  let rate: RateRecord | null = null;
  if (q.rate !== null && q.rate !== undefined) {
    const r = q.rate as Record<string, unknown>;
    const rr = statedNumber(r.rate), src = statedString(r.sourceCurrency), tgt = statedString(r.targetCurrency), lu = statedString(r.lastUpdated), ex = statedString(r.expiry);
    if (rr === null || rr <= 0 || src === null || tgt === null || lu === null || ex === null || Number.isNaN(Date.parse(ex)) || r.source !== RATE_SOURCE) return { refused: `viatorQuote.rate must be the vendor's own rate (${RATE_SOURCE}) with its lastUpdated and expiry` };
    rate = { rate: rr, sourceCurrency: src, targetCurrency: tgt, lastUpdated: lu, expiry: ex, source: RATE_SOURCE };
  }
  const asOf = statedString(q.asOf); if (asOf === null || Number.isNaN(Date.parse(asOf))) return { refused: 'viatorQuote.asOf must be the read\'s timestamp' };
  return {
    v: 1, userId, productCode, productOptionCode,
    optionTitle: statedString(q.optionTitle), title, date, startTime,
    unavailable: statedString(q.unavailable), timeZone: statedString(q.timeZone),
    duration: duration as Stated<ActivityDuration>, bands,
    minPerBooking: statedNumber(q.minPerBooking), maxPerBooking: statedNumber(q.maxPerBooking),
    requiresAdultForBooking: statedBoolean(q.requiresAdultForBooking),
    currency, extraPerTraveller: statedNumber(q.extraPerTraveller), rate,
    cancellation: statedString(q.cancellation) ?? `cancellation policy ${NOT_STATED}`, asOf,
  };
}

// ─── Recomputing from the quote (the screen and the commit, one method) ───────

/** Minutes between the quote's read and `now` — the age the commit checks against QUOTE_MAX_AGE_MINUTES. */
export function quoteAgeMinutes(quote: Pick<ViatorQuote, 'asOf'>, now: Date): number {
  return (now.getTime() - Date.parse(quote.asOf)) / 60000;
}

export interface QuotePrice {
  lines: PriceLine[];
  native: { amount: number; currency: string };
  extra: Stated<ExtraCharges>;
  total: ViatorSave['total'];
}

/** The party the operator allows, checked against the SEALED limits (the product's rules, via the one checker). */
export function partyMeetsQuote(quote: ViatorQuote, party: Party): { ok: true } | { refused: string } {
  const facts = {
    bands: quote.bands.map((b) => ({ ageBand: b.ageBand, startAge: null, endAge: null, minTravelersPerBooking: b.minPerBooking, maxTravelersPerBooking: b.maxPerBooking })),
    minTravelersPerBooking: quote.minPerBooking,
    maxTravelersPerBooking: quote.maxPerBooking,
    requiresAdultForBooking: quote.requiresAdultForBooking,
  } as ProductFacts;
  return partyMeetsProduct(facts, party);
}

/**
 * The party's cost from the SEALED bands: PER_PERSON → price × count, UNIT → price ×
 * units, the extra charges per traveller, and the plan's total through fx.ts. Refuses
 * by name: a band the quote does not price, a count outside the sealed limits, a
 * party the operator's booking rules do not allow.
 */
export function priceQuote(quote: ViatorQuote, party: Party, targetCurrency: string, now: Date): QuotePrice | { refused: string } {
  const rules = partyMeetsQuote(quote, party);
  if ('refused' in rules) return rules;
  const lines: PriceLine[] = [];
  for (const [band, count] of Object.entries(party)) {
    if (!Number.isInteger(count) || count < 0) return { refused: `${band}: a whole number of travellers is required` };
    if (count === 0) continue;
    const b = quote.bands.find((x) => x.ageBand === band);
    if (!b) return { refused: `${band}: the operator states no price for this band on ${quote.date}` };
    if (b.min !== null && count < b.min) return { refused: `${band}: the operator requires at least ${b.min} for this price` };
    if (b.max !== null && count > b.max) return { refused: `${band}: the operator allows at most ${b.max} for this price` };
    lines.push({ ageBand: band, count, pricingPackageType: b.pricingPackageType, unitPrice: b.unitPrice, basis: b.basis, subtotal: Math.round(b.unitPrice * count * 100) / 100 });
  }
  if (lines.length === 0) return { refused: 'the party holds no travellers' };
  const travellers = partySize(party);
  const nativeAmount = Math.round(lines.reduce((n, l) => n + l.subtotal, 0) * 100) / 100;
  const extra: Stated<ExtraCharges> = quote.extraPerTraveller === null ? null : { perTraveller: quote.extraPerTraveller, travellers, total: Math.round(quote.extraPerTraveller * travellers * 100) / 100 };
  const native = { amount: nativeAmount, currency: quote.currency };
  const total = totalOf({ native, extra, rate: quote.rate }, targetCurrency, now);
  if ('refused' in total) return total;
  return { lines, native, extra, total };
}

export interface QuoteEnd {
  endTime: Stated<string>;
  /** True when the operator states no end this reader can derive — the block draws as a flagged marker. */
  flagged: boolean;
}

/**
 * The tour's end: a FIXED duration derives it; a VARIABLE one takes the founder's own
 * pick, which must lie inside the operator's stated range; an unstructured or unstated
 * duration draws none. A pick outside the range, or sent where the operator states a
 * fixed duration, is refused by name.
 */
export function endOfQuote(quote: ViatorQuote, endTimeChosen: unknown): QuoteEnd | { refused: string } {
  const chosen = typeof endTimeChosen === 'string' && endTimeChosen.trim() !== '' ? endTimeChosen : null;
  const d = quote.duration;
  if (d !== null && d.kind === 'fixed') {
    const derived = endTimeOf(quote.startTime, d);
    if (chosen !== null && chosen !== derived) return { refused: `the operator states a fixed duration of ${d.minutes} minutes, so the end is ${derived ?? 'not derivable inside the day'} — an end time may not be chosen; nothing was saved` };
    return { endTime: derived, flagged: derived === null };
  }
  if (d !== null && d.kind === 'variable') {
    if (chosen === null) return { endTime: null, flagged: true };
    if (!HHMM.test(chosen)) return { refused: 'endTimeChosen must be HH:MM; nothing was saved' };
    if (quote.startTime === null) return { refused: 'the operator publishes no start time for this date, so no end can be chosen; nothing was saved' };
    const [sh, sm] = quote.startTime.split(':').map(Number);
    const [eh, em] = chosen.split(':').map(Number);
    const start = sh * 60 + sm, end = eh * 60 + em;
    const lo = start + d.fromMinutes, hi = start + d.toMinutes;
    if (end < lo || end > hi) return { refused: `the operator states ${durationText(d)}, so the end must sit between ${minutesClock(lo)} and ${minutesClock(hi)} — ${chosen} does not; nothing was saved` };
    return { endTime: chosen, flagged: false };
  }
  if (chosen !== null) return { refused: `the operator states ${durationText(d)}, so no end time may be chosen; nothing was saved` };
  return { endTime: null, flagged: true };
}

/** Minutes past midnight as a clock, past midnight rolling into the next day's hours. */
function minutesClock(total: number): string {
  const h = Math.floor(total / 60) % 24, m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${total >= 24 * 60 ? ' the next day' : ''}`;
}

/**
 * The line vendor-commit writes, built from the SEALED quote and the party alone: the
 * priced figures, the note the same facts write, and the end the duration allows.
 * Refuses by name: an unavailable start time (the operator's own reason), an expired
 * rate, a party the operator does not allow, an end outside the range. The quote's own
 * age is checked by the commit before it calls this (quoteAgeMinutes).
 */
export function saveFromQuote(quote: ViatorQuote, party: Party, endTimeChosen: unknown, targetCurrency: string, now: Date): ViatorSave | { refused: string } {
  if (quote.unavailable !== null) return { refused: `the operator states ${quote.startTime ?? quote.date} as ${quote.unavailable}; nothing was saved` };
  if (quote.rate !== null && isExpired(quote.rate, now)) return { refused: `the Viator ${quote.rate.sourceCurrency}→${quote.rate.targetCurrency} rate expired at ${quote.rate.expiry} — check availability again for a current rate; nothing was saved` };
  const priced = priceQuote(quote, party, targetCurrency, now);
  if ('refused' in priced) return { refused: `${priced.refused}; nothing was saved` };
  const end = endOfQuote(quote, endTimeChosen);
  if ('refused' in end) return end;
  return {
    productCode: quote.productCode,
    productOptionCode: quote.productOptionCode,
    optionTitle: quote.optionTitle,
    title: quote.title,
    date: quote.date,
    startTime: quote.startTime,
    endTime: end.endTime,
    timeZone: quote.timeZone,
    duration: quote.duration,
    party,
    native: priced.native,
    extra: priced.extra,
    rate: quote.rate,
    total: priced.total,
    cancellation: quote.cancellation,
    asOf: quote.asOf,
  };
}

/** The note the commit stores — written from the derived line, never from the caller. */
export function noteFromQuote(save: ViatorSave): string {
  return activitySaveNoteOf(save);
}

export { CALCULATED };
