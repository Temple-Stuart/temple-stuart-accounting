/**
 * DOCUMENTS-01 (Alex, 2026-10-28) — THE SOURCE DOCUMENT ON ITS POSTING: THE RULES.
 *
 * Every GL entry comes from a source document. A receipt is the one for a posting: the
 * customer attaches the file on the /books ledger, and it is kept word for word in
 * source_documents (prisma/migrations/20261028120000_documents_01_source_documents —
 * append-only: frozen, never deleted, replaced only by superseding).
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock, no React. The upload route
 * (src/app/api/books/documents/route.ts), the file route (…/[id]/file/route.ts) and the
 * ledger's controls (src/components/books/ReceiptControls.tsx) ask it; none restates it.
 *
 *   · THE TYPE comes from the FIRST BYTES, never from the browser's word or the file's
 *     name (ruling D): %PDF- → application/pdf, FF D8 FF → image/jpeg, 89 50 4E 47 →
 *     image/png. Anything else is refused by name (415); an HEIC/HEIF photo is named —
 *     the phone's default — so the customer knows what to do.
 *   · THE SIZE: more than 0 bytes and at most 4 MiB (4,194,304 bytes), the column's own
 *     CHECK. The request is refused BEFORE its body is read when its Content-Length is
 *     over the file cap plus the form's overhead (413), or absent (411). Vercel carries a
 *     function body of at most 4.5 MB (vercel.com/docs/functions/limitations, "Request
 *     body size"), so 4 MiB + the overhead fits under it.
 *   · THE ADDRESS: a posting of the caller's, posted, neither a reversal nor reversed
 *     (LINK-LAW-01's isReversedPosting) — a reversed posting documents nothing new.
 *   · ONE CURRENT RECEIPT per posting: a second upload is refused (409) unless it says
 *     replace=true; a replace with nothing to replace is refused too — nothing is guessed.
 *   · THE NAME is display only, never a path: its directories, control characters and
 *     surrounding spaces are dropped, and it is cut to 255 characters; a name that is
 *     empty after that is refused by name (400), never invented.
 */
import { isReversedPosting, type PostingState } from '../calendar/postingAmount';

// ─── the limits ──────────────────────────────────────────────────────────────

/** The largest file kept: 4 MiB — the migration's CHECK holds the same number. */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
/** What a multipart form adds around one file and two short fields: the boundaries, the part headers, the file name. */
export const FORM_OVERHEAD_BYTES = 16 * 1024;
/** The largest request body read at all — refused before reading when the Content-Length says more. */
export const MAX_UPLOAD_BODY_BYTES = MAX_RECEIPT_BYTES + FORM_OVERHEAD_BYTES;
/** Vercel's ceiling for a function's request body (4.5 MB, vercel.com/docs/functions/limitations). The upload must fit under it. */
export const VERCEL_BODY_LIMIT_BYTES = 4_500_000;
/** Uploads per user per hour (lib/rateLimit.ts, a durable window). */
export const UPLOADS_PER_HOUR = 30;
/** The most postings one list read names — the ledger reads its rows in pages of this many. */
export const MAX_ENTRIES_PER_READ = 200;
/** The longest name kept — the column is VARCHAR(255). */
export const MAX_FILE_NAME_CHARS = 255;

/** The three types kept, in the order the screen names them. */
export const RECEIPT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number];
/** The file input's accept attribute — the same three, never retyped. */
export const RECEIPT_ACCEPT = RECEIPT_CONTENT_TYPES.join(',');

/** The form's three fields — anything else in the body is refused by name. */
export const UPLOAD_FIELDS = { file: 'file', entry: 'journal_entry_id', replace: 'replace' } as const;

/** The list read's columns: the metadata, and never `bytes` (ruling C; the build's documents law). */
export const SOURCE_DOCUMENT_LIST_SELECT = {
  id: true, journal_entry_id: true, file_name: true, content_type: true, byte_size: true, uploaded_at: true,
} as const;

/** What the list answers per receipt. */
export interface ReceiptMeta {
  readonly id: string;
  readonly journal_entry_id: string;
  readonly file_name: string;
  readonly content_type: string;
  readonly byte_size: number;
  readonly uploaded_at: string;
}

// ─── the words ───────────────────────────────────────────────────────────────

export const HEIC_WORDS = "HEIC photos aren't accepted — export as JPEG";
export const UNKNOWN_TYPE_WORDS = 'this file is not a PDF, a JPEG or a PNG — only those three are kept';
export const EMPTY_FILE_WORDS = 'the file is empty — nothing to keep';
export const NO_LENGTH_WORDS = 'the upload did not say its size (no Content-Length) — it is refused before it is read';
export const NO_FILE_NAME_WORDS = 'the file has no name — name it and attach it again';
export const ONE_FILE_WORDS = 'send exactly one file';
export const NO_ENTRY_WORDS = 'say which posting the receipt is for (journal_entry_id)';
export const BAD_ENTRY_WORDS = 'journal_entry_id is not a posting id';
export const NOT_YOURS_WORDS = 'no posting of yours has that id';
export const NOT_POSTED_WORDS = 'that posting is not posted — a receipt documents a posted entry';
export const REVERSAL_WORDS = 'that entry is a reversal — its receipt is the original posting’s';
export const REVERSED_WORDS = 'that posting was reversed — a receipt is attached to a posting that stands';
export const HAS_RECEIPT_WORDS = 'this posting has a receipt — replace it';
export const NOTHING_TO_REPLACE_WORDS = 'this posting has no receipt to replace — attach one';
export const REPLACED_MEANWHILE_WORDS = 'the receipt was replaced while you chose the file — read the ledger again';
export const BAD_REPLACE_WORDS = "replace is 'true' or absent";
export const BAD_FORM_WORDS = 'the upload is not a form with one file (multipart/form-data)';
export const RATE_WORDS = 'too many uploads this hour — try again later';
export const LIST_ONE_OF_WORDS = 'name the postings: entry=<id> or entries=<id,id,…>, one of the two';
export const RECEIPT_WORDS = 'Receipt';
export const NO_RECEIPT_WORDS = 'No receipt';
export const ATTACH_WORDS = 'attach';
export const REPLACE_WORDS = 'replace';
export const OPEN_WORDS = 'open';
export const CANCEL_WORDS = 'cancel';
export const RECEIPTS_LOADING_WORDS = 'reading the receipts…';
/** The limit, in the customer's words — the panel says it before the file is chosen. */
export const RECEIPT_LIMIT_WORDS = 'Up to 4 MiB · PDF, JPEG or PNG';

export const unknownFieldWords = (name: string): string => `the upload carries "${name}", which is not one of its fields (file, journal_entry_id, replace)`;
// DOCUMENTS-01b (Alex, 2026-10-30, ruling B): a refusal names both exact byte counts — the file's and the cap's — beside the size in words.
export const tooLargeWords = (bytes: number): string => `the file is ${bytes.toLocaleString('en-US')} bytes (${sizeWords(bytes)}) — the most kept is 4 MiB (${MAX_RECEIPT_BYTES.toLocaleString('en-US')} bytes)`;
export const bodyTooLargeWords = (bytes: number): string => `the upload is ${bytes.toLocaleString('en-US')} bytes (${sizeWords(bytes)}) — a receipt of at most 4 MiB, with its form, is at most ${MAX_UPLOAD_BODY_BYTES.toLocaleString('en-US')} bytes; refused before it was read`;
export const tooManyEntriesWords = (n: number): string => `${n} postings named — at most ${MAX_ENTRIES_PER_READ} in one read`;
export const badListIdWords = (id: string): string => `"${id}" is not a posting id`;
export const receiptsFailedWords = (reason: string): string => `The receipts could not be read — ${reason}. No receipt is shown as missing.`;
export const uploadFailedWords = (reason: string): string => `Not kept — ${reason}`;
export const coverageWords = (withReceipt: number, postings: number): string =>
  `${withReceipt} of ${postings} posting${postings === 1 ? '' : 's'} in view carr${postings === 1 ? 'ies' : 'y'} a receipt`;

/**
 * A size in the customer's words: B, KiB or MiB (binary — 1 KiB is 1,024 bytes, 1 MiB is 1,048,576), one
 * decimal place. DOCUMENTS-01b (Alex, 2026-10-30, ruling B): ONE UNIT — the cap is 4 MiB (4,194,304 bytes)
 * and every other word on the screen says MiB; this said decimal MB, two units on one screen.
 */
export function sizeWords(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

/** A type's short name on the screen. */
export function typeWords(contentType: string): string {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType === 'image/jpeg') return 'JPEG';
  if (contentType === 'image/png') return 'PNG';
  return contentType;
}

/** The ledger's line for a kept receipt: "Receipt: <name> · 1.2 MiB · PDF". */
export function receiptLineWords(r: Pick<ReceiptMeta, 'file_name' | 'byte_size' | 'content_type'>): string {
  return `${RECEIPT_WORDS}: ${r.file_name} · ${sizeWords(r.byte_size)} · ${typeWords(r.content_type)}`;
}

// ─── the refusals ────────────────────────────────────────────────────────────

/** A refusal: the status the route answers with and the words it says. */
export interface Refusal { readonly ok: false; readonly status: number; readonly error: string }
const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });

// ─── the type, from the first bytes ──────────────────────────────────────────

/** The brands an ISO-BMFF `ftyp` box names for an HEIC/HEIF photo (bytes 8–11). */
export const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'] as const;

const startsWith = (bytes: Uint8Array, sig: readonly number[], at = 0): boolean =>
  bytes.length >= at + sig.length && sig.every((b, i) => bytes[at + i] === b);
const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  bytes.length >= to ? String.fromCharCode(...bytes.slice(from, to)) : '';

/** The type of a file from its first bytes — the three kept, or a refusal by name (HEIC named). */
export function sniffContentType(bytes: Uint8Array): { ok: true; contentType: ReceiptContentType } | Refusal {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true, contentType: 'application/pdf' }; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: true, contentType: 'image/jpeg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { ok: true, contentType: 'image/png' };
  if (ascii(bytes, 4, 8) === 'ftyp' && (HEIF_BRANDS as readonly string[]).includes(ascii(bytes, 8, 12))) return refuse(415, HEIC_WORDS);
  return refuse(415, UNKNOWN_TYPE_WORDS);
}

// ─── the size ────────────────────────────────────────────────────────────────

/** The request's own word for its size, read BEFORE the body: absent → 411, over the cap → 413. */
export function contentLengthRule(header: string | null): { ok: true; bytes: number } | Refusal {
  if (header === null || !/^\d+$/.test(header.trim())) return refuse(411, NO_LENGTH_WORDS);
  const bytes = Number(header.trim());
  if (bytes > MAX_UPLOAD_BODY_BYTES) return refuse(413, bodyTooLargeWords(bytes));
  return { ok: true, bytes };
}

/** The file's own size: more than 0, at most 4 MiB. */
export function sizeRule(bytes: number): { ok: true } | Refusal {
  if (bytes <= 0) return refuse(400, EMPTY_FILE_WORDS);
  if (bytes > MAX_RECEIPT_BYTES) return refuse(413, tooLargeWords(bytes));
  return { ok: true };
}

// ─── the name ────────────────────────────────────────────────────────────────

/** The name kept for display: the last path segment, no control characters, trimmed, at most 255 characters — or a refusal. */
export function fileNameRule(raw: string): { ok: true; fileName: string } | Refusal {
  const last = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = last.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const cut = Array.from(clean).slice(0, MAX_FILE_NAME_CHARS).join('');
  if (cut.length === 0) return refuse(400, NO_FILE_NAME_WORDS);
  return { ok: true, fileName: cut };
}

/** The download's Content-Disposition: an attachment, an ASCII name with nothing that ends the header, and the UTF-8 name beside it. */
export function contentDispositionOf(fileName: string): string {
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\;]/g, '_');
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** The download's headers — the file is handed over, never rendered here (ruling D). */
export function fileResponseHeaders(doc: { readonly file_name: string; readonly content_type: string; readonly byte_size: number }): Record<string, string> {
  return {
    'Content-Type': doc.content_type,
    'Content-Length': String(doc.byte_size),
    'Content-Disposition': contentDispositionOf(doc.file_name),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': 'sandbox',
    'Cache-Control': 'no-store',
  };
}

// ─── the address ─────────────────────────────────────────────────────────────

/** Whether a posting can carry a receipt: posted, neither a reversal nor reversed. */
export function canCarryReceipt(entry: PostingState): boolean {
  return entry.status === 'posted' && !isReversedPosting(entry);
}

/** The posting the receipt is for, as the caller's own read found it (null = none of theirs). */
export function addressRule(entry: (PostingState & { readonly id: string }) | null): { ok: true } | Refusal {
  if (entry === null) return refuse(404, NOT_YOURS_WORDS);
  if (entry.is_reversal) return refuse(409, REVERSAL_WORDS);
  if (entry.reversed_by_entry_id !== null || entry.status === 'reversed') return refuse(409, REVERSED_WORDS);
  if (entry.status !== 'posted') return refuse(409, NOT_POSTED_WORDS);
  return { ok: true };
}

/** One current receipt per posting: a second needs replace=true; a replace needs a receipt to replace. */
export function currentRule(hasCurrent: boolean, replace: boolean): { ok: true } | Refusal {
  if (hasCurrent && !replace) return refuse(409, HAS_RECEIPT_WORDS);
  if (!hasCurrent && replace) return refuse(409, NOTHING_TO_REPLACE_WORDS);
  return { ok: true };
}

/** The replace flag: absent, or 'true' — any other word is refused, never read as a guess. */
export function replaceRule(raw: FormDataEntryValue | null): { ok: true; replace: boolean } | Refusal {
  if (raw === null) return { ok: true, replace: false };
  if (raw === 'true') return { ok: true, replace: true };
  return refuse(400, BAD_REPLACE_WORDS);
}

// ─── the list read ───────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The postings a list read names: entry=<id> or entries=<id,id,…> — exactly one, real ids, at most 200, each once. */
export function listInput(entry: string | null, entries: string | null): { ok: true; ids: string[] } | Refusal {
  if ((entry === null) === (entries === null)) return refuse(400, LIST_ONE_OF_WORDS);
  const ids = [...new Set((entry ?? entries ?? '').split(',').map((s) => s.trim()))];
  const bad = ids.find((id) => !UUID.test(id));
  if (bad !== undefined) return refuse(400, badListIdWords(bad));
  if (ids.length > MAX_ENTRIES_PER_READ) return refuse(400, tooManyEntriesWords(ids.length));
  return { ok: true, ids };
}

/** The ledger's pages of ids — each at most MAX_ENTRIES_PER_READ, every id once, in order. */
export function pagesOf(ids: readonly string[]): string[][] {
  const unique = [...new Set(ids)];
  const pages: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_ENTRIES_PER_READ) pages.push(unique.slice(i, i + MAX_ENTRIES_PER_READ));
  return pages;
}

/** The coverage over the rows in view: the postings that can carry a receipt, and how many do. Each posting counted once. */
export function receiptCoverage(
  rows: readonly (PostingState & { readonly journal_id: string })[],
  receipts: ReadonlyMap<string, ReceiptMeta>,
): { withReceipt: number; postings: number; line: string } {
  const can = new Set(rows.filter((r) => canCarryReceipt(r)).map((r) => r.journal_id));
  const withReceipt = [...can].filter((id) => receipts.has(id)).length;
  return { withReceipt, postings: can.size, line: coverageWords(withReceipt, can.size) };
}
