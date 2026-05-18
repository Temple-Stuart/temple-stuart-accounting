/**
 * /api/operations/routines/today
 *
 * GET — return today's strip: every active routine's expected occurrence
 *       within today's bounds (in the routine's timezone), hydrated with
 *       completion status and any miss audit row.
 *
 *       Response shape:
 *         {
 *           generated_at: string,
 *           entries: TodayRoutineEntry[]
 *         }
 *
 *       For each active routine:
 *         1. Expand RRULE in (todayStartLocal, todayEndLocal].
 *         2. Pick FIRST occurrence in that window (typical case: at most one
 *            per day; daily routines yield one, weekly routines yield 0 or 1).
 *         3. Look up completion at that expected_at → status='completed'.
 *         4. Else if expected_at + fail_threshold < now → status='missed'.
 *         5. Else if expected_at <= now → status='pending'.
 *         6. Else → status='upcoming'.
 *         7. Routines with NO occurrence today are excluded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { expandBetween } from '@/lib/operations/rruleHelpers';
import type { TodayStatus } from '@/components/workbench/operations/routines/types';

/**
 * Format a Date as YYYY-MM-DD in a specific timezone (the routine's timezone).
 * Used for comparing the routine's local calendar date against its DATE-typed bounds.
 */
function formatLocalDate(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    // Fallback for invalid timezone — use UTC.
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Compute today's start and end in the given timezone, returned as UTC Date.
 * Today's start is "00:00 in tz today"; today's end is "00:00 in tz tomorrow".
 */
function todayBounds(tz: string, now: Date): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const year = get('year');
  const month = get('month');
  const day = get('day');

  // Construct UTC midnight for the local date, then shift by the tz's
  // offset at that instant to get the actual UTC instant of local midnight.
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
  const fmt2 = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const partsAtUtcMidnight = fmt2.formatToParts(new Date(utcMidnight));
  const get2 = (type: string) => Number(partsAtUtcMidnight.find((p) => p.type === type)?.value ?? '0');
  const tzShown = Date.UTC(
    get2('year'), get2('month') - 1, get2('day'),
    get2('hour') === 24 ? 0 : get2('hour'), get2('minute'), get2('second')
  );
  const offsetMs = tzShown - utcMidnight;
  const localMidnightUtc = utcMidnight - offsetMs;

  return {
    start: new Date(localMidnightUtc),
    end: new Date(localMidnightUtc + 24 * 60 * 60 * 1000),
  };
}

export async function GET(_request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const now = new Date();

    const routines = await prisma.operations_routines.findMany({
      where: { user_id: user.id, is_active: true },
      orderBy: { name: 'asc' },
      include: {
        steps: { orderBy: { step_order: 'asc' } },
      },
    });

    const entries: Array<{
      routine: typeof routines[number];
      expected_at: string;
      status: TodayStatus;
      completion: unknown;
    }> = [];

    for (const r of routines) {
      const { start, end } = todayBounds(r.timezone, now);

      // Bounds check: routine is in scope today iff within [start_date, end_date].
      // Compute the routine's local calendar date for accurate comparison against
      // the timezone-naive @db.Date bounds columns.
      const localToday = formatLocalDate(now, r.timezone);
      if (r.start_date) {
        const startDateStr = formatLocalDate(r.start_date, 'UTC'); // @db.Date stored as midnight UTC
        if (startDateStr > localToday) {
          continue; // Routine hasn't started yet in its own timezone.
        }
      }
      if (r.end_date) {
        const endDateStr = formatLocalDate(r.end_date, 'UTC');
        if (endDateStr < localToday) {
          continue; // Routine has expired in its own timezone.
        }
      }

      let occurrences: Date[] = [];
      try {
        occurrences = expandBetween(r.schedule_rrule, r.timezone, start, end);
      } catch (e) {
        console.error(`[Today GET] RRULE parse failed for ${r.id}: ${e}`);
        continue;
      }

      if (occurrences.length === 0) continue;

      const expectedAt = occurrences[0];

      // Look up completion at this expected_at.
      const completion = await prisma.operations_routine_completions.findUnique({
        where: {
          routine_id_expected_at: {
            routine_id: r.id,
            expected_at: expectedAt,
          },
        },
      });

      let status: TodayStatus;
      if (completion) {
        status = 'completed';
      } else {
        const failThresholdMs = r.fail_threshold_minutes * 60 * 1000;
        if (now.getTime() > expectedAt.getTime() + failThresholdMs) {
          status = 'missed';
        } else if (expectedAt.getTime() <= now.getTime()) {
          status = 'pending';
        } else {
          status = 'upcoming';
        }
      }

      entries.push({
        routine: r,
        expected_at: expectedAt.toISOString(),
        status,
        completion,
      });
    }

    return NextResponse.json({
      generated_at: now.toISOString(),
      entries,
    });
  } catch (error) {
    console.error('[Today GET]', error);
    return NextResponse.json(
      { error: 'Failed to load today', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
