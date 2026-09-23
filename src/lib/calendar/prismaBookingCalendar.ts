/**
 * CAL-01 (2026-09-23) — the prisma side of BookingCalendarPort.
 *
 * Raw SQL, because calendar_events is written that way everywhere else
 * (trips/[id]/vendor-commit/route.ts:595) and this row must be the same shape as
 * the rows already on the grid.
 *
 * The lookup is on (source, source_id) — the pair idx_calendar_events_source
 * indexes (schema.prisma:1736). The index is NOT unique, so the check is done
 * here rather than relying on the database to refuse a duplicate.
 *
 * category and color match the source: a paid booking is not a planned trip item,
 * and the column a surface groups on should not say it is.
 */
import type { PrismaClient } from '@prisma/client';
import type { BookingCalendarPort } from './bookingEvent';

type RawClient = Pick<PrismaClient, '$queryRaw'>;

export function prismaBookingCalendar(db: RawClient): BookingCalendarPort {
  return {
    async find(source, sourceId) {
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM calendar_events WHERE source = ${source} AND source_id = ${sourceId} LIMIT 1
      `;
      return rows.length > 0;
    },
    async insert(row) {
      // The columns vendor-commit's writer sets, minus the ones a reservation has
      // no honest value for: no coa_code and no budget_amount (budget mapping is
      // DEFERRED by this ruling), no times or zones (a stay is an all-day span and
      // the property's clock is the itinerary's business, HOTEL-02), no duration.
      await db.$queryRaw`
        INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, end_date, is_recurring)
        VALUES (${row.userId}, ${row.source}, ${row.sourceId}, ${row.title}, 'reservation', ${row.icon}, 'amber', ${row.startDate}, ${row.endDate}, false)
      `;
    },
  };
}
