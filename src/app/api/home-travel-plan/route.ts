import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { readBudgetChart } from '@/lib/budget/reportReads';
import { TravelPlanError, travelPlanOf, travelPlanQuery } from '@/lib/home/travelPlan';

/**
 * HOME-LEDGER-02a (Alex, 2026-11-07, ruling B) — GET /api/home-travel-plan?year=YYYY: the caller's trip budget lines for
 * one year, one row each, never summed — THE TRAVEL PLAN under HOME LEDGER · MONTH on /home. READ-ONLY: this route
 * writes nothing. A NEW route, never a Budget file: Budget's files may not read budget_line_items (the budget report
 * route law, clause 2), so the lines come through here and src/lib/home/travelPlan.ts alone.
 *
 * THE GATE: the cart-plan order — a verified cookie or 401, the user or 404 — before any other read. GET is the only
 * method; the path is not public (src/middleware.ts PUBLIC_PATHS: an unsigned call is sent to '/').
 *
 * THE QUERY: ?year= is the year the month table shows (the day card's year on /home) — required and four digits, or 400
 * by name (travelPlan.ts travelPlanQuery); nothing is defaulted.
 *
 * THE READS, every one the caller's own: the viewer's books and their chart as the budget report reads them
 * (reportReads.ts readBudgetChart — ACCOUNT NAME is matched there), and budget_line_items where userId is the caller's,
 * source is 'trip' and year is the year asked for — with trips.name through the relation (null when the trip is gone).
 * The amount travels as the Decimal's text; the leaf reads it as cents and refuses one that is not whole cents by name.
 *
 * FAIL LOUD. A bad year → 400 naming it. The leaf refusing a row (TravelPlanError) → 500 with the words. Anything else →
 * failClosedResponse. Never a blank 200: the answer always carries its rows list and its year.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const query = travelPlanQuery(request.nextUrl.searchParams.get('year'));
    if (!query.ok) return NextResponse.json({ error: 'Validation', field: query.field, message: query.message }, { status: 400 });
    const { year } = query;

    const entities = await prisma.entities.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, entity_type: true },
      orderBy: { name: 'asc' },
    });
    const entityIds = entities.map((e) => e.id);

    const [chart, lines] = await Promise.all([
      readBudgetChart(prisma, user.id, entityIds),
      // The caller's trip budget lines for the year — source 'trip', never another; the trip's name through the relation.
      prisma.budget_line_items.findMany({
        where: { userId: user.id, source: 'trip', year: Number(year) },
        select: { id: true, coaCode: true, year: true, month: true, amount: true, description: true, tripId: true, trip: { select: { name: true } } },
        orderBy: [{ month: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return NextResponse.json(travelPlanOf({
      year,
      books: entities.map((e) => ({ id: e.id, name: e.name, entityType: e.entity_type })),
      chart: chart.map((a) => ({ entityId: a.entity_id, code: a.code, name: a.name, accountType: a.account_type, balanceType: a.balance_type })),
      lines: lines.map((l) => ({
        id: l.id,
        coaCode: l.coaCode,
        year: l.year,
        month: l.month,
        amount: l.amount.toString(),
        description: l.description,
        tripId: l.tripId,
        tripName: l.trip === null ? null : l.trip.name,
      })),
    }));
  } catch (error) {
    if (error instanceof TravelPlanError) {
      return NextResponse.json({ error: 'home-travel-plan', message: error.message }, { status: 500 });
    }
    return failClosedResponse('home-travel-plan', 'Could not read the trip budget lines', error);
  }
}
