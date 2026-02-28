import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    // Aggregate ledger entries by COA account and month
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        coa.id,
        coa.code,
        coa.name,
        coa.account_type,
        coa.entity_id,
        e.name as entity_name,
        EXTRACT(MONTH FROM je.date)::int as month,
        SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END)::text as debits,
        SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)::text as credits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      LEFT JOIN entities e ON coa.entity_id = e.id
      WHERE je."userId" = ${user.id}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND EXTRACT(YEAR FROM je.date) = ${year}
      GROUP BY coa.id, coa.code, coa.name, coa.account_type,
               coa.entity_id, e.name, EXTRACT(MONTH FROM je.date)
      ORDER BY coa.account_type, coa.code, month
    `;

    // Get available years with ledger data
    const yearRows: any[] = await prisma.$queryRaw`
      SELECT DISTINCT EXTRACT(YEAR FROM date)::int as year
      FROM journal_entries
      WHERE "userId" = ${user.id}
        AND is_reversal = false
        AND reversed_by_entry_id IS NULL
      ORDER BY year DESC
    `;

    const accounts = rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      accountType: r.account_type,
      entityId: r.entity_id,
      entityName: r.entity_name,
      month: Number(r.month),
      debits: Number(r.debits),
      credits: Number(r.credits),
    }));

    const availableYears = yearRows.map(r => Number(r.year));

    return NextResponse.json({ accounts, availableYears });
  } catch (error) {
    console.error('Statements API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
