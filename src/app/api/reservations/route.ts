import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { reservationsAnswerOf } from '@/lib/reservations/reservationsAnswer';
// READS-01a (Alex, 2026-11-07, ruling B): the body moved to reservationsAnswer.ts (the note at the foot of this header);
// the header's lines stay where TripBookings.tsx :20 cites them (:12-13).

/**
 * BOOKINGS-01 (2026-09-27) — GET /api/reservations: every booking of the caller, newest first.
 *
 * ONE list for all of a user's bookings — attached to a trip or not — each row built
 * by ONE pure leaf (src/lib/reservations/bookingRow.ts bookingRowOf) from facts already
 * recorded: the reservation (STATUS-01's ticketing, cancel intent and last read), the
 * flight's calendar day (CAL-01), the ACCEPTED CHARGE link (MATCH), the POSTED entry
 * that documents the charge (POST-01), the owner's budget-line link (LINK-02).
 *
 * AUTH, the reservations/[id] pattern: getVerifiedEmail → 401; the user row → 404.
 * Every query is scoped to that user: reservations WHERE userId = user.id — a guest
 * row (userId null) and another user's row are never returned. READ-ONLY: zero
 * writes, and no vendor client — nothing here calls a provider.
 *
 * CAL-02 (2026-09-27): a flight now has one calendar row PER SEGMENT (source_id
 * `<id>:seg:<n>`). The rows are read through the one where (bookingCalendarRowsWhere)
 * and folded back to their reservation, so a booking with several rows is still ONE
 * booking here: its day is the earliest stated start_date among its rows (the rows
 * arrive ordered by start_date; the first one kept per reservation).
 *
 * TRAVEL-02a (Alex, 2026-11-02, ruling E) — THE READ, ADDITIVE. The answer keeps `bookings`
 * (bookingRowOf's words) and gains `ledger`: the FACTS the travel ledger's leaf
 * (src/lib/reservations/travelLedger.ts) words — per reservation its id, createdAt, lane,
 * provider, displayName, providerBookingId, confirmation, status, finalPriceCents, currency,
 * checkinDate / checkoutDate, the flight's calendar day, trip { id, name } | null, budgetLine
 * { coaCode } | null, charge { matched, posted, bank { amount, currency, date } | null, postedDay,
 * postedEntryId }, receipts (current source_documents receipts on the posted entry — read with
 * user_id), moneyEvents[] (kind refund | cancellation_fee | voucher_issued — each with its
 * settled bank row). The links by the caller's reservation ids AND the reservation's owner;
 * the same bank join the travel-day route uses. This route words nothing: every word is the
 * leaf's. A second accepted charge link or a second posted charge entry on one booking is a
 * contradiction named by name, never one picked.
 *
 * READS-01a (Alex, 2026-11-07, ruling B): the body above moved VERBATIM to src/lib/reservations/reservationsAnswer.ts
 * (reservationsAnswerOf — the caller's id as the parameter); this route is the gate and the answer, and /api/home-ledger
 * calls the function directly — no route calls a route.
 */
export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(await reservationsAnswerOf(prisma, user.id));
}
