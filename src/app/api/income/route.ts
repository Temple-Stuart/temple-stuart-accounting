import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * GET /api/income (RUNWAY-1)
 *
 * Income on the COMMITTED-LEDGER basis: SUM of ledger_entries credits
 * (entry_type='C') on revenue COAs (account_type='revenue'), scoped to the
 * authenticated user's posted, non-reversed journal entries — the SAME basis the
 * expense actuals use (year-calendar/route.ts:154-170), so expenses − income is a
 * TRUE single-basis net burn. Every income number traces to a real ledger revenue
 * credit (commitPlaidTransaction posts it: journal-entry-service.ts:108).
 *
 * NOT the `transactions` table, and NOT the module='income' filter (counted: 0
 * COAs have module='income'; the 9 real income COAs are account_type='revenue').
 * NO FALLBACK: an empty period returns honest zero — never reads `transactions`.
 *
 * Entity-scoped: `byEntity` splits income by entity_type (Personal/Business/Trading)
 * for per-entity net burn — additive; the existing shape (byCode/byMonth/summary/
 * recentTransactions) is preserved for the one consumer (income/page.tsx).
 */
export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── INCOME = ledger_entries revenue credits, committed + non-reversed, per
    //    (coa, entity, year, month). Mirrors the expense actuals query, but
    //    entry_type='C' + account_type='revenue'. le.amount is BigInt cents. ──
    const rows: Array<{
      code: string; name: string; entity_type: string; year: number; month: number; credits: string; cnt: number;
    }> = await prisma.$queryRaw`
      SELECT
        coa.code,
        coa.name,
        e.entity_type,
        EXTRACT(YEAR FROM je.date)::int  AS year,
        EXTRACT(MONTH FROM je.date)::int AS month,
        SUM(le.amount)::text             AS credits,
        COUNT(*)::int                    AS cnt
      FROM ledger_entries le
      JOIN journal_entries je   ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      JOIN entities e            ON coa.entity_id = e.id
      WHERE je."userId" = ${user.id}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'revenue'
        AND le.entry_type = 'C'
      GROUP BY coa.code, coa.name, e.entity_type, EXTRACT(YEAR FROM je.date), EXTRACT(MONTH FROM je.date)
    `;

    const cents = (s: string) => Math.round(Number(s) / 100 * 100) / 100; // cents → dollars

    const byCodeMap: Record<string, { name: string; total: number; count: number }> = {};
    const byMonthMap: Record<string, number> = {};
    const byEntityMap: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    let ytdTotal = 0;
    let allTimeTotal = 0;
    let transactionCount = 0;

    for (const r of rows) {
      const dollars = cents(r.credits);
      transactionCount += r.cnt;
      allTimeTotal += dollars;
      if (r.year === currentYear) ytdTotal += dollars;

      if (!byCodeMap[r.code]) byCodeMap[r.code] = { name: r.name, total: 0, count: 0 };
      byCodeMap[r.code].total += dollars;
      byCodeMap[r.code].count += r.cnt;

      const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`;
      byMonthMap[monthKey] = (byMonthMap[monthKey] || 0) + dollars;

      byEntityMap[r.entity_type] = (byEntityMap[r.entity_type] || 0) + dollars;
    }

    const monthCount = Object.keys(byMonthMap).length || 1;

    // ── recentTransactions = the 20 most recent income journal entries (id, date,
    //    description AS name, credit amount in dollars, COA code). ──
    const recentRows: Array<{ id: string; date: Date; name: string | null; amount: string; accountcode: string }> =
      await prisma.$queryRaw`
        SELECT
          je.id,
          je.date,
          je.description AS name,
          le.amount::text AS amount,
          coa.code AS accountcode
        FROM ledger_entries le
        JOIN journal_entries je   ON le.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON le.account_id = coa.id
        WHERE je."userId" = ${user.id}
          AND je.is_reversal = false
          AND je.reversed_by_entry_id IS NULL
          AND coa.account_type = 'revenue'
          AND le.entry_type = 'C'
        ORDER BY je.date DESC
        LIMIT 20
      `;

    return NextResponse.json({
      byCode: Object.entries(byCodeMap)
        .filter(([, d]) => d.total > 0)
        .map(([code, d]) => ({ code, ...d }))
        .sort((a, b) => b.total - a.total),
      byMonth: Object.entries(byMonthMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 })),
      summary: {
        ytdTotal: Math.round(ytdTotal * 100) / 100,
        allTimeTotal: Math.round(allTimeTotal * 100) / 100,
        monthlyAvg: Math.round((allTimeTotal / monthCount) * 100) / 100,
        transactionCount,
      },
      // RUNWAY-1: per-entity income (Personal/Business/Trading) for net burn. Additive.
      byEntity: Object.entries(byEntityMap)
        .map(([entityType, total]) => ({ entityType, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total),
      recentTransactions: recentRows.map((t) => ({
        id: t.id,
        date: t.date,
        name: t.name ?? '',
        amount: cents(t.amount), // positive dollars (the revenue credit magnitude)
        accountCode: t.accountcode,
      })),
    });
  } catch (error) {
    console.error('Income API error:', error);
    return NextResponse.json({ error: 'Failed to fetch income data' }, { status: 500 });
  }
}
