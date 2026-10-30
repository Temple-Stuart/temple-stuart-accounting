/**
 * TAX-WAGES-01 (Alex, 2026-10-28, ruling B) — NO SILENT ZERO: the one rule for a tax document's amount.
 *
 * Every read of a number on a stored tax document (tax_documents.data) goes through readTaxAmount:
 *   · a number, or a string that is plainly one ("50000", "1234.56") → that amount;
 *   · BLANK (absent, null, "" or spaces) → 0 ONLY where the form says a blank box means none
 *     (documentFields.ts AMOUNT_BOXES), and the blank is DECLARED: the caller collects the note
 *     ("W-2 from Acme: Box 2 is blank — read as none") into the Form 1040's documentNotes;
 *   · BLANK where the form does not say none (the 1099-R's Box 2a) → refused by name;
 *   · blank while the row holds the same box under a key an earlier form wrote ("wages") → refused
 *     by name: that figure is neither none nor read;
 *   · anything else ("abc", "1,000", NaN, Infinity, true, an object) → refused by name:
 *     "W-2 from Acme has no readable Box 1".
 * A refusal is a ValidationError at 422 — failClosed passes its words to the customer verbatim. A
 * reader asking for a key the wizard never writes is a fault in the code, thrown as such.
 * `Number(x) || 0` leaves every tax path: nothing here turns an unreadable value into a figure.
 *
 * documentTotals sums the boxes the Form 1040 and /api/tax/calculate read, once, for both.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no React — the wizard's steps read through it too.
 */
import { ValidationError } from '../errors/ValidationError';
import {
  AMOUNT_BOXES, DOC_WORDS, EARLIER_AMOUNT_KEYS, E1098, R1099, T1098, W2, isTaxDocType, type TaxDocType,
} from './documentFields';

/** A stored tax document as the readers hold it. */
export interface TaxDocumentRow {
  readonly doc_type: string;
  readonly label: string | null;
  readonly data: unknown;
}

/** A tax document whose amount cannot be read — its words go to the customer as they are. */
export class TaxDocumentValueError extends ValidationError {
  constructor(words: string) {
    super(words, { status: 422 });
    this.name = 'TaxDocumentValueError';
  }
}

/** The document in the customer's words: "W-2 from Acme", or "W-2 (no name)" when its label is empty. */
export function documentWords(doc: Pick<TaxDocumentRow, 'doc_type' | 'label'>): string {
  const form = isTaxDocType(doc.doc_type) ? DOC_WORDS[doc.doc_type] : doc.doc_type;
  const name = (doc.label ?? '').trim();
  return name === '' ? `${form} (no name)` : `${form} from ${name}`;
}

export const unreadableWords = (doc: TaxDocumentRow, box: string): string => `${documentWords(doc)} has no readable ${box}`;
export const blankNotNoneWords = (doc: TaxDocumentRow, box: string): string =>
  `${documentWords(doc)} has no ${box} — a blank taxable amount is one the payer did not determine, not none; enter it in the wizard`;
export const earlierKeyWords = (doc: TaxDocumentRow, box: string, earlier: string): string =>
  `${documentWords(doc)} holds its ${box} under "${earlier}", a key an earlier form wrote — enter it again in the wizard`;
export const blankDeclaredWords = (doc: TaxDocumentRow, box: string): string => `${documentWords(doc)}: ${box} is blank — read as none`;

const PLAIN_NUMBER = /^\s*-?\d+(\.\d+)?\s*$/;
const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** One amount, by the rule. A blank that means none reads 0 with blank: true — the caller declares it. */
export function readTaxAmount(doc: TaxDocumentRow, key: string): { value: number; blank: boolean } {
  const type = doc.doc_type;
  const box = isTaxDocType(type) ? AMOUNT_BOXES[type][key] : undefined;
  // A reader asking for a box the wizard never writes is the code's fault, not the customer's.
  if (box === undefined) throw new Error(`TAX-WAGES-01: a reader asked ${type} for "${key}", which is not one of its amount boxes (src/lib/tax/documentFields.ts)`);
  if (typeof doc.data !== 'object' || doc.data === null || Array.isArray(doc.data)) throw new TaxDocumentValueError(unreadableWords(doc, box.box));
  const data = doc.data as Record<string, unknown>;
  const v = data[key];
  if (isBlank(v)) {
    const earlier = EARLIER_AMOUNT_KEYS[type as TaxDocType][key];
    if (earlier !== undefined && !isBlank(data[earlier])) throw new TaxDocumentValueError(earlierKeyWords(doc, box.box, earlier));
    if (!box.blankMeansNone) throw new TaxDocumentValueError(blankNotNoneWords(doc, box.box));
    return { value: 0, blank: true };
  }
  if (typeof v === 'number' && Number.isFinite(v)) return { value: v, blank: false };
  if (typeof v === 'string' && PLAIN_NUMBER.test(v)) return { value: Number(v), blank: false };
  throw new TaxDocumentValueError(unreadableWords(doc, box.box));
}

/** One amount, its blank declared into `notes` when the form says blank means none. */
export function taxAmount(doc: TaxDocumentRow, key: string, notes?: string[]): number {
  const read = readTaxAmount(doc, key);
  if (read.blank && notes !== undefined) {
    const box = AMOUNT_BOXES[doc.doc_type as TaxDocType][key].box;
    notes.push(blankDeclaredWords(doc, box));
  }
  return read.value;
}

/** The boxes documentTotals reads, per type — every one a box of that type's schema (the coverage test holds it). */
export const TOTAL_READS: Readonly<Partial<Record<TaxDocType, readonly string[]>>> = {
  w2: [W2.grossWages, W2.federalWithheld],
  '1099r': [R1099.grossDistribution, R1099.taxableAmount, R1099.federalWithheld],
  '1098t': [T1098.amountsBilled, T1098.scholarships],
  '1098e': [E1098.interestPaid],
};

export interface DocumentTotals {
  readonly w2: { readonly wages: number; readonly withheld: number; readonly count: number };
  readonly r1099: { readonly gross: number; readonly taxable: number; readonly withheld: number; readonly count: number };
  readonly t1098: { readonly tuition: number; readonly scholarships: number; readonly count: number };
  readonly e1098: { readonly interest: number; readonly count: number };
  /** Every blank read as none, said — the Form 1040's documentNotes. */
  readonly notes: readonly string[];
}

const cents = (n: number): number => Math.round(n * 100) / 100;

/** The documents' amounts the Form 1040 and /api/tax/calculate use, read once by the rule. */
export function documentTotals(docs: readonly TaxDocumentRow[]): DocumentTotals {
  const notes: string[] = [];
  const of = (type: TaxDocType) => docs.filter((d) => d.doc_type === type);
  const sum = (rows: readonly TaxDocumentRow[], key: string): number => cents(rows.reduce((s, d) => s + taxAmount(d, key, notes), 0));
  const w2 = of('w2'), r1099 = of('1099r'), t1098 = of('1098t'), e1098 = of('1098e');
  return {
    w2: { wages: sum(w2, W2.grossWages), withheld: sum(w2, W2.federalWithheld), count: w2.length },
    r1099: { gross: sum(r1099, R1099.grossDistribution), taxable: sum(r1099, R1099.taxableAmount), withheld: sum(r1099, R1099.federalWithheld), count: r1099.length },
    t1098: { tuition: sum(t1098, T1098.amountsBilled), scholarships: sum(t1098, T1098.scholarships), count: t1098.length },
    e1098: { interest: sum(e1098, E1098.interestPaid), count: e1098.length },
    notes,
  };
}
