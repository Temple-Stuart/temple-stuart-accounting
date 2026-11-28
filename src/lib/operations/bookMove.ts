/**
 * EDIT-03 (Alex, 2026-11-29) — A PLAN MOVES TO ANOTHER BOOK. "they should all be able to be edited, eccept for formula driven cells"
 * (2026-11-28): ENTITY is typed in place, and a row moves to the book picked — on a repeating plan, the whole plan, every day of it.
 *
 * The move's PLAN, pure (as routineRekey.ts is the rekey's): handed the routine, all its lines (active or not), its and its lines' vendor
 * rows with their vendors, the target book — its word, its chart's codes, its vendors — and what the route counted inside its transaction
 * (the Books links, the Books lines coded to it, the other rows that keep their own book), it answers the refusal's words, or the move:
 * the lines, and each vendor row's target — a vendor the target book already holds of the same name (planVendor.ts takenBy over
 * vendorNameKey, the directory's own match), or the name and tag to add there, copied from the vendor the plan names. Nothing is read
 * here and nothing is written; the route (routines/[id]/route.ts PATCH) reads, calls this, and writes what it returns, in one transaction.
 *
 * Refused, in this order, and nothing moves:
 *   (a) a posting in Books is linked to the plan (planned_item_links — the routine DELETE's own reader);
 *   (b) a Books line is coded to it (ledger_line_links.routine_id — the DELETE's count);
 *   (c) an account the routine or any of its lines names — active or not, so no line is left naming an account its book's chart does not
 *       hold — is not in the target book's chart, read by the chart's own rule (scheme.ts parseCode: four digits, or the book's letter and
 *       four; planMoney.ts readsAs — the reading the money rule and /budget give a code);
 *   (d) another row that keeps its own book points at the plan (on the hub's schedule, or in Content);
 *   (e) two of the target book's vendors answer one name the plan's vendor rows carry — which of them would be a guess.
 */
import { readsAs } from './planMoney';
import { takenBy, vendorNameKey } from './planVendor';
import { BOOKS_CODED_MOVE_WORDS, BOOKS_LINK_MOVE_WORDS, MOVE_ACCOUNTS_MISSING_WORDS, MOVE_OTHER_BOOK_ROWS_WORDS } from './linkHold';

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
/** The book the plan moves to: its word (the sheet's), its entity type (whose letter its chart's codes carry), its chart's codes as saved, and its vendors (active or archived — the directory's own match). */
export interface BookMoveTarget {
  readonly word: string;
  readonly entityType: string;
  readonly codes: readonly string[];
  readonly vendors: readonly { readonly id: string; readonly vendor_name: string }[];
}
/** What the route counted inside its transaction: (a) the Books links, (b) the Books lines coded to the routine, (d) the other rows that keep their own book. */
export interface BookMoveCounts {
  readonly links: number;
  readonly coded: number;
  readonly otherBook: number;
}
export interface BookMoveInput {
  readonly routine: { readonly coa_code: string | null };
  readonly lines: readonly { readonly id: string; readonly coa_code: string | null }[];
  readonly vendorRows: readonly BookMoveVendorRow[];
  readonly target: BookMoveTarget;
  readonly counts: BookMoveCounts;
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
export type BookMovePlan =
  | { readonly ok: false; readonly words: string }
  | { readonly ok: true; readonly lines: readonly string[]; readonly adds: readonly BookMoveAdd[]; readonly repoints: readonly BookMoveRepoint[] };

/** Thrown inside the route's transaction to roll it back with the refusal's words — nothing has been written when it is. */
export class MoveRefused extends Error {
  constructor(readonly words: string) {
    super(words);
    this.name = 'MoveRefused';
  }
}

/**
 * (c): the codes the routine and its lines name — the routine's first, then each line's in order, each once — that the target book's chart
 * does not hold, read by the chart's own rule: a code is held when it reads as four digits for the target book and a row of its chart reads
 * as the same four. A code the target book's rule cannot read (another book's letter) is not held. No code is no account — nothing to hold.
 */
export function codesNotHeld(input: Pick<BookMoveInput, 'routine' | 'lines' | 'target'>): readonly string[] {
  const named = [input.routine.coa_code, ...input.lines.map((l) => l.coa_code)].filter((c): c is string => c !== null && c.trim() !== '');
  const held = new Set(input.target.codes.map((c) => readsAs(c, input.target.entityType)).filter((d): d is string => d !== null));
  return [...new Set(named)].filter((code) => {
    const digits = readsAs(code, input.target.entityType);
    return digits === null || !held.has(digits);
  });
}

/** The move's plan: the refusal's words, (a) to (e) in order — or the lines, the vendors to add, and each vendor row's target. */
export function bookMove(input: BookMoveInput): BookMovePlan {
  const { counts, target } = input;
  if (counts.links > 0) return { ok: false, words: BOOKS_LINK_MOVE_WORDS };
  if (counts.coded > 0) return { ok: false, words: BOOKS_CODED_MOVE_WORDS(counts.coded) };
  const missing = codesNotHeld(input);
  if (missing.length > 0) return { ok: false, words: MOVE_ACCOUNTS_MISSING_WORDS(target.word, missing) };
  if (counts.otherBook > 0) return { ok: false, words: MOVE_OTHER_BOOK_ROWS_WORDS(counts.otherBook) };
  const adds: BookMoveAdd[] = [];
  const repoints: BookMoveRepoint[] = [];
  for (const row of input.vendorRows) {
    const key = vendorNameKey(row.vendor.vendor_name);
    if (target.vendors.filter((v) => vendorNameKey(v.vendor_name) === key).length > 1) return { ok: false, words: MOVE_VENDOR_NAME_TWICE_WORDS(target.word, row.vendor.vendor_name) };
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
  return { ok: true, lines: input.lines.map((l) => l.id), adds, repoints };
}
