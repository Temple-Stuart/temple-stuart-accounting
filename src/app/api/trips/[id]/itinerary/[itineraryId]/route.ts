/**
 * PATCH /api/trips/[id]/itinerary/[itineraryId]
 *
 * Inline time-edit for a committed itinerary block. Writes EXISTING columns only
 * (no schema change): block_start_time / block_end_time (@db.Time), and — for
 * ONCE rows — date (homeDate + destDate, kept same-day). Sibling pattern of
 * /api/operations/daily-plan/blocks/[blockId] (auth → load authorized → validate
 * → update → writeAuditLog). Trip ownership via trip.userId; cross-user is 404
 * (non-disclosure), never 403.
 *
 * Body (all optional; absent key = leave column untouched):
 *   blockStartTime: 'HH:MM' | null   — null clears (row → no-time lane)
 *   blockEndTime:   'HH:MM' | null
 *   date:           'YYYY-MM-DD'      — ONCE rows only (move between days)
 *
 * PR-Ledger-Edit-Times — the ledger's inline Start/End date+time cells:
 *   startTime: 'HH:MM' | null  — writes homeTime (the ledger's Start time) AND keeps
 *                                block_start_time in sync (same clock for the calendar)
 *   endTime:   'HH:MM' | null  — writes destTime + block_end_time
 *   startDate: 'YYYY-MM-DD'    — writes homeDate (independent; allows a real range,
 *                                unlike the same-day `date` key above)
 *   endDate:   'YYYY-MM-DD'    — writes destDate
 *
 * Times use parseTimeOrNull (the canonical @db.Time serializer); malformed → 400.
 * Overnight windows (end < start, e.g. 22:00→07:00) are VALID — no end>start check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { parseTimeOrNull } from '@/lib/operations/parseTime';

/** YYYY-MM-DD → UTC-midnight Date, or null if malformed. */
function parseDayUtc(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A ledger time field: validates HH:MM(:SS), returns the HH:MM string (for the VarChar
 *  homeTime/destTime the ledger reads) plus the parsed @db.Time (for the paired block_*).
 *  '' / null clears both. Malformed → a 400 response in `.error`. */
function parseLedgerTime(
  v: unknown,
  field: string,
): { str: string | null; block: Date | null; error?: NextResponse } {
  if (v === null || v === '') return { str: null, block: null };
  if (typeof v !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    return {
      str: null,
      block: null,
      error: NextResponse.json({ error: 'Validation', field, message: `${field} must be HH:MM` }, { status: 400 }),
    };
  }
  const r = parseTimeOrNull(v, field);
  if (r.error) return { str: null, block: null, error: r.error };
  return { str: v.slice(0, 5), block: r.value };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itineraryId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: tripId, itineraryId } = await params;

    // Trip ownership — cross-user is 404 (non-disclosure).
    const trip = await prisma.trips.findFirst({ where: { id: tripId, userId: user.id }, select: { id: true } });
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = await prisma.trip_itinerary.findFirst({ where: { id: itineraryId, tripId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Prisma.trip_itineraryUpdateInput = {};

    // ── block_start_time / block_end_time (HH:MM | null) ──────────────────────
    if (body.blockStartTime !== undefined) {
      const r = parseTimeOrNull(body.blockStartTime, 'blockStartTime');
      if (r.error) return r.error; // malformed → 400, never coerced
      data.block_start_time = r.value; // null clears → no-time lane
    }
    if (body.blockEndTime !== undefined) {
      const r = parseTimeOrNull(body.blockEndTime, 'blockEndTime');
      if (r.error) return r.error;
      data.block_end_time = r.value;
    }
    // Overnight windows are intentionally allowed — NO end>start validation.

    // ── date (ONCE rows only) ────────────────────────────────────────────────
    if (body.date !== undefined) {
      if (existing.recurrence === 'daily') {
        return NextResponse.json(
          { error: 'Validation', field: 'date', message: 'daily rows cannot be moved to a single day — edit times only' },
          { status: 400 }
        );
      }
      const d = parseDayUtc(body.date);
      if (!d) {
        return NextResponse.json(
          { error: 'Validation', field: 'date', message: 'date must be a valid YYYY-MM-DD' },
          { status: 400 }
        );
      }
      // ONCE rows keep homeDate and destDate on the same day.
      data.homeDate = d;
      data.destDate = d;
    }

    // ── PR-Ledger-Edit-Times: the ledger's Start/End date+time cells ─────────────
    // startTime/endTime write the VarChar homeTime/destTime the ledger DISPLAYS, and
    // keep the paired @db.Time block_start_time/block_end_time in sync (same clock).
    if (body.startTime !== undefined) {
      const t = parseLedgerTime(body.startTime, 'startTime');
      if (t.error) return t.error;
      data.homeTime = t.str;
      data.block_start_time = t.block;
    }
    if (body.endTime !== undefined) {
      const t = parseLedgerTime(body.endTime, 'endTime');
      if (t.error) return t.error;
      data.destTime = t.str;
      data.block_end_time = t.block;
    }
    // startDate/endDate move homeDate/destDate INDEPENDENTLY (a real check-in→check-out
    // span), unlike the same-day `date` key above.
    if (body.startDate !== undefined) {
      const d = parseDayUtc(body.startDate);
      if (!d) return NextResponse.json({ error: 'Validation', field: 'startDate', message: 'startDate must be a valid YYYY-MM-DD' }, { status: 400 });
      data.homeDate = d;
    }
    if (body.endDate !== undefined) {
      const d = parseDayUtc(body.endDate);
      if (!d) return NextResponse.json({ error: 'Validation', field: 'endDate', message: 'endDate must be a valid YYYY-MM-DD' }, { status: 400 });
      data.destDate = d;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Validation', message: 'no editable fields supplied' }, { status: 400 });
    }

    const updated = await prisma.trip_itinerary.update({ where: { id: itineraryId }, data });

    // NOTE: no writeAuditLog here. The trip domain has no AuditActionType enum
    // value (it's a Prisma enum — adding one is a schema change, out of scope for
    // this PR), and the trip-side siblings (vendor-commit, itinerary GET) don't
    // audit either. Matching them rather than fabricating a mismatched action type.
    return NextResponse.json({ itinerary: updated });
  } catch (error) {
    console.error('[Trip Itinerary PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update itinerary block', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
