/**
 * /api/books/documents — THE SOURCE DOCUMENT ON ITS ADDRESS: the receipt on its posting (DOCUMENTS-01,
 * Alex, 2026-10-28, ruling D), the bank statement on its account's month (DOCUMENTS-02, Alex, 2026-10-30,
 * ruling A).
 *
 * POST (multipart/form-data: exactly one `file`, ONE address — `journal_entry_id` for a receipt, or
 * `account_id` + `period` ('YYYY-MM') for a statement — optional `replace=true`) keeps one document for
 * that address, word for word, in source_documents. It is the table's ONE WRITER (the build's documents
 * law). In order, every step refused by name:
 *   1. the caller: a verified cookie (401), the user (404), Books' entitlement (requireTabAccess
 *      'tab:books', 403), then 30 uploads an hour (lib/rateLimit.ts — durable, 429);
 *   2. the size, BEFORE the body is read: no Content-Length 411, over 4 MiB + the form 413;
 *   3. the form: one file, exactly one address, replace absent or 'true', nothing else (400);
 *   4. the file: not empty (400), at most 4 MiB (413), a PDF, JPEG or PNG by its FIRST BYTES —
 *      the browser's word and the file's name are never read for the type — else 415 (HEIC named);
 *   5. the address: a receipt's posting is the caller's (404), posted, neither a reversal nor reversed
 *      (409); a statement's account is the caller's (404) and a bank (depository) account (409), its
 *      month the first of the month (period_month, a DATE);
 *   6. one current document per address: a second is refused (409) unless replace=true, which — in ONE
 *      transaction — marks the old row superseded by the new id, then inserts the new row
 *      (superseded_by's reference is DEFERRABLE, checked at commit). Nothing is ever deleted.
 * No paid call. Not in PUBLIC_PATHS; no URL here ends in a file extension (middleware.ts skips those).
 *
 * GET ?entry=<id> or ?entries=<id,id,…>, OR ?account=<id>&periods=YYYY-MM,… (each at most 200): the same
 * gate (no rate limit — a read), the caller's CURRENT documents for those postings or that account's
 * months, metadata only — the select never names `bytes`.
 */
import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { POSTING_STATE_SELECT } from '@/lib/calendar/postingAmount';
import {
  BAD_FORM_WORDS, HAS_RECEIPT_WORDS, HAS_STATEMENT_WORDS, ONE_FILE_WORDS, RATE_WORDS, REPLACED_MEANWHILE_WORDS, STATEMENT_REPLACED_MEANWHILE_WORDS,
  SOURCE_DOCUMENT_LIST_SELECT, UPLOADS_PER_HOUR, UPLOAD_FIELDS,
  addressRule, contentLengthRule, currentRule, dateColumnOf, documentMetaOf, documentsListInput, fileNameRule, replaceRule, sizeRule, sniffContentType,
  statementAccountRule, statementCurrentRule, unknownFieldWords, uploadAddressRule,
  type Refusal,
} from '@/lib/books/sourceDocuments';

const refused = (r: Refusal) => NextResponse.json({ error: r.error }, { status: r.status });

/** A replace whose old row someone else superseded first — the transaction is undone and the caller told. */
class ReplacedMeanwhile extends Error {}

export async function POST(request: NextRequest) {
  // The kind the form named — for the words of a refusal raised after the transaction (DOCUMENTS-02).
  let kind: 'receipt' | 'statement' = 'receipt';
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;
    await rateLimit(`books-documents:${user.id}`, { limit: UPLOADS_PER_HOUR, windowSeconds: 3600 });

    // The size, from the request's own word — the body is not read when it says too much, or nothing.
    const length = contentLengthRule(request.headers.get('content-length'));
    if (!length.ok) return refused(length);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: BAD_FORM_WORDS }, { status: 400 });
    }
    const known = new Set<string>(Object.values(UPLOAD_FIELDS));
    for (const name of new Set(form.keys())) if (!known.has(name)) return NextResponse.json({ error: unknownFieldWords(name) }, { status: 400 });
    const files = form.getAll(UPLOAD_FIELDS.file);
    if (files.length !== 1 || !(files[0] instanceof File)) return NextResponse.json({ error: ONE_FILE_WORDS }, { status: 400 });
    const file = files[0];
    // DOCUMENTS-02 (ruling A): exactly one address — the posting (a receipt) or the account's month (a statement).
    const named = uploadAddressRule({ entry: form.getAll(UPLOAD_FIELDS.entry), account: form.getAll(UPLOAD_FIELDS.account), period: form.getAll(UPLOAD_FIELDS.period) });
    if (!named.ok) return refused(named);
    const address = named.address;
    kind = address.kind;
    const replaceFlags = form.getAll(UPLOAD_FIELDS.replace);
    const replace = replaceRule(replaceFlags.length > 1 ? 'more than one' : (replaceFlags[0] ?? null));
    if (!replace.ok) return refused(replace);

    const size = sizeRule(file.size);
    if (!size.ok) return refused(size);
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = sniffContentType(bytes);
    if (!type.ok) return refused(type);
    const name = fileNameRule(file.name);
    if (!name.ok) return refused(name);
    const sha256 = createHash('sha256').update(bytes).digest();

    const result = await prisma.$transaction(async (tx) => {
      // The address, and the current document at it: a receipt's posting, or a statement's account-month.
      let current: { id: string } | null;
      let where: { journal_entry_id: string; account_id: null; period_month: null } | { journal_entry_id: null; account_id: string; period_month: string };
      if (address.kind === 'receipt') {
        const entry = await tx.journal_entries.findFirst({ where: { id: address.entryId, userId: user.id }, select: { id: true, ...POSTING_STATE_SELECT } });
        const posting = addressRule(entry);
        if (!posting.ok) return posting;
        current = await tx.source_documents.findFirst({
          where: { user_id: user.id, kind: 'receipt', journal_entry_id: address.entryId, superseded_by: null },
          select: { id: true },
        });
        where = { journal_entry_id: address.entryId, account_id: null, period_month: null };
      } else {
        const account = await tx.accounts.findFirst({ where: { id: address.accountId, userId: user.id }, select: { id: true, type: true } });
        const owned = statementAccountRule(account);
        if (!owned.ok) return owned;
        const periodMonth = dateColumnOf(address.period.period_month);
        current = await tx.source_documents.findFirst({
          where: { user_id: user.id, kind: 'statement', account_id: address.accountId, period_month: periodMonth, superseded_by: null },
          select: { id: true },
        });
        where = { journal_entry_id: null, account_id: address.accountId, period_month: periodMonth };
      }
      const one = address.kind === 'receipt' ? currentRule(current !== null, replace.replace) : statementCurrentRule(current !== null, replace.replace);
      if (!one.ok) return one;
      const id = randomUUID();
      if (current !== null) {
        // The old row leaves the one-current index first; its reference to the new id is checked at commit.
        const marked = await tx.source_documents.updateMany({ where: { id: current.id, user_id: user.id, superseded_by: null }, data: { superseded_by: id } });
        if (marked.count !== 1) throw new ReplacedMeanwhile();
      }
      const kept = await tx.source_documents.create({
        data: {
          id, user_id: user.id, kind: address.kind, ...where,
          file_name: name.fileName, content_type: type.contentType, byte_size: bytes.length,
          sha256, bytes, uploaded_by: user.email,
        },
        select: SOURCE_DOCUMENT_LIST_SELECT,
      });
      return { ok: true as const, kept, superseded: current?.id ?? null };
    });
    if (!result.ok) return refused(result);
    return NextResponse.json({ document: documentMetaOf(result.kept), superseded: result.superseded }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: RATE_WORDS }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    if (error instanceof ReplacedMeanwhile) return NextResponse.json({ error: kind === 'receipt' ? REPLACED_MEANWHILE_WORDS : STATEMENT_REPLACED_MEANWHILE_WORDS }, { status: 409 });
    // Two first uploads at once: the one-current index refuses the second, by name.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: kind === 'receipt' ? HAS_RECEIPT_WORDS : HAS_STATEMENT_WORDS }, { status: 409 });
    return failClosedResponse('Books documents POST', kind === 'receipt' ? 'Failed to keep the receipt' : 'Failed to keep the statement', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const q = request.nextUrl.searchParams;
    const input = documentsListInput({ entry: q.get('entry'), entries: q.get('entries'), account: q.get('account'), periods: q.get('periods') });
    if (!input.ok) return refused(input);
    // DOCUMENTS-02 (ruling A): the three readers — postings (receipts), or an account's months (statements).
    const documents = input.kind === 'receipt'
      ? await prisma.source_documents.findMany({
        where: { user_id: user.id, kind: 'receipt', superseded_by: null, journal_entry_id: { in: input.ids } },
        select: SOURCE_DOCUMENT_LIST_SELECT,
        orderBy: { uploaded_at: 'asc' },
      })
      : await prisma.source_documents.findMany({
        where: { user_id: user.id, kind: 'statement', superseded_by: null, account_id: input.accountId, period_month: { in: input.months.map((m) => dateColumnOf(m.period_month)) } },
        select: SOURCE_DOCUMENT_LIST_SELECT,
        orderBy: { period_month: 'asc' },
      });
    return NextResponse.json({ documents: documents.map(documentMetaOf) });
  } catch (error) {
    return failClosedResponse('Books documents GET', 'Failed to read the documents', error);
  }
}
