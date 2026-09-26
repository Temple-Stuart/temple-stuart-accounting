import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BOOKING_READ, LITEAPI, bookingReadTheirId } from '@/lib/arrivals/liteapiBooking';
import { receiptOf, type ReceiptArrival } from '@/lib/receipts/bookingReceipt';

/**
 * RECEIPT-01 (2026-09-26) — GET /api/reservations/[id]/receipt.
 *
 * The owner's receipt for one booking: the six inputs loaded, the pure leaf
 * (src/lib/receipts/bookingReceipt.ts) called, its words returned. READ-ONLY:
 * zero writes, and NO vendor call — the receipt reads the vendor's LANDED
 * answers (the book arrival at reservations.arrival_id and the latest landed
 * booking read) and never the wire.
 *
 * AUTH, the reservations/[id]/route.ts pattern: getVerifiedEmail → 401; the user
 * row → 404; the reservation by findFirst { id, userId: user.id } → 404 — the
 * defensive 404 that confirms nothing, and the guest fence (a guest row has
 * userId null and can never match; the claim flow is a separate decision).
 * NO TIER GATE: a receipt is the customer's own record — the export's bar
 * (src/app/api/export/route.ts:11-16), verified email + user scope only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // The reservation must be THIS user's account row.
  const reservation = await prisma.reservations.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true, lane: true, displayName: true, providerBookingId: true, providerConfirmationCode: true, status: true,
      createdAt: true, checkinDate: true, checkoutDate: true, arrival_id: true,
    },
  });
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

  // 1. The landed book answer (reservations.arrival_id) — null for a row landed before REBUILD-01 PR-5.
  const bookArrival: ReceiptArrival | null = reservation.arrival_id === null
    ? null
    : await prisma.arrivals.findUnique({ where: { id: reservation.arrival_id }, select: { id: true, arrived: true, payload: true } });

  // 2. The LATEST landed booking read: resource booking_read, their_id read:<bookingId>, the owner's, arrived DESC.
  const latestReadArrival: ReceiptArrival | null = await prisma.arrivals.findFirst({
    where: { provider: LITEAPI, resource: BOOKING_READ, their_id: bookingReadTheirId(reservation.providerBookingId), user_id: user.id },
    orderBy: { arrived: 'desc' },
    select: { id: true, arrived: true, payload: true },
  });

  // 3. The accepted CHARGE link → the bank row (POST-01's chain; the earliest accept when more than one).
  const chargeLink = await prisma.transaction_reservation_links.findFirst({
    where: { reservationId: reservation.id, userId: user.id, status: 'accepted', moneyEventId: null },
    orderBy: { reviewedAt: 'asc' },
    select: { id: true, transaction: { select: { id: true, name: true, merchantName: true, amount: true, date: true } } },
  });

  // 4. The posted entry that documents the booking's charge, with its D/C lines and their accounts.
  const journalEntry = await prisma.journal_entries.findFirst({
    where: { userId: user.id, document_reservation_id: reservation.id, document_money_event_id: null, status: 'posted' },
    select: {
      id: true, date: true, status: true,
      ledger_entries: { select: { id: true, entry_type: true, amount: true, account: { select: { code: true, name: true } } } },
    },
  });

  // 5. The money events the vendor stated, with the settling bank row when settled (MATCH-02).
  const moneyEvents = await prisma.money_events.findMany({
    where: { reservationId: reservation.id },
    orderBy: { statedAt: 'asc' },
    select: {
      id: true, kind: true, amountCents: true, currency: true, status: true, statedAt: true,
      settledTransactionId: true, settledAt: true,
      settledTransaction: { select: { name: true, date: true } },
    },
  });

  const receipt = receiptOf({ reservation, bookArrival, latestReadArrival, chargeLink, journalEntry, moneyEvents });
  return NextResponse.json({ receipt });
}
