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
 * carrier.marketingName and flight.marketingNumber. This function calls it ONCE
 * for one flight reservation and applies what it states:
 *
 *   · the OUTBOUND segment's departureTime → the CAL-01 calendar row on that day,
 *     keyed (source='reservation', source_id=reservation.id) exactly as CAL-01;
 *   · carrier.marketingName + originCode → destinationCode → displayName;
 *   · the vendor's current status → reservations.status, mapped EXACTLY as the
 *     book route maps it (src/lib/reservations/flightStatus.ts); an unmapped
 *     status changes nothing and is reported by name.
 *
 * NO FALLBACK. If the call fails or the answer carries no segments: no row, no
 * rename, no status change — one named outcome the caller logs once. No date is
 * ever derived from createdAt. A row already carrying its day, its name and its
 * current status is left untouched, so a second run changes nothing.
 *
 * WHICH SEGMENT IS "THE OUTBOUND". A journey's outbound may be several segments
 * (a connection). The day the trip starts is the departure of the EARLIEST
 * OUTBOUND segment by its stated departureTime; the route is the first outbound
 * segment's origin to the last outbound segment's destination, and the carrier
 * is the first outbound segment's marketing carrier. Segments the vendor has not
 * marked OUTBOUND, or has not dated, are not guessed at.
 *
 * Pure over ports, so node:test drives every branch without a database or a
 * provider, and the retro script (scripts/lane-01-retro-flights.ts) and the book
 * route wire the same function to the real ones.
 */
import { flightStatedCalendarDecision, writeBookingCalendarEvent, type BookingCalendarPort } from '../calendar/bookingEvent';
import { flightDisplayName, reservationIdentity } from './lane';
import { flightProviderStatusToReservation, type MappedReservationStatus } from './flightStatus';

/** One segment, as the vendor states it — null where the field was not carried. */
export interface FlightBookingSegmentStated {
  departureTime: string | null;
  direction: string | null;
  originCode: string | null;
  destinationCode: string | null;
  carrierName: string | null;
  flightNumber: string | null;
}

/** GET /flights/bookings/{bookingId}, the three things this function reads from it. */
export interface FlightBookingStated {
  bookingId: string;
  status: string | null;
  segments: FlightBookingSegmentStated[];
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
}

export interface FlightRefreshPorts {
  /** The vendor call. Throws on any failure — the throw is caught here and named. */
  fetchBooking(bookingId: string): Promise<FlightBookingStated>;
  /** The CAL-01 calendar port (prismaBookingCalendar in production). */
  calendar: BookingCalendarPort;
  /** ONE write of the fields that changed; called only when something did. */
  writeReservation(id: string, patch: { displayName?: string; status?: MappedReservationStatus }): Promise<void>;
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
  if (stated.segments.length === 0) {
    return {
      fetched: false,
      reason: `reservation ${row.id}: GET /flights/bookings/${row.providerBookingId} answered with no segments — no row, no rename, no status change`,
    };
  }

  // ── THE OUTBOUND, from stated fields only ──────────────────────────────────
  const outbound = stated.segments
    .filter((s) => s.direction === 'OUTBOUND' && typeof s.departureTime === 'string' && s.departureTime.length > 0)
    .sort((a, b) => (a.departureTime as string).localeCompare(b.departureTime as string));
  if (outbound.length === 0) {
    return {
      fetched: false,
      reason: `reservation ${row.id}: GET /flights/bookings/${row.providerBookingId} states ${stated.segments.length} segment(s) but none marked OUTBOUND with a departureTime — no row, no rename, no status change`,
    };
  }
  const first = outbound[0];
  const last = outbound[outbound.length - 1];
  const departureTime = first.departureTime as string;

  // ── THE NAME ───────────────────────────────────────────────────────────────
  const statedName = flightDisplayName({ carrierName: first.carrierName, originCode: first.originCode, destinationCode: last.destinationCode });
  const patch: { displayName?: string; status?: MappedReservationStatus } = {};
  let name: 'set' | 'unchanged' | 'not_stated';
  if (statedName === null) name = 'not_stated';
  else if (statedName === row.displayName) name = 'unchanged';
  else { name = 'set'; patch.displayName = statedName; }

  // ── THE STATUS — the vendor's, through the one mapping, or unchanged ───────
  const mapped = flightProviderStatusToReservation(stated.status);
  let status: 'set' | 'unchanged' | 'unmapped';
  if (mapped === null) status = 'unmapped';
  else if (mapped === row.status) status = 'unchanged';
  // CANCEL-01 (2026-09-26): a cancel the airline ACCEPTED but has not finalized
  // (a 202) leaves the vendor's status CONFIRMED; that word must not flip the row
  // back from 'cancel_pending' to 'confirmed'. The row waits for CANCELLED /
  // CANCELLED_WITH_CHARGES. Resolving a 202 — the final status AND its money
  // facts (money_events) — is item 3's webhook receiver and scheduled refresh,
  // NOT this PR: this guard only keeps the refresh from undoing a request.
  else if (row.status === 'cancel_pending' && mapped === 'confirmed') status = 'unchanged';
  else { status = 'set'; patch.status = mapped; }

  if (patch.displayName !== undefined || patch.status !== undefined) {
    await ports.writeReservation(row.id, patch);
  }

  // ── THE DAY — the CAL-01 row, keyed on the reservation, written once ───────
  const nameForRow = statedName ?? reservationIdentity({ ...row, displayName: row.displayName }).name;
  const outcome = await writeBookingCalendarEvent(
    ports.calendar,
    flightStatedCalendarDecision({ reservationId: row.id, userId: row.userId, name: nameForRow, departureTime }),
  );

  return {
    fetched: true,
    providerStatus: stated.status,
    calendar: outcome.landed,
    calendarReason: outcome.landed === 'no_row' ? outcome.reason : null,
    day: outcome.landed === 'no_row' ? null : departureTime.slice(0, 10),
    name,
    nameValue: statedName,
    status,
    statusValue: patch.status ?? row.status,
  };
}
