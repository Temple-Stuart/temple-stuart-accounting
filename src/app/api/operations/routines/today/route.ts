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
 *
 * WEEK-01 (2026-09-30) — ONE DAY, ANY DAY; NOTHING DROPPED.
 *   ?date=YYYY-MM-DD (optional): each routine's day is that local date in its
 *   own zone; absent, today, as before. A date that is not a real day is a 400
 *   naming the field — never today instead. The day logic (the bounds, the
 *   start/end dates, the anchored expansion, the first occurrence, the status)
 *   lives in ONE pure module, src/lib/operations/routineDay.ts; this route keeps
 *   the auth, the reads and the response. A routine whose zone cannot be read,
 *   or whose schedule does not parse, is listed in `refused` with the day
 *   rules' words — every other routine is still answered:
 *         { generated_at, entries, refused: [{ routine_id, name, reason, detail }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { parseDayParam, routineDay, routineStatus, type RoutineDayRefusal } from '@/lib/operations/routineDay';
import type { TodayStatus } from '@/components/workbench/operations/routines/types';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // WEEK-01: the day asked for, or today — a bad day is refused by name.
    const asked = parseDayParam(request.nextUrl.searchParams.get('date'));
    if (!asked.ok) {
      return NextResponse.json({ error: 'Validation', field: 'date', message: asked.message }, { status: 400 });
    }

    const now = new Date();

    const routines = await prisma.operations_routines.findMany({
      where: { user_id: user.id, is_active: true },
      orderBy: { name: 'asc' },
      include: {
        // OPS-CE-1: today's strip shows only active steps; archived steps are
        // hidden but preserved (scene-row + logged takes survive in the DB).
        steps: { where: { is_active: true }, orderBy: { step_order: 'asc' } },
      },
    });

    const entries: Array<{
      routine: typeof routines[number];
      expected_at: string;
      status: TodayStatus;
      completion: unknown;
    }> = [];

    const refused: Array<{ routine_id: string; name: string; reason: RoutineDayRefusal; detail: string }> = [];

    for (const r of routines) {
      const day = routineDay(r, asked.day, now);
      if (day.kind === 'refused') {
        refused.push({ routine_id: r.id, name: r.name, reason: day.reason, detail: day.detail });
        continue;
      }
      if (day.kind === 'none') continue;

      const expectedAt = day.expectedAt;

      // Look up completion at this expected_at.
      const completion = await prisma.operations_routine_completions.findUnique({
        where: {
          routine_id_expected_at: {
            routine_id: r.id,
            expected_at: expectedAt,
          },
        },
      });

      const status: TodayStatus = routineStatus(expectedAt, completion !== null, r.fail_threshold_minutes, now);

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
      refused,
    });
  } catch (error) {
    return failClosedResponse('Today GET', 'Failed to load today', error);
  }
}
