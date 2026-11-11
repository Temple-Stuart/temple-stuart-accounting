/**
 * PENDING-02 (Alex, 2026-11-11 12:08: "get bookkeeping full proof" · 16:25: "would be better to get the sync and
 * data issues fixed") — A POSTING WHOSE BANK ROW IS GONE: its shape, the slice size, and every word about it.
 *
 * WHAT IT IS. commitPlaidTransaction posts a bank row as a journal entry that points back at it — source_type
 * 'plaid_txn', source_id = the bank transaction's id (src/lib/journal-entry-service.ts). When that bank row later
 * leaves the account — most often a pending charge the bank replaced with its posted copy — the entry stays: live,
 * counted by every statement, and out of reach of the committed table, which starts from bank rows
 * (src/app/api/transactions/route.ts). Until this file, the only place that said so was the source cell of one entry
 * opened by hand (src/lib/books/entrySource.ts MISSING_ROW_WORDS).
 *
 * WHO READS IT. src/lib/books/postingsWithNoBankRowRead.ts finds them; GET /api/journal-entries/no-bank-row answers
 * them; src/components/books/PostingsWithNoBankRow.tsx is the panel at the top of the General Ledger. The words are
 * written once, here, and nowhere else — the reversal's among them (the buttons, the question, the result, the
 * description prefix and the writer's two refusals), which PENDING-02 part 2 reads.
 *
 * NOTHING IS DELETED OR EDITED. A posting leaves the statements the way every other one does: a reversing entry dated
 * the day it is posted, whose description opens with REVERSAL_PREFIX.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock, no React, no import. A figure is an integer number of cents and
 * this file prints none — the panel writes each through src/lib/books/functionalCurrency.ts functionalMoneyWords.
 */

/** One account a ledger line posts to: the chart's code and name. */
export interface LineAccount {
  readonly code: string;
  readonly name: string;
}

/** ONE POSTING WITH NO BANK ROW — one live journal entry, as the list shows it. */
export interface PostingWithNoBankRow {
  /** The journal entry's own id. */
  readonly id: string;
  /** The entry's date, 'YYYY-MM-DD'. */
  readonly day: string;
  readonly description: string;
  /** The bank transaction id the entry points at — the row that is gone. */
  readonly bankTransactionId: string;
  /** The name of the ENTRY's book. */
  readonly book: string;
  /** The accounts of its debit lines, then of its credit lines. */
  readonly debits: readonly LineAccount[];
  readonly credits: readonly LineAccount[];
  /** The sum of its debit lines, integer cents. */
  readonly cents: number;
}

/** What GET /api/journal-entries/no-bank-row answers: the postings, their count and the sum of their cents. */
export interface NoBankRowAnswer {
  readonly postings: readonly PostingWithNoBankRow[];
  readonly count: number;
  readonly sumCents: number;
}

const NAME = 'postings with no bank row';

/** An integer number of cents, or a fault by name — never rounded, never defaulted. */
function wholeCents(n: unknown, what: string): number {
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw new Error(`${NAME}: ${what} ${JSON.stringify(n)} is not an integer number of cents`);
  return n;
}

/** A count of rows, or a fault by name. */
function counted(n: unknown, what: string): number {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error(`${NAME}: ${what} ${JSON.stringify(n)} is not a count`);
  return n;
}

/** The answer over a list of postings: the list as it is, its length, and the sum of its cents (checked whole). */
export function noBankRowAnswerOf(postings: readonly PostingWithNoBankRow[]): NoBankRowAnswer {
  let sumCents = 0;
  for (const p of postings) sumCents = wholeCents(sumCents + wholeCents(p.cents, `the amount of entry ${p.id}`), 'the sum');
  return { postings, count: postings.length, sumCents };
}

/** A field the answer must state in words. `blankAllowed` is for the one field that is the entry's own text and may be empty: its description. */
const text = (v: unknown, what: string, blankAllowed = false): string => {
  if (typeof v !== 'string' || (v === '' && !blankAllowed)) throw new Error(`${NAME}: the answer states no ${what}`);
  return v;
};

const accountsFrom = (v: unknown, what: string): LineAccount[] => {
  if (!Array.isArray(v)) throw new Error(`${NAME}: the answer states no ${what}`);
  return v.map((a) => {
    const o = (a !== null && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    return { code: text(o.code, `account code among the ${what}`), name: text(o.name, `account name among the ${what}`) };
  });
};

/**
 * THE ANSWER, READ BACK by the panel: every field the route states, or a fault that names the one it does not. An
 * answer whose count or sum disagrees with its own rows is refused too — the panel prints what was counted, never a
 * figure it was merely handed.
 */
export function noBankRowAnswerFrom(body: unknown): NoBankRowAnswer {
  const o = (body !== null && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!Array.isArray(o.postings)) throw new Error(`${NAME}: the answer states no postings`);
  const postings = o.postings.map((row): PostingWithNoBankRow => {
    const r = (row !== null && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const id = text(r.id, 'entry id');
    return {
      id,
      day: text(r.day, `day for entry ${id}`),
      description: text(r.description, `description for entry ${id}`, true),
      bankTransactionId: text(r.bankTransactionId, `bank transaction id for entry ${id}`),
      book: text(r.book, `book for entry ${id}`),
      debits: accountsFrom(r.debits, `debit accounts of entry ${id}`),
      credits: accountsFrom(r.credits, `credit accounts of entry ${id}`),
      cents: wholeCents(r.cents, `the amount of entry ${id}`),
    };
  });
  const answer = noBankRowAnswerOf(postings);
  if (counted(o.count, 'the answer\'s count') !== answer.count) throw new Error(`${NAME}: the answer counts ${String(o.count)} and carries ${answer.count}`);
  if (wholeCents(o.sumCents, 'the answer\'s sum') !== answer.sumCents) throw new Error(`${NAME}: the answer sums to ${String(o.sumCents)} cents and its rows to ${answer.sumCents}`);
  return answer;
}

// ── THE WORDS ────────────────────────────────────────────────────────────────

/** The count line: `1 posting has no bank row` · `46 postings have no bank row`. */
export const countWords = (n: number): string => (counted(n, 'the count') === 1 ? '1 posting has no bank row' : `${n} postings have no bank row`);

/** The one line under it: what they are, and when to reverse one. */
export const WHAT_THEY_ARE_WORDS = 'Each was posted from a bank row that is no longer in your account — most often a pending charge the bank replaced with its posted copy. Reverse one when its charge is posted from another row, or never went through.';

export const SHOW_WORDS = 'Show them';
export const HIDE_WORDS = 'Hide them';

/** The table's columns, in order. */
export const COLUMN_WORDS = ['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Book'] as const;

/** The button over the ticked rows, and the second press that sends them. */
export const reverseWords = (n: number): string => `Reverse ${counted(n, 'the number ticked')}`;

/** The one question asked before anything is sent. */
export const questionWords = (n: number): string => (counted(n, 'the number ticked') === 1 ? 'Post 1 reversing entry dated today?' : `Post ${n} reversing entries dated today?`);

export const CANCEL_WORDS = 'Cancel';

/** The result line: `Reversed 46 of 46`. */
export const resultWords = (reversed: number, asked: number): string => `Reversed ${counted(reversed, 'the number reversed')} of ${counted(asked, 'the number asked')}`;

export const REFRESH_WORDS = 'Refresh the books';

/** What a reversal posted from this list opens its description with — the reason, on the entry itself. */
export const REVERSAL_PREFIX = 'REVERSAL (no bank row): ';

/** The writer's two refusals in this mode (src/lib/journal-entry-service.ts reversePlaidTransaction, bankRowGone). */
export const NOT_FROM_THAT_BANK_ROW_WORDS = 'this entry was not posted from that bank row — nothing was reversed';
export const BANK_ROW_EXISTS_WORDS = 'this posting\'s bank row exists — uncommit it on the committed table';

// ── THE ROUTE, AND WHAT THE PANEL SAYS WHEN ITS ANSWER CANNOT BE READ ────────

/** The one route: the panel reads it. */
export const NO_BANK_ROW_ROUTE = '/api/journal-entries/no-bank-row';

/** An answer that is not JSON: the route and its status, nothing guessed. */
export const notJsonWords = (status: number): string => `${NO_BANK_ROW_ROUTE} answered ${status} and its answer was not JSON`;

/** A day the one day formatter will not print (src/lib/plaid/failLoud.ts calendarDay): a fault by name, never a blank cell. */
export const notADayWords = (entryId: string, day: string): string => `${NAME}: entry ${entryId}'s day ${JSON.stringify(day)} is not a calendar day`;

// ── THE SLICE ────────────────────────────────────────────────────────────────

/** How many entries one request reverses — the panel sends its ticked rows in slices of this, the route takes no more. */
export const REVERSAL_SLICE = 25;

/** The ids in slices of REVERSAL_SLICE, in the order given — the last one holds what is left. */
export function slicesOf<T>(ids: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < ids.length; at += REVERSAL_SLICE) out.push(ids.slice(at, at + REVERSAL_SLICE));
  return out;
}
