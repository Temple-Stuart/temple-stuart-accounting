/**
 * FX-01 (Alex, 2026-10-30, rulings A and F) — THE FUNCTIONAL CURRENCY, DECLARED ONCE.
 *
 * THE AUTHORITY.
 *   · ASC 830-10-20 (the Codification's glossary): the functional currency is "the currency of the
 *     primary economic environment in which the entity operates; normally, that is the currency of the
 *     environment in which an entity primarily generates and expends cash". ASC 830-20-30-1 measures a
 *     foreign currency transaction "initially in the functional currency of the recording entity by use
 *     of the exchange rate in effect at that date"; a later change in that rate "is a foreign currency
 *     transaction gain or loss" (ASC 830-20-35-1) — FX-02's ground, not this file's.
 *   · IRS, "Foreign currency and currency exchange rates" (irs.gov/individuals/international-taxpayers):
 *     "You must express the amounts you report on your U.S. tax return in U.S. dollars."; "The U.S.
 *     dollar is the functional currency for all taxpayers except some qualified business units (QBUs)."
 *     and "Use the exchange rate prevailing when you receive, pay, or accrue the item."
 *
 * THE DECLARATION. Every entity the books hold today is a USD entity, so the functional currency is ONE
 * constant, FUNCTIONAL_CURRENCY, not an entities column: the per-entity column (ASC 830's shape) is
 * written the day a non-USD entity exists. The general ledger stores integer cents OF THIS CURRENCY
 * (ledger_entries.amount, a bigint); every figure the books lane prints is written by the ONE formatter
 * below and every "USD" label the lane shows reads FUNCTIONAL_CURRENCY_WORDS. FX-00 (2026-10-30) found
 * the word declared nowhere and implied by a literal `$` on 94 files; the books law in
 * scripts/assert-tool-registry.ts now holds the lane to this file.
 *
 * THE ONE FORMATTER. functionalMoneyWords(cents) takes an INTEGER number of cents — a bigint, or a
 * number that is a safe integer — and refuses anything else by name: no rounding, no float arithmetic
 * on this path. The decimal text is built by integer arithmetic and handed to Intl.NumberFormat as a
 * STRING, which Intl (ES2023) reads as an exact decimal; a negative figure carries a leading minus.
 *
 * THE READERS OF A DOLLARS FIGURE. centsOfDecimalString reads a Decimal(14,2) column's own text
 * ('1234.56', exactly two decimals — the bank_reconciliations figures) into cents by string arithmetic;
 * anything else is refused by name. centsOfTypedDollars reads a figure a customer typed ('100',
 * '12.5', '12.50') the same way, padding to two decimals — more than two decimals is not cents and is
 * refused, never rounded. Neither multiplies a float by 100 (ruling B).
 *
 * THE PLAID RULE AT COMMIT (ruling F, postingCurrencyRule). A bank row posts to the general ledger only
 * when its account's stated currency (accounts.isoCurrencyCode, as Plaid states it or NULL — LAW-02,
 * src/app/api/plaid/exchange-token/route.ts) IS the functional currency, and when the row's own stated
 * currency (transactions.iso_currency_code, kept by the sync since FX-01; NULL for rows synced before
 * it) does not contradict the account's. A NULL account currency is refused by name; another currency
 * is refused by name until FX-02 posts it; nothing is converted. The commit route
 * (src/app/api/transactions/commit-to-ledger/route.ts) calls this before anything posts, in its own
 * errors shape.
 *
 * THE OTHER POSTING PATHS post in the functional currency BY CONSTRUCTION — their figures are typed or
 * derived in the books' own unit and no bank currency enters them — so they do not call the rule:
 * the typed journal entry (src/app/api/journal-entries/route.ts), the adjusting entry
 * (src/app/api/journal-entries/manual/route.ts), reclassification
 * (src/app/api/chart-of-accounts/reclassify/route.ts → src/lib/coa/reclassify.ts), the year-end close
 * (src/app/api/year-end-close/route.ts), the admin entity fix
 * (src/app/api/admin/fix-entity-assignment/route.ts), the reversals (src/lib/journal-entry-service.ts
 * reversePlaidTransaction; src/app/api/investment-transactions/uncommit/route.ts), and the trading
 * commits (src/app/api/trading/commit-to-ledger/route.ts, src/app/api/stock-lots/commit/route.ts,
 * src/app/api/investment-transactions/commit-to-ledger/route.ts, src/app/api/investments/
 * assignment-exercise/route.ts, src/lib/batch-trade-processor.ts).
 *
 * A BANK FIGURE (bankMoneyWords) is a balance or a bank row in the ACCOUNT's currency, not the books':
 * it is written by the one formatter only when that currency is the functional one, else as the
 * figure with its code, and a currency Plaid did not state is named as not stated — the travel lane's
 * shape (src/lib/activities/products.ts money), never a `$` on a figure that is not dollars.
 *
 * THE CURRENCY CODE (FX-01b, 2026-10-30, ruling C). A manual account's currency is chosen from the RUNTIME's
 * own ISO 4217 list — runtimeCurrencyCodes() reads Intl.supportedValuesOf('currency') when it is called,
 * never a hand-picked list — and when the runtime has no such list the code is typed under ISO_4217_CODE,
 * the manual route's own rule (src/app/api/transactions/manual/route.ts). Neither path preselects a code.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock, no React.
 */

export const FUNCTIONAL_CURRENCY = 'USD' as const;
export type FunctionalCurrency = typeof FUNCTIONAL_CURRENCY;

/** The label every books screen and export carries. */
export const FUNCTIONAL_CURRENCY_WORDS = `All figures in ${FUNCTIONAL_CURRENCY}`;

export type FunctionalCurrencyErrorCode = 'not-cents' | 'not-decimal' | 'not-dollars';

/** A figure that is not what the caller said it was — the caller's bug, refused by name. */
export class FunctionalCurrencyError extends Error {
  readonly code: FunctionalCurrencyErrorCode;
  constructor(code: FunctionalCurrencyErrorCode, message: string) {
    super(`FUNCTIONAL CURRENCY: ${message}`);
    this.name = 'FunctionalCurrencyError';
    this.code = code;
  }
}

const FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: FUNCTIONAL_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** An integer number of cents as a bigint — a bigint as it is, a safe-integer number converted; anything else refused by name. */
export function centsOf(cents: bigint | number): bigint {
  if (typeof cents === 'bigint') return cents;
  if (typeof cents === 'number' && Number.isSafeInteger(cents)) return BigInt(cents);
  throw new FunctionalCurrencyError('not-cents', `${typeof cents === 'number' ? String(cents) : JSON.stringify(cents)} is not an integer number of cents`);
}

/** '1234.56' · '-45.00' · '0.00' — the decimal text of a number of cents, by integer arithmetic (no sign on zero). */
export function decimalStringOfCents(cents: bigint | number): string {
  const c = centsOf(cents);
  const negative = c < BigInt(0);
  const magnitude = negative ? -c : c;
  const whole = magnitude / BigInt(100);
  const rest = magnitude % BigInt(100);
  return `${negative ? '-' : ''}${whole}.${rest.toString().padStart(2, '0')}`;
}

/**
 * THE ONE FORMATTER: cents → '$1,234.56' · '-$45.00' · '$0.00', in the functional currency, with
 * en-US grouping. The decimal text is handed to Intl as a string, so nothing is rounded or divided.
 */
export function functionalMoneyWords(cents: bigint | number): string {
  return FORMATTER.format(decimalStringOfCents(cents) as unknown as number);
}

const DECIMAL_TWO = /^(-)?(\d+)\.(\d{2})$/;
const TYPED_DOLLARS = /^(-)?(\d+)(?:\.(\d{0,2}))?$/;

/** A Decimal(14,2) column's own text ('1234.56', exactly two decimals) → cents, by string arithmetic; anything else refused by name. */
export function centsOfDecimalString(value: string): bigint {
  const m = typeof value === 'string' ? value.match(DECIMAL_TWO) : null;
  if (m === null) throw new FunctionalCurrencyError('not-decimal', `${JSON.stringify(value)} is not a decimal string with exactly two decimals`);
  const cents = BigInt(m[2]) * BigInt(100) + BigInt(m[3]);
  return m[1] === '-' ? -cents : cents;
}

/**
 * A figure a customer typed ('100', '12.5', '12.50', '-3') → cents, by string arithmetic, padded to two
 * decimals. Blank, a third decimal, letters, exponents: not dollars, refused by name — never rounded.
 */
export function centsOfTypedDollars(typed: string): bigint {
  const trimmed = typeof typed === 'string' ? typed.trim() : '';
  const m = trimmed.match(TYPED_DOLLARS);
  if (m === null) throw new FunctionalCurrencyError('not-dollars', `${JSON.stringify(typed)} is not a dollars figure (digits, at most two decimals)`);
  return centsOfDecimalString(`${m[1] ?? ''}${m[2]}.${(m[3] ?? '').padEnd(2, '0')}`);
}

/** Whether a number's own decimal text is whole cents — a bank figure that can be written by the one formatter. */
export function isWholeCents(n: number): boolean {
  return Number.isFinite(n) && TYPED_DOLLARS.test(String(n));
}

export const CURRENCY_NOT_STATED_WORDS = 'currency not stated';
export const NOT_WHOLE_CENTS_WORDS = 'not whole cents';

/**
 * TRAVEL-01b (Alex, 2026-10-31, ruling C): A STATED PRICE — a vendor's figure in its own minor unit with its
 * ISO code (reservations.finalPriceCents + reservations.currency): the one formatter when the code is the
 * functional currency, else the figure with its code ('12345.00 PHP'). ONE function: the matcher's rationale
 * (src/lib/runway/reservationMatcher.ts, where it was FX-01b's local bookedMoneyWords — the words are unchanged)
 * and the day card's travel stops both write through it; nothing converts, nothing writes a `$` on a figure
 * that is not dollars. A figure that is not whole minor units is the caller's bug, refused by centsOf.
 */
export function statedMoneyWords(minor: bigint | number, currency: string): string {
  const upper = currency.toUpperCase();
  return upper === FUNCTIONAL_CURRENCY ? functionalMoneyWords(minor) : `${decimalStringOfCents(minor)} ${upper}`;
}

// ─── THE CURRENCY CODE (FX-01b, ruling C) ────────────────────────────────────

/** ISO 4217: three capitals — the manual route's own rule, stated once here for the form's typed path. */
export const ISO_4217_CODE = /^[A-Z]{3}$/;

/**
 * The runtime's own ISO 4217 list (Intl.supportedValuesOf('currency')), read when called; NULL when the runtime
 * has no supportedValuesOf — the caller then takes a typed code under ISO_4217_CODE. Neither path is a default.
 */
export function runtimeCurrencyCodes(): readonly string[] | null {
  const intl = Intl as unknown as { supportedValuesOf?: (key: 'currency') => string[] };
  return typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('currency') : null;
}

/**
 * A bank figure in the ACCOUNT's currency: '$1,234.56' when that currency is the functional one;
 * '2520.00 THB' otherwise; a figure whose currency the bank did not state is named so; a missing
 * figure is '—'. A figure that is not whole cents is shown as the bank stated it, named.
 */
export function bankMoneyWords(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const code = typeof currency === 'string' && currency.trim() !== '' ? currency.trim().toUpperCase() : null;
  if (!isWholeCents(amount)) return `${String(amount)} ${code ?? `(${CURRENCY_NOT_STATED_WORDS})`} (${NOT_WHOLE_CENTS_WORDS})`;
  const cents = centsOfTypedDollars(String(amount));
  if (code === FUNCTIONAL_CURRENCY) return functionalMoneyWords(cents);
  const figure = decimalStringOfCents(cents);
  return code === null ? `${figure} (${CURRENCY_NOT_STATED_WORDS})` : `${figure} ${code}`;
}

// ─── THE PLAID RULE AT COMMIT (ruling F) ─────────────────────────────────────

export interface PostingAccount {
  readonly name: string;
  /** accounts.isoCurrencyCode — as Plaid stated it, or NULL (LAW-02). */
  readonly isoCurrencyCode: string | null;
}

export interface PostingTransaction {
  readonly id: string;
  /** transactions.iso_currency_code — Plaid's word for the row (FX-01), NULL for a row synced before it. */
  readonly iso_currency_code: string | null;
}

export type PostingCurrencyVerdict = { readonly ok: true } | { readonly ok: false; readonly error: string };

export const noAccountCurrencyWords = (name: string): string => `account "${name}" states no currency — set it before it posts`;
export const foreignAccountWords = (name: string, code: string): string =>
  `account "${name}" is stated in ${code}; the books are kept in ${FUNCTIONAL_CURRENCY} — FX-02 posts it`;
export const transactionCurrencyWords = (id: string, code: string, accountCode: string): string =>
  `transaction ${id} is stated in ${code} but its account in ${accountCode}`;

/**
 * Whether a bank row may post to the general ledger: its account's currency must BE the functional
 * currency (NULL and any other code refused by name, never converted), and the row's own stated
 * currency, when it has one, must agree with the account's.
 */
export function postingCurrencyRule(account: PostingAccount, transaction: PostingTransaction): PostingCurrencyVerdict {
  const accountCode = account.isoCurrencyCode === null ? null : account.isoCurrencyCode.trim().toUpperCase();
  if (accountCode === null || accountCode === '') return { ok: false, error: noAccountCurrencyWords(account.name) };
  if (accountCode !== FUNCTIONAL_CURRENCY) return { ok: false, error: foreignAccountWords(account.name, accountCode) };
  const rowCode = transaction.iso_currency_code === null ? null : transaction.iso_currency_code.trim().toUpperCase();
  if (rowCode !== null && rowCode !== '' && rowCode !== accountCode) return { ok: false, error: transactionCurrencyWords(transaction.id, rowCode, accountCode) };
  return { ok: true };
}
