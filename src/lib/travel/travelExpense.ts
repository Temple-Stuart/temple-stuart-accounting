/**
 * TRAVEL-02b (Alex, 2026-11-03, rulings A, C, E, F) — THE TYPED TRAVEL EXPENSE'S RULES, PURE.
 *
 * A visa, an eSIM or a one-off travel purchase is its own typed row (prisma/schema.prisma travel_expenses; the
 * migration 20261103120000_travel_02b_travel_expenses holds its CHECKs and its two triggers): stated in the currency it
 * was paid in, on the DAY it was paid, the vendor as typed, trimmed — frozen once kept, voided never deleted. This
 * file holds what the two routes ask before they write, and every word they answer with:
 *
 *   · THE BODY RULE (ruling C) — POST /api/travel-expenses: { kind, paid_on, amount_minor, currency, vendor, note?,
 *     trip_id?, coa_code? }. Every field is refused by name (the documents route's unknownFieldWords shape); an
 *     unknown field is a 400. kind one of visa | esim | other; paid_on a 'YYYY-MM-DD' day the calendar has
 *     (budget/days.ts isIsoDay); amount_minor a whole number of HUNDREDTHS of the currency above 0 that the INTEGER
 *     column holds (THE HUNDREDTHS, beside AMOUNT_REQUIRED_WORDS); currency three capitals (functionalCurrency.ts
 *     ISO_4217_CODE — 'usd' is refused, never upper-cased for the customer: stated, never assumed); vendor as typed,
 *     trimmed (STAY-01's rule for a place), 1–120 characters (the CHECK's rule); note, trip_id and coa_code left out
 *     (or null) or stated — a blank one is refused, never read as absent — and a stated note kept trimmed too
 *     (TRAVEL-02b-fix, Alex, 2026-11-03, ruling B: the vendor and the note are stored trimmed).
 *   · THE CHART RULE — a coa_code must be ONE row of the caller's chart_of_accounts, read through the one scheme
 *     (src/lib/coa/scheme.ts parseCode, COA-01: four digits, or the entity's letter and four digits): the typed code
 *     against each of the caller's books, matched to a row whose saved code reads the same — planMoney's reading
 *     (src/lib/operations/planMoney.ts R2). None → 409 naming the code; more than one → 409 naming them all; one → the
 *     row's account string (accountString.ts deriveAccountString — 'P-9200'), so its book's letter rides with it and
 *     the ledger's BOOK reads it back through the same scheme. The form's choices (chartChoicesOf) are exactly the rows
 *     this rule can name.
 *   · THE VOID RULE — POST /api/travel-expenses/[id]/void: { reason }, required, never blank; an expense is voided
 *     once — a second void is a 409 by name. The database refuses the same (the void pair CHECK, the FREEZE trigger).
 *   · THE LINK'S WORDS (ruling B) — the links route refuses a payment to a voided expense by name.
 *
 * Nothing here defaults: no field is filled in, no code is guessed, no currency assumed. Pure: no Prisma, no fetch, no
 * clock, no React.
 */
import { deriveAccountString } from '@/lib/accountString';
import { ISO_4217_CODE } from '@/lib/books/functionalCurrency';
import { isIsoDay } from '@/lib/budget/days';
import { parseCode } from '@/lib/coa/scheme';
import { ValidationError } from '@/lib/errors/ValidationError';

// ── THE KINDS ───────────────────────────────────────────────────────────────

/** Ruling A: the three kinds the table's CHECK admits. */
export const TRAVEL_EXPENSE_KINDS = ['visa', 'esim', 'other'] as const;
export type TravelExpenseKind = (typeof TRAVEL_EXPENSE_KINDS)[number];
export const isTravelExpenseKind = (k: unknown): k is TravelExpenseKind =>
  typeof k === 'string' && (TRAVEL_EXPENSE_KINDS as readonly string[]).includes(k);

// ── THE FIELDS ──────────────────────────────────────────────────────────────

/** The POST's fields, in the ruling's order — any other key is refused by name. */
export const TRAVEL_EXPENSE_FIELDS = ['kind', 'paid_on', 'amount_minor', 'currency', 'vendor', 'note', 'trip_id', 'coa_code'] as const;
export type TravelExpenseField = (typeof TRAVEL_EXPENSE_FIELDS)[number];
/** The void's one field. */
export const VOID_FIELDS = ['reason'] as const;

/** The columns' own limits (the migration): VARCHAR(120), VARCHAR(50), INTEGER. */
export const VENDOR_MAX = 120;
export const COA_CODE_MAX = 50;
export const AMOUNT_MINOR_MAX = 2147483647;

/** What POST /api/travel-expenses writes, read from the body — nothing filled in. */
export interface TravelExpenseBody {
  readonly kind: TravelExpenseKind;
  readonly paid_on: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly vendor: string;
  readonly note: string | null;
  readonly trip_id: string | null;
  readonly coa_code: string | null;
}

export interface FieldRefusal {
  readonly ok: false;
  readonly field: string;
  readonly words: string;
}

// ── THE WORDS (ruling F) — every refusal, by name ───────────────────────────

export const JSON_BODY_WORDS = 'a JSON body is required';
export const NOT_AN_OBJECT_WORDS = `the body is a JSON object of the expense's fields (${TRAVEL_EXPENSE_FIELDS.join(', ')})`;
export const unknownExpenseFieldWords = (name: string): string =>
  `the expense carries "${name}", which is not one of its fields (${TRAVEL_EXPENSE_FIELDS.join(', ')})`;
export const unknownVoidFieldWords = (name: string): string => `the void carries "${name}", which is not one of its fields (${VOID_FIELDS.join(', ')})`;
export const KIND_REQUIRED_WORDS = `kind is required — one of ${TRAVEL_EXPENSE_KINDS.join(', ')}`;
export const kindNotAKindWords = (sent: unknown): string => `kind ${JSON.stringify(sent)} is not one of ${TRAVEL_EXPENSE_KINDS.join(', ')}`;
export const PAID_ON_REQUIRED_WORDS = "paid_on is required — the day it was paid, 'YYYY-MM-DD'";
export const paidOnNotADayWords = (sent: unknown): string => `paid_on ${JSON.stringify(sent)} is not a day — 'YYYY-MM-DD', a day the calendar has`;
/**
 * TRAVEL-02b-fix (Alex, 2026-11-03, ruling C) — THE HUNDREDTHS. Every stated figure in the travel lane is in HUNDREDTHS
 * of its currency (1/100 of its major unit), whatever the currency's ISO 4217 exponent: VND, JPY and KRW have none, so
 * 350,000 VND is stored 35,000,000 and printed '350000.00 VND'. One convention across reservations.finalPriceCents,
 * money_events.amountCents and travel_expenses.amount_minor — a "minor unit" in this lane is always that hundredth.
 * FX-02 owns exponent-aware words and any conversion.
 */
export const AMOUNT_REQUIRED_WORDS = 'amount_minor is required — the amount in hundredths of the currency (1/100 of its major unit), a whole number above 0';
/** TRAVEL-02c (Alex, 2026-11-03, item 0 — 02b-fix call 7): one word for the unit — hundredths, as AMOUNT_REQUIRED_WORDS declares. */
export const amountNotWholeWords = (sent: unknown): string => `amount_minor ${JSON.stringify(sent)} is not a whole number of hundredths`;
export const amountNotAboveZeroWords = (sent: number): string => `amount_minor ${sent} is not above 0 — an expense is money paid`;
export const amountTooLargeWords = (sent: number): string => `amount_minor ${sent} is more than ${AMOUNT_MINOR_MAX} — the most the column holds`;
export const CURRENCY_REQUIRED_WORDS = 'currency is required — the three-letter ISO 4217 code it was paid in (USD, PHP, …)';
export const currencyNotACodeWords = (sent: unknown): string => `currency ${JSON.stringify(sent)} is not a three-letter ISO 4217 code in capitals (USD, PHP, …)`;
export const VENDOR_REQUIRED_WORDS = 'vendor is required — who was paid, as typed';
export const VENDOR_BLANK_WORDS = 'vendor is blank — name who was paid';
export const vendorTooLongWords = (length: number): string => `vendor is ${length} characters — at most ${VENDOR_MAX}`;
export const NOTE_NOT_TEXT_WORDS = 'note is text, or left out';
export const NOTE_BLANK_WORDS = 'note is blank — write the note, or leave it out';
export const TRIP_NOT_AN_ID_WORDS = "trip_id is one of your trips' ids, or left out for an unattached expense";
export const TRIP_BLANK_WORDS = 'trip_id is blank — choose a trip, or leave it out for an unattached expense';
export const COA_NOT_A_CODE_WORDS = 'coa_code is a code of your chart of accounts, or left out';
export const COA_BLANK_WORDS = 'coa_code is blank — choose an account, or leave it out';
export const coaTooLongWords = (length: number): string => `coa_code is ${length} characters — at most ${COA_CODE_MAX}`;
/** The trip is not the caller's (or no trip) — the defensive 404: it does not say whether the trip exists. */
export const tripNotYoursWords = (tripId: string): string => `no trip ${JSON.stringify(tripId)} of yours — choose one of your trips, or leave the expense unattached`;
export const coaNotInChartWords = (typed: string): string => `${JSON.stringify(typed)} is not an account in your chart of accounts`;
export const coaAmbiguousWords = (typed: string, named: readonly string[]): string =>
  `${JSON.stringify(typed)} is ${named.length} accounts in your chart of accounts — ${named.join(' and ')} — choose it by its book's letter (P-, B-, T-), or fix the chart in Books first`;
export const REASON_REQUIRED_WORDS = 'a void needs its reason — say why this expense is void';
export const NO_SUCH_EXPENSE_WORDS = 'no such travel expense';
/** A day of an instant, 'YYYY-MM-DD' — the words below name the void's day. */
const dayOfInstant = (instant: Date): string => instant.toISOString().slice(0, 10);
export const alreadyVoidedWords = (voidedAt: Date, reason: string): string =>
  `this expense was voided on ${dayOfInstant(voidedAt)} — ${JSON.stringify(reason)}; an expense is voided once`;
/** Ruling B: the links POST's refusal for a voided expense. */
export const voidedExpenseLinkWords = (vendor: string, voidedAt: Date, reason: string): string =>
  `the travel expense ${JSON.stringify(vendor)} was voided on ${dayOfInstant(voidedAt)} (${JSON.stringify(reason)}) — a voided expense takes no payment`;
/** The trip DELETE's refusal: a typed expense names the trip with RESTRICT and is never deleted, so the trip stays. */
export const tripHoldsTravelExpensesWords = (n: number): string =>
  `${n === 1 ? 'A travel expense names' : `${n} travel expenses name`} this trip — a typed expense is kept for good (a voided one too), so the trip cannot be deleted`;

// ── THE BODY RULE ───────────────────────────────────────────────────────────

const refuse = (field: string, words: string): FieldRefusal => ({ ok: false, field, words });
const has = (o: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A field left out, or sent as null (or undefined, which JSON never carries) — the same absence; nothing else reads as absent. */
function absent(o: Record<string, unknown>, key: string): boolean {
  if (!has(o, key)) return true;
  const v = o[key];
  return v === null ? true : v === undefined;
}

/** An optional text field: absent or null → null; a non-blank string → as typed; anything else refused by name. */
function optionalText(o: Record<string, unknown>, key: string, notText: string, blank: string): { ok: true; value: string | null } | FieldRefusal {
  if (absent(o, key)) return { ok: true, value: null };
  const v = o[key];
  if (typeof v !== 'string') return refuse(key, notText);
  if (v.trim() === '') return refuse(key, blank);
  return { ok: true, value: v };
}

/** POST /api/travel-expenses's body, field by field in the ruling's order; the first refusal is the answer. */
export function travelExpenseBodyRule(body: unknown): { readonly ok: true; readonly value: TravelExpenseBody } | FieldRefusal {
  if (!isPlainObject(body)) return refuse('body', NOT_AN_OBJECT_WORDS);
  for (const key of Object.keys(body)) {
    if (!(TRAVEL_EXPENSE_FIELDS as readonly string[]).includes(key)) return refuse(key, unknownExpenseFieldWords(key));
  }

  if (absent(body, 'kind')) return refuse('kind', KIND_REQUIRED_WORDS);
  if (!isTravelExpenseKind(body.kind)) return refuse('kind', kindNotAKindWords(body.kind));
  const kind = body.kind;

  if (absent(body, 'paid_on')) return refuse('paid_on', PAID_ON_REQUIRED_WORDS);
  if (!isIsoDay(body.paid_on)) return refuse('paid_on', paidOnNotADayWords(body.paid_on));
  const paidOn: string = body.paid_on;

  if (absent(body, 'amount_minor')) return refuse('amount_minor', AMOUNT_REQUIRED_WORDS);
  const amount = body.amount_minor;
  if (!(typeof amount === 'number' && Number.isInteger(amount))) return refuse('amount_minor', amountNotWholeWords(amount));
  if (amount <= 0) return refuse('amount_minor', amountNotAboveZeroWords(amount));
  if (amount > AMOUNT_MINOR_MAX) return refuse('amount_minor', amountTooLargeWords(amount));

  if (absent(body, 'currency')) return refuse('currency', CURRENCY_REQUIRED_WORDS);
  if (!(typeof body.currency === 'string' && ISO_4217_CODE.test(body.currency))) return refuse('currency', currencyNotACodeWords(body.currency));
  const currency = body.currency;

  // TRAVEL-02b-fix (ruling B): the vendor is kept TRIMMED — STAY-01's rule for a place — and its length is the trimmed
  // text's (the CHECK reads char_length(btrim(vendor)) the same way).
  if (typeof body.vendor !== 'string') return refuse('vendor', VENDOR_REQUIRED_WORDS);
  const vendor = body.vendor.trim();
  if (vendor === '') return refuse('vendor', VENDOR_BLANK_WORDS);
  if (vendor.length > VENDOR_MAX) return refuse('vendor', vendorTooLongWords(vendor.length));

  // The note the same way: stated, it is kept trimmed; one that trims to '' is still refused as blank (optionalText).
  const note = optionalText(body, 'note', NOTE_NOT_TEXT_WORDS, NOTE_BLANK_WORDS);
  if (!note.ok) return note;
  const noteKept = note.value === null ? null : note.value.trim();
  const tripId = optionalText(body, 'trip_id', TRIP_NOT_AN_ID_WORDS, TRIP_BLANK_WORDS);
  if (!tripId.ok) return tripId;
  const coaCode = optionalText(body, 'coa_code', COA_NOT_A_CODE_WORDS, COA_BLANK_WORDS);
  if (!coaCode.ok) return coaCode;
  if (coaCode.value !== null && coaCode.value.length > COA_CODE_MAX) return refuse('coa_code', coaTooLongWords(coaCode.value.length));

  return { ok: true, value: { kind, paid_on: paidOn, amount_minor: amount, currency, vendor, note: noteKept, trip_id: tripId.value, coa_code: coaCode.value } };
}

// ── THE CHART RULE ──────────────────────────────────────────────────────────

/** A row of the caller's chart as the route reads it: its saved code and name, and its book (the entity's type and name). */
export interface ChartRowIn {
  readonly code: string;
  readonly name: string;
  readonly entityType: string;
  readonly bookName: string;
}

/** The four digits a code reads as in a book of this type, by the one scheme; null when the scheme cannot read it there. */
function readsAs(code: string, entityType: string): string | null {
  try {
    return parseCode(code, entityType);
  } catch (error) {
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

/** The account string a chart row is named by — the book's letter and the four digits ('P-9200'); null for a row the scheme cannot read. */
export function accountStringOfRow(row: ChartRowIn): string | null {
  const digits = readsAs(row.code, row.entityType);
  return digits === null ? null : deriveAccountString({ entityType: row.entityType, code: digits });
}

/** The typed coa_code against the caller's chart: exactly one row reads as it → its account string; none or several → refused by name. */
export function chartAccountRule(typed: string, chart: readonly ChartRowIn[]): { readonly ok: true; readonly account: string } | { readonly ok: false; readonly words: string } {
  const matches = chart.filter((row) => {
    const typedDigits = readsAs(typed, row.entityType);
    return typedDigits !== null && readsAs(row.code, row.entityType) === typedDigits;
  });
  if (matches.length === 0) return { ok: false, words: coaNotInChartWords(typed) };
  if (matches.length > 1) {
    return { ok: false, words: coaAmbiguousWords(typed, matches.map((row) => `${JSON.stringify(accountStringOfRow(row))} ${JSON.stringify(row.name)} (${row.bookName})`)) };
  }
  const account = accountStringOfRow(matches[0]);
  if (account === null) throw new Error(`travelExpense: a chart row matched the typed code ${JSON.stringify(typed)} and reads as no account string — the scheme read it twice`);
  return { ok: true, account };
}

/** One choice the form offers for the account: the account string the rule accepts, the row's name, its book. */
export interface ChartChoice {
  readonly account: string;
  readonly name: string;
  readonly book: string;
}

/**
 * A trip the form offers: the caller's, as GET /api/travel-expenses answers it (its `trips` list). TRAVEL-02b-fix: moved
 * here from TravelExpenseControls.tsx so the ledger's pure read of that answer (travelLedger.ts travelLedgerReadsOf)
 * names it without importing a component.
 */
export interface TripChoice {
  readonly id: string;
  readonly name: string;
}

/** A choice's words in the form's list: the account string, its name, its book — 'P-9200 · Travel — Visas (Personal)'. */
export const chartChoiceWords = (choice: ChartChoice): string => `${choice.account} · ${choice.name} (${choice.book})`;

/** The form's account choices — every row of the caller's chart the rule can name, by account string, then name. */
export function chartChoicesOf(chart: readonly ChartRowIn[]): ChartChoice[] {
  const out: ChartChoice[] = [];
  for (const row of chart) {
    const account = accountStringOfRow(row);
    if (account !== null) out.push({ account, name: row.name, book: row.bookName });
  }
  return out.sort((a, b) => (a.account === b.account ? a.name.localeCompare(b.name) : a.account.localeCompare(b.account, 'en', { numeric: true })));
}

// ── THE VOID RULE ───────────────────────────────────────────────────────────

/** POST /api/travel-expenses/[id]/void's body: { reason }, required, never blank; any other key refused by name. */
export function voidBodyRule(body: unknown): { readonly ok: true; readonly reason: string } | FieldRefusal {
  if (!isPlainObject(body)) return refuse('reason', REASON_REQUIRED_WORDS);
  for (const key of Object.keys(body)) {
    if (!(VOID_FIELDS as readonly string[]).includes(key)) return refuse(key, unknownVoidFieldWords(key));
  }
  if (!(typeof body.reason === 'string' && body.reason.trim() !== '')) return refuse('reason', REASON_REQUIRED_WORDS);
  return { ok: true, reason: body.reason };
}

/** An expense is voided once: the stored pair decides — a second void is refused by name, naming the first. */
export function voidStateRule(row: { readonly voided_at: Date | null; readonly void_reason: string | null }): { readonly ok: true } | { readonly ok: false; readonly words: string } {
  if (row.voided_at === null && row.void_reason === null) return { ok: true };
  if (row.voided_at !== null && row.void_reason !== null) return { ok: false, words: alreadyVoidedWords(row.voided_at, row.void_reason) };
  throw new Error('travelExpense: a row carries half a void — the void pair CHECK forbids it');
}

// ── THE FORM'S WORDS (ruling E) — under the TRAVEL LEDGER: "+ travel expense", and "void" on a row ─────────────

export const ADD_TRAVEL_EXPENSE_WORDS = '+ travel expense';
/** The form's labels, by field — the ledger's own head words where a column already names it. */
export const EXPENSE_FIELD_LABELS: Readonly<Record<TravelExpenseField, string>> = {
  kind: 'KIND', paid_on: 'PAID ON', amount_minor: 'AMOUNT', currency: 'CURRENCY', vendor: 'VENDOR', note: 'NOTE', trip_id: 'TRIP', coa_code: 'ACCOUNT',
};
export const CHOOSE_KIND_WORDS = '— choose the kind —';
export const CHOOSE_TRIP_WORDS = '— choose the trip, or unattached —';
/** The form's own refusal: the trip is a choice — a trip, or unattached — and nothing is chosen for the customer. */
export const TRIP_NOT_CHOSEN_WORDS = 'choose the trip, or unattached';
export const AMOUNT_PLACEHOLDER_WORDS = 'in the currency, e.g. 3500.00';
export const SAVE_EXPENSE_WORDS = 'save';
export const SAVING_EXPENSE_WORDS = 'saving…';
export const CANCEL_EXPENSE_WORDS = 'cancel';
export const VOID_WORDS = 'void';
export const VOIDING_WORDS = 'voiding…';
export const VOID_REASON_LABEL_WORDS = 'REASON';
/** A refusal the server gave with no words of its own — its status said, never guessed. */
export const noWordsRefusalWords = (status: number): string => `the server refused with status ${status} and no words`;
export const TRAVEL_EXPENSES_UNREADABLE_WORDS = 'the typed travel expenses could not be read';
