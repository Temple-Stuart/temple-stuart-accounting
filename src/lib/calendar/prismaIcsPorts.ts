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
    calendarRows: async (reservationIds, userId) => {
      const rows = await prisma.calendar_events.findMany({
        where: { user_id: userId, ...bookingCalendarRowsWhere(reservationIds) },
        orderBy: [{ start_date: 'asc' }, { start_time: 'asc' }, { id: 'asc' }],
        select: { id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true, start_at: true, end_at: true },
      });
      if (rows.length === 0) return [];
      // LAW-02 (2026-09-27): DTSTAMP IS READ AS AN INSTANT, EXPLICITLY. calendar_events.
      // updated_at is `timestamp(6) WITHOUT time zone` (schema.prisma calendar_events),
      // filled only by the DATABASE's now() — every writer is raw SQL: the INSERTs take
      // the column default, the UPDATEs set updated_at = now() — so it holds the wall
      // clock of the session's TimeZone, which Prisma reads as if it were UTC. That is
      // UTC only when the server's TimeZone is UTC (Azure's setting: not verified). So
      // the instant is read here: updated_at AT TIME ZONE current_setting('TimeZone')
      // is the real timestamptz whatever the setting. A read, scoped to the caller.
      const stamps = await prisma.$queryRaw<Array<{ id: string; updated_at: Date | null }>>`
        SELECT id::text AS id, (updated_at AT TIME ZONE current_setting('TimeZone')) AS updated_at
          FROM calendar_events
         WHERE user_id = ${userId} AND id = ANY(${rows.map((r) => r.id)}::uuid[])
      `;
      const stampOf = new Map(stamps.map((st) => [st.id, st.updated_at]));
      // A row with no stamp read back carries NULL — the builder names it and exports no VEVENT for it.
      return rows.map((r) => ({ ...r, updated_at: stampOf.get(r.id) ?? null }));
    },
  };
}
