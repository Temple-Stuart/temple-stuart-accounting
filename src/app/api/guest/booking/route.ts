// GUEST-01 (2026-09-29) — GET /api/guest/booking: the ONE booking a guest's session
// opened, the vendor's side, read-only.
//
// PUBLIC, and why that is safe to be: nothing is read until the guestBooking cookie
// verifies (a signed value naming one reservation, unexpired — src/lib/guest/
// guestAccess.ts); none or an invalid one is 401 before any query. Then every read
// names that reservation: the row only while it is still a guest's (bookingType
// 'guest', userId null), its landed book answer and its latest landed booking read
// (user_id null, guest_ref booking:<reference>), and the refunds and fees the vendor
// stated — no bank row, no link, no books entry, no margin. The answer is
// guestReceiptOf's (src/lib/receipts/bookingReceipt.ts). It writes nothing, calls no
// vendor, and is never cached.
// The decision is src/lib/guest/guestSession.ts guestBooking; this file wires it.
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { guestKey } from '@/lib/cookie-auth';
import { BOOKING_READ, LITEAPI, bookingGuestRef, bookingReadTheirId } from '@/lib/arrivals/liteapiBooking';
import { GUEST_COOKIE } from '@/lib/guest/guestAccess';
import { guestBooking, type GuestBookingPorts } from '@/lib/guest/guestSession';

const NO_STORE = { 'Cache-Control': 'no-store' };

const ports: GuestBookingPorts = {
  reservation: (id) =>
    prisma.reservations.findFirst({
      where: { id, bookingType: 'guest', userId: null },
      select: {
        id: true, lane: true, displayName: true, providerBookingId: true, providerConfirmationCode: true, status: true,
        createdAt: true, checkinDate: true, checkoutDate: true, arrival_id: true,
      },
    }),
  bookArrival: (arrivalId, providerBookingId) =>
    prisma.arrivals.findFirst({
      where: { id: arrivalId, user_id: null, guest_ref: bookingGuestRef(providerBookingId) },
      select: { id: true, arrived: true, payload: true },
    }),
  latestRead: (providerBookingId) =>
    prisma.arrivals.findFirst({
      where: { provider: LITEAPI, resource: BOOKING_READ, their_id: bookingReadTheirId(providerBookingId), user_id: null, guest_ref: bookingGuestRef(providerBookingId) },
      orderBy: { arrived: 'desc' },
      select: { id: true, arrived: true, payload: true },
    }),
  moneyEvents: (reservationId) =>
    prisma.money_events.findMany({
      where: { reservationId },
      orderBy: { statedAt: 'asc' },
      select: { id: true, kind: true, amountCents: true, currency: true, statedAt: true },
    }),
};

export async function GET(request: NextRequest) {
  try {
    const answer = await guestBooking(ports, {
      cookie: request.cookies.get(GUEST_COOKIE)?.value ?? null,
      key: guestKey(),
      now: Math.floor(Date.now() / 1000),
    });
    if (answer.status !== 200) return NextResponse.json({ error: answer.error }, { status: answer.status, headers: NO_STORE });
    return NextResponse.json({ receipt: answer.receipt }, { headers: NO_STORE });
  } catch (err) {
    const failed = failClosedResponse('Guest booking read', 'Could not read the booking right now', err);
    failed.headers.set('Cache-Control', 'no-store');
    return failed;
  }
}
