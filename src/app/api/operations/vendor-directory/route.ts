import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { readInstagramTag, readVendorId, readVendorName, takenBy } from '@/lib/operations/planVendor';

// VENDOR-01 (2026-09-29) · TIMESHEET-04a (2026-11-27): this file CREATES vendors (the POST) and holds ONE update — the PATCH's,
// a vendor's Instagram tag, a column of its own ("tag is own column"; it held no update until then). No vendor is renamed,
// archived or removed here (the vendor law, scripts/assert-tool-registry.ts).
//
// GET /api/operations/vendor-directory — DIM-3: the minimal USER-SCOPED vendor
// list feeding the commit-time vendor picker. The DIM-3 audit found NO existing
// route over operations_vendor_directory; per the ruling a minimal list GET is
// in scope, full vendor CRUD is not. Read-only, active vendors only, standard
// auth chain (mirrors the commit route's own bar: verified email → user →
// user-scoped query). Cheap DB read — no rate limit needed (authed non-paid
// read convention).
export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const vendors = await prisma.operations_vendor_directory.findMany({
      where: { user_id: user.id, is_active: true },
      orderBy: { vendor_name: 'asc' },
      select: { id: true, vendor_name: true, entity_id: true, category: true, instagram_tag: true },
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error('Vendor directory fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

/**
 * POST /api/operations/vendor-directory — VENDOR-01: add a vendor to ONE book.
 *
 * Body { entityId, name }. D1: one vendor list per book, and typing is free — a
 * name the book already has, ignoring case and spacing, IS that vendor, so it is
 * never created twice.
 *   · the caller first — the GET's own gate (the cart-plan pattern);
 *   · the book must be the caller's, else 404. Ruled D3 (2026-09-29): that read
 *     LOCKS the book's entities row FOR NO KEY UPDATE, inside the create's
 *     transaction, so two creates for one book run one after the other and
 *     "Pho 24" beside "pho 24" cannot both pass. FOR NO KEY UPDATE blocks no
 *     foreign-key check on the book (those take FOR KEY SHARE);
 *   · the name, read by the rule (planVendor.ts readVendorName): trimmed, every run
 *     of whitespace one space, 1–200 characters — else 400;
 *   · a vendor of that book with the same name ignoring case — active or archived
 *     — is a 409 naming it, its id and whether it is active; nothing is created.
 *     A race the lock does not see meets the unique index (schema :3939): 409;
 *   · else created — user, book, name, created_by the caller's email — and
 *     audited operations_vendor_added. 201 with { id, vendor_name, entity_id }.
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let raw: unknown;
    try { raw = await request.json(); } catch { return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 }); }
    // TAB13-04 (R7 b): a body that is not an object — null, an array, a number — is refused, never read as one.
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'A JSON object body is required.' }, { status: 400 });
    }
    const body = raw as { entityId?: unknown; name?: unknown };
    const entityId = body.entityId;
    if (typeof entityId !== 'string' || entityId === '') {
      return NextResponse.json({ error: 'Validation', message: 'entityId is required' }, { status: 400 });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      // The ownership read IS the lock (ruled D3): no row of the caller's → 404.
      const book = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM entities WHERE id = ${entityId} AND "userId" = ${user.id} FOR NO KEY UPDATE`;
      if (book.length === 0) return { kind: 'no-book' } as const;
      const name = readVendorName(body.name);
      if (!name.ok) return { kind: 'bad-name', refusal: name } as const;
      const vendors = await tx.operations_vendor_directory.findMany({
        where: { user_id: user.id, entity_id: entityId },
        select: { id: true, vendor_name: true, is_active: true },
      });
      const taken = takenBy(name.name, vendors);
      if (taken) return { kind: 'taken', vendor: taken } as const;
      const created = await tx.operations_vendor_directory.create({
        data: { user_id: user.id, entity_id: entityId, vendor_name: name.name, created_by: userEmail },
        select: { id: true, vendor_name: true, entity_id: true },
      });
      return { kind: 'created', vendor: created } as const;
    });

    if (outcome.kind === 'no-book') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (outcome.kind === 'bad-name') {
      return NextResponse.json({ error: outcome.refusal.error, message: outcome.refusal.message }, { status: outcome.refusal.status });
    }
    if (outcome.kind === 'taken') {
      const v = outcome.vendor;
      return NextResponse.json({
        error: 'vendor-exists',
        message: `this book already has "${v.vendor_name}"${v.is_active ? '' : ' (archived)'} — the same vendor, ignoring case and spacing`,
        vendor: { id: v.id, vendor_name: v.vendor_name, is_active: v.is_active },
      }, { status: 409 });
    }

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_vendor_added', description: `Added vendor "${outcome.vendor.vendor_name}"` },
      target: { table: 'operations_vendor_directory', id: outcome.vendor.id },
      payload: { before: null, after: outcome.vendor, metadata: { entity_id: outcome.vendor.entity_id } },
    });

    return NextResponse.json(outcome.vendor, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'vendor-exists', message: 'this book gained a vendor of that name at the same moment — read the list again' }, { status: 409 });
    }
    return failClosedResponse('Vendor directory POST', 'Failed to add the vendor', error);
  }
}

/**
 * PATCH /api/operations/vendor-directory — TIMESHEET-04a (2026-11-27): a vendor's Instagram tag.
 *
 * Body { id, instagramTag }. This file's ONE update, and the only update of the directory anywhere (the vendor law pins it to
 * its shape): instagram_tag alone, where id and the caller. "tag is own column" — no vendor is renamed, archived or removed.
 *   · the caller first — the GET's own gate;
 *   · the JSON body, and a body that is not an object, refused as the POST refuses them;
 *   · instagramTag must be SAID: absent → 400. A text sets the tag; null clears it;
 *   · the tag, read by the rule (planVendor.ts readInstagramTag): trimmed, ONE leading @ dropped, then letters, digits, dots and
 *     underscores, 1–30 — else 400 in the rule's words. Both refusals come before any query of the directory;
 *   · the vendor: an id that is no UUID names no row, and no query is made for it (readVendorId). Else the caller's own row, by
 *     { id, user_id } — active or archived. None → 404: ONE answer for an id that is no UUID, a missing row and another user's;
 *   · the same tag as the row holds → 200 with the row and changed: false — nothing is written, nothing audited;
 *   · else THE ONE WRITE, then its audit — operations_vendor_updated, with the row before and after — and 200 with the row and
 *     changed: true.
 * No 403 anywhere. No rate limit: the POST has none.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let raw: unknown;
    try { raw = await request.json(); } catch { return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 }); }
    // TAB13-04 (R7 b): a body that is not an object — null, an array, a number — is refused, never read as one.
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'A JSON object body is required.' }, { status: 400 });
    }
    const body = raw as { id?: unknown; instagramTag?: unknown };
    if (body.instagramTag === undefined) {
      return NextResponse.json({ error: 'Validation', message: 'instagramTag is required — text, or null for none' }, { status: 400 });
    }
    const read = readInstagramTag(body.instagramTag);
    if (!read.ok) return NextResponse.json({ error: read.error, message: read.message }, { status: read.status });

    // The vendor — the caller's own row, active or archived. An id that is no UUID names no row: no query is made for it.
    const id = readVendorId(body.id);
    const before = id === null ? null : await prisma.operations_vendor_directory.findFirst({
      where: { id, user_id: user.id },
      select: { id: true, vendor_name: true, entity_id: true, instagram_tag: true },
    });
    if (before === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // The same tag as the row holds: nothing is written and nothing is audited.
    if (before.instagram_tag === read.tag) return NextResponse.json({ ...before, changed: false });

    const after = await prisma.operations_vendor_directory.update({ where: { id: before.id, user_id: user.id }, data: { instagram_tag: read.tag }, select: { id: true, vendor_name: true, entity_id: true, instagram_tag: true } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_vendor_updated', description: `${read.tag === null ? 'Cleared' : 'Set'} the Instagram tag of "${after.vendor_name}"` },
      target: { table: 'operations_vendor_directory', id: after.id },
      payload: { before, after, metadata: { entity_id: after.entity_id } },
    });

    return NextResponse.json({ ...after, changed: true });
  } catch (error) {
    return failClosedResponse('Vendor directory PATCH', 'Failed to set the vendor\'s Instagram tag', error);
  }
}
