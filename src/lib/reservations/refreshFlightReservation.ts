/**
 * LANE-01 (2026-09-25) — THE FLIGHT'S NAME, ITS DAY, AND ITS STATUS — VENDOR-STATED.
 *
 * A flight reservation was written once from the book answer and never touched
 * again: no day (the book payload carries no date of travel — CAL-01 STEP 1.5),
 * no route (hotelName null, so the ledgers named it "liteapi"), and a status frozen
 * at 'pending' long after the plane had flown.
 *
 * The vendor documents GET /flights/bookings/{bookingId}
 * (docs.liteapi.travel/reference/get_flights-bookings-bookingid): data[0].booking
 * with the booking's CURRENT status and journey.segments[], each segment carrying
 * departureTime, direction (OUTBOUND | INBOUND), originCode, destinationCode,
 * carrier.marketingName and flight.marketingNumber. This function is handed ONE
 * such answer for one flight reservation and applies what it states:
 *
 *   · the OUTBOUND segment's departureTime → the CAL-01 calendar row on that day,
 *     keyed (source='reservation', source_id=reservation.id) exactly as CAL-01;
 *   · carrier.marketingName + originCode → destinationCode → displayName;
 *   · the vendor's current status → reservations.status, through THE ONE APPLY
 *     LEAF (STATUS-01, src/lib/reservations/applyVendorState.ts), which maps it
 *     by name through src/lib/reservations/flightStatus.ts exactly as the book
 *     route does; an unlisted status changes nothing and is reported by name.
 *
 * NO FALLBACK. If the call fails: no row, no rename, no status change — one named
 * outcome the caller logs once. If the answer carries no OUTBOUND segment with a
 * departureTime: no row, no rename, each by name (LANE-01's posture, kept) — and
 * the STATUS STILL GOES THROUGH THE APPLY LEAF (STATUS-01b, 2026-09-26): a
 * cancelled, failed or expired flight whose GET drops the journey must not stay
 * 'confirmed' forever. No date is ever derived from createdAt. A row already
 * carrying its day, its name and its current status is left untouched, so a
 * second run changes nothing but the read stamp.
 *
 * STATUS-01 (2026-09-26) — WHAT MOVED. The status mapping, CANCEL-01's
 * cancel_pending guard, the PNR, ticketedAt, ticketLimitTime, lastVendorReadAt
 * and the lifecycle emails all live in applyVendorState — this function hands it
 * the stated flight and merges its ONE write with the name. The CAL-01 row is
 * written BEFORE the apply, so a flight the vendor reports cancelled has its day
 * MARKED by the apply (markBookingCalendarCancelled) rather than inserted live
 * after the mark. One reservation write per run, always carrying lastVendorReadAt.
 *
 * WHICH SEGMENT IS "THE OUTBOUND". A journey's outbound may be several segments
 * (a connection). The day the trip starts is the departure of the EARLIEST
 * OUTBOUND segment by its stated departureTime; the route is the first outbound
 * segment's origin to the last outbound segment's destination, and the carrier
 * is the first outbound segment's marketing carrier. Segments the vendor has not
 * marked OUTBOUND, or has not dated, are not guessed at.
 *
 * Pure over ports, so node:test drives every branch without a database or a
 * provider, and the retro scripts (scripts/lane-01-retro-flights.ts,
 * scripts/status-01-retro-reservations.ts), the read leaf (vendorRead.ts) and
 * the book route wire the same function to the real ones.
 */
import { flightStatedCalendarDecision, writeBookingCalendarEvent, type BookingCalendarCancelPort, type BookingCalendarPort } from '../calendar/bookingEvent';
import { flightDisplayName, reservationIdentity } from './lane';
import { applyVendorState, type ApplyPorts, type LifecycleEmailRequest, type ReservationPatch } from './applyVendorState';

/** One segment, as the vendor states it — null where the field was not carried. */
export interface FlightBookingSegmentStated {
  departureTime: string | null;
  direction: string | null;
  originCode: string | null;
  destinationCode: string | null;
  carrierName: string | null;
  flightNumber: string | null;
}

/** GET /flights/bookings/{bookingId}, what this function reads from it. */
export interface FlightBookingStated {
  bookingId: string;
  status: string | null;
  segments: FlightBookingSegmentStated[];
  /** STATUS-01: the rest of what the GET states, handed to applyVendorState as stated — null when absent. */
  pnr: string | null;
  ticketedAt: string | null;
  ticketLimitTime: string | null;
  cancelIntentAt: string | null;
  /** STATUS-01: the landed answer's own arrival instant — becomes lastVendorReadAt. */
  readAt: Date;
}

/** The reservation row, the columns this function reads and may write. */
export interface FlightReservationRow {
  id: string;
  userId: string | null;
  lane: string;
  providerBookingId: string;
  providerConfirmationCode: string | null;
  status: string;
  displayName: string | null;
  /** STATUS-01: the apply leaf's columns. */
  ticketedAt: Date | null;
  ticketLimitTime: Date | null;
  cancelIntentAt: Date | null;
  ticketedEmailSentAt: Date | null;
  confirmationEmailSentAt: Date | null;
  /** COMM-01: the apply leaf's lock gate — null for a flight (a non-stay order). */
  checkoutDate: Date | null;
}

/** ONE write: the name (when it changed) beside the apply leaf's patch. */
export type FlightReservationPatch = ReservationPatch & { displayName?: string };

export interface FlightRefreshPorts {
  /** The vendor call. Throws on any failure — the throw is caught here and named. */
  fetchBooking(bookingId: string): Promise<FlightBookingStated>;
  /** The CAL-01 calendar port (prismaBookingCalendar in production), which also marks a cancelled day. */
  calendar: BookingCalendarPort & BookingCalendarCancelPort;
  /** ONE write per run: what changed, always carrying lastVendorReadAt. */
  writeReservation(id: string, patch: FlightReservationPatch): Promise<void>;
  /** STATUS-01: commission_ledger 'estimated' → 'cancelled' for a vendor-cancelled flight (applyVendorState). */
  cancelCommission: ApplyPorts['cancelCommission'];
  /** Named lines, once each; default silent. */
  log?: (line: string) => void;
}

export type FlightRefreshOutcome =
  | {
      fetched: false;
      /** Named — the caller logs it once. */
      reason: string;
    }
  | {
      fetched: true;
      providerStatus: string | null;
      /** The calendar row: written now, already there, or not written and why. */
      calendar: 'inserted' | 'already_there' | 'no_row';
      calendarReason: string | null;
      /** The day the row sits on (YYYY-MM-DD), when the vendor stated one. */
      day: string | null;
      name: 'set' | 'unchanged' | 'not_stated';
      nameValue: string | null;
      status: 'set' | 'unchanged' | 'unmapped';
      statusValue: string;
      /** STATUS-01: every fact the apply leaf changed, by name, and the emails now owed (send after the commit). */
      changes: string[];
      emails: LifecycleEmailRequest[];
    };

export async function refreshFlightReservation(ports: FlightRefreshPorts, row: FlightReservationRow): Promise<FlightRefreshOutcome> {
  if (row.lane !== 'flight') {
    throw new Error(`reservation ${row.id} is lane "${row.lane}" — the flight refresh reads flights only`);
  }

  let stated: FlightBookingStated;
  try {
    stated = await ports.fetchBooking(row.providerBookingId);
  } catch (err) {
    return {
      fetched: false,
      reason: `reservation ${row.id}: GET /flights/bookings/${row.providerBookingId} failed (${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}) — no row, no rename, no status change`,
    };
  }

  // ── THE OUTBOUND, from stated fields only ──────────────────────────────────
  const outbound = stated.segments
    .filter((s) => s.direction === 'OUTBOUND' && typeof s.departureTime === 'string' && s.departureTime.length > 0)
    .sort((a, b) => (a.departureTime as string).localeCompare(b.departureTime as string));
  const first = outbound[0] as FlightBookingSegmentStated | undefined;
  const last = outbound[outbound.length - 1];

  // ── THE NAME AND THE DAY — LANE-01's posture: a stated OUTBOUND segment, or nothing, by name ──
  // STATUS-01b: no OUTBOUND segment with a departureTime → no row, no rename, each
  // named; the status below is applied regardless.
  let statedName: string | null = null;
  let calendar: Awaited<ReturnType<typeof writeBookingCalendarEvent>>;
  let day: string | null = null;
  if (first === undefined) {
    calendar = {
      landed: 'no_row',
      reason: stated.segments.length === 0
        ? `GET /flights/bookings/${row.providerBookingId} answered with no segments — no row, no rename`
        : `GET /flights/bookings/${row.providerBookingId} states ${stated.segments.length} segment(s) but none marked OUTBOUND with a departureTime — no row, no rename`,
    };
  } else {
    const departureTime = first.departureTime as string;
    statedName = flightDisplayName({ carrierName: first.carrierName, originCode: first.originCode, destinationCode: last.destinationCode });
    // The CAL-01 row, keyed on the reservation, written once, BEFORE the apply.
    const nameForRow = statedName ?? reservationIdentity({ ...row, displayName: row.displayName }).name;
    calendar = await writeBookingCalendarEvent(
      ports.calendar,
      flightStatedCalendarDecision({ reservationId: row.id, userId: row.userId, name: nameForRow, departureTime }),
    );
    day = calendar.landed === 'no_row' ? null : departureTime.slice(0, 10);
  }
  const namePatch: { displayName?: string } = {};
  let name: 'set' | 'unchanged' | 'not_stated';
  if (statedName === null) name = 'not_stated';
  else if (statedName === row.displayName) name = 'unchanged';
  else { name = 'set'; namePatch.displayName = statedName; }

  // ── THE STATUS AND THE REST — through the one apply leaf; the name rides its write ──
  const applied = await applyVendorState(
    {
      writeReservation: (id, patch) => ports.writeReservation(id, { ...namePatch, ...patch }),
      calendar: ports.calendar,
      cancelCommission: ports.cancelCommission,
      // COMM-01: a flight locks no commission (NOT DOCUMENTED) — the leaf never asks; if it ever did, this names it.
      lockCommission: async () => { throw new Error(`reservation ${row.id}: a flight locks no commission — NOT DOCUMENTED (COMM-01)`); },
      log: ports.log,
    },
    row,
    {
      lane: 'flight',
      bookingId: stated.bookingId,
      status: stated.status,
      pnr: stated.pnr,
      ticketedAt: stated.ticketedAt,
      ticketLimitTime: stated.ticketLimitTime,
      cancelIntentAt: stated.cancelIntentAt,
      readAt: stated.readAt,
    },
  );
  if (name === 'set') applied.changes.unshift(`displayName ${row.displayName === null ? 'null' : `"${row.displayName}"`} → "${statedName}"`);

  return {
    fetched: true,
    providerStatus: stated.status,
    calendar: calendar.landed,
    calendarReason: calendar.landed === 'no_row' ? calendar.reason : null,
    day,
    name,
    nameValue: statedName,
    status: applied.status === 'unlisted' ? 'unmapped' : applied.status,
    statusValue: applied.statusValue,
    changes: applied.changes,
    emails: applied.emails,
  };
}
