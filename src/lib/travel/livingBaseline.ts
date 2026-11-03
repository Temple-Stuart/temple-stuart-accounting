/**
 * TRAVEL-02c (Alex, 2026-11-03, rulings B, C and F) — THE LIVING BASELINE'S RULES, PURE.
 *
 * A living baseline is one user's dated, frozen statement of what living at home costs a month — 'LA rent', from a
 * day, a monthly figure (prisma/schema.prisma living_baselines; the migration
 * 20261103200000_travel_02c_stay_link_living_baselines holds its CHECKs, its one-live-baseline-a-day partial unique and
 * its three triggers). This file holds what the two routes ask before they write, and every word they answer with —
 * the 02b shape exactly (src/lib/travel/travelExpense.ts):
 *
 *   · THE BODY RULE — POST /api/living-baselines: { label, effective_from, monthly_minor, currency }. Every field is
 *     refused by name; an unknown field is a 400. label as typed, trimmed (STAY-01's rule for a place), 1–80
 *     characters, no control character; effective_from a 'YYYY-MM-DD' day the calendar has (budget/days.ts isIsoDay);
 *     monthly_minor a whole number of HUNDREDTHS of the currency above 0 that the INTEGER column holds (THE HUNDREDTHS
 *     — travelExpense.ts, the travel lane's one convention); currency three capitals (functionalCurrency.ts
 *     ISO_4217_CODE — 'usd' is refused, never upper-cased for the customer: stated, never assumed).
 *   · ONE LIVE BASELINE A DAY — a second live baseline on the same effective_from is a 409 by name, naming the one that
 *     stands (the partial unique index is the backstop for a race, answered with the same words).
 *   · THE VOID RULE — POST /api/living-baselines/[id]/void: { reason }, required, never blank; a baseline is voided
 *     once — a second void is a 409 by name. The database refuses the same (the void pair CHECK, the FREEZE trigger).
 *
 * Nothing here defaults: no field is filled in, no currency assumed. No edit route — a baseline is frozen once kept.
 * Pure: no Prisma, no fetch, no clock, no React.
 */
import { ISO_4217_CODE } from '@/lib/books/functionalCurrency';
import { isIsoDay } from '@/lib/budget/days';

// ── THE FIELDS ──────────────────────────────────────────────────────────────

/** The POST's fields, in the ruling's order — any other key is refused by name. */
export const LIVING_BASELINE_FIELDS = ['label', 'effective_from', 'monthly_minor', 'currency'] as const;
export type LivingBaselineField = (typeof LIVING_BASELINE_FIELDS)[number];
/** The void's one field. */
export const BASELINE_VOID_FIELDS = ['reason'] as const;

/** The columns' own limits (the migration): VARCHAR(80) and its CHECK, INTEGER. */
export const LABEL_MAX = 80;
export const MONTHLY_MINOR_MAX = 2147483647;

/** What POST /api/living-baselines writes, read from the body — nothing filled in. */
export interface LivingBaselineBody {
  readonly label: string;
  readonly effective_from: string;
  readonly monthly_minor: number;
  readonly currency: string;
}

export interface BaselineFieldRefusal {
  readonly ok: false;
  readonly field: string;
  readonly words: string;
}

// ── THE WORDS (ruling F) — every refusal, by name; hundredths from the start (item 0) ──────────

export const BASELINE_JSON_BODY_WORDS = 'a JSON body is required';
export const BASELINE_NOT_AN_OBJECT_WORDS = `the body is a JSON object of the baseline's fields (${LIVING_BASELINE_FIELDS.join(', ')})`;
export const unknownBaselineFieldWords = (name: string): string =>
  `the baseline carries "${name}", which is not one of its fields (${LIVING_BASELINE_FIELDS.join(', ')})`;
export const unknownBaselineVoidFieldWords = (name: string): string =>
  `the void carries "${name}", which is not one of its fields (${BASELINE_VOID_FIELDS.join(', ')})`;
export const LABEL_REQUIRED_WORDS = "label is required — what the baseline is, as typed (e.g. 'LA rent')";
export const LABEL_BLANK_WORDS = 'label is blank — name the baseline';
export const LABEL_CONTROL_WORDS = 'label holds a control character — type the label as words';
export const labelTooLongWords = (length: number): string => `label is ${length} characters — at most ${LABEL_MAX}`;
export const EFFECTIVE_FROM_REQUIRED_WORDS = "effective_from is required — the day the baseline applies from, 'YYYY-MM-DD'";
export const effectiveFromNotADayWords = (sent: unknown): string => `effective_from ${JSON.stringify(sent)} is not a day — 'YYYY-MM-DD', a day the calendar has`;
export const MONTHLY_REQUIRED_WORDS = 'monthly_minor is required — the monthly figure in hundredths of the currency (1/100 of its major unit), a whole number above 0';
export const monthlyNotWholeWords = (sent: unknown): string => `monthly_minor ${JSON.stringify(sent)} is not a whole number of hundredths`;
export const monthlyNotAboveZeroWords = (sent: number): string => `monthly_minor ${sent} is not above 0 — a baseline is what a month costs`;
export const monthlyTooLargeWords = (sent: number): string => `monthly_minor ${sent} is more than ${MONTHLY_MINOR_MAX} — the most the column holds`;
export const BASELINE_CURRENCY_REQUIRED_WORDS = 'currency is required — the three-letter ISO 4217 code the monthly figure is stated in (USD, EUR, …)';
export const baselineCurrencyNotACodeWords = (sent: unknown): string =>
  `currency ${JSON.stringify(sent)} is not a three-letter ISO 4217 code in capitals (USD, EUR, …)`;
/** Ruling C: two live baselines never start the same day — the one that stands, named. */
export const sameDayLiveBaselineWords = (effectiveFrom: string, standing: string): string =>
  `a live baseline already starts on ${effectiveFrom} (${JSON.stringify(standing)}) — two live baselines never start the same day; void it first`;
export const BASELINE_REASON_REQUIRED_WORDS = 'a void needs its reason — say why this baseline is void';
export const NO_SUCH_BASELINE_WORDS = 'no such living baseline';
const dayOfInstant = (instant: Date): string => instant.toISOString().slice(0, 10);
export const baselineAlreadyVoidedWords = (voidedAt: Date, reason: string): string =>
  `this baseline was voided on ${dayOfInstant(voidedAt)} — ${JSON.stringify(reason)}; a baseline is voided once`;

// ── THE BODY RULE ───────────────────────────────────────────────────────────

const refuse = (field: string, words: string): BaselineFieldRefusal => ({ ok: false, field, words });
const has = (o: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A field left out, or sent as null (or undefined, which JSON never carries) — the same absence; nothing else reads as absent. */
function absent(o: Record<string, unknown>, key: string): boolean {
  if (!has(o, key)) return true;
  const v = o[key];
  return v === null ? true : v === undefined;
}

/** POST /api/living-baselines's body, field by field in the ruling's order; the first refusal is the answer. */
export function livingBaselineBodyRule(body: unknown): { readonly ok: true; readonly value: LivingBaselineBody } | BaselineFieldRefusal {
  if (!isPlainObject(body)) return refuse('body', BASELINE_NOT_AN_OBJECT_WORDS);
  for (const key of Object.keys(body)) {
    if (!(LIVING_BASELINE_FIELDS as readonly string[]).includes(key)) return refuse(key, unknownBaselineFieldWords(key));
  }

  // The label is kept TRIMMED — STAY-01's rule for a place — and its length is the trimmed text's (the CHECK reads
  // char_length(btrim(label)) the same way).
  if (typeof body.label !== 'string') return refuse('label', LABEL_REQUIRED_WORDS);
  const label = body.label.trim();
  if (label === '') return refuse('label', LABEL_BLANK_WORDS);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(label)) return refuse('label', LABEL_CONTROL_WORDS);
  if (label.length > LABEL_MAX) return refuse('label', labelTooLongWords(label.length));

  if (absent(body, 'effective_from')) return refuse('effective_from', EFFECTIVE_FROM_REQUIRED_WORDS);
  if (!isIsoDay(body.effective_from)) return refuse('effective_from', effectiveFromNotADayWords(body.effective_from));
  const effectiveFrom: string = body.effective_from;

  if (absent(body, 'monthly_minor')) return refuse('monthly_minor', MONTHLY_REQUIRED_WORDS);
  const monthly = body.monthly_minor;
  if (!(typeof monthly === 'number' && Number.isInteger(monthly))) return refuse('monthly_minor', monthlyNotWholeWords(monthly));
  if (monthly <= 0) return refuse('monthly_minor', monthlyNotAboveZeroWords(monthly));
  if (monthly > MONTHLY_MINOR_MAX) return refuse('monthly_minor', monthlyTooLargeWords(monthly));

  if (absent(body, 'currency')) return refuse('currency', BASELINE_CURRENCY_REQUIRED_WORDS);
  if (!(typeof body.currency === 'string' && ISO_4217_CODE.test(body.currency))) return refuse('currency', baselineCurrencyNotACodeWords(body.currency));
  const currency = body.currency;

  return { ok: true, value: { label, effective_from: effectiveFrom, monthly_minor: monthly, currency } };
}

// ── THE VOID RULE ───────────────────────────────────────────────────────────

/** POST /api/living-baselines/[id]/void's body: { reason }, required, never blank; any other key refused by name. */
export function baselineVoidBodyRule(body: unknown): { readonly ok: true; readonly reason: string } | BaselineFieldRefusal {
  if (!isPlainObject(body)) return refuse('reason', BASELINE_REASON_REQUIRED_WORDS);
  for (const key of Object.keys(body)) {
    if (!(BASELINE_VOID_FIELDS as readonly string[]).includes(key)) return refuse(key, unknownBaselineVoidFieldWords(key));
  }
  if (!(typeof body.reason === 'string' && body.reason.trim() !== '')) return refuse('reason', BASELINE_REASON_REQUIRED_WORDS);
  return { ok: true, reason: body.reason };
}

/** A baseline is voided once: the stored pair decides — a second void is refused by name, naming the first. */
export function baselineVoidStateRule(row: { readonly voided_at: Date | null; readonly void_reason: string | null }): { readonly ok: true } | { readonly ok: false; readonly words: string } {
  if (row.voided_at === null && row.void_reason === null) return { ok: true };
  if (row.voided_at !== null && row.void_reason !== null) return { ok: false, words: baselineAlreadyVoidedWords(row.voided_at, row.void_reason) };
  throw new Error('livingBaseline: a row carries half a void — the void pair CHECK forbids it');
}

// ── THE FORM'S WORDS (ruling E) — under the STAYS table: "+ baseline", and "void" on a baseline ─────────────

export const ADD_BASELINE_WORDS = '+ baseline';
/** The form's labels, by field. */
export const BASELINE_FIELD_LABELS: Readonly<Record<LivingBaselineField, string>> = {
  label: 'LABEL', effective_from: 'EFFECTIVE FROM', monthly_minor: 'MONTHLY', currency: 'CURRENCY',
};
/** The list's heads, in Alex's order: label · effective from · monthly · per day · status. */
export const BASELINE_LIST_HEADS = ['LABEL', 'EFFECTIVE FROM', 'MONTHLY', 'PER DAY', 'STATUS'] as const;
export const BASELINES_HEADING = 'LIVING BASELINES';
export const NO_BASELINES_WORDS = 'no baseline kept yet — "+ baseline" states what living at home costs a month';
export const MONTHLY_PLACEHOLDER_WORDS = 'in the currency, e.g. 2500.00';
/** The currency is chosen from the runtime's ISO 4217 list (functionalCurrency.ts runtimeCurrencyCodes); a browser that lists none is told so — never a typed guess. */
export const CURRENCIES_UNLISTED_WORDS = 'this browser lists no ISO 4217 currencies — a baseline is stated in a currency chosen from that list';
export const SAVE_BASELINE_WORDS = 'save';
export const SAVING_BASELINE_WORDS = 'saving…';
export const CANCEL_BASELINE_WORDS = 'cancel';
export const VOID_BASELINE_WORDS = 'void';
export const VOIDING_BASELINE_WORDS = 'voiding…';
export const BASELINE_VOID_REASON_LABEL_WORDS = 'REASON';
/** The stay row's door: the one link picker, kind 'stay'. */
export const LINK_A_CHARGE_WORDS = 'link a charge';
/** The stay row's drill: its lines and its BY ACCOUNT sums. */
export const OPEN_LINES_WORDS = 'lines';
export const CLOSE_LINES_WORDS = 'close';
export const LINES_HEADING = 'LINES';
export const BY_ACCOUNT_HEADING = 'BY ACCOUNT';
export const NO_LINES_WORDS = 'no posting linked to this stay';
