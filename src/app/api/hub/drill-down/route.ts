import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const coaCodes = searchParams.get('coaCodes')?.split(',').filter(Boolean);
    const month = parseInt(searchParams.get('month') || '');
    const year = parseInt(searchParams.get('year') || '');
    const entityType = searchParams.get('entityType') || 'personal';

    if (!coaCodes?.length || isNaN(month) || isNaN(year)) {
      return NextResponse.json(
        { error: 'coaCodes, month, and year are required' },
        { status: 400 }
      );
    }

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

    // month is 0-indexed from frontend, EXTRACT(MONTH) is 1-based
    const dbMonth = month + 1;

    // Entity type mapping: business section uses sole_prop
    const entityTypes = entityType === 'sole_prop'
      ? ['sole_prop', 'business']
      : [entityType];

    const rows: Array<{
      amount: string;
      entry_type: string;
      date: Date;
      description: string;
      source_id: string | null;
      code: string;
      account_name: string;
      merchant_name: string | null;
      transaction_name: string | null;
    }> = await prisma.$queryRaw`
      SELECT
        le.amount::text,
        le.entry_type,
        je.date,
        je.description,
        je.source_id,
        coa.code,
        coa.name as account_name,
        t."merchantName" as merchant_name,
        t.name as transaction_name
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      JOIN entities e ON coa.entity_id = e.id
      LEFT JOIN transactions t ON je.source_id = t."transactionId"
      WHERE je."userId" = ${user.id}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND EXTRACT(YEAR FROM je.date) = ${year}
        AND EXTRACT(MONTH FROM je.date) = ${dbMonth}
        AND coa.code IN (${Prisma.join(coaCodes)})
        AND e.entity_type IN (${Prisma.join(entityTypes)})
        AND le.entry_type = 'D'
      ORDER BY je.date DESC, je.created_at DESC
    `;

    const transactions = rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      merchant: row.merchant_name || row.description,
      description: row.transaction_name || row.description,
      amount: Math.round(Number(row.amount) / 100 * 100) / 100, // cents → dollars
      coaCode: row.code,
      coaName: row.account_name,
    }));

    const total = Math.round(transactions.reduce((s, t) => s + t.amount, 0) * 100) / 100;

    return NextResponse.json({
      transactions,
      total,
      count: transactions.length,
      meta: { coaCodes, month, year },
    });
  } catch (error) {
    console.error('Drill-down error:', error);
    return NextResponse.json({ error: 'Failed to fetch drill-down' }, { status: 500 });
  }
}
