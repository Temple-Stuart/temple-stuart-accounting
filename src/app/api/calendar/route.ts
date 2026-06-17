import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;
    // PR-calendar-visible-range: optional explicit visible window (inclusive 'YYYY-MM-DD').
    // When present it takes precedence over month/year so a week/day spanning a month boundary
    // loads ALL its events. month + year modes are kept for the other caller (hub/page.tsx).
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    let events: any[];
    // PR-Calendar-Overlap-Fetch: the RETURNED events list uses a range-OVERLAP predicate so a
    // multi-day row (e.g. a hotel starting before the window) that SPANS into the window is
    // included — fixing the "vanishes in week 2" bug. The (dead, unused) summary below is scoped
    // separately to events that START in the window, preserving its original semantic so its
    // numbers stay honest rather than jumping with spanning rows. summaryEvents defaults to the
    // full set and is narrowed per mode.
    let summaryEvents: typeof events;
    // start_date (pg date) → 'YYYY-MM-DD' key; lexical compare on that == chronological.
    const startKeyOf = (e: { start_date: Date | string }): string => {
      const d = e.start_date instanceof Date ? e.start_date : new Date(e.start_date);
      return d.toISOString().slice(0, 10);
    };

    if (fromParam && toParam && DATE_RE.test(fromParam) && DATE_RE.test(toParam)) {
      // Overlap with the inclusive window [from, to]: starts on/before `to` AND (ends on/after
      // `from`, OR is a single-day row (null end) that starts within the window). Rows entirely
      // before (end < from) or entirely after (start > to) the window are excluded — bounded, no
      // catch-all.
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events
        WHERE user_id = ${user.id}
        AND start_date <= ${toParam}::date
        AND (end_date >= ${fromParam}::date OR (end_date IS NULL AND start_date >= ${fromParam}::date))
        ORDER BY start_date ASC
      `;
      summaryEvents = events.filter(e => { const k = startKeyOf(e); return k >= fromParam && k <= toParam; });
    } else if (month) {
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const endOfMonth = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      // Overlap with the half-open month [startOfMonth, endOfMonth): starts before month-end AND
      // (ends on/after month-start, OR is a single-day row starting in the month). Fixes a stay
      // spanning a MONTH boundary (e.g. Jun 28→Jul 5) vanishing from the month it spans into.
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events
        WHERE user_id = ${user.id}
        AND start_date < ${endOfMonth}::date
        AND (end_date >= ${startOfMonth}::date OR (end_date IS NULL AND start_date >= ${startOfMonth}::date))
        ORDER BY start_date ASC
      `;
      summaryEvents = events.filter(e => { const k = startKeyOf(e); return k >= startOfMonth && k < endOfMonth; });
    } else {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year + 1}-01-01`;

      // Overlap with the half-open year [startOfYear, endOfYear) — same shape as the month mode.
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events
        WHERE user_id = ${user.id}
        AND start_date < ${endOfYear}::date
        AND (end_date >= ${startOfYear}::date OR (end_date IS NULL AND start_date >= ${startOfYear}::date))
        ORDER BY start_date ASC
      `;
      summaryEvents = events.filter(e => { const k = startKeyOf(e); return k >= startOfYear && k < endOfYear; });
    }

    // Calculate totals by source — scoped to events that START in the window (summaryEvents), NOT
    // the widened overlap set, so the (currently unused) summary totals don't jump with spanning rows.
    const calcTotal = (source: string) => summaryEvents.filter(e => e.source === source).reduce((sum, e) => sum + Number(e.budget_amount || 0), 0);
    const calcCount = (source: string) => summaryEvents.filter(e => e.source === source).length;

    const homeTotal = calcTotal('home');
    const autoTotal = calcTotal('auto');
    const shoppingTotal = calcTotal('shopping');
    const personalTotal = calcTotal('personal');
    const healthTotal = calcTotal('health');
    const growthTotal = calcTotal('growth');
    const tripTotal = calcTotal('trip');

    return NextResponse.json({
      events,
      summary: {
        // Window-start scope (summaryEvents), consistent with calcTotal/calcCount — NOT the
        // widened overlap `events` list, so this count matches the per-source counts below.
        totalEvents: summaryEvents.length,
        homeTotal,
        autoTotal,
        shoppingTotal,
        personalTotal,
        healthTotal,
        growthTotal,
        tripTotal,
        grandTotal: homeTotal + autoTotal + shoppingTotal + personalTotal + healthTotal + growthTotal + tripTotal,
        homeCount: calcCount('home'),
        autoCount: calcCount('auto'),
        shoppingCount: calcCount('shopping'),
        personalCount: calcCount('personal'),
        healthCount: calcCount('health'),
        growthCount: calcCount('growth'),
        tripCount: calcCount('trip'),
      }
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
