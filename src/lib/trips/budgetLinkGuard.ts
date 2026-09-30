import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * LINK-02 (2026-09-27) — THE LINK'S INTEGRITY, ASKED BEFORE A WRITE.
 *
 * reservation_budget_links holds a booking to the budget line it fulfils, RESTRICT
 * both ways (migration 20260927120000_link_02_reservation_budget_links), and a
 * booking fulfils a line of ITS OWN trip. Two existing writers could break that
 * (LEGACY-DEL-01, 2026-09-29: a third, the legacy planner's trip uncommit —
 * src/app/api/trips/[id]/commit/route.ts DELETE — was deleted with the planner):
 *
 *   · the trip delete (src/app/api/trips/[id]/route.ts) deletes a trip's lines AFTER
 *     other writes that share no transaction — Postgres's RESTRICT would refuse
 *     mid-way and leave the trip half-deleted, or its budgets already removed;
 *   · the attach/detach PATCH (src/app/api/reservations/[id]/route.ts) would move a
 *     linked booking off its trip, leaving it "fulfilling" another trip's line.
 *
 * So each asks here FIRST and refuses BY NAME (409) before any write — the owner
 * unlinks, then acts. Nothing here links, unlinks, or guesses: it only counts the
 * links the owner made. Scoped to the owner's lines / booking.
 */

/** The trip's lines carry a link → the named refusal; none → null. */
export async function tripLinesLinkedRefusal(userId: string, tripId: string): Promise<NextResponse | null> {
  const linked = await prisma.reservation_budget_links.count({ where: { budgetLineItem: { tripId, userId } } });
  if (linked === 0) return null;
  return NextResponse.json(
    { error: `${linked === 1 ? 'A booking is' : `${linked} bookings are`} linked to this trip's budget lines — unlink ${linked === 1 ? 'it' : 'them'} first (the booking's Budget line control).`, code: 'budget_lines_linked', linked },
    { status: 409 },
  );
}

/** The booking is linked to a budget line → the named refusal to move it off its trip; none → null. */
export async function bookingLinkedRefusal(userId: string, reservationId: string): Promise<NextResponse | null> {
  const link = await prisma.reservation_budget_links.findFirst({ where: { reservationId, userId }, select: { id: true } });
  if (link === null) return null;
  return NextResponse.json(
    { error: 'This booking fulfils a budget line of its trip — unlink it from the line first, then move it.', code: 'budget_link_exists' },
    { status: 409 },
  );
}
