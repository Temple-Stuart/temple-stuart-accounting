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
 *
 * CAL-02 (2026-09-27): a flight writes one row per stated segment, keyed
 * `${reservationId}:seg:${index}`. So:
 *   · insert writes the segment's stated clocks (start_time / end_time, "HH:MM"
 *     ::time — vendor-commit's own idiom) and its instants (start_at / end_at,
 *     null unless the stated value carries its offset); never a zone (nothing
 *     resolves an airport code to one);
 *   · rekey moves a pre-CAL-02 row from the bare reservation key to a segment's
 *     key and fields IN PLACE — its id, owner and status kept (a row already
 *     marked cancelled keeps its "Cancelled: " title);
 *   · markCancelled matches the bare key AND the `${key}:seg:` prefix, by
 *     left(...) = prefix — an exact prefix compare, no LIKE wildcard.
 */
import type { PrismaClient } from '@prisma/client';
import { CANCELLED_TITLE_PREFIX, SEGMENT_KEY_MARK, type BookingCalendarCancelPort, type BookingCalendarSegmentPort } from './bookingEvent';

type RawClient = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>;

export function prismaBookingCalendar(db: RawClient): BookingCalendarSegmentPort & BookingCalendarCancelPort {
  return {
    // CANCEL-01 (2026-09-26): mark, never delete — see markBookingCalendarCancelled.
    // Idempotent: a row already marked (title already prefixed) is left alone.
    // CAL-02 (2026-09-27): every row of the reservation — the bare key and each segment key.
    async markCancelled(source, sourceId) {
      const prefixed = `${CANCELLED_TITLE_PREFIX}%`;
      const segmentPrefix = `${sourceId}${SEGMENT_KEY_MARK}`;
      const count = await db.$executeRaw`
        UPDATE calendar_events
           SET title = ${CANCELLED_TITLE_PREFIX} || title, status = 'cancelled', updated_at = now()
         WHERE source = ${source} AND (source_id = ${sourceId} OR left(source_id, char_length(${segmentPrefix})) = ${segmentPrefix}) AND title NOT LIKE ${prefixed}
      `;
      return count;
    },
    // CAL-02 (2026-09-27): the same row, moved to a segment's key and fields — never a second row.
    async rekey(source, fromSourceId, row) {
      return db.$executeRaw`
        UPDATE calendar_events
           SET source_id = ${row.sourceId},
               title = CASE WHEN status = 'cancelled' THEN ${CANCELLED_TITLE_PREFIX} || ${row.title} ELSE ${row.title} END,
               icon = ${row.icon}, start_date = ${row.startDate}, end_date = ${row.endDate},
               start_time = ${row.startTime}::time, end_time = ${row.endTime}::time,
               start_at = ${row.startAt}, end_at = ${row.endAt}, updated_at = now()
         WHERE source = ${source} AND source_id = ${fromSourceId}
      `;
    },
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
      // CAL-02 (2026-09-27): a flight segment's STATED clocks and instants ride the
      // row (a stay's are null); still no zone and no duration.
      await db.$queryRaw`
        INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, end_date, start_time, end_time, start_at, end_at, is_recurring)
        VALUES (${row.userId}, ${row.source}, ${row.sourceId}, ${row.title}, 'reservation', ${row.icon}, 'amber', ${row.startDate}, ${row.endDate}, ${row.startTime}::time, ${row.endTime}::time, ${row.startAt}, ${row.endAt}, false)
      `;
    },
  };
}
