/**
 * save — WHAT A TOUR'S SAVE CARRIES, AND THE WORDS IT WRITES (ACTIVITY-01 STEP 4, 2026-09-22).
 *
 * The Save posts vendor-commit an `activity` synthetic line with a `viatorSave`
 * object: the product and option the founder chose, the date, the start time the
 * operator PUBLISHED (schedule.ts) or null, the end time from the product's fixed
 * duration or null, the product's stated zone or null, the party, the option's
 * native cost and the in-destination charges as stated, the vendor's rate (fx.ts)
 * or null when the schedule already answers in the plan's currency, and the
 * CALCULATED total. One method: the container builds it through these functions,
 * vendor-commit reads it back through readViatorSave() and RECOMPUTES the total
 * (verifyViatorSave) — a total that does not follow from the stated figures × the
 * stated rate is refused by name, as is an expired rate, as is a note that is not
 * the one activitySaveNoteOf() writes from the same facts. Nothing is invented on
 * either side.
 *
 * The note: "<title> · option <code> <option title> · <startTime> <timeZone> ·
 * <party> · THB <native> × <rate> (Viator rate as of <lastUpdated>, expires
 * <expiry>) = USD <total> · calculated · cancellation: <as stated> · book on Viator".
 *
 * PURE: no fetch, no env, no clock of its own.
 */

import { type Stated, statedNumber, statedString } from '@/lib/travel/stated';
import type { ActivityDuration } from '@/lib/activities/products';
import type { Party } from '@/lib/activities/product';
import { partySize, partyText } from '@/lib/activities/product';
import { CALCULATED, RATE_SOURCE, convert, conversionLine, isExpired, sameCurrencyLine, type RateRecord } from '@/lib/activities/fx';

export const NOT_STATED = 'not stated by the operator';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  durationMinutes: Stated<number>;
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
  return [
    save.title,
    `option ${save.productOptionCode}${save.optionTitle ? ` ${save.optionTitle}` : ` (title ${NOT_STATED})`}`,
    save.startTime === null ? `start time ${NOT_STATED} for ${save.date}` : `${save.startTime}${save.timeZone ? ` ${save.timeZone}` : ` (zone ${NOT_STATED})`}`,
    partyText(save.party),
    conversionText(save),
    `cancellation: ${save.cancellation}`,
    `schedule as published by the operator ${save.asOf}`,
    'book on Viator',
  ].join(' · ');
}

/** vendor-commit's reader: the posted object, every field typed, or refused by name. */
export function readViatorSave(input: unknown): ViatorSave | { refused: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { refused: 'viatorSave must be an object' };
  const v = input as Record<string, unknown>;
  const productCode = statedString(v.productCode); if (productCode === null) return { refused: 'viatorSave.productCode is required' };
  const productOptionCode = statedString(v.productOptionCode); if (productOptionCode === null) return { refused: 'viatorSave.productOptionCode is required' };
  const title = statedString(v.title); if (title === null) return { refused: 'viatorSave.title is required' };
  const date = statedString(v.date); if (date === null || !DATE.test(date)) return { refused: 'viatorSave.date must be YYYY-MM-DD' };
  const startTime = statedString(v.startTime); if (startTime !== null && !HHMM.test(startTime)) return { refused: 'viatorSave.startTime must be HH:MM or null' };
  const endTime = statedString(v.endTime); if (endTime !== null && !HHMM.test(endTime)) return { refused: 'viatorSave.endTime must be HH:MM or null' };
  if (endTime !== null && startTime === null) return { refused: 'viatorSave.endTime needs a startTime' };
  const timeZone = statedString(v.timeZone);
  const durationMinutes = statedNumber(v.durationMinutes);
  const party = v.party;
  if (typeof party !== 'object' || party === null || Array.isArray(party) || Object.values(party as Record<string, unknown>).some((c) => !Number.isInteger(c) || (c as number) < 0)) return { refused: 'viatorSave.party must map age bands to whole numbers' };
  if (partySize(party as Party) === 0) return { refused: 'viatorSave.party holds no travellers' };
  const native = v.native as Record<string, unknown> | undefined;
  const nativeAmount = statedNumber(native?.amount); const nativeCurrency = statedString(native?.currency);
  if (nativeAmount === null || nativeAmount < 0 || nativeCurrency === null) return { refused: 'viatorSave.native must carry a non-negative amount and its currency' };
  let extra: ViatorSave['extra'] = null;
  if (v.extra !== null && v.extra !== undefined) {
    const e = v.extra as Record<string, unknown>;
    const per = statedNumber(e.perTraveller), trav = statedNumber(e.travellers), tot = statedNumber(e.total);
    if (per === null || trav === null || tot === null || Math.round(per * trav * 100) / 100 !== tot) return { refused: 'viatorSave.extra must carry the per-traveller figure, the travellers and their product' };
    extra = { perTraveller: per, travellers: trav, total: tot };
  }
  let rate: RateRecord | null = null;
  if (v.rate !== null && v.rate !== undefined) {
    const r = v.rate as Record<string, unknown>;
    const rr = statedNumber(r.rate), src = statedString(r.sourceCurrency), tgt = statedString(r.targetCurrency), lu = statedString(r.lastUpdated), ex = statedString(r.expiry);
    if (rr === null || rr <= 0 || src === null || tgt === null || lu === null || ex === null || Number.isNaN(Date.parse(ex)) || r.source !== RATE_SOURCE) return { refused: `viatorSave.rate must be the vendor's own rate (${RATE_SOURCE}) with its lastUpdated and expiry` };
    rate = { rate: rr, sourceCurrency: src, targetCurrency: tgt, lastUpdated: lu, expiry: ex, source: RATE_SOURCE };
  }
  const total = v.total as Record<string, unknown> | undefined;
  const totalAmount = statedNumber(total?.amount); const totalCurrency = statedString(total?.currency); const label = total?.label;
  if (totalAmount === null || totalCurrency === null || (label !== CALCULATED && label !== 'as stated')) return { refused: `viatorSave.total must carry an amount, its currency and the label '${CALCULATED}' or 'as stated'` };
  const cancellation = statedString(v.cancellation) ?? `cancellation policy ${NOT_STATED}`;
  const asOf = statedString(v.asOf); if (asOf === null || Number.isNaN(Date.parse(asOf))) return { refused: 'viatorSave.asOf must be the read\'s timestamp' };
  return { productCode, productOptionCode, optionTitle: statedString(v.optionTitle), title, date, startTime, endTime, timeZone, durationMinutes, party: party as Party, native: { amount: nativeAmount, currency: nativeCurrency }, extra, rate, total: { amount: totalAmount, currency: totalCurrency, label }, cancellation, asOf };
}

/**
 * vendor-commit's check: the posted total follows from the stated figures and the
 * stated rate (recomputed here), the rate has not expired at `now`, the line's
 * amount is that total, and the note is the one these facts write.
 */
export function verifyViatorSave(save: ViatorSave, amount: number, notes: unknown, targetCurrency: string, now: Date): { ok: true } | { refused: string } {
  if (save.rate !== null && isExpired(save.rate, now)) return { refused: `the Viator ${save.rate.sourceCurrency}→${save.rate.targetCurrency} rate expired at ${save.rate.expiry} — check availability again for a current rate; nothing was saved` };
  const expected = totalOf(save, targetCurrency, now);
  if ('refused' in expected) return expected;
  if (expected.amount !== save.total.amount || expected.currency !== save.total.currency || expected.label !== save.total.label) return { refused: `the total ${save.total.amount} ${save.total.currency} (${save.total.label}) does not follow from the stated figures × the stated rate (${expected.amount} ${expected.currency}, ${expected.label}); nothing was saved` };
  if (Math.round(amount * 100) / 100 !== save.total.amount) return { refused: `the line's amount ${amount} is not the ${save.total.label} total ${save.total.amount}; nothing was saved` };
  if (typeof notes !== 'string' || notes !== activitySaveNoteOf(save)) return { refused: 'the note is not the one the Save\'s facts write; nothing was saved' };
  if (save.endTime !== null && save.durationMinutes !== null && endTimeOf(save.startTime, { kind: 'fixed', minutes: save.durationMinutes }) !== save.endTime) return { refused: 'the end time does not follow from the start time and the stated fixed duration; nothing was saved' };
  return { ok: true };
}
