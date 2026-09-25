/**
 * The cancel law's seeded regressions (CANCEL-01, 2026-09-26).
 *
 * The ruling says three things: a cancel goes to the right endpoint, shows the
 * quote first, and keeps the money facts. These seeds put back, one at a time,
 * each shape the ruling removed or forbade:
 *
 *   · the flight lane is sent to the hotel endpoint again (clause 1);
 *   · the flights client posts the cancel to the hotel path (clause 1);
 *   · the quote goes unmetered (clause 2);
 *   · the Cancel control renders before the quote (clause 2);
 *   · a missing amount becomes 0 (clause 3);
 *   · a 202 writes a money row (clause 3);
 *   · the hotel cancel discards its refund and fee again (clause 3);
 *   · money_events.arrivalId becomes optional (clause 3);
 *   · cancelIntentAt takes our clock (clause 4);
 *   · the refresh flips a pending cancel back to confirmed (clause 4);
 *   · a list offers Cancel on every lane (clause 4);
 *   · the calendar row is removed instead of marked (clause 5);
 *   · a final flight cancel leaves the estimated commission (clause 5).
 *
 * Each must fail THE CANCEL LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
const DIALOG = 'src/components/trips/CancelBookingDialog.tsx';
const LEAF = 'src/lib/reservations/cancellation.ts';
const FCLIENT = 'src/lib/liteapiFlightsClient.ts';
const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
const CAL_IMPL = 'src/lib/calendar/prismaBookingCalendar.ts';

const SEEDS: Seed[] = [
  {
    name: 'cancel01-a the flight lane is sent to the hotel endpoint again (clause 1)',
    file: ROUTE,
    find: "    if (owned.lane === 'flight') return cancelFlight(owned, userId);",
    replace: "    if (owned.lane === 'flight') return cancelHotel(owned, userId);",
    expect: 'does not send the flight lane to the flight cancel',
  },
  {
    name: 'cancel01-b the flights client posts the cancel to the hotel path (clause 1)',
    file: FCLIENT,
    find: '  const answer = await postFlightsAnswer(base, `/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`, undefined);',
    replace: '  const answer = await postFlightsAnswer(base, `/bookings/${encodeURIComponent(bookingId)}`, undefined);',
    expect: 'does not call the documented path POST /flights/bookings/{id}/cancellations',
  },
  {
    name: 'cancel01-c the quote goes unmetered (clause 2)',
    file: ROUTE,
    find: "    await reserveTravelSearch('liteapiflightcancelquote');\n",
    replace: '    // (unmetered)\n',
    expect: 'the quote is not reserved against liteapiflightcancelquote',
  },
  {
    name: 'cancel01-d the Cancel control renders before the quote (clause 2)',
    file: DIALOG,
    find: "  const canConfirm = !isFlight || quote.state === 'quoted';",
    replace: '  const canConfirm = true;',
    expect: 'renders a Cancel control before the quote has rendered',
  },
  {
    name: 'cancel01-e a missing amount becomes 0 (clause 3)',
    file: LEAF,
    find: '  if (amount === null) return null;',
    replace: '  if (amount === null) return 0;',
    expect: 'an amount the vendor did not state is not NULL',
  },
  {
    name: 'cancel01-f a 202 writes a money row (clause 3)',
    file: LEAF,
    find: "    return { status: 'cancel_pending', final: false, moneyEvents: [], vouchers: [], vouchersWithoutCode: [], commission: 'leave' };",
    replace: "    return { status: 'cancel_pending', final: false, moneyEvents: [{ reservationId: ev.reservationId, lane: 'flight', kind: 'refund', amountCents: centsOf(parsed.refundAmount), currency: parsed.currency, refundDestination: parsed.destination, status: 'stated', vendorReference: parsed.bookingId, arrivalId: ev.arrivalId, statedAt: ev.statedAt }], vouchers: [], vouchersWithoutCode: [], commission: 'leave' };",
    expect: 'a 202 writes money',
  },
  {
    name: 'cancel01-g the hotel cancel discards its refund and fee again (clause 3)',
    file: ROUTE,
    find: '          await tx.money_events.createMany({ data: moneyEvents });\n          // item 7',
    replace: '          // item 7',
    expect: 'the hotel cancel discards the refund and fee',
  },
  {
    name: 'cancel01-h money_events.arrivalId becomes optional (clause 3)',
    file: 'prisma/schema.prisma',
    find: '  arrivalId         String\n',
    replace: '  arrivalId         String?\n',
    expect: 'money_events.arrivalId is not required',
  },
  {
    name: 'cancel01-i cancelIntentAt takes our clock (clause 4)',
    file: ROUTE,
    find: 'data: { cancelIntentAt: new Date(details.cancelIntentAt) }',
    replace: 'data: { cancelIntentAt: new Date() }',
    expect: 'writes our clock into cancelIntentAt',
  },
  {
    name: 'cancel01-j the refresh flips a pending cancel back to confirmed (clause 4)',
    file: REFRESH,
    find: "  else if (row.status === 'cancel_pending' && mapped === 'confirmed') status = 'unchanged';",
    replace: "  else if (false) status = 'unchanged';",
    expect: 'would flip a cancel_pending row back to confirmed',
  },
  {
    name: 'cancel01-k a list offers Cancel on every lane (clause 4)',
    file: 'src/components/trips/TripBookings.tsx',
    find: "                      {(r.type === 'hotel' || r.type === 'flight') && r.status === 'confirmed' && (",
    replace: "                      {r.status === 'confirmed' && (",
    expect: 'does not offer Cancel on exactly the hotel and flight lanes',
  },
  {
    name: 'cancel01-l the calendar row is removed instead of marked (clause 5)',
    file: CAL_IMPL,
    find: "        UPDATE calendar_events\n           SET title = ${CANCELLED_TITLE_PREFIX} || title, status = 'cancelled', updated_at = now()\n         WHERE",
    replace: '        DELETE FROM calendar_events\n         WHERE',
    expect: 'is removed, not marked',
  },
  {
    name: 'cancel01-m a final flight cancel leaves the estimated commission (clause 5)',
    file: ROUTE,
    find: "            ? await tx.commission_ledger.updateMany({ where: { reservationId: owned.id, status: 'estimated' }, data: { status: 'cancelled' } })",
    replace: '            ? { count: 0 }',
    expect: 'does not move the estimated commission to cancelled',
  },
];

export default SEEDS;
