/**
 * save — WHAT A TOUR'S LINE CARRIES, AND THE WORDS IT WRITES (ACTIVITY-01 STEP 4,
 * 2026-09-22; STEP 4b, 2026-09-22: DERIVED BY THE SERVER, never posted).
 *
 * A ViatorSave is what vendor-commit WRITES: the product and option the founder
 * chose, the date, the start time the operator PUBLISHED (schedule.ts) or null, the
 * end the stated duration allows or null, the product's stated zone or null, the
 * party, the option's native cost and the in-destination charges as stated, the
 * vendor's rate (fx.ts) or null when the schedule already answers in the plan's
 * currency, and the CALCULATED total.
 *
 * STEP 4b: it is no longer an input. The browser posts the SEALED quote the server
 * issued, its seal and the party — no figure — and vendor-commit builds this object
 * itself through saveFromQuote() (src/lib/activities/quote.ts) from the sealed bands,
 * the sealed rate and the sealed clock. These functions are the one method both the
 * screen and the commit price through; nothing is invented on either side, and
 * nothing here is read from a caller.
 *
 * The note: "<title> · option <code> <option title> · <startTime> <timeZone> ·
 * <party> · THB <native> × <rate> (Viator rate as of <lastUpdated>, expires
 * <expiry>) = USD <total> · calculated · cancellation: <as stated> · book on Viator".
 *
 * PURE: no fetch, no env, no clock of its own.
 */

import { type Stated } from '@/lib/travel/stated';
import { durationText, type ActivityDuration } from '@/lib/activities/products';
import type { Party } from '@/lib/activities/product';
import { partyText } from '@/lib/activities/product';
import { CALCULATED, RATE_SOURCE, convert, conversionLine, sameCurrencyLine, type RateRecord } from '@/lib/activities/fx';

export const NOT_STATED = 'not stated by the operator';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ViatorSave {
  productCode: string;
  productOptionCode: string;
  optionTitle: Stated<string>;
  title: string;
  date: string;
  /** The published start time the founder chose, or null when the operator states none for the date. */
  startTime: Stated<string>;
  /** start + the product's fixed duration, or null (a variable or unstated duration draws no end). */
  endTime: Stated<string>;
  /** The product's stated IANA zone, or null — never guessed. */
  timeZone: Stated<string>;
  /** The duration as the operator states it: fixed minutes, a variable range, or its own text. */
  duration: Stated<ActivityDuration>;
  party: Party;
  /** The option's cost for the party in the supplier's currency, before extra charges. */
  native: { amount: number; currency: string };
  /** The in-destination charges the schedule states, per traveller × travellers, or null. */
  extra: Stated<{ perTraveller: number; travellers: number; total: number }>;
  /** The vendor's rate, or null when the schedule already answers in the plan's currency. */
  rate: RateRecord | null;
  /** The plan's amount: the calculated figure at the rate, or the native figure when no conversion is needed. */
  total: { amount: number; currency: string; label: typeof CALCULATED | 'as stated' };
  cancellation: string;
  /** When the options were read. */
  asOf: string;
}

/** The option's end from its start and a FIXED duration inside the same day; null otherwise (never the shorter or longer bound of a range). */
export function endTimeOf(startTime: Stated<string>, duration: Stated<ActivityDuration>): Stated<string> {
  if (startTime === null || !HHMM.test(startTime) || duration === null || duration.kind !== 'fixed') return null;
  const [h, m] = startTime.split(':').map(Number);
  const end = h * 60 + m + duration.minutes;
  if (end > 24 * 60) return null;
  const eh = Math.floor(end / 60) % 24, em = end % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

/** The whole native figure the rate applies to: the option's cost plus the stated in-destination charges. */
export function nativeTotalOf(save: Pick<ViatorSave, 'native' | 'extra'>): number {
  return Math.round((save.native.amount + (save.extra?.total ?? 0)) * 100) / 100;
}

/** The plan's amount from the stated figures and the stated rate — the one method the container and the commit share. */
export function totalOf(save: Pick<ViatorSave, 'native' | 'extra' | 'rate'>, targetCurrency: string, now: Date): ViatorSave['total'] | { refused: string } {
  const native = nativeTotalOf(save);
  if (save.rate === null) {
    if (save.native.currency !== targetCurrency) return { refused: `the schedule answers in ${save.native.currency}, the plan is ${targetCurrency}, and no rate was read` };
    return { amount: native, currency: targetCurrency, label: 'as stated' };
  }
  if (save.rate.targetCurrency !== targetCurrency) return { refused: `the rate converts to ${save.rate.targetCurrency}, the plan is ${targetCurrency}` };
  const calc = convert({ amount: native, currency: save.native.currency }, save.rate, now);
  if ('refused' in calc) return calc;
  return { amount: calc.amount, currency: calc.target, label: CALCULATED };
}

/** The words for the conversion, or for its absence. */
export function conversionText(save: Pick<ViatorSave, 'native' | 'extra' | 'rate' | 'total'>): string {
  const native = nativeTotalOf(save);
  const parts = save.extra ? ` (${save.native.amount.toFixed(2)} + ${save.extra.total.toFixed(2)} in-destination charges stated by the operator, ${save.extra.perTraveller.toFixed(2)} × ${save.extra.travellers})` : '';
  if (save.rate === null) return `${sameCurrencyLine(native, save.native.currency)}${parts}`;
  const line = conversionLine({ label: CALCULATED, native, currency: save.native.currency, rate: save.rate.rate, target: save.rate.targetCurrency, amount: save.total.amount, source: RATE_SOURCE, lastUpdated: save.rate.lastUpdated, expiry: save.rate.expiry });
  return parts ? line.replace(' × ', `${parts} × `) : line;
}

/** The note vendor-commit stores as the line's vendor text — built from the facts, nowhere else. */
export function activitySaveNoteOf(save: ViatorSave): string {
  // A VARIABLE duration names its stated range and what was done with it: the operator
  // gives a window, not an end, so the line says the window and either the end the
  // founder picked inside it or that none was picked (a flagged marker on the day).
  const variable = save.duration !== null && save.duration.kind === 'variable'
    ? [`${durationText(save.duration)}${save.endTime === null ? ' · no end chosen — the block draws as a flagged marker' : ` · ends ${save.endTime}, chosen inside it`}`]
    : [];
  return [
    save.title,
    `option ${save.productOptionCode}${save.optionTitle ? ` ${save.optionTitle}` : ` (title ${NOT_STATED})`}`,
    save.startTime === null ? `start time ${NOT_STATED} for ${save.date}` : `${save.startTime}${save.timeZone ? ` ${save.timeZone}` : ` (zone ${NOT_STATED})`}`,
    ...variable,
    partyText(save.party),
    conversionText(save),
    `cancellation: ${save.cancellation}`,
    `schedule as published by the operator ${save.asOf}`,
    'book on Viator',
  ].join(' · ');
}
