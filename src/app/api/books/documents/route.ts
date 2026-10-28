/**
 * /api/books/documents — THE RECEIPT ON ITS POSTING (DOCUMENTS-01, Alex, 2026-10-28, ruling D).
 *
 * POST (multipart/form-data: exactly one `file`, its `journal_entry_id`, optional `replace=true`)
 * keeps one receipt for one posting of the caller's, word for word, in source_documents. It is the
 * table's ONE WRITER (the build's documents law). In order, every step refused by name:
 *   1. the caller: a verified cookie (401), the user (404), Books' entitlement (requireTabAccess
 *      'tab:books', 403), then 30 uploads an hour (lib/rateLimit.ts — durable, 429);
 *   2. the size, BEFORE the body is read: no Content-Length 411, over 4 MiB + the form 413;
 *   3. the form: one file, the posting's id, replace absent or 'true', nothing else (400);
 *   4. the file: not empty (400), at most 4 MiB (413), a PDF, JPEG or PNG by its FIRST BYTES —
 *      the browser's word and the file's name are never read for the type — else 415 (HEIC named);
 *   5. the posting: the caller's (404), posted, neither a reversal nor reversed (409);
 *   6. one current receipt: a second is refused (409) unless replace=true, which — in ONE
 *      transaction — marks the old row superseded by the new id, then inserts the new row
 *      (superseded_by's reference is DEFERRABLE, checked at commit). Nothing is ever deleted.
 * No paid call. Not in PUBLIC_PATHS; no URL here ends in a file extension (middleware.ts skips those).
 *
 * GET ?entry=<id> or ?entries=<id,id,…> (at most 200): the same gate (no rate limit — a read), the
 * caller's CURRENT receipts for those postings, metadata only — the select never names `bytes`.
 */
import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { POSTING_STATE_SELECT } from '@/lib/calendar/postingAmount';
import {
  BAD_ENTRY_WORDS, BAD_FORM_WORDS, HAS_RECEIPT_WORDS, NO_ENTRY_WORDS, ONE_FILE_WORDS, RATE_WORDS, REPLACED_MEANWHILE_WORDS,
  SOURCE_DOCUMENT_LIST_SELECT, UPLOADS_PER_HOUR, UPLOAD_FIELDS,
  addressRule, contentLengthRule, currentRule, fileNameRule, listInput, replaceRule, sizeRule, sniffContentType, unknownFieldWords,
  type Refusal,
} from '@/lib/books/sourceDocuments';

const refused = (r: Refusal) => NextResponse.json({ error: r.error }, { status: r.status });

/** A replace whose old row someone else superseded first — the transaction is undone and the caller told. */
class ReplacedMeanwhile extends Error {}

export async function POST(request: NextRequest) {
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
    const entries = form.getAll(UPLOAD_FIELDS.entry);
    if (entries.length !== 1 || typeof entries[0] !== 'string' || entries[0].trim() === '') return NextResponse.json({ error: NO_ENTRY_WORDS }, { status: 400 });
    const entryId = entries[0].trim();
    if (!isValidUuid(entryId)) return NextResponse.json({ error: BAD_ENTRY_WORDS }, { status: 400 });
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
      const entry = await tx.journal_entries.findFirst({ where: { id: entryId, userId: user.id }, select: { id: true, ...POSTING_STATE_SELECT } });
      const address = addressRule(entry);
      if (!address.ok) return address;
      const current = await tx.source_documents.findFirst({
        where: { user_id: user.id, kind: 'receipt', journal_entry_id: entryId, superseded_by: null },
        select: { id: true },
      });
      const one = currentRule(current !== null, replace.replace);
      if (!one.ok) return one;
      const id = randomUUID();
      if (current !== null) {
        // The old row leaves the one-current index first; its reference to the new id is checked at commit.
        const marked = await tx.source_documents.updateMany({ where: { id: current.id, user_id: user.id, superseded_by: null }, data: { superseded_by: id } });
        if (marked.count !== 1) throw new ReplacedMeanwhile();
      }
      const kept = await tx.source_documents.create({
        data: {
          id, user_id: user.id, kind: 'receipt', journal_entry_id: entryId,
          file_name: name.fileName, content_type: type.contentType, byte_size: bytes.length,
          sha256, bytes, uploaded_by: user.email,
        },
        select: SOURCE_DOCUMENT_LIST_SELECT,
      });
      return { ok: true as const, kept, superseded: current?.id ?? null };
    });
    if (!result.ok) return refused(result);
    return NextResponse.json({ document: { ...result.kept, uploaded_at: result.kept.uploaded_at.toISOString() }, superseded: result.superseded }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: RATE_WORDS }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    if (error instanceof ReplacedMeanwhile) return NextResponse.json({ error: REPLACED_MEANWHILE_WORDS }, { status: 409 });
    // Two first uploads at once: the one-current index refuses the second, by name.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: HAS_RECEIPT_WORDS }, { status: 409 });
    return failClosedResponse('Books documents POST', 'Failed to keep the receipt', error);
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

    const input = listInput(request.nextUrl.searchParams.get('entry'), request.nextUrl.searchParams.get('entries'));
    if (!input.ok) return refused(input);
    const documents = await prisma.source_documents.findMany({
      where: { user_id: user.id, kind: 'receipt', superseded_by: null, journal_entry_id: { in: input.ids } },
      select: SOURCE_DOCUMENT_LIST_SELECT,
      orderBy: { uploaded_at: 'asc' },
    });
    return NextResponse.json({ documents: documents.map((d) => ({ ...d, uploaded_at: d.uploaded_at.toISOString() })) });
  } catch (error) {
    return failClosedResponse('Books documents GET', 'Failed to read the receipts', error);
  }
}
