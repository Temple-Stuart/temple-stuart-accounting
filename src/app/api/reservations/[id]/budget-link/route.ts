import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { recordBookingEvent } from '@/lib/reservations/auditTrail';
import { LinkExistsError, linkBooking, unlinkBooking, type BudgetLinkPorts } from '@/lib/reservations/budgetLink';

/**
 * LINK-02 (2026-09-27) — POST / DELETE /api/reservations/[id]/budget-link.
 *
 * The owner links a booking to the budget line of its trip that it fulfils — or
 * unlinks it. THE ONLY WRITER of reservation_budget_links. The decisions (the
 * reservations/[id] auth pattern — verified email, the user, findFirst { id,
 * userId } → 404, guests fenced — the line by { id, userId } → 404, its own trip
 * → else 409, one link per booking → else 409, then the audit row through the ONE
 * port) live in src/lib/reservations/budgetLink.ts; this file is their prisma
 * adapter, every query scoped to the caller. No matcher, no score, no suggestion:
 * the line written is the one the owner named. No amount, no status, no ledger.
 */
function ports(): BudgetLinkPorts {
  return {
    findUser: (email) => prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
    findReservation: (id, userId) => prisma.reservations.findFirst({ where: { id, userId }, select: { id: true, tripId: true } }),
    findLine: (id, userId) => prisma.budget_line_items.findFirst({ where: { id, userId }, select: { id: true, tripId: true, description: true } }),
    findLink: async (reservationId, userId) => {
      const link = await prisma.reservation_budget_links.findFirst({
        where: { reservationId, userId },
        select: { id: true, budgetLineItemId: true, budgetLineItem: { select: { description: true } } },
      });
      return link === null ? null : { id: link.id, budgetLineItemId: link.budgetLineItemId, description: link.budgetLineItem.description };
    },
    createLink: async (row) => {
      try {
        return await prisma.reservation_budget_links.create({ data: row, select: { id: true, budgetLineItemId: true, linkedAt: true } });
      } catch (err) {
        // The UNIQUE on reservationId refused a second link — named for the leaf.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new LinkExistsError();
        throw err;
      }
    },
    deleteLink: async (id, userId) => (await prisma.reservation_budget_links.deleteMany({ where: { id, userId } })).count,
    record: (input) => recordBookingEvent(input),
    now: () => new Date(),
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const answer = await linkBooking(ports(), { userEmail: await getVerifiedEmail(), reservationId: id, readBody: () => request.json() });
    return NextResponse.json(answer.body, { status: answer.status });
  } catch (err) {
    return failClosedResponse('Reservation budget link', 'Could not link the booking to the budget line', err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const answer = await unlinkBooking(ports(), { userEmail: await getVerifiedEmail(), reservationId: id });
    return NextResponse.json(answer.body, { status: answer.status });
  } catch (err) {
    return failClosedResponse('Reservation budget unlink', 'Could not unlink the booking from the budget line', err);
  }
}
