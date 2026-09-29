import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { readVendorName, takenBy } from '@/lib/operations/planVendor';

// VENDOR-01 (2026-09-29): this file now CREATES vendors — the directory's first
// write, the POST below. It never updates or deletes one: no vendor is renamed,
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
      select: { id: true, vendor_name: true, entity_id: true, category: true },
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

    let body: { entityId?: unknown; name?: unknown };
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 }); }
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
