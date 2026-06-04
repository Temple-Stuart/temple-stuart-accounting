/**
 * dayOrder — the ONE canonical "content day" ordering, shared by the S3 answer
 * timeline (DailyLog) and the DAY-TO-DAY RECORD grid (PieceGrid) so the two can
 * never drift (OPS-CE-8B).
 *
 * Alex's content day runs ~04:00 → past midnight. Early-morning times (00:00–03:59,
 * e.g. a Sleep scene or a 00:30 task block) belong to the END of the day, not the
 * start — so we ANCHOR the sort to DAY_START and wrap anything before it past +24h.
 *
 *   minute < DAY_START  →  minute + 1440  (sorts after the evening)
 *
 * Untimed scenes (no time_of_day) sink after all timed rows, ordered by step_order.
 * On a tie at the same minute, scenes sort before task blocks (the CE-6 rule).
 *
 * Pure presentation: no payload/route/schema change.
 */

/** 04:00 — the start of Alex's content day. */
export const DAY_START_MINUTE = 4 * 60;

/** Wrap an early-morning minute-of-day to the end of the content day. */
export function dayAnchoredMinute(minute: number): number {
  return minute < DAY_START_MINUTE ? minute + 1440 : minute;
}

/**
 * Minutes-of-day from a Prisma @db.Time value ("1970-01-01T07:30:00Z" → 450).
 * Returns null when there is no time (untimed scene).
 */
export function minuteOfDayFromTime(timeOfDay: string | null): number | null {
  if (!timeOfDay) return null;
  const m = timeOfDay.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes-of-day (LOCAL wall clock) from a Timestamptz instant (calendar block). */
export function minuteOfDayFromInstant(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** A row that can be ordered in the content day. */
export interface DayOrderRow {
  /** minute-of-day (0–1439) for a timed row, or null for an untimed scene. */
  minute: number | null;
  /** secondary key — step_order for scenes; the block's minute for tasks. */
  order: number;
  /** scenes sort before task blocks on a tie. */
  kind?: 'scene' | 'task';
}

/**
 * The shared comparator. Timed rows sort by their DAY-ANCHORED minute (midnight
 * wraps to day-end); untimed scenes sink to the end by step_order; ties keep
 * scenes before task blocks.
 */
export function compareDayOrder(a: DayOrderRow, b: DayOrderRow): number {
  if (a.minute == null && b.minute == null) return a.order - b.order;
  if (a.minute == null) return 1;
  if (b.minute == null) return -1;
  const ad = dayAnchoredMinute(a.minute);
  const bd = dayAnchoredMinute(b.minute);
  if (ad !== bd) return ad - bd;
  const ak = a.kind === 'task' ? 1 : 0;
  const bk = b.kind === 'task' ? 1 : 0;
  if (ak !== bk) return ak - bk;
  return a.order - b.order;
}
