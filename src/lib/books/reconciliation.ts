/**
 * DOCUMENTS-02 (Alex, 2026-10-30, rulings C, D, E, F) — THE BANK RECONCILIATION'S RULES.
 *
 * THE NUMBERS ARE THE SERVER'S (C). The route reads the body's statement balance and items through the
 * rules here, computes the book balance itself (bankSide.ts + the GL), and stores ITS arithmetic:
 *   adjusted_bank = statement + deposits in transit − outstanding checks
 *   adjusted_book = book − bank fees + interest
 *   difference    = |adjusted_bank − adjusted_book|
 * A statement balance is any finite number (zero and overdrawn included); items is an array, each item
 * typed, described, with a finite amount and a boolean cleared; status is 'draft' or 'reconciled';
 * 'reconciled' only when the difference is under half a cent AND the month's statement document is current
 * (E). Anything else is refused by name. A body carrying bookBalance is refused: the books compute it.
 *
 * A RECONCILED MONTH IS FROZEN (D): the database refuses to change it (the migration's trigger) and the
 * route surfaces the trigger's own words; it is re-opened only by supersession — a new current draft row,
 * the old one marked superseded by it. The screen shows the current row, and the superseded ones under
 * it, read-only: "superseded <day> — final".
 *
 * A PERIOD IS A MONTH (F): 'YYYY-MM' in and out (period.ts); nothing here parses a Date.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock, no React — the screen reads through it too.
 */
import { BAD_PERIOD_WORDS, periodOf, periodRule, type Period } from './period';
import type { ReceiptMeta, Refusal } from './sourceDocuments';

// ─── the words ───────────────────────────────────────────────────────────────

export const BOOK_BALANCE_FIELD_WORDS = 'bookBalance is not a field — the books compute it';
export const ACCOUNT_REQUIRED_WORDS = 'say which account (accountId)';
export const NOT_YOUR_ACCOUNT_WORDS = 'no account of yours has that id';
export const NOT_DEPOSITORY_WORDS = 'that account is not a bank (depository) account — a reconciliation is a bank account’s';
export const STATEMENT_BALANCE_WORDS = 'statementBalance is not a number — the statement’s closing balance, zero and overdrawn included';
export const ITEMS_ARRAY_WORDS = 'items is an array of reconciling items (it may be empty)';
export const STATUS_WORDS = "status is 'draft' or 'reconciled'";
export const REOPEN_FLAG_WORDS = 'reopen is true or absent';
export const REOPEN_IS_DRAFT_WORDS = 'a re-opened month starts as a draft — send status draft with reopen';
export const NO_DIFFERENCE_YET_WORDS = 'enter the statement balance — the difference is computed from it';
export const BANK_SIDE_LOADING_WORDS = 'reading the books…';
export const DRAFT_SAVED_WORDS = 'draft saved';
export const SUPERSEDED_FINAL_WORDS = 'final';

export const unknownReconciliationFieldWords = (name: string): string =>
  `"${name}" is not a field of a reconciliation (accountId, period, statementBalance, items, status, reopen)`;
export const itemTypeWords = (n: number): string => `item ${n} has no type — one of ${ITEM_TYPES.join(', ')}`;
export const itemDescriptionWords = (n: number): string => `item ${n} has no description`;
export const itemAmountWords = (n: number): string => `item ${n} has no amount`;
export const itemClearedWords = (n: number): string => `item ${n} says nothing about cleared (true or false)`;
export const notReconciledWords = (difference: number): string => `difference is ${moneyWords(difference)} — not reconciled`;
export const attachStatementWords = (period: Period): string => `attach the bank statement for ${period.words} first`;
export const nothingToReopenWords = (period: Period): string => `nothing to re-open — ${period.words} is not reconciled`;
export const reconciledFrozenWords = (period: Period): string => `${period.words} is reconciled — re-open it to change it`;
export const supersededWords = (day: string): string => `superseded ${day} — ${SUPERSEDED_FINAL_WORDS}`;
export const noCoaRowWords = (code: string, entityType: string): string =>
  `the ${entityType} entity has no chart-of-accounts row ${code} — the account’s code names a row the books do not hold`;
export const currentMeanwhileWords = (period: Period): string => `${period.words} was saved by someone else meanwhile — read it again`;

/** $9,445.00 — en-US grouping, two decimals, the sign in front. */
export function moneyWords(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

// ─── the inputs ──────────────────────────────────────────────────────────────

export const ITEM_TYPES = ['deposit_in_transit', 'outstanding_check', 'bank_fee', 'interest'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const ITEM_TYPE_WORDS: Readonly<Record<ItemType, string>> = {
  deposit_in_transit: 'deposit in transit', outstanding_check: 'outstanding check', bank_fee: 'bank fee', interest: 'interest',
};

export interface ReconciliationItem {
  readonly type: ItemType;
  readonly description: string;
  readonly amount: number;
  readonly cleared: boolean;
}

export const RECONCILIATION_FIELDS = ['accountId', 'period', 'statementBalance', 'items', 'status', 'reopen'] as const;
export const STATUSES = ['draft', 'reconciled'] as const;
export type ReconciliationStatusWord = (typeof STATUSES)[number];

const refuse = (status: 400 | 404 | 409, error: string): Refusal => ({ ok: false, status, error });
const PLAIN_NUMBER = /^\s*-?\d+(\.\d+)?\s*$/;

/** A finite number, as a number or a string that is plainly one — nothing else. */
export function finiteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && PLAIN_NUMBER.test(v)) return Number(v);
  return null;
}

/** The statement's closing balance: any finite number — zero and overdrawn are numbers. */
export function statementBalanceRule(raw: unknown): { ok: true; value: number } | Refusal {
  const n = finiteNumber(raw);
  return n === null ? refuse(400, STATEMENT_BALANCE_WORDS) : { ok: true, value: n };
}

/** The reconciling items: an array (absent is refused), each item whole — the first fault named by its number. */
export function itemsRule(raw: unknown): { ok: true; value: ReconciliationItem[] } | Refusal {
  if (!Array.isArray(raw)) return refuse(400, ITEMS_ARRAY_WORDS);
  const items: ReconciliationItem[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const n = i + 1;
    const it = raw[i];
    if (typeof it !== 'object' || it === null || Array.isArray(it)) return refuse(400, itemTypeWords(n));
    const o = it as Record<string, unknown>;
    if (typeof o.type !== 'string' || !(ITEM_TYPES as readonly string[]).includes(o.type)) return refuse(400, itemTypeWords(n));
    if (typeof o.description !== 'string' || o.description.trim() === '') return refuse(400, itemDescriptionWords(n));
    const amount = finiteNumber(o.amount);
    if (amount === null) return refuse(400, itemAmountWords(n));
    if (typeof o.cleared !== 'boolean') return refuse(400, itemClearedWords(n));
    items.push({ type: o.type as ItemType, description: o.description.trim(), amount, cleared: o.cleared });
  }
  return { ok: true, value: items };
}

/** 'draft' or 'reconciled' — nothing else, nothing defaulted. */
export function statusRule(raw: unknown): { ok: true; value: ReconciliationStatusWord } | Refusal {
  if (raw === 'draft' || raw === 'reconciled') return { ok: true, value: raw };
  return refuse(400, STATUS_WORDS);
}

/** reopen: absent, or true. */
export function reopenRule(raw: unknown): { ok: true; value: boolean } | Refusal {
  if (raw === undefined) return { ok: true, value: false };
  if (raw === true) return { ok: true, value: true };
  return refuse(400, REOPEN_FLAG_WORDS);
}

/** The body's fields: the six and nothing else; bookBalance refused in its own words. */
export function bodyFieldsRule(body: Record<string, unknown>): { ok: true } | Refusal {
  for (const name of Object.keys(body)) {
    if (name === 'bookBalance') return refuse(400, BOOK_BALANCE_FIELD_WORDS);
    if (!(RECONCILIATION_FIELDS as readonly string[]).includes(name)) return refuse(400, unknownReconciliationFieldWords(name));
  }
  return { ok: true };
}

export { periodRule, BAD_PERIOD_WORDS };

// ─── the arithmetic ──────────────────────────────────────────────────────────

export interface ReconciliationFigures {
  readonly depositsInTransit: number;
  readonly outstandingChecks: number;
  readonly bankFees: number;
  readonly interest: number;
  readonly adjustedBank: number;
  readonly adjustedBook: number;
  readonly difference: number;
}

const cents = (n: number): number => Math.round(n * 100) / 100;
const sumOf = (items: readonly ReconciliationItem[], type: ItemType, unclearedOnly: boolean): number =>
  cents(items.filter((i) => i.type === type && (!unclearedOnly || !i.cleared)).reduce((s, i) => s + i.amount, 0));

/** The reconciliation's figures from the statement, the items and the BOOKS' balance — the one arithmetic, server and screen. */
export function reconcile(statementBalance: number, bookBalance: number, items: readonly ReconciliationItem[]): ReconciliationFigures {
  const depositsInTransit = sumOf(items, 'deposit_in_transit', true);
  const outstandingChecks = sumOf(items, 'outstanding_check', true);
  const bankFees = sumOf(items, 'bank_fee', false);
  const interest = sumOf(items, 'interest', false);
  const adjustedBank = cents(statementBalance + depositsInTransit - outstandingChecks);
  const adjustedBook = cents(bookBalance - bankFees + interest);
  return { depositsInTransit, outstandingChecks, bankFees, interest, adjustedBank, adjustedBook, difference: cents(Math.abs(adjustedBank - adjustedBook)) };
}

/** Reconciled is a difference under half a cent — nothing about the statement's sign. */
export const isBalanced = (difference: number): boolean => difference < 0.005;

/** The GL balance from the route's SQL: cents as text, by the account's normal balance. */
export function bookBalanceOf(totalDebitsCents: string, totalCreditsCents: string, balanceType: string): number {
  const d = Number(totalDebitsCents), c = Number(totalCreditsCents);
  if (!Number.isFinite(d) || !Number.isFinite(c)) throw new Error(`DOCUMENTS-02: the GL sums are not numbers (${totalDebitsCents}, ${totalCreditsCents})`);
  return cents((balanceType === 'D' ? d - c : c - d) / 100);
}

/**
 * Whether a month may be marked reconciled — the server's gate, mirrored by the screen's control:
 * the books resolved, the difference under half a cent, the statement current. The first missing thing is the reason.
 */
export function reconciledGate(input: {
  readonly bookSide: { ok: true } | Refusal;
  readonly difference: number | null;
  readonly statement: ReceiptMeta | null;
  readonly period: Period;
}): { ok: true } | Refusal {
  if (!input.bookSide.ok) return input.bookSide;
  if (input.difference === null) return refuse(409, NO_DIFFERENCE_YET_WORDS);
  if (!isBalanced(input.difference)) return refuse(409, notReconciledWords(input.difference));
  if (input.statement === null) return refuse(409, attachStatementWords(input.period));
  return { ok: true };
}

// ─── the database's refusal, surfaced ────────────────────────────────────────

/** The freeze or no-delete trigger's own sentence inside a Prisma error's text — or null when the error is something else. */
export function triggerRefusalOf(message: string): string | null {
  const m = /message: "(Bank reconciliation[^"]*)"/.exec(message) ?? /(Bank reconciliations? [^"\n]*?(?:frozen|final|deleted)[^"\n]*\.)/.exec(message);
  return m === null ? null : m[1];
}

// ─── the wire's row ──────────────────────────────────────────────────────────

/** A stored row, as Prisma reads it (Decimals already numbers). */
export interface StoredReconciliation {
  readonly id: string;
  readonly account_id: string;
  readonly entity_id: string;
  readonly year: number;
  readonly month: number;
  readonly statement_balance: number;
  readonly book_balance: number;
  readonly adjusted_bank: number;
  readonly adjusted_book: number;
  readonly difference: number;
  readonly status: string;
  readonly reconciled_at: Date | null;
  readonly reconciled_by: string | null;
  readonly items: unknown;
  readonly superseded_by: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface ReconciliationAccount {
  readonly id: string;
  readonly name: string;
  readonly mask: string | null;
  /** The institution's name, or null — null renders nothing, never 'Unknown'. */
  readonly institution: string | null;
}

export interface ReconciliationRow {
  readonly id: string;
  readonly accountId: string;
  readonly entityId: string;
  readonly period: string;
  readonly period_end: string;
  readonly words: string;
  readonly statementBalance: number;
  readonly bookBalance: number;
  readonly adjustedBankBalance: number;
  readonly adjustedBookBalance: number;
  readonly difference: number;
  readonly status: string;
  readonly items: ReconciliationItem[];
  readonly reconciledAt: string | null;
  readonly reconciledBy: string | null;
  readonly supersededBy: string | null;
  /** The UTC day this row was superseded (its last write), or null while current. */
  readonly supersededOn: string | null;
  readonly createdAt: string;
  readonly account: ReconciliationAccount;
  /** The month's current statement document, or null — only on a current row. */
  readonly statement: ReceiptMeta | null;
  /** The superseded rows this one replaced, newest first — only on a current row. */
  readonly history: ReconciliationRow[];
}

/** The stored items, read by the rule — a row whose items a bad writer left malformed is said, never read as none. */
function storedItemsOf(row: StoredReconciliation): ReconciliationItem[] {
  const read = itemsRule(row.items ?? []);
  if (!read.ok) throw new Error(`DOCUMENTS-02: bank_reconciliations ${row.id} holds items the rule cannot read — ${read.error}`);
  return read.value;
}

const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

/** One row on the wire. */
export function reconciliationRowOf(row: StoredReconciliation, account: ReconciliationAccount, statement: ReceiptMeta | null, history: ReconciliationRow[]): ReconciliationRow {
  const period = periodOf(row.year, row.month);
  return {
    id: row.id, accountId: row.account_id, entityId: row.entity_id,
    period: period.period, period_end: period.period_end, words: period.words,
    statementBalance: row.statement_balance, bookBalance: row.book_balance,
    adjustedBankBalance: row.adjusted_bank, adjustedBookBalance: row.adjusted_book, difference: row.difference,
    status: row.status, items: storedItemsOf(row),
    reconciledAt: row.reconciled_at === null ? null : row.reconciled_at.toISOString(),
    reconciledBy: row.reconciled_by,
    supersededBy: row.superseded_by,
    supersededOn: row.superseded_by === null ? null : dayOf(row.updated_at),
    createdAt: row.created_at.toISOString(),
    account, statement, history,
  };
}

/** The current rows, each with its superseded chain under it, newest month first. */
export function reconciliationListOf(
  rows: readonly StoredReconciliation[],
  accountOf: (accountId: string) => ReconciliationAccount,
  statementOf: (accountId: string, period: string) => ReceiptMeta | null,
): ReconciliationRow[] {
  const bySupersededBy = new Map<string, StoredReconciliation>();
  for (const r of rows) if (r.superseded_by !== null) bySupersededBy.set(r.superseded_by, r);
  const chainUnder = (current: StoredReconciliation): ReconciliationRow[] => {
    const chain: ReconciliationRow[] = [];
    let next = bySupersededBy.get(current.id);
    while (next !== undefined) {
      chain.push(reconciliationRowOf(next, accountOf(next.account_id), null, []));
      next = bySupersededBy.get(next.id);
    }
    return chain;
  };
  return rows
    .filter((r) => r.superseded_by === null)
    .sort((a, b) => (b.year - a.year) || (b.month - a.month) || a.account_id.localeCompare(b.account_id))
    .map((r) => reconciliationRowOf(r, accountOf(r.account_id), statementOf(r.account_id, periodOf(r.year, r.month).period), chainUnder(r)));
}
