import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

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
    // BUDGET DATA - From budget_line_items (trip source)
    // ═══════════════════════════════════════════════════════════════════
    const items = await prisma.budget_line_items.findMany({
      where: {
        userId: user.id,
        year: year,
        source: 'trip'
      },
      include: {
        trip: {
          select: { name: true, destination: true, startDate: true }
        }
      }
    });

    // COA code to name mapping
    const COA_NAMES: Record<string, string> = {
      'P-7100': '✈️ Flight',
      'P-7200': '🏨 Lodging',
      'P-7300': '🚗 Transportation',
      'P-7400': '🎟️ Activities',
      'P-7500': '🎿 Equipment',
      'P-7600': '🚕 Ground Transport',
      'P-7700': '🍽️ Food & Dining',
      'P-7800': '💵 Tips & Misc',
      'P-8220': '💼 Business Dev',
    };

    // Aggregate budget by COA and month
    const budgetData: Record<string, Record<number, number>> = {};
    let budgetGrandTotal = 0;

    for (const item of items) {
      const coa = item.coaCode || 'P-7800';
      const month = item.month - 1; // 0-indexed
      const amount = Number(item.amount || 0);

      if (!budgetData[coa]) {
        budgetData[coa] = {};
      }
      budgetData[coa][month] = (budgetData[coa][month] || 0) + amount;
      budgetGrandTotal += amount;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTUALS DATA - From transactions with trip COA codes (P-7xxx)
    // SECURITY: Scoped to user's accounts only
    // ═══════════════════════════════════════════════════════════════════
    const tripCodes = Object.keys(COA_NAMES);
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await prisma.transactions.findMany({
      where: {
        accounts: { userId: user.id },
        accountCode: { in: tripCodes },
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
      const coa = txn.accountCode || 'P-7800';
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
      actualGrandTotal,
      // Legacy support
      monthlyData: budgetData,
      grandTotal: budgetGrandTotal
    });
  } catch (error) {
    console.error('Nomad budget error:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}
