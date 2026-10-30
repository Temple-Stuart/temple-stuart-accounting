/**
 * DOCUMENTS-01 (Alex, 2026-10-28) — receipts: the source document on its posting.
 *
 * The rules are pure (src/lib/books/sourceDocuments.ts) and driven here over fixtures: the type from the
 * first bytes, the size, the address, one current receipt, the name, the list's input, the coverage. The
 * routes, the migration, the law and the ledger are read from source the way this repo proves what it
 * cannot execute without a database (receipt01.test.ts's header); the live refusals, the replace's one
 * transaction and the two triggers are proven against the LOCAL database and reported with the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  BAD_REPLACE_WORDS, EMPTY_FILE_WORDS, FORM_OVERHEAD_BYTES, HAS_RECEIPT_WORDS, HEIC_WORDS, LIST_ONE_OF_WORDS, MAX_ENTRIES_PER_READ,
  MAX_FILE_NAME_CHARS, MAX_RECEIPT_BYTES, MAX_UPLOAD_BODY_BYTES, NO_FILE_NAME_WORDS, NO_LENGTH_WORDS, NOT_POSTED_WORDS, NOT_YOURS_WORDS,
  NOTHING_TO_REPLACE_WORDS, RECEIPT_ACCEPT, RECEIPT_CONTENT_TYPES, REVERSAL_WORDS, REVERSED_WORDS, SOURCE_DOCUMENT_LIST_SELECT,
  UNKNOWN_TYPE_WORDS, UPLOADS_PER_HOUR, VERCEL_BODY_LIMIT_BYTES,
  addressRule, canCarryReceipt, contentDispositionOf, contentLengthRule, coverageWords, currentRule, fileNameRule, fileResponseHeaders,
  listInput, pagesOf, receiptCoverage, receiptLineWords, replaceRule, sizeRule, sizeWords, sniffContentType, type ReceiptMeta,
} from '../books/sourceDocuments';

const LEAF = 'src/lib/books/sourceDocuments.ts';
const ROUTE = 'src/app/api/books/documents/route.ts';
const FILE_ROUTE = 'src/app/api/books/documents/[id]/file/route.ts';
const CONTROLS = 'src/components/books/ReceiptControls.tsx';
const LEDGER = 'src/components/dashboard/GeneralLedger.tsx';
const LEDGER_ROUTE = 'src/app/api/ledger/route.ts';
const MIDDLEWARE = 'src/middleware.ts';
const SCHEMA = 'prisma/schema.prisma';
const LAW = 'scripts/assert-tool-registry.ts';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261028120000_documents_01_source_documents';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;

// ── fixtures: the first bytes of each kind of file ───────────────────────────
const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b);
const asciiBytes = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));
const PDF = bytes(...asciiBytes('%PDF-1.7\n'));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...asciiBytes('JFIF'));
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const HEIC = bytes(0x00, 0x00, 0x00, 0x18, ...asciiBytes('ftypheic'), 0, 0, 0, 0);
const HEIF_MIF1 = bytes(0x00, 0x00, 0x00, 0x1c, ...asciiBytes('ftypmif1'), 0, 0, 0, 0);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);
const RANDOM = bytes(0x13, 0x37, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x01);
const posted = { id: 'je-1', status: 'posted', is_reversal: false, reversed_by_entry_id: null };

test('A the type comes from the first bytes: %PDF- · FF D8 FF · 89 50 4E 47; a .pdf name with PNG bytes is a PNG; HEIC and anything else 415 by name', () => {
  assert.deepEqual(sniffContentType(PDF), { ok: true, contentType: 'application/pdf' });
  assert.deepEqual(sniffContentType(JPEG), { ok: true, contentType: 'image/jpeg' });
  assert.deepEqual(sniffContentType(PNG), { ok: true, contentType: 'image/png' });
  // The rule takes bytes only — there is no name and no browser word to read; "receipt.pdf" with PNG bytes is stored as image/png.
  assert.equal(sniffContentType.length, 1);
  assert.deepEqual(sniffContentType(PNG), { ok: true, contentType: 'image/png' }, 'a .pdf name changes nothing: the bytes are a PNG');
  assert.deepEqual(sniffContentType(HEIC), { ok: false, status: 415, error: HEIC_WORDS });
  assert.deepEqual(sniffContentType(HEIF_MIF1), { ok: false, status: 415, error: HEIC_WORDS });
  assert.equal(HEIC_WORDS, "HEIC photos aren't accepted — export as JPEG");
  for (const other of [ZIP, RANDOM, bytes(), bytes(0x25, 0x50, 0x44, 0x46), bytes(0xff, 0xd8), bytes(0x89, 0x50, 0x4e)]) {
    assert.deepEqual(sniffContentType(other), { ok: false, status: 415, error: UNKNOWN_TYPE_WORDS });
  }
  assert.deepEqual([...RECEIPT_CONTENT_TYPES], ['application/pdf', 'image/jpeg', 'image/png']);
  assert.equal(RECEIPT_ACCEPT, 'application/pdf,image/jpeg,image/png');
});

test('A the size: more than 0 and at most 4 MiB; the request refused before its body when its Content-Length says more (413) or nothing (411); 4 MiB fits Vercel', () => {
  assert.equal(MAX_RECEIPT_BYTES, 4_194_304);
  assert.deepEqual(sizeRule(MAX_RECEIPT_BYTES), { ok: true });
  assert.deepEqual(sizeRule(1), { ok: true });
  assert.deepEqual(sizeRule(0), { ok: false, status: 400, error: EMPTY_FILE_WORDS });
  const over = sizeRule(MAX_RECEIPT_BYTES + 1);
  assert.equal(over.ok, false);
  assert.ok(!over.ok && over.status === 413 && /the most kept is 4 MiB \(4,194,304 bytes\)/.test(over.error));
  assert.equal(MAX_UPLOAD_BODY_BYTES, MAX_RECEIPT_BYTES + FORM_OVERHEAD_BYTES);
  assert.ok(MAX_UPLOAD_BODY_BYTES < VERCEL_BODY_LIMIT_BYTES, 'the cap is never lowered silently: 4 MiB and its form fit under the 4.5 MB limit');
  assert.deepEqual(contentLengthRule(null), { ok: false, status: 411, error: NO_LENGTH_WORDS });
  assert.deepEqual(contentLengthRule('abc'), { ok: false, status: 411, error: NO_LENGTH_WORDS });
  assert.deepEqual(contentLengthRule(String(MAX_UPLOAD_BODY_BYTES)), { ok: true, bytes: MAX_UPLOAD_BODY_BYTES });
  const big = contentLengthRule(String(MAX_UPLOAD_BODY_BYTES + 1));
  assert.ok(!big.ok && big.status === 413 && /refused before it was read$/.test(big.error));
});

test('A the address: the caller’s posting (404), posted, neither a reversal nor reversed (409); one current receipt — a second 409 unless replace, a replace with nothing 409', () => {
  assert.deepEqual(addressRule(posted), { ok: true });
  assert.deepEqual(addressRule(null), { ok: false, status: 404, error: NOT_YOURS_WORDS });
  assert.deepEqual(addressRule({ ...posted, is_reversal: true }), { ok: false, status: 409, error: REVERSAL_WORDS });
  assert.deepEqual(addressRule({ ...posted, reversed_by_entry_id: 'je-2' }), { ok: false, status: 409, error: REVERSED_WORDS });
  assert.deepEqual(addressRule({ ...posted, status: 'reversed' }), { ok: false, status: 409, error: REVERSED_WORDS });
  assert.deepEqual(addressRule({ ...posted, status: 'draft' }), { ok: false, status: 409, error: NOT_POSTED_WORDS });
  assert.equal(canCarryReceipt(posted), true);
  assert.equal(canCarryReceipt({ ...posted, is_reversal: true }), false);
  assert.equal(canCarryReceipt({ ...posted, reversed_by_entry_id: 'x' }), false);
  assert.deepEqual(currentRule(false, false), { ok: true });
  assert.deepEqual(currentRule(true, true), { ok: true });
  assert.deepEqual(currentRule(true, false), { ok: false, status: 409, error: HAS_RECEIPT_WORDS });
  assert.equal(HAS_RECEIPT_WORDS, 'this posting has a receipt — replace it');
  assert.deepEqual(currentRule(false, true), { ok: false, status: 409, error: NOTHING_TO_REPLACE_WORDS });
  assert.deepEqual(replaceRule(null), { ok: true, replace: false });
  assert.deepEqual(replaceRule('true'), { ok: true, replace: true });
  for (const w of ['false', '1', 'yes', 'TRUE', '']) assert.deepEqual(replaceRule(w), { ok: false, status: 400, error: BAD_REPLACE_WORDS });
});

test('A the name is display only: its directories and control characters dropped, cut to 255, never empty; the download’s name cannot end the header', () => {
  assert.deepEqual(fileNameRule('receipt.pdf'), { ok: true, fileName: 'receipt.pdf' });
  assert.deepEqual(fileNameRule('../../etc/passwd'), { ok: true, fileName: 'passwd' });
  assert.deepEqual(fileNameRule('C:\\Users\\a\\Scan 01.jpg'), { ok: true, fileName: 'Scan 01.jpg' });
  assert.deepEqual(fileNameRule('  lunch\u0000\u001f.png  '), { ok: true, fileName: 'lunch.png' });
  const long = fileNameRule('é'.repeat(400));
  assert.ok(long.ok && Array.from(long.fileName).length === MAX_FILE_NAME_CHARS);
  for (const empty of ['', '   ', 'dir/', '\u0001']) assert.deepEqual(fileNameRule(empty), { ok: false, status: 400, error: NO_FILE_NAME_WORDS });
  assert.equal(contentDispositionOf('a"b\\c;d.pdf'), 'attachment; filename="a_b_c_d.pdf"; filename*=UTF-8\'\'a%22b%5Cc%3Bd.pdf');
  assert.equal(contentDispositionOf('reçu.pdf'), 'attachment; filename="re_u.pdf"; filename*=UTF-8\'\'re%C3%A7u.pdf');
  assert.deepEqual(fileResponseHeaders({ file_name: 'r.png', content_type: 'image/png', byte_size: 8 }), {
    'Content-Type': 'image/png', 'Content-Length': '8', 'Content-Disposition': 'attachment; filename="r.png"; filename*=UTF-8\'\'r.png',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store',
  });
});

test('A the list read: entry= or entries=, exactly one, real ids, at most 200, each once; the ledger reads in pages of 200', () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  assert.deepEqual(listInput(null, null), { ok: false, status: 400, error: LIST_ONE_OF_WORDS });
  assert.deepEqual(listInput(id(1), id(2)), { ok: false, status: 400, error: LIST_ONE_OF_WORDS });
  assert.deepEqual(listInput(id(1), null), { ok: true, ids: [id(1)] });
  assert.deepEqual(listInput(null, `${id(1)},${id(2)},${id(1)}`), { ok: true, ids: [id(1), id(2)] });
  assert.deepEqual(listInput(null, `${id(1)},nope`), { ok: false, status: 400, error: '"nope" is not a posting id' });
  const many = Array.from({ length: MAX_ENTRIES_PER_READ + 1 }, (_, i) => id(i)).join(',');
  assert.deepEqual(listInput(null, many), { ok: false, status: 400, error: `${MAX_ENTRIES_PER_READ + 1} postings named — at most 200 in one read` });
  const pages = pagesOf(Array.from({ length: 450 }, (_, i) => id(i % 450)).concat([id(0)]));
  assert.deepEqual(pages.map((p) => p.length), [200, 200, 50]);
  assert.deepEqual(pagesOf([]), []);
  // The list's select is metadata — never the file.
  assert.deepEqual(Object.keys(SOURCE_DOCUMENT_LIST_SELECT), ['id', 'journal_entry_id', 'file_name', 'content_type', 'byte_size', 'uploaded_at']);
  assert.ok(!('bytes' in SOURCE_DOCUMENT_LIST_SELECT) && !('sha256' in SOURCE_DOCUMENT_LIST_SELECT));
});

test('A the words: the receipt line, the size, and the coverage counted once per posting that can carry one', () => {
  const r: ReceiptMeta = { id: 'd1', journal_entry_id: 'je-1', file_name: 'lunch.pdf', content_type: 'application/pdf', byte_size: 1_234_567, uploaded_at: '2026-10-28T10:00:00.000Z' };
  // DOCUMENTS-01b (Alex, 2026-10-30, ruling B): one unit — binary, as the cap is said (4 MiB). 1,234,567 bytes was '1.2 MB'; 48,100 was '48.1 KB'.
  assert.equal(receiptLineWords(r), 'Receipt: lunch.pdf · 1.2 MiB · PDF');
  assert.equal(receiptLineWords({ ...r, content_type: 'image/jpeg', byte_size: 48_100 }), 'Receipt: lunch.pdf · 47.0 KiB · JPEG');
  assert.equal(sizeWords(999), '999 B');
  const rows = [
    { journal_id: 'je-1', ...posted }, { journal_id: 'je-1', ...posted }, // one posting, two lines (debit and credit)
    { journal_id: 'je-2', ...posted },
    { journal_id: 'je-3', ...posted, is_reversal: true },
    { journal_id: 'je-4', ...posted, reversed_by_entry_id: 'je-3' },
  ];
  const c = receiptCoverage(rows, new Map([['je-1', r], ['je-4', { ...r, journal_entry_id: 'je-4' }]]));
  assert.deepEqual(c, { withReceipt: 1, postings: 2, line: '1 of 2 postings in view carry a receipt' });
  assert.equal(coverageWords(0, 1), '0 of 1 posting in view carries a receipt');
  assert.equal(UPLOADS_PER_HOUR, 30);
});

test('B the migration: the newest; one table column for column, the CHECKs, RESTRICT, the deferred self reference, one current receipt and statement, the freeze and the no-delete', () => {
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261020160000_backlog_02_reranked', 'right after BACKLOG-02’s');
  const sql = code(MIGRATION);
  assert.match(sql, /CREATE TABLE "source_documents" \(\n  "id"\s+UUID\s+NOT NULL DEFAULT gen_random_uuid\(\),\n  "user_id"\s+TEXT\s+NOT NULL,\n  "kind"\s+VARCHAR\(12\)\s+NOT NULL,\n  "journal_entry_id" TEXT,\n  "account_id"\s+TEXT,\n  "period_month"\s+DATE,\n  "file_name"\s+VARCHAR\(255\)\s+NOT NULL,\n  "content_type"\s+VARCHAR\(32\)\s+NOT NULL,\n  "byte_size"\s+INTEGER\s+NOT NULL,\n  "sha256"\s+BYTEA\s+NOT NULL,\n  "bytes"\s+BYTEA\s+NOT NULL,\n  "superseded_by"\s+UUID,\n  "uploaded_at"\s+TIMESTAMPTZ\(6\) NOT NULL DEFAULT now\(\),\n  "uploaded_by"\s+TEXT,\n  CONSTRAINT "source_documents_pkey" PRIMARY KEY \("id"\)\n\);/);
  assert.match(sql, /CHECK \("kind" IN \('receipt', 'statement'\)\)/);
  assert.match(sql, /CHECK \(\("kind" = 'receipt' AND "journal_entry_id" IS NOT NULL AND "account_id" IS NULL AND "period_month" IS NULL\)\n\s+OR \("kind" = 'statement' AND "journal_entry_id" IS NULL AND "account_id" IS NOT NULL AND "period_month" IS NOT NULL\)\)/);
  assert.match(sql, /CHECK \("period_month" IS NULL OR "period_month" = date_trunc\('month', "period_month"\)::date\)/);
  assert.match(sql, /CHECK \("content_type" IN \('application\/pdf', 'image\/jpeg', 'image\/png'\)\)/);
  assert.match(sql, /CHECK \("byte_size" > 0 AND "byte_size" <= 4194304 AND octet_length\("bytes"\) = "byte_size"\)/);
  assert.match(sql, /CHECK \(octet_length\("sha256"\) = 32\)/);
  for (const fk of [
    /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT/,
    /FOREIGN KEY \("journal_entry_id"\) REFERENCES "journal_entries"\("id"\) ON DELETE RESTRICT/,
    /FOREIGN KEY \("account_id"\) REFERENCES "accounts"\("id"\) ON DELETE RESTRICT/,
    /FOREIGN KEY \("superseded_by"\) REFERENCES "source_documents"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE\n\s+DEFERRABLE INITIALLY DEFERRED;/,
  ]) assert.match(sql, fk);
  assert.match(sql, /CREATE UNIQUE INDEX "source_documents_one_current_receipt"\n\s+ON "source_documents" \("journal_entry_id"\)\n\s+WHERE "kind" = 'receipt' AND "superseded_by" IS NULL;/);
  assert.match(sql, /CREATE UNIQUE INDEX "source_documents_one_current_statement"\n\s+ON "source_documents" \("account_id", "period_month"\)\n\s+WHERE "kind" = 'statement' AND "superseded_by" IS NULL;/);
  // The freeze names every column but superseded_by, and superseded_by moves once from NULL.
  const freeze = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION prevent_source_document_mutation()'), sql.indexOf('CREATE TRIGGER protect_source_document_fields'));
  for (const col of ['id', 'user_id', 'kind', 'journal_entry_id', 'account_id', 'period_month', 'file_name', 'content_type', 'byte_size', 'sha256', 'bytes', 'uploaded_at', 'uploaded_by']) {
    assert.match(freeze, new RegExp(`NEW\\.${col} IS DISTINCT FROM OLD\\.${col}`), col);
  }
  assert.doesNotMatch(freeze, /NEW\.superseded_by IS DISTINCT FROM OLD\.superseded_by\n\s+OR/);
  assert.match(freeze, /IF OLD\.superseded_by IS NOT NULL AND NEW\.superseded_by IS DISTINCT FROM OLD\.superseded_by THEN/);
  assert.match(sql, /CREATE TRIGGER protect_source_document_fields\nBEFORE UPDATE ON "source_documents"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_source_document_mutation\(\);/);
  assert.match(sql, /CREATE TRIGGER no_source_document_deletes\nBEFORE DELETE ON "source_documents"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_source_document_delete\(\);/);
  assert.match(sql, /RAISE EXCEPTION 'Source documents cannot be deleted\./);
  assert.doesNotMatch(sql, /\bDROP\b|\bINSERT\b|\bUPDATE "|\bDELETE FROM\b/, 'nothing dropped, nothing written');
  assert.match(comments(MIGRATION), /AUTHORED, NOT APPLIED\. Claude Code cannot reach Azure Postgres/);
  // The schema carries the model, at the end of the file, with its relations; Prisma cannot hold the partial index or the triggers, and says so.
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model source_documents {'), schema.indexOf('@@map("source_documents")'));
  assert.match(model, /^\s+bytes\s+Bytes\s+@db\.ByteA$/m);
  assert.match(model, /^\s+sha256\s+Bytes\s+@db\.ByteA$/m);
  assert.match(model, /^\s+superseded_by\s+String\?\s+@db\.Uuid$/m);
  assert.match(model, /@relation\("source_document_supersede", fields: \[superseded_by\], references: \[id\], onDelete: Restrict\)/);
  assert.ok(schema.trimEnd().endsWith('@@map("source_documents")\n}'), 'the model is the schema’s last — no line above it moved but the three back-relations');
  assert.match(comments(SCHEMA), /DOCUMENTS-01 \(Alex, 2026-10-28\) — THE SOURCE DOCUMENT, KEPT/);
});

test('C the upload: the gate, then the size before the body, then the form, the bytes’ type, the posting, one current receipt, the replace in one transaction — no paid call', () => {
  const r = code(ROUTE);
  const post = r.slice(r.indexOf('export async function POST('), r.indexOf('export async function GET('));
  const order = [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const tabGate = await requireTabAccess(user.id, 'tab:books');",
    'await rateLimit(`books-documents:${user.id}`, { limit: UPLOADS_PER_HOUR, windowSeconds: 3600 });',
    "const length = contentLengthRule(request.headers.get('content-length'));",
    'form = await request.formData();',
    'if (files.length !== 1 || !(files[0] instanceof File)) return NextResponse.json({ error: ONE_FILE_WORDS }, { status: 400 });',
    'const size = sizeRule(file.size);',
    'const type = sniffContentType(bytes);',
    'const name = fileNameRule(file.name);',
    "const sha256 = createHash('sha256').update(bytes).digest();",
    'const result = await prisma.$transaction(async (tx) => {',
    "const entry = await tx.journal_entries.findFirst({ where: { id: entryId, userId: user.id }, select: { id: true, ...POSTING_STATE_SELECT } });",
    'const address = addressRule(entry);',
    "where: { user_id: user.id, kind: 'receipt', journal_entry_id: entryId, superseded_by: null },",
    'const one = currentRule(current !== null, replace.replace);',
    'const marked = await tx.source_documents.updateMany({ where: { id: current.id, user_id: user.id, superseded_by: null }, data: { superseded_by: id } });',
    'if (marked.count !== 1) throw new ReplacedMeanwhile();',
    'const kept = await tx.source_documents.create({',
  ];
  let at = -1;
  for (const piece of order) {
    const next = post.indexOf(piece);
    assert.ok(next > at, `in order: ${piece}`);
    at = next;
  }
  assert.doesNotMatch(post, /\bfile\.type\b/, 'the browser’s word for the type is never read');
  assert.match(post, /select: SOURCE_DOCUMENT_LIST_SELECT,\n\s+\}\);/, 'the kept row is answered as metadata');
  assert.match(post, /status: 201/);
  assert.match(post, /error\.code === 'P2002'\) return NextResponse\.json\(\{ error: HAS_RECEIPT_WORDS \}, \{ status: 409 \}\);/);
  assert.match(post, /if \(error instanceof RateLimitError\) \{\n\s+return NextResponse\.json\(\{ error: RATE_WORDS \}, \{ status: 429, headers: \{ 'Retry-After': String\(error\.retryAfterSeconds\) \} \}\);/);
  assert.match(post, /return failClosedResponse\('Books documents POST', 'Failed to keep the receipt', error\);/);
  assert.doesNotMatch(r, /anthropic|openai|fetch\(/i, 'no paid call, no outbound call');
  // The list: the same gate, current receipts only, the metadata select.
  const get = r.slice(r.indexOf('export async function GET('));
  assert.ok(get.indexOf('getVerifiedEmail()') < get.indexOf("requireTabAccess(user.id, 'tab:books')") && get.indexOf("requireTabAccess(user.id, 'tab:books')") < get.indexOf('prisma.source_documents.findMany('));
  assert.match(get, /where: \{ user_id: user\.id, kind: 'receipt', superseded_by: null, journal_entry_id: \{ in: input\.ids \} \},\n\s+select: SOURCE_DOCUMENT_LIST_SELECT,/);
  assert.doesNotMatch(get, /\bbytes\b/);
  assert.doesNotMatch(get, /rateLimit/, 'a read is not rate-limited — the ruling limits uploads');
});

test('C the file: the same gate, the caller’s own or a defensive 404, the stored bytes as a download with nosniff, sandbox and no-store; no URL ends in an extension; not public', () => {
  const f = code(FILE_ROUTE);
  assert.ok(f.indexOf('getVerifiedEmail()') < f.indexOf("requireTabAccess(user.id, 'tab:books')") && f.indexOf("requireTabAccess(user.id, 'tab:books')") < f.indexOf('prisma.source_documents.findFirst('));
  assert.match(f, /if \(!isValidUuid\(id\)\) return NextResponse\.json\(NOT_FOUND, \{ status: 404 \}\);/);
  assert.match(f, /where: \{ id, user_id: user\.id \},/);
  assert.match(f, /if \(!doc\) return NextResponse\.json\(NOT_FOUND, \{ status: 404 \}\);/);
  assert.match(f, /return new NextResponse\(new Uint8Array\(doc\.bytes\), \{ status: 200, headers: fileResponseHeaders\(doc\) \}\);/);
  assert.doesNotMatch(code(MIDDLEWARE), /'\/api\/books/);
  assert.ok(!/\.(svg|png|jpe?g|gif|webp|pdf)$/.test(FILE_ROUTE.replace(/\/route\.ts$/, '')));
  assert.match(comments(LEAF), /Vercel carries a\n \*\s+function body of at most 4\.5 MB/);
});

test('D the ledger: the receipt under each posted row’s source, attach and replace in a panel under the table, the coverage line, a re-read after a write; reversal and reversed rows offer no attach', () => {
  const g = code(LEDGER);
  assert.match(g, /import \{ ReceiptLine, ReceiptPanel, readReceipts, type ReceiptsRead \} from '@\/components\/books\/ReceiptControls';/);
  assert.match(g, /<ReceiptLine\n\s+entryId=\{entry\.journal_id\}\n\s+read=\{receiptsRead\}\n\s+canCarry=\{canCarryReceipt\(entry\)\}/);
  assert.match(g, /<ReceiptPanel\n\s+key=\{`\$\{receiptFor\.entryId\}:\$\{receiptFor\.replacing\}`\}/);
  assert.match(g, /onKept=\{\(\) => \{ setReceiptFor\(null\); setReceiptWrites\(\(n\) => n \+ 1\); \}\}/);
  assert.match(g, /\}, \[accountEntryIds, receiptWrites\]\);/, 'a write re-reads the receipts');
  assert.match(g, /receiptsRead\.state === 'done' \? receiptCoverage\(filteredEntries, receiptsRead\.receipts\)\.line/);
  assert.match(g, /: receiptsFailedWords\(receiptsRead\.reason\)\}/, 'a failed read says so — no receipt shown as missing');
  // The wire's own names: reversed_by_entry_id (the route never sent reversed_by_transaction_id) and the status beside it.
  assert.doesNotMatch(g, /reversed_by_transaction_id/);
  assert.match(g, /if \(e\.reversed_by_entry_id\) return 'Reversed';/);
  assert.match(code(LEDGER_ROUTE), /reversed_by_entry_id: entry\.journal_entry\.reversed_by_entry_id \?\? null,\n\s+status: entry\.journal_entry\.status,/);
  // The controls: no attach without canCarry; the input takes the three types; the panel's words; open is the authed file route.
  const c = code(CONTROLS);
  assert.match(c, /if \(receipt === undefined\) \{\n\s+if \(!canCarry\) return null;/);
  assert.match(c, /\{canCarry && \(\n\s+<button type="button" onClick=\{\(e\) => \{ e\.stopPropagation\(\); onAttach\(entryId, true\); \}\}/);
  assert.match(c, /<input type="file" accept=\{RECEIPT_ACCEPT\}/);
  assert.match(c, /href=\{`\/api\/books\/documents\/\$\{encodeURIComponent\(receipt\.id\)\}\/file`\}/);
  assert.match(c, /if \(replacing\) form\.append\(UPLOAD_FIELDS\.replace, 'true'\);/);
  assert.match(c, /\/api\/books\/documents\?entries=\$\{page\.map\(encodeURIComponent\)\.join\(','\)\}/);
  assert.doesNotMatch(c, /localStorage|sessionStorage|document\.cookie/);
  // Bookkeeping's controls on Bookkeeping's ledger alone (TOOL-LAW-01).
  for (const f of ['src/components/dashboard/JournalEntryEngine.tsx', 'src/components/home/BooksPipeline.tsx']) assert.doesNotMatch(code(f), /ReceiptControls/);
});

test('E the law: one writer, the list never names bytes, every read the caller’s, the gate before the body, the triggers held — and the export never reads a document', () => {
  const law = code(LAW);
  assert.match(law, /lawGuard\('The documents law', \(\) => \{/);
  assert.match(law, /const ALLOWED_IN_POST = new Set\(\['create', 'updateMany'\]\);/);
  assert.match(law, /if \('bytes' in SOURCE_DOCUMENT_LIST_SELECT\) docFail/);
  assert.match(law, /if \(!\/where:\\s\*\\\{\[\^\}\]\*\\buser_id: user\\\.id\\b\/\.test\(call\)\) docFail/);
  assert.match(law, /if \(\/\\bfile\\\.type\\b\/\.test\(docsPost\)\) docFail/);
  assert.match(law, /if \(\/source_documents\/\.test\(codeOf\('src\/app\/api\/export\/route\.ts'\)\)\) docFail/);
  assert.doesNotMatch(code('src/app/api/export/route.ts'), /source_documents/);
});
