/**
 * CAL-02 (2026-09-27) — the prisma side of IcsExportPorts. READS ONLY, every query
 * scoped to the caller: the user by verified email, the reservation and the trip by
 * { id, userId }, the trip's reservations by { tripId, userId }, and the calendar
 * rows by user_id AND the one where (bookingCalendarRowsWhere) — so a row keyed to
 * another user's booking never reaches an export, whatever its source_id says.
 */
import { prisma } from '@/lib/prisma';
import { bookingCalendarRowsWhere } from './bookingEvent';
import type { IcsExportPorts } from './icsExport';

export function prismaIcsPorts(): IcsExportPorts {
  return {
    findUser: (email) => prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
    findReservation: (id, userId) => prisma.reservations.findFirst({ where: { id, userId }, select: { id: true } }),
    findTrip: (id, userId) => prisma.trips.findFirst({ where: { id, userId }, select: { id: true } }),
    tripReservationIds: async (tripId, userId) => (await prisma.reservations.findMany({ where: { tripId, userId }, select: { id: true } })).map((r) => r.id),
    calendarRows: (reservationIds, userId) => prisma.calendar_events.findMany({
      where: { user_id: userId, ...bookingCalendarRowsWhere(reservationIds) },
      orderBy: [{ start_date: 'asc' }, { start_time: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true, start_at: true, end_at: true, updated_at: true },
    }),
  };
}
