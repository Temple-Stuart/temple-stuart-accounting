import type { PrismaClient } from '@prisma/client';
import { bookingCalendarRowsWhere } from '@/lib/calendar/bookingEvent';
import { bookingsSelectionOf, plannedSelectionOf, segmentsSelectionOf, type InstantRange } from '@/lib/operations/travelDay';

/**
 * READS-01a (Alex, 2026-11-07, ruling A) — THE TRAVEL-DAY READS, AS RANGE FUNCTIONS.
 *
 * The four reads GET /api/operations/travel-day ran inline (TRAVEL-01a, 01b) live here, verbatim, each taking the
 * database and the caller's id — the reportReads.ts idiom, `(db, userId, …)` — and the leaf's DayRange
 * (travelDay.ts). A day is a range, and so is a year: nothing in these four assumes one day, so SUPERSEDE-01's blocks
 * read builds on them (SUPERSEDE-00, decision 3). Server-side by use: routes and server reads call these; the client
 * is handed in, so the route keeps the gate and nothing here reads a cookie.
 *
 *   · readPlannedTravel     — the planner's rows through the trip's owner, by the day-blocks selection rule restated in
 *                             the leaf (plannedSelectionOf: once rows by homeDate in the range, daily rows spanning it),
 *                             PLANNED_SELECT — every trip_itinerary column the leaf hands over, as stored;
 *   · readBookingsOn        — the caller's reservations checking in or out in the range (bookingsSelectionOf; userId =
 *                             the caller: a guest row, userId null, is never returned), RESERVATION_SELECT;
 *   · readOwnReservationIds — the keys the segments are read through: every reservation of the caller's own;
 *   · readSegments          — the calendar_events rows of source 'reservation' in the range, read ONLY through
 *                             bookingCalendarRowsWhere over those ids (never by trip, never by source alone),
 *                             SEGMENT_SELECT.
 *
 * Every where names the caller (userId / user_id). READ-ONLY: nothing here writes; no vendor client, no paid call,
 * no `||`, no `?? <default>`. The route keeps its gate, dayRangeOf, its own per-id booking-fact reads (narrower than
 * the reservations answer's — READS-01c decides), travelDayOf and its answer.
 *
 * SUPERSEDE-01b (Alex, 2026-11-08, ruling A): the four take InstantRange (travelDay.ts — from/to alone): the travel-day
 * route still passes its DayRange, structurally the same; the blocks read (travelBlocksReads.ts) passes a span's.
 */

type Db = Pick<PrismaClient, 'trip_itinerary' | 'reservations' | 'calendar_events'>;

/** The reservation columns the one leaf reads (bookingRow.ts BookingRowReservation), plus the provider the card names. */
export const RESERVATION_SELECT = {
  id: true, lane: true, displayName: true, provider: true, providerConfirmationCode: true, providerBookingId: true,
  status: true, tripId: true, checkinDate: true, checkoutDate: true,
  ticketedAt: true, ticketLimitTime: true, cancelIntentAt: true, lastVendorReadAt: true,
  finalPriceCents: true, currency: true, createdAt: true,
} as const;

/** Every trip_itinerary column the leaf hands over, as stored. */
export const PLANNED_SELECT = {
  id: true, tripId: true, category: true, vendor: true, vendor_name: true, cost: true, coa_code: true, recurrence: true,
  homeDate: true, homeTime: true, destDate: true, destTime: true, duration_minutes: true,
  start_zone: true, end_zone: true, start_at: true, end_at: true, block_start_time: true, block_end_time: true,
  vendorOptionId: true, vendorOptionType: true, note: true,
} as const;

/** The calendar_events columns a segment row hands over, as stated. */
export const SEGMENT_SELECT = {
  source_id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true,
  start_at: true, end_at: true, start_zone: true, end_zone: true,
} as const;

/** 1. The planner's rows in the range, through the trip's owner. */
export function readPlannedTravel(db: Db, userId: string, range: InstantRange) {
  return db.trip_itinerary.findMany({ where: { trip: { userId: userId }, ...plannedSelectionOf(range) }, select: PLANNED_SELECT });
}

/** 2. The caller's bookings checking in or out in the range. */
export function readBookingsOn(db: Db, userId: string, range: InstantRange) {
  return db.reservations.findMany({ where: { userId: userId, ...bookingsSelectionOf(range) }, select: RESERVATION_SELECT });
}

/** 3. The keys the segments are read through: every reservation of the caller's own. */
export function readOwnReservationIds(db: Db, userId: string) {
  return db.reservations.findMany({ where: { userId: userId }, select: { id: true } });
}

/** 4. The segments in the range, read through the one where over the caller's reservation ids. */
export function readSegments(db: Db, userId: string, ids: readonly string[], range: InstantRange) {
  return db.calendar_events.findMany({
    where: { user_id: userId, ...bookingCalendarRowsWhere(ids), ...segmentsSelectionOf(range) },
    select: SEGMENT_SELECT,
  });
}
