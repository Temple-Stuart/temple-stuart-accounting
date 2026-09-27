/**
 * CAL-02 (2026-09-27) — THE TWO EXPORTS' DECISIONS, OVER PORTS.
 *
 * GET /api/reservations/[id]/ics and GET /api/trips/[id]/ics are thin adapters
 * (src/lib/calendar/prismaIcsPorts.ts wires the reads); what they answer is
 * decided here, so node:test drives every branch without a database.
 *
 * THE HOUSE PATTERN (reservations/[id], receipt, budget-link): no verified email
 * → 401; no user row → 404; the booking by { id, userId: the caller } → 404 (the
 * defensive 404 — another user's booking and a GUEST booking, userId null, never
 * match, and neither is confirmed to exist); the trip by { id, userId } → 404.
 * Then the caller's own calendar rows for that booking — or for that trip's own
 * bookings — go through the ONE builder (src/lib/calendar/ics.ts). No row to export
 * (a booking with no stated day yet, a trip with no bookings) is a 404 BY NAME —
 * RFC 5545 §3.6 requires at least one component, and an empty file is not a calendar.
 *
 * READ-ONLY: the ports read; nothing here writes, calls a vendor, or reads a clock.
 */
import { buildIcs, type IcsRow } from './ics';

export interface IcsExportPorts {
  findUser(email: string): Promise<{ id: string } | null>;
  /** The caller's own reservation — { id, userId: the caller } — or null. */
  findReservation(id: string, userId: string): Promise<{ id: string } | null>;
  /** The caller's own trip — { id, userId: the caller } — or null. */
  findTrip(id: string, userId: string): Promise<{ id: string } | null>;
  /** The ids of the caller's own reservations on that trip. */
  tripReservationIds(tripId: string, userId: string): Promise<string[]>;
  /** The caller's calendar rows for these reservations — every bare and segment key (bookingCalendarRowsWhere). */
  calendarRows(reservationIds: string[], userId: string): Promise<IcsRow[]>;
}

export const ICS_EXPORT_WORDS = {
  unauthorized: 'Unauthorized',
  userNotFound: 'User not found',
  reservationNotFound: 'Reservation not found',
  tripNotFound: 'Trip not found',
  noRows: 'Nothing to add to a calendar yet — no day is stated for this booking.',
  noTripRows: 'Nothing to add to a calendar yet — no booking on this trip has a stated day.',
} as const;

export type IcsAnswer =
  | { status: 200; ics: string; filename: string; excluded: { id: string; reason: string }[] }
  | { status: 401 | 404; error: string };

async function caller(ports: IcsExportPorts, userEmail: string | null): Promise<{ id: string } | IcsAnswer> {
  if (!userEmail) return { status: 401, error: ICS_EXPORT_WORDS.unauthorized };
  const user = await ports.findUser(userEmail);
  if (!user) return { status: 404, error: ICS_EXPORT_WORDS.userNotFound };
  return user;
}

/** One booking's rows — a stay's one, a flight's one per stated segment. */
export async function reservationIcs(ports: IcsExportPorts, input: { userEmail: string | null; reservationId: string }): Promise<IcsAnswer> {
  const user = await caller(ports, input.userEmail);
  if ('status' in user) return user;
  const owned = await ports.findReservation(input.reservationId, user.id);
  if (!owned) return { status: 404, error: ICS_EXPORT_WORDS.reservationNotFound };
  const built = buildIcs(await ports.calendarRows([owned.id], user.id));
  if (built.events === 0) return { status: 404, error: ICS_EXPORT_WORDS.noRows };
  return { status: 200, ics: built.text, filename: `booking-${owned.id}.ics`, excluded: built.excluded };
}

/** Every row of the trip's own bookings. */
export async function tripIcs(ports: IcsExportPorts, input: { userEmail: string | null; tripId: string }): Promise<IcsAnswer> {
  const user = await caller(ports, input.userEmail);
  if ('status' in user) return user;
  const trip = await ports.findTrip(input.tripId, user.id);
  if (!trip) return { status: 404, error: ICS_EXPORT_WORDS.tripNotFound };
  const ids = await ports.tripReservationIds(trip.id, user.id);
  const built = buildIcs(ids.length === 0 ? [] : await ports.calendarRows(ids, user.id));
  if (built.events === 0) return { status: 404, error: ICS_EXPORT_WORDS.noTripRows };
  return { status: 200, ics: built.text, filename: `trip-${trip.id}.ics`, excluded: built.excluded };
}
