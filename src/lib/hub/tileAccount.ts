/**
 * CAL-02 (Alex, 2026-10-27) — THE ACCOUNT REACHES THE CALENDAR TILE.
 *
 * THE GRAIN IS THE ACCOUNT — book + code + name — never the bare code (ruling A):
 * 6200 is Personal Fitness in one book and Business Software in another. The
 * words are the tables' words, "P-6150 Food & drink": the book's letter and the
 * four digits by ROUTINES-01's helper (accountCell), the chart's name by THE
 * WORK's rule (chartNameOf). Nothing here is a second reading of a code.
 *
 * THE JOIN HAPPENS ON THE SERVER, once per window request (ruling B): the window
 * route reads the returned routines' books and their charts ONCE and ships, per
 * routine and per line, `account` beside the existing coa_code. A saved code
 * with no chart row → 'missing', the account carrying its code and book with
 * name null (CAL-02 ruling 1, 2026-10-27 — the panel prints "P-9999 — not in the
 * chart" from it); no code → 'none', account null.
 *
 * THE TILE (ruling C, as ruled 2026-10-27): the mapper reads the lines' OWN codes,
 * not routinePlanned's coaCode (null for every costed-lines routine, LINES-01):
 * a stepless routine → its own; every coded line sharing one code → that
 * account; two or more codes → 'several', account null; no code on any line →
 * the routine's own (which is 'none' when it has none).
 *
 * THE PANEL (ruling D): one words rule for the four states — the account's
 * words, "several accounts", "no account", "P-9999 — not in the chart".
 *
 * Pure: no fetch, no React, no Prisma. The route hands it rows; the mapper and
 * the panel hand it what the route shipped.
 */
import { accountCell, type AccountCellBook } from '@/lib/coa/accountCell';
import { CHART_MISSING_WORDS, chartNameOf, type WorkChart } from '@/lib/operations/work';

/** The account a routine or a line is coded to: the book's letter, the four digits, the chart's name — null when the chart lists no row for the code ('missing'). */
export interface TileAccount {
  readonly code: string;
  readonly name: string | null;
  readonly book: string;
}
/** The route's three states, per routine and per line. */
export type AccountState = 'account' | 'none' | 'missing';
/** The tile's four — the mapper adds 'several' for a lined routine whose lines carry more than one code. */
export type TileAccountState = AccountState | 'several';

export interface AccountRead {
  readonly account: TileAccount | null;
  readonly account_state: AccountState;
}

/** A book as the window route reads it — its id and its entity type (the letter's source). */
export interface TileBook extends AccountCellBook { readonly id: string }

/** The letter and the four digits of the helper's account string: "P-6150" → P · 6150; an unlettered book's "6150" → '' · 6150. */
const splitAccountText = (text: string): { readonly book: string; readonly code: string } => {
  const m = /^(?:([PBT])-)?(\d{4})$/.exec(text);
  if (!m) throw new Error(`tileAccount: ${JSON.stringify(text)} is not an account string — the helper draws <letter>-<four digits>`);
  return { book: m[1] ?? '', code: m[2] };
};

/**
 * ONE saved code read as its account, by the tables' rule: blank → 'none'; the
 * helper's account string with the chart's name → 'account'; the string with no
 * chart row → 'missing' (name null); a saved code the chart's rule cannot read
 * (legacy only — planMoney writes the chart row's own code) → 'missing' too, the
 * code as saved. A book the route did not hand in is the route's error, thrown.
 */
export function accountOf(books: readonly TileBook[], chart: WorkChart, bookId: string, saved: string | null): AccountRead {
  const cell = accountCell(books, bookId, saved);
  if (cell.state === 'blank') return { account: null, account_state: 'none' };
  if (cell.state === 'book-not-loaded') throw new Error(`tileAccount: book ${bookId} was not read with the window — the route reads every returned routine's book`);
  const book = books.find((b) => b.id === bookId);
  if (book === undefined) throw new Error(`tileAccount: book ${bookId} was not read with the window`);
  if (cell.state === 'not-recognised') {
    const letter = /^[PBT]$/.test(String(bookLetterOf(book))) ? String(bookLetterOf(book)) : '';
    return { account: { code: String(saved).trim(), name: null, book: letter }, account_state: 'missing' };
  }
  const { book: letter, code } = splitAccountText(cell.text);
  const name = chartNameOf(chart, cell.text);
  return name === null
    ? { account: { code, name: null, book: letter }, account_state: 'missing' }
    : { account: { code, name, book: letter }, account_state: 'account' };
}
/** The book's letter by the helper's own drawing of a code in it (deriveAccountString through accountCell) — null for an unlettered type. */
function bookLetterOf(book: TileBook): string | null {
  const cell = accountCell([book], book.id, '1000');
  if (cell.state !== 'account') return null;
  return splitAccountText(cell.text).book || null;
}

// ── B · THE WINDOW ANSWER, ANNOTATED ─────────────────────────────────────────

export interface WindowLineIn { readonly id: string; readonly coa_code: string | null }
export interface WindowEntryIn<L extends WindowLineIn> { readonly entity_id: string; readonly coa_code: string | null; readonly steps: readonly L[] }
export type WindowLineOut<L extends WindowLineIn> = L & AccountRead;
export type WindowEntryOut<E extends WindowEntryIn<L>, L extends WindowLineIn> = Omit<E, 'steps'> & AccountRead & { readonly steps: readonly WindowLineOut<L>[] };

/**
 * The route's one pass: every entry and every line gains `account` and
 * `account_state` by accountOf over the entry's book and that book's chart;
 * every existing key is carried as it was (the answer is additive — cal02 diffs
 * it). The charts are given by book id — one read, never per routine.
 */
export function annotateWindow<E extends WindowEntryIn<L>, L extends WindowLineIn>(
  entries: readonly E[],
  books: readonly TileBook[],
  chartsByBook: ReadonlyMap<string, WorkChart>,
): WindowEntryOut<E, L>[] {
  return entries.map((e) => {
    const chart = chartsByBook.get(e.entity_id) ?? [];
    const own = accountOf(books, chart, e.entity_id, e.coa_code);
    const steps = e.steps.map((s) => ({ ...s, ...accountOf(books, chart, e.entity_id, s.coa_code) }));
    return { ...e, ...own, steps };
  });
}

// ── C · THE TILE ─────────────────────────────────────────────────────────────

export interface TileAccountRead {
  readonly account: TileAccount | null;
  readonly accountState: TileAccountState;
}
/** What the tile rule reads of the window's entry — the routine's own read and its lines' (each line's own read). */
export interface TileEntryIn {
  readonly account?: TileAccount | null;
  readonly account_state?: AccountState;
  readonly steps?: readonly { readonly id: string; readonly account?: TileAccount | null; readonly account_state?: AccountState }[] | null;
}

/** One account's identity for the lines' count — the book and the code (a 'missing' account counts by its code too). */
const accountKey = (a: TileAccount): string => `${a.book}-${a.code}`;

/**
 * The tile's account by the leaf grain (ruling C as ruled 2026-10-27): no lines
 * → the routine's own; the lines' coded ones (state 'account' or 'missing') —
 * one code among them → that line's account and state; two or more codes →
 * 'several' with no account; none coded → the routine's own. An entry the route
 * shipped without an account_state is not read: null (the tile carries none).
 * A line without one, when the routine has one, is the route's error.
 */
export function tileAccountOf(entry: TileEntryIn): TileAccountRead | null {
  if (entry.account_state === undefined) return null;
  const own: TileAccountRead = { account: entry.account ?? null, accountState: entry.account_state };
  const lines = entry.steps ?? [];
  if (lines.length === 0) return own;
  const coded = new Map<string, TileAccountRead>();
  for (const l of lines) {
    if (l.account_state === undefined) throw new Error(`tileAccount: line ${l.id} carries no account_state — the window route ships one per line`);
    if (l.account_state === 'none') continue;
    if (!l.account) throw new Error(`tileAccount: line ${l.id} is ${l.account_state} with no account — the route ships the code and book for it`);
    coded.set(accountKey(l.account), { account: l.account, accountState: l.account_state });
  }
  if (coded.size === 0) return own;
  if (coded.size === 1) return [...coded.values()][0];
  return { account: null, accountState: 'several' };
}

// ── D · THE WORDS ────────────────────────────────────────────────────────────

export const SEVERAL_ACCOUNTS_WORDS = 'several accounts';
export const NO_ACCOUNT_WORDS = 'no account';
/** A routine tile whose window answer carried no account read (an older answer) — said, never a blank. */
export const ACCOUNT_NOT_READ_WORDS = 'account not read';

/** "P-6150" — the helper's string from the account's book and code; an unlettered book's code alone. */
export const accountCodeWords = (a: TileAccount): string => (a.book === '' ? a.code : `${a.book}-${a.code}`);

/**
 * The one words rule, the tables' (work.ts accountWordsOf): 'account' →
 * "P-6150 Food & drink"; 'missing' → "P-9999 — not in the chart"; 'several' →
 * "several accounts"; 'none' → "no account". A state whose account is absent
 * when it must carry one is the caller's error.
 */
export function accountWords(account: TileAccount | null, state: TileAccountState): string {
  switch (state) {
    case 'none': return NO_ACCOUNT_WORDS;
    case 'several': return SEVERAL_ACCOUNTS_WORDS;
    case 'missing':
      if (account === null) throw new Error('tileAccount: a missing account carries its code and book');
      return `${accountCodeWords(account)} — ${CHART_MISSING_WORDS}`;
    case 'account':
      if (account === null || account.name === null) throw new Error('tileAccount: an account carries its name');
      return `${accountCodeWords(account)} ${account.name}`;
  }
}
/** The panel's words for a row or a line that may not have been read with its account. */
export const readAccountWords = (read: { readonly account?: TileAccount | null; readonly accountState?: TileAccountState }): string =>
  (read.accountState === undefined ? ACCOUNT_NOT_READ_WORDS : accountWords(read.account ?? null, read.accountState));
