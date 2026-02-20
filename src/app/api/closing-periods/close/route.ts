import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { journalEntryService } from '@/lib/journal-entry-service';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { periodEnd, periodType } = await request.json();

    if (!periodEnd) {
      return NextResponse.json({ error: 'Period end date is required' }, { status: 400 });
    }

    // Check if period already closed for THIS user
    const existing = await prisma.closing_periods.findFirst({
      where: {
        periodEnd: new Date(periodEnd),
        status: 'closed',
        closedBy: user.id
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'This period is already closed' }, { status: 400 });
    }

    // SECURITY: Only this user's COA
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { userId: user.id, is_archived: false }
    });

    let revenue = 0;
    let expenses = 0;

    accounts.forEach(acc => {
      const balance = Number(acc.settled_balance) / 100;
      const type = acc.account_type.toLowerCase();
      
      if (type === 'revenue') revenue += balance;
      else if (type === 'expense') expenses += balance;
    });

    const netIncome = revenue - expenses;

    const lines = [];
    
    if (revenue !== 0) {
      const revenueAccount = accounts.find(a => a.account_type.toLowerCase() === 'revenue' && Number(a.settled_balance) !== 0);
      if (revenueAccount) {
        lines.push({
          accountCode: revenueAccount.code,
          entryType: 'D' as const,
          amount: Math.abs(Math.round(revenue * 100))
        });
      }
    }

    if (expenses !== 0) {
      const expenseAccount = accounts.find(a => a.account_type.toLowerCase() === 'expense' && Number(a.settled_balance) !== 0);
      if (expenseAccount) {
        lines.push({
          accountCode: expenseAccount.code,
          entryType: 'C' as const,
          amount: Math.abs(Math.round(expenses * 100))
        });
      }
    }

    const equityAccount = accounts.find(a => 
      a.code.includes('3130') || a.code.includes('3010')
    );

    if (equityAccount && netIncome !== 0) {
      lines.push({
        accountCode: equityAccount.code,
        entryType: netIncome > 0 ? 'C' as const : 'D' as const,
        amount: Math.abs(Math.round(netIncome * 100))
      });
    }

    let closingEntryId = null;

    if (lines.length >= 2) {
      const entry = await journalEntryService.createJournalEntry({
        date: new Date(periodEnd),
        description: `Closing entry for ${periodType} period ending ${periodEnd}`,
        lines
      });
      closingEntryId = entry.id;
    }

    const closingPeriod = await prisma.closing_periods.create({
      data: {
        id: randomUUID(),
        periodEnd: new Date(periodEnd),
        periodType,
        status: 'closed',
        closedAt: new Date(),
        closedBy: user.id,
        closingEntryId,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      periodId: closingPeriod.id,
      netIncome,
      closingEntryId,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Close period error:', error);
    return NextResponse.json({ error: 'Failed to close period' }, { status: 500 });
  }
}
