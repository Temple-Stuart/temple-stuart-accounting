/**
 * GET /api/books/documents/<id>/file — A KEPT RECEIPT, HANDED BACK (DOCUMENTS-01, Alex, 2026-10-28, ruling D).
 *
 * The same gate as the upload: a verified cookie (401), the user (404), Books' entitlement
 * (requireTabAccess 'tab:books', 403). The document is read by its id AND the caller's user_id —
 * another user's id, an id that is not a uuid, or none at all answers the same defensive 404: nothing
 * is confirmed. A superseded receipt is still the caller's, so it is still handed back by its id; the
 * ledger names only the current one.
 *
 * The answer is the stored bytes exactly, as a DOWNLOAD — never rendered here: the type as stored (read
 * from the first bytes at upload), Content-Disposition attachment with a sanitized name, nosniff, a
 * sandbox CSP and no-store (src/lib/books/sourceDocuments.ts fileResponseHeaders). The URL ends in
 * `/file`, never a file extension — middleware.ts skips its auth for a path ending in an image
 * extension. No paid call.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { fileResponseHeaders } from '@/lib/books/sourceDocuments';

const NOT_FOUND = { error: 'Document not found' };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json(NOT_FOUND, { status: 404 });
    const doc = await prisma.source_documents.findFirst({
      where: { id, user_id: user.id },
      select: { file_name: true, content_type: true, byte_size: true, bytes: true },
    });
    if (!doc) return NextResponse.json(NOT_FOUND, { status: 404 });
    return new NextResponse(new Uint8Array(doc.bytes), { status: 200, headers: fileResponseHeaders(doc) });
  } catch (error) {
    return failClosedResponse('Books document file GET', 'Failed to read the document', error);
  }
}
