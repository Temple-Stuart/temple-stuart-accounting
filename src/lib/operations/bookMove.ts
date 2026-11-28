/**
 * EDIT-03 (Alex, 2026-11-29) — A PLAN MOVES TO ANOTHER BOOK. "they should all be able to be edited, eccept for formula driven cells"
 * (2026-11-28): ENTITY is typed in place, and a row moves to the book picked — on a repeating plan, the whole plan, every day of it.
 *
 * The move's PLAN, pure (as routineRekey.ts is the rekey's): handed the routine, all its lines (active or not), its and its lines' vendor
 * rows with their vendors, the target book — its word, its book as the money rule reads it (EDIT-04: loadPlanBook.ts), its vendors — the
 * source book's entity type and the CATEGORY picked (EDIT-04), and what the route counted inside its transaction (the Books links, the Books
 * lines coded to it, the other rows that keep their own book), it answers the refusal's words, or the move: the lines, the plan's account in
 * the target book (EDIT-04), and each vendor row's target — a vendor the target book already holds of the same name (planVendor.ts takenBy over
 * vendorNameKey, the directory's own match), or the name and tag to add there, copied from the vendor the plan names. Nothing is read
 * here and nothing is written; the route (routines/[id]/route.ts PATCH) reads, calls this, and writes what it returns, in one transaction.
 *
 * Refused, in this order, and nothing moves:
 *   (a) a posting in Books is linked to the plan (planned_item_links — the routine DELETE's own reader);
 *   (b) a Books line is coded to it (ledger_line_links.routine_id — the DELETE's count);
 *   EDIT-04 (Alex, 2026-11-29) — THE ACCOUNT IS PICKED IN THE NEW BOOK, where (c) stood. (c) carried a code over by its number when the target
 *       chart held the number — and two books may give one number to two different accounts. Now the plan's accounts — the routine's and every
 *       line's, active or not — are each read by the SOURCE book's rule (planMoney.ts readsAs), so "6150" and "P-6150" are one account: with
 *       none, a CATEGORY picked is refused (the book alone moves); with one, none picked is refused, else the code picked is read by the money
 *       rule for the target book (planMoney, each row's own amount as stored — the routine as 'routine', each line carrying the account as
 *       'line'), its refusal said in its words, its answer written on each row that carried the account; with two or more, refused by name;
 *   (d) another row that keeps its own book points at the plan (on the hub's schedule, or in Content);
 *   (e) two of the target book's vendors answer one name the plan's vendor rows carry — which of them would be a guess.
 */
import { editedPlanMoney, planMoney, readsAs, type PlanBook } from './planMoney';
import { takenBy, vendorNameKey } from './planVendor';
import { BOOKS_CODED_MOVE_WORDS, BOOKS_LINK_MOVE_WORDS, MOVE_ACCOUNTS_MANY_WORDS, MOVE_NO_ACCOUNT_WORDS, MOVE_OTHER_BOOK_ROWS_WORDS, MOVE_PICK_ACCOUNT_WORDS } from './linkHold';

/** A body that moves a routine to another book carries nothing else — the move is its own path and its own transaction (the cell sends entity_id alone). */
export const ENTITY_MOVES_ALONE_WORDS = 'ENTITY moves alone — save the other change first';
/** (e): two of the target book's vendors answer the name — refused, nothing moved. */
export const MOVE_VENDOR_NAME_TWICE_WORDS = (book: string, name: string): string => `${book} holds two vendors named "${name}" — nothing was moved`;
/** A vendor of the name was added to the target book between the move's read and its add — the directory's unique key; nothing written. */
export const MOVE_VENDOR_RACE_WORDS = (book: string): string => `a vendor of that name was added to ${book} while this edit ran — try again`;

/** A vendor a plan's row names — its own name and tag, what a copy of it carries. */
export interface BookMoveVendor {
  readonly id: string;
  readonly vendor_name: string;
  readonly instagram_tag: string | null;
}
/** A vendor row of the routine or one of its lines, with its vendor. */
export interface BookMoveVendorRow {
  readonly id: string;
  readonly vendor_id: string;
  readonly vendor: BookMoveVendor;
}
/** The book the plan moves to: its word (the sheet's), its book as the money rule reads it (EDIT-04: loadPlanBook.ts — its entity type and whole chart, archived rows included), and its vendors (active or archived — the directory's own match). */
export interface BookMoveTarget {
  readonly word: string;
  readonly book: PlanBook;
  readonly vendors: readonly { readonly id: string; readonly vendor_name: string }[];
}
/** What the route counted inside its transaction: (a) the Books links, (b) the Books lines coded to the routine, (d) the other rows that keep their own book. */
export interface BookMoveCounts {
  readonly links: number;
  readonly coded: number;
  readonly otherBook: number;
}
/** A money column as stored — Prisma's Decimal, or null (planMoney.ts StoredPlanMoney). */
type StoredAmount = { toString(): string } | null;
export interface BookMoveInput {
  readonly routine: { readonly coa_code: string | null; readonly budget_amount: StoredAmount };
  readonly lines: readonly { readonly id: string; readonly coa_code: string | null; readonly budget_amount: StoredAmount }[];
  readonly vendorRows: readonly BookMoveVendorRow[];
  /** EDIT-04: the book the plan is in — its entity type, whose rule reads the plan's own codes. */
  readonly source: { readonly entityType: string };
  readonly target: BookMoveTarget;
  /** EDIT-04: the CATEGORY picked in the target book, as sent — null (or blank) when none was. */
  readonly picked: string | null;
  readonly counts: BookMoveCounts;
}
/** EDIT-04: an account the plan carries — its key by the source book's rule, its code as first stored, and the rows that carry it. */
export interface PlanAccount {
  readonly key: string;
  readonly code: string;
  readonly routine: boolean;
  readonly lines: readonly string[];
}
/** EDIT-04: the plan's account, moved — its code before, the code the money rule answers in the target book (as its chart saves it), and the rows to write it on. */
export interface BookMoveMoney {
  readonly from: string;
  readonly coaCode: string;
  readonly routine: boolean;
  readonly lines: readonly string[];
}
/** A vendor the target book lacks, to add there before any row points at it — keyed by its name's key, its name and tag the source vendor's own. */
export interface BookMoveAdd {
  readonly key: string;
  readonly source: BookMoveVendor;
}
/** A vendor row re-pointed: to a vendor the target book holds, or to the one added under its key. */
export interface BookMoveRepoint {
  readonly id: string;
  readonly from: BookMoveVendor;
  readonly to: { readonly kind: 'held'; readonly vendorId: string } | { readonly kind: 'added'; readonly key: string };
}
/** A refusal: its status (EDIT-04 — 400 for the CATEGORY the body sends or lacks, and the money rule's; 409 otherwise), its field, its words. */
export type BookMoveRefusal = { readonly ok: false; readonly status: 400 | 409; readonly field: 'entity_id' | 'coa_code'; readonly words: string };
export type BookMovePlan =
  | BookMoveRefusal
  | { readonly ok: true; readonly lines: readonly string[]; readonly money: BookMoveMoney | null; readonly adds: readonly BookMoveAdd[]; readonly repoints: readonly BookMoveRepoint[] };

/** Thrown inside the route's transaction to roll it back with the refusal — nothing has been written when it is. */
export class MoveRefused extends Error {
  constructor(readonly status: 400 | 404 | 409, readonly field: 'entity_id' | 'coa_code', readonly words: string) {
    super(words);
    this.name = 'MoveRefused';
  }
}

/**
 * EDIT-04: the plan's accounts — the routine's first, then each line's in order (active or not), each once — keyed by the SOURCE book's rule
 * (planMoney.ts readsAs: four digits, or the book's letter and four), so "6150" and "P-6150" are one. A code the source book's rule cannot read
 * is an account of its own, by the code as stored. No code is no account.
 */
export function planAccounts(input: Pick<BookMoveInput, 'routine' | 'lines' | 'source'>): readonly PlanAccount[] {
  const found = new Map<string, { readonly code: string; readonly routine: boolean; readonly lines: string[] }>();
  const keyOf = (code: string): string => readsAs(code, input.source.entityType) ?? `unread ${code.trim()}`;
  const routineCode = input.routine.coa_code;
  if (routineCode !== null && routineCode.trim() !== '') found.set(keyOf(routineCode), { code: routineCode, routine: true, lines: [] });
  for (const line of input.lines) {
    if (line.coa_code === null || line.coa_code.trim() === '') continue;
    const key = keyOf(line.coa_code);
    const held = found.get(key);
    if (held === undefined) found.set(key, { code: line.coa_code, routine: false, lines: [line.id] });
    else held.lines.push(line.id);
  }
  return [...found].map(([key, account]) => ({ key, ...account }));
}

const refused = (status: 400 | 409, field: 'entity_id' | 'coa_code', words: string): BookMoveRefusal => ({ ok: false, status, field, words });

/**
 * EDIT-04: the plan's account in the target book — refused, or null for a plan with none, or the money rule's answer for the code picked and
 * the rows to write it on. The rule reads the code picked with each carrying row's own amount as stored (planMoney.ts editedPlanMoney — the
 * pair as the edit would leave it): the routine as 'routine' (an account needs its amount), each line as 'line' (a line's may have none).
 */
export function moveMoneyOf(input: Pick<BookMoveInput, 'routine' | 'lines' | 'source' | 'target' | 'picked'>): BookMoveRefusal | { readonly ok: true; readonly money: BookMoveMoney | null } {
  const accounts = planAccounts(input);
  const picked = input.picked !== null && input.picked.trim() !== '' ? input.picked : null;
  if (accounts.length > 1) return refused(409, 'coa_code', MOVE_ACCOUNTS_MANY_WORDS(accounts.map((a) => a.code)));
  if (accounts.length === 0) return picked === null ? { ok: true, money: null } : refused(400, 'coa_code', MOVE_NO_ACCOUNT_WORDS);
  if (picked === null) return refused(400, 'coa_code', MOVE_PICK_ACCOUNT_WORDS(input.target.word));
  const account = accounts[0];
  const carriers = [
    ...(account.routine ? [{ column: 'routine' as const, stored: input.routine }] : []),
    ...input.lines.filter((l) => account.lines.includes(l.id)).map((l) => ({ column: 'line' as const, stored: l })),
  ];
  let coaCode: string | null = null;
  for (const carrier of carriers) {
    const sent = editedPlanMoney(undefined, picked, { amount: carrier.stored.budget_amount, account: carrier.stored.coa_code });
    if (sent === null) throw new Error('bookMove: the CATEGORY picked was not read as sent');
    const read = planMoney(sent, input.target.book, carrier.column, { amount: 'budget_amount', account: 'coa_code' });
    if ('error' in read) return refused(400, 'coa_code', read.error.message);
    coaCode = read.value.coaCode;
  }
  if (coaCode === null) throw new Error(`bookMove: the money rule read "${picked}" to no account — a CATEGORY picked is an account`);
  return { ok: true, money: { from: account.code, coaCode, routine: account.routine, lines: account.lines } };
}

/** The move's plan: the refusal, (a), (b), the account (EDIT-04, where (c) stood), (d), (e) in order — or the lines, the plan's account in the target book, the vendors to add, and each vendor row's target. */
export function bookMove(input: BookMoveInput): BookMovePlan {
  const { counts, target } = input;
  if (counts.links > 0) return refused(409, 'entity_id', BOOKS_LINK_MOVE_WORDS);
  if (counts.coded > 0) return refused(409, 'entity_id', BOOKS_CODED_MOVE_WORDS(counts.coded));
  const account = moveMoneyOf(input);
  if (!account.ok) return account;
  if (counts.otherBook > 0) return refused(409, 'entity_id', MOVE_OTHER_BOOK_ROWS_WORDS(counts.otherBook));
  const adds: BookMoveAdd[] = [];
  const repoints: BookMoveRepoint[] = [];
  for (const row of input.vendorRows) {
    const key = vendorNameKey(row.vendor.vendor_name);
    if (target.vendors.filter((v) => vendorNameKey(v.vendor_name) === key).length > 1) return refused(409, 'entity_id', MOVE_VENDOR_NAME_TWICE_WORDS(target.word, row.vendor.vendor_name));
    const held = takenBy(row.vendor.vendor_name, target.vendors);
    if (held !== null) {
      // Already the target book's vendor of the name (a row that named it before the move): nothing to re-point.
      if (held.id !== row.vendor_id) repoints.push({ id: row.id, from: row.vendor, to: { kind: 'held', vendorId: held.id } });
      continue;
    }
    // None of the name there: added once — the first row's vendor gives its name and tag — and every row of the name points at it.
    if (!adds.some((a) => a.key === key)) adds.push({ key, source: row.vendor });
    repoints.push({ id: row.id, from: row.vendor, to: { kind: 'added', key } });
  }
  return { ok: true, lines: input.lines.map((l) => l.id), money: account.money, adds, repoints };
}
