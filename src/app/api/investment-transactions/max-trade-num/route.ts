import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
