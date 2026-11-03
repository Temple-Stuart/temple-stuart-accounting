/**
 * /api/operations/stays/[id] — one of the caller's stays (STAY-01, 2026-10-12).
 *
 * PATCH  { place, starts_on, ends_on } → { stay, changed }: the whole stay, read
 *        by the one rule (src/lib/operations/stay.ts stayInput — a 400 names the
 *        first bad field); a span that meets another of the caller's stays is
 *        refused by name, 409, before any write (the migration's trigger is the
 *        backstop for a race, answered 409 too). Unchanged values write nothing
 *        and audit nothing: { stay, changed: false }. Audited operations_stay_set
 *        (before → after) after the write.
 * DELETE → { deleted: true }. Audited operations_stay_deleted (before) after.
 *        TRAVEL-02c (Alex, 2026-11-03, ruling A) — NO ORPHANS: while the stay holds a link in planned_item_links (kind
 *        'stay' — no FK on target_id), it refuses 409 by name before any write — the links counted and the stay
 *        deleted in one transaction, LINK-LAW-01's rule for a routine (routines/[id]/route.ts) applied to a stay
 *        (stayCosts.ts stayHoldsLinksWords): unlink first. A PATCH that moves the stay's days keeps its links — the
 *        link is to the stay, not to its dates.
 *
 * The caller's own row only: the verified cookie, then the user, then the stay
 * by { id, user_id } — another user's row, a missing one and an id that is no
 * UUID get the same 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { OVERLAP_TAG, RACE_WORDS, asDate, meeting, overlapWords, stayInput, stayRowOf } from '@/lib/operations/stay';
import { stayHoldsLinksWords, stayLinksWhere } from '@/lib/operations/stayCosts';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { id } = await params;
    // The caller's own row — another user's, a missing one and an id that is no UUID get the same 404 (nothing reaches Prisma malformed).
    if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = await prisma.operations_stays.findFirst({ where: { id, user_id: user.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const before = stayRowOf(row);

    const read = stayInput(await request.json());
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });
    const { place, startsOn, endsOn } = read.value;

    if (place === before.place && startsOn === before.starts_on && endsOn === before.ends_on) {
      return NextResponse.json({ stay: before, changed: false });
    }

    const others = (await prisma.operations_stays.findMany({ where: { user_id: user.id } })).map(stayRowOf);
    const met = meeting(others, { startsOn, endsOn }, row.id);
    if (met.length > 0) return NextResponse.json({ error: 'Conflict', message: overlapWords({ startsOn, endsOn }, met[0]) }, { status: 409 });

    let after;
    try {
      after = stayRowOf(await prisma.operations_stays.update({
        where: { id: row.id },
        data: { place, starts_on: asDate(startsOn), ends_on: asDate(endsOn) },
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes(OVERLAP_TAG)) {
        return NextResponse.json({ error: 'Conflict', message: RACE_WORDS(startsOn, endsOn) }, { status: 409 });
      }
      throw error;
    }

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stay_set', description: `Changed a stay: ${after.place}, ${after.starts_on} to ${after.ends_on}` },
      target: { table: 'operations_stays', id: row.id },
      payload: { before, after },
    });

    return NextResponse.json({ stay: after, changed: true });
  } catch (error) {
    return failClosedResponse('Stay PATCH', 'Failed to save the stay', error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { id } = await params;
    // The caller's own row — another user's, a missing one and an id that is no UUID get the same 404 (nothing reaches Prisma malformed).
    if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = await prisma.operations_stays.findFirst({ where: { id, user_id: user.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const before = stayRowOf(row);

    // TRAVEL-02c (ruling A): the links the stay holds, counted inside the transaction that deletes; any held refuses the
    // delete by name, and nothing is written.
    const held = await prisma.$transaction(async (tx) => {
      const n = await tx.planned_item_links.count({ where: stayLinksWhere(user.id, row.id) });
      if (n > 0) return n;
      await tx.operations_stays.delete({ where: { id: row.id } });
      return 0;
    });
    if (held > 0) return NextResponse.json({ error: 'Conflict', message: stayHoldsLinksWords(held, before) }, { status: 409 });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stay_deleted', description: `Deleted a stay: ${before.place}, ${before.starts_on} to ${before.ends_on}` },
      target: { table: 'operations_stays', id: row.id },
      payload: { before, after: null },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return failClosedResponse('Stay DELETE', 'Failed to delete the stay', error);
  }
}
