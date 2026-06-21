/**
 * GET /api/hub/operations-routines?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Expands every active routine's RRULE into individual occurrences inside
 * the given window. Used by the Hub calendar (PR-Ops-5.6) to render
 * recurring time-block routines as discrete dated entries — one tile per
 * occurrence — alongside the existing Operations one-time blocks and
 * other Hub sources.
 *
 * Auth mirrors /api/operations/routines/today: getVerifiedEmail + user
 * lookup; scoped to user.id; rrule expansion via shipped helpers; routine
 * start_date/end_date bounds applied per the same idiom as /today
 * (compare in the routine's local timezone). On-the-fly only — no
 * materialized routine_occurrences table.
 *
 * Performance guards (REQUIRED per PR-Ops-5.6 spec):
 *   - Window length capped at MAX_WINDOW_DAYS (92, ~one quarter). Reject
 *     larger windows with 400 — no silent narrowing.
 *   - Total occurrences across all routines capped at MAX_OCCURRENCES
 *     (500). When the cap is hit, response includes truncated: true so
 *     the caller can surface a warning (no silent drop — North Star).
 *
 * Routines with NO time component in their RRULE shouldn't exist
 * (compileFormToRRule always writes BYHOUR/BYMINUTE) but if a hand-
 * authored "custom" rrule omits BYHOUR, the occurrence still carries
 * a default time; the client renders the resulting HH:MM as-is.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { expandBetween } from '@/lib/operations/rruleHelpers';

const MAX_WINDOW_DAYS = 92;
const MAX_OCCURRENCES = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(s: string | null): Date | null {
  if (!s || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalDate(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const sp = request.nextUrl.searchParams;
    const from = parseDate(sp.get('from'));
    if (!from) {
      return NextResponse.json(
        { error: 'Validation', field: 'from', message: 'from is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const to = parseDate(sp.get('to'));
    if (!to) {
      return NextResponse.json(
        { error: 'Validation', field: 'to', message: 'to is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { error: 'Validation', field: 'to', message: 'to must be on or after from' },
        { status: 400 }
      );
    }
    const windowDays = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
    if (windowDays > MAX_WINDOW_DAYS) {
      return NextResponse.json(
        {
          error: 'Validation',
          field: 'to',
          message: `window must be <= ${MAX_WINDOW_DAYS} days (got ${windowDays})`,
        },
        { status: 400 }
      );
    }

    // Use end-of-day for `to` so the last day's occurrences are included.
    const windowEnd = new Date(to.getTime() + MS_PER_DAY - 1);

    const routines = await prisma.operations_routines.findMany({
      where: { user_id: user.id, is_active: true },
      orderBy: { name: 'asc' },
    });

    type RoutineWindowEntry = {
      routine_id: string;
      name: string;
      entity_id: string;
      timezone: string;
      start_time: string | null;
      end_time: string | null;
      occurrences: string[];
      // HB-4a budget bridge: the routine's per-occurrence budget + its COA, carried through so a
      // routine tile's detail panel can show them (the row already holds both — full fetch above).
      // Real values only — null stays null (a routine with no budget/COA is truthfully empty).
      coa_code: string | null;
      budget_amount: number | null;
    };

    const out: RoutineWindowEntry[] = [];
    let totalOccurrences = 0;
    let truncated = false;

    for (const r of routines) {
      if (totalOccurrences >= MAX_OCCURRENCES) {
        truncated = true;
        break;
      }

      // Apply routine's own start_date/end_date bounds (mirroring
      // /api/operations/routines/today/route.ts:124-135). The bounds
      // columns are @db.Date — compare in the routine's local timezone
      // via formatLocalDate, not UTC, to avoid edge-of-day off-by-ones.
      const fromLocal = formatLocalDate(from, r.timezone);
      const toLocal = formatLocalDate(windowEnd, r.timezone);
      // PR-Routine-EndDate: the routine's calendar end date. Formatted in UTC because the
      // @db.Date column stores the intended date at UTC midnight (the same idiom the coarse
      // skip already used). Reused for BOTH the coarse skip and the per-occurrence clamp below.
      const endDateStr = r.end_date ? formatLocalDate(r.end_date, 'UTC') : null;
      if (r.start_date) {
        const startDateStr = formatLocalDate(r.start_date, 'UTC');
        if (startDateStr > toLocal) continue; // routine starts after window
      }
      if (endDateStr && endDateStr < fromLocal) continue; // routine ended before window

      let occurrences: Date[] = [];
      try {
        occurrences = expandBetween(r.schedule_rrule, r.timezone, from, windowEnd);
      } catch (e) {
        // Skip malformed rrule rather than failing the whole request —
        // log so the gap is visible. Same idiom as /today endpoint.
        console.error(`[Hub Routines] RRULE expand failed for ${r.id}:`, e);
        continue;
      }

      // PR-Routine-EndDate: the RRULE carries no UNTIL, so expandBetween runs to windowEnd
      // regardless of the routine's end_date. Drop any occurrence whose LOCAL day (the day it
      // renders on — the SAME formatter the mapper uses to place the tile) is AFTER end_date.
      // Through end_date is inclusive (<=); a routine with no end_date keeps every occurrence.
      if (endDateStr) {
        occurrences = occurrences.filter(
          (occ) => formatLocalDate(occ, r.timezone) <= endDateStr
        );
      }

      // Cap per-routine if the global ceiling would be exceeded.
      const remaining = MAX_OCCURRENCES - totalOccurrences;
      const taken =
        occurrences.length > remaining ? occurrences.slice(0, remaining) : occurrences;
      if (occurrences.length > remaining) truncated = true;
      totalOccurrences += taken.length;

      if (taken.length === 0) continue;

      out.push({
        routine_id: r.id,
        name: r.name,
        entity_id: r.entity_id,
        timezone: r.timezone,
        start_time: r.start_time ? r.start_time.toISOString() : null,
        end_time: r.end_time ? r.end_time.toISOString() : null,
        occurrences: taken.map((d) => d.toISOString()),
        coa_code: r.coa_code,
        budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null,
      });
    }

    return NextResponse.json({ routines: out, truncated });
  } catch (error) {
    console.error('[Hub Routines GET]', error);
    return NextResponse.json(
      {
        error: 'Failed to load routines window',
        message: error instanceof Error ? error.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
