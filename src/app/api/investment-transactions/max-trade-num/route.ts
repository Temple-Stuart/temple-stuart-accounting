import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all trade numbers and find the max numerically
    // (tradeNum is stored as string, so we can't use orderBy for numeric sorting)
    const results = await prisma.investment_transactions.findMany({
      where: {
        tradeNum: { not: null },
        accounts: { userId: user.id }
      },
      select: {
        tradeNum: true
      },
      distinct: ['tradeNum']
    });

    let maxTradeNum = 0;
    for (const r of results) {
      if (r.tradeNum) {
        const num = parseInt(r.tradeNum, 10);
        if (!isNaN(num) && num > maxTradeNum) {
          maxTradeNum = num;
        }
      }
    }

    return NextResponse.json({ maxTradeNum });
  } catch (error) {
    console.error('Max trade num error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
