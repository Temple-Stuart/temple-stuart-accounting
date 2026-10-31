/**
 * fx — A CONVERTED FIGURE IS LABELLED CALCULATED (ACTIVITY-01 STEP 4, 2026-09-22).
 *
 * The schedule prices in the supplier's currency (THB for Phuket) and every plan
 * amount is USD (ACTIVITY_SEARCH_CURRENCY — the one constant). The vendor states
 * the rate: POST /exchange-rates { sourceCurrencies, targetCurrencies } (docs.viator.
 * com/partner-api/technical, operationId exchangeRates; ✅ for a Basic-access
 * Affiliate) answers rates[] { sourceCurrency, targetCurrency, rate ("value of
 * targetCurrency per unit of sourceCurrency"), lastUpdated, expiry }, and the docs
 * instruct: "Exchange rates should be cached and refreshed based on the expiry
 * timestamp" and the conversion must use rates "valid at the time of conversion (as
 * given in the expiry field)". So:
 *
 *   · rateOf(raw, source, target) reads the pair's rate with every field stated,
 *     else refuses by name;
 *   · convert(native, rate, now) → the USD figure rounded half-up to the cent,
 *     LABELLED 'calculated', carrying { native, currency, rate, source: 'viator
 *     /exchange-rates', lastUpdated, expiry } — refused by name when the rate's
 *     source is not the native currency, or when the rate has expired at `now`;
 *     never a rate typed here, never applied silently.
 *   · conversionLine(calc) is the words the note and the screen carry:
 *     "THB 2,520.00 × 0.0308188425 (Viator rate as of 2026-09-21T23:59:59Z,
 *     expires 2026-09-23T01:09:59Z) = USD 77.66 · calculated".
 *
 * Reconciled on the captures (fixtureViatorExchangeRates.thb-usd.json): the
 * schedule's from-price 2,520 THB × 0.0308188425 = 77.66 USD, the search's own
 * from-price to the cent; the schedule's 400 THB extra charges × the rate = 12.33,
 * NOT the search's 12.03 — both asserted as facts, neither explained.
 *
 * PURE: no fetch, no env, no clock of its own (`now` is passed in).
 */

import { type Stated, statedNumber, statedString } from '@/lib/travel/stated';

export const RATE_SOURCE = 'viator /exchange-rates';
export const CALCULATED = 'calculated';

export interface RawExchangeRates {
  rates?: Array<{ sourceCurrency?: string; targetCurrency?: string; rate?: number; lastUpdated?: string; expiry?: string }>;
}

export interface RateRecord {
  sourceCurrency: string;
  targetCurrency: string;
  /** targetCurrency per unit of sourceCurrency, as stated. */
  rate: number;
  lastUpdated: string;
  expiry: string;
  source: typeof RATE_SOURCE;
}

/** The pair's rate from the vendor's answer, every field stated — or refused by name. */
export function rateOf(raw: RawExchangeRates, source: string, target: string): RateRecord | { refused: string } {
  const list = Array.isArray(raw?.rates) ? raw.rates : [];
  const hit = list.find((r) => statedString(r?.sourceCurrency) === source && statedString(r?.targetCurrency) === target);
  if (!hit) return { refused: `the vendor stated no ${source}→${target} rate` };
  const rate = statedNumber(hit.rate);
  const lastUpdated = statedString(hit.lastUpdated);
  const expiry = statedString(hit.expiry);
  if (rate === null || rate <= 0) return { refused: `the vendor's ${source}→${target} rate is not a positive number` };
  if (lastUpdated === null || Number.isNaN(Date.parse(lastUpdated))) return { refused: `the vendor's ${source}→${target} rate carries no readable lastUpdated` };
  if (expiry === null || Number.isNaN(Date.parse(expiry))) return { refused: `the vendor's ${source}→${target} rate carries no readable expiry` };
  return { sourceCurrency: source, targetCurrency: target, rate, lastUpdated, expiry, source: RATE_SOURCE };
}

/** A rate is expired once `now` reaches its expiry. */
export function isExpired(rate: Pick<RateRecord, 'expiry'>, now: Date): boolean {
  return now.getTime() >= Date.parse(rate.expiry);
}

/** Half-up to the cent (Math.round rounds a positive half up). */
export function roundHalfUpCents(x: number): number {
  return Math.round(x * 100 + Number.EPSILON) / 100;
}

export interface Calculated {
  label: typeof CALCULATED;
  native: number;
  currency: string;
  rate: number;
  target: string;
  amount: number;
  source: typeof RATE_SOURCE;
  lastUpdated: string;
  expiry: string;
}

/** The native amount at the vendor's rate, labelled calculated — or refused by name. */
export function convert(native: { amount: number; currency: string }, rate: RateRecord, now: Date): Calculated | { refused: string } {
  if (!Number.isFinite(native.amount) || native.amount < 0) return { refused: 'the native amount is not a non-negative number' };
  if (native.currency !== rate.sourceCurrency) return { refused: `the rate converts ${rate.sourceCurrency}, the amount is ${native.currency}` };
  if (isExpired(rate, now)) return { refused: `the Viator ${rate.sourceCurrency}→${rate.targetCurrency} rate expired at ${rate.expiry} — check availability again for a current rate` };
  return {
    label: CALCULATED,
    native: native.amount,
    currency: native.currency,
    rate: rate.rate,
    target: rate.targetCurrency,
    amount: roundHalfUpCents(native.amount * rate.rate),
    source: RATE_SOURCE,
    lastUpdated: rate.lastUpdated,
    expiry: rate.expiry,
  };
}

/** "THB 2,520.00 × 0.0308188425 (Viator rate as of 2026-09-21T23:59:59Z, expires 2026-09-23T01:09:59Z) = USD 77.66 · calculated" */
export function conversionLine(calc: Calculated): string {
  return `${calc.currency} ${calc.native.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${calc.rate} (Viator rate as of ${calc.lastUpdated}, expires ${calc.expiry}) = ${calc.target} ${calc.amount.toFixed(2)} · ${calc.label}`;
}

/** The figure when no conversion is needed — the schedule already answers in the search's currency. */
export function sameCurrencyLine(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)} as stated by the operator (no conversion — the schedule answers in ${currency})`;
}

export type { Stated };
