import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    
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

    // ═══════════════════════════════════════════════════════════════════
    // Get Business COA codes (B-xxxx prefix) — scoped to user
    // ═══════════════════════════════════════════════════════════════════
    const businessAccounts = await prisma.chart_of_accounts.findMany({
      where: {
        userId: user.id,
        code: { startsWith: 'B-' },
        account_type: 'expense',
        is_archived: false
      },
      select: { code: true, name: true }
    });

    // Build COA name mapping dynamically from database
    const COA_NAMES: Record<string, string> = {};
    businessAccounts.forEach(acc => {
      COA_NAMES[acc.code] = acc.name;
    });

    // If no business accounts exist yet, return empty data
    if (Object.keys(COA_NAMES).length === 0) {
      return NextResponse.json({
        year,
        budgetData: {},
        actualData: {},
        coaNames: {},
        budgetGrandTotal: 0,
        actualGrandTotal: 0
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUDGET DATA - From budget_line_items (business source)
    // ═══════════════════════════════════════════════════════════════════
    const items = await prisma.budget_line_items.findMany({
      where: {
        userId: user.id,
        year: year,
        source: 'business'
      }
    });

    // Aggregate budget by COA and month
    const budgetData: Record<string, Record<number, number>> = {};
    let budgetGrandTotal = 0;

    for (const item of items) {
      const coa = item.coaCode || 'B-6900';
      const month = item.month - 1; // 0-indexed
      const amount = Number(item.amount || 0);

      if (!budgetData[coa]) {
        budgetData[coa] = {};
      }
      budgetData[coa][month] = (budgetData[coa][month] || 0) + amount;
      budgetGrandTotal += amount;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTUALS DATA - From transactions with business COA codes (B-xxxx)
    // SECURITY: Scoped to user's accounts only
    // ═══════════════════════════════════════════════════════════════════
    const businessCodes = Object.keys(COA_NAMES);
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await prisma.transactions.findMany({
      where: {
        accounts: { userId: user.id },
        accountCode: { in: businessCodes },
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      select: {
        date: true,
        amount: true,
        accountCode: true
      }
    });

    // Aggregate actuals by COA and month
    const actualData: Record<string, Record<number, number>> = {};
    let actualGrandTotal = 0;

    for (const txn of transactions) {
      const coa = txn.accountCode || 'B-6900';
      const month = new Date(txn.date).getMonth();
      const amount = Math.abs(txn.amount);

      if (!actualData[coa]) {
        actualData[coa] = {};
      }
      actualData[coa][month] = (actualData[coa][month] || 0) + amount;
      actualGrandTotal += amount;
    }

    // Round actuals
    Object.keys(actualData).forEach(coa => {
      Object.keys(actualData[coa]).forEach(month => {
        actualData[coa][parseInt(month)] = Math.round(actualData[coa][parseInt(month)] * 100) / 100;
      });
    });

    return NextResponse.json({ 
      year, 
      budgetData,
      actualData,
      coaNames: COA_NAMES, 
      budgetGrandTotal,
      actualGrandTotal
    });
  } catch (error) {
    console.error('Business budget error:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}
