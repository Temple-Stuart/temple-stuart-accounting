import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BOOKING_READ, CANCELLATION, LITEAPI, bookingReadTheirId, cancellationTheirId } from '@/lib/arrivals/liteapiBooking';
import { timelineOf, type TimelineArrival } from '@/lib/reservations/timeline';

/**
 * AUDIT-01 (2026-09-26) — GET /api/reservations/[id]/timeline.
 *
 * The booking's own history: the primary tables AND the audit rows loaded, the
 * pure leaf (src/lib/reservations/timeline.ts timelineOf) called, its items
 * returned. READ-ONLY: zero writes, and NO vendor call — every line is a row
 * already recorded.
 *
 * AUTH, the receipt route's exactly (src/app/api/reservations/[id]/receipt/
 * route.ts): getVerifiedEmail → 401; the user row → 404; the reservation by
 * findFirst { id, userId: user.id } → 404 — the defensive 404 that confirms
 * nothing, and the guest fence (a guest row has userId null and never matches).
 * No tier gate — the receipt's bar.
 *
 * WHAT IT READS, every query scoped to this user or this owned reservation:
 *   · the arrivals — the book answer (reservations.arrival_id), every landed
 *     booking read (booking_read, read:<bookingId>) and every landed cancel
 *     answer (cancellation, cancellation:<bookingId>), the owner's;
 *   · the vendor's webhook deliveries naming this booking (provider liteapi,
 *     bookingId);
 *   · the audit rows the owner is the actor of (SEC-1's scope, the audit-log
 *     route's) that target this reservation OR name it in payload_metadata
 *     (money_event_* rows target the money event);
 *   · the money events; the posted entries that document the booking (the
 *     charge's and each refund's); the calendar rows (source 'reservation').
 *
 * COMMISSION IS NOT READ HERE. This history renders on the customer's receipt
 * page, and RECEIPT-01 ruled that commission never appears there (Temple
 * Stuart's books, not the customer's). So commission_ledger is not loaded and
 * the commission_locked audit rows are not selected — excluded BY NAME, never
 * silently: the commission rows stay in commission_ledger and the chained
 * commission_locked rows stay in audit_log, readable from the owner's audit log.
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
    select: { id: true, providerBookingId: true, arrival_id: true },
  });
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

  const arrivalSelect = { id: true, resource: true, arrived: true, asked: true, payload: true } as const;

  // 1. The landed book answer (reservations.arrival_id) — none for a row landed before REBUILD-01 PR-5.
  const bookArrival: TimelineArrival | null = reservation.arrival_id === null
    ? null
    : await prisma.arrivals.findUnique({ where: { id: reservation.arrival_id }, select: arrivalSelect });

  // 2. Every landed booking read and every landed cancel answer for this booking, the owner's.
  const laterArrivals: TimelineArrival[] = await prisma.arrivals.findMany({
    where: {
      provider: LITEAPI,
      user_id: user.id,
      OR: [
        { resource: BOOKING_READ, their_id: bookingReadTheirId(reservation.providerBookingId) },
        { resource: CANCELLATION, their_id: cancellationTheirId(reservation.providerBookingId) },
      ],
    },
    select: arrivalSelect,
  });

  // 3. The vendor's webhook deliveries naming this booking.
  const webhookEvents = await prisma.webhook_events.findMany({
    where: { provider: LITEAPI, bookingId: reservation.providerBookingId },
    select: { id: true, eventType: true, outcome: true, receivedAt: true },
  });

  // 4. The audit rows: the owner's (SEC-1), targeting the reservation or naming it — commission_locked excluded by name (above).
  const auditRows = await prisma.audit_log.findMany({
    where: {
      actor_user_id: user.id,
      action_type: { not: 'commission_locked' },
      OR: [
        { target_table: 'reservations', target_id: reservation.id },
        { payload_metadata: { path: ['reservationId'], equals: reservation.id } },
      ],
    },
    select: { id: true, created_at: true, action_type: true, action_description: true, payload_before: true, payload_after: true },
  });

  // 5. The money events the vendor stated, settled or not.
  const moneyEvents = await prisma.money_events.findMany({
    where: { reservationId: reservation.id },
    select: { id: true, kind: true, amountCents: true, currency: true, status: true, statedAt: true, settledTransactionId: true, settledAt: true },
  });

  // 6. The posted entries that document this booking — the charge's and each refund's (POST-01).
  const journalEntries = await prisma.journal_entries.findMany({
    where: { userId: user.id, document_reservation_id: reservation.id },
    select: { id: true, date: true, status: true, created_at: true, document_money_event_id: true },
  });

  // 7. The booking's calendar rows (CAL-01: source 'reservation', source_id = the reservation id).
  const calendarRows = await prisma.calendar_events.findMany({
    where: { user_id: user.id, source: 'reservation', source_id: reservation.id },
    select: { id: true, start_date: true, status: true, created_at: true, updated_at: true },
  });

  const timeline = timelineOf({
    arrivals: bookArrival === null ? laterArrivals : [bookArrival, ...laterArrivals],
    webhookEvents,
    auditRows,
    moneyEvents,
    // Excluded by RECEIPT-01's ruling, named above — not loaded, never on the customer's page.
    commission: [],
    journalEntries,
    calendarRows,
  });
  return NextResponse.json({ timeline });
}
