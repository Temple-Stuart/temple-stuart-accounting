import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// Extract the numeric portion from both "42" (legacy) and "OKTA-0042" (TICKER-XXXX) formats
function extractTradeNumber(tradeNum: string): number {
  const match = tradeNum.match(/-(\d+)$/);
  if (match) return parseInt(match[1], 10);
  const num = parseInt(tradeNum, 10);
  return isNaN(num) ? 0 : num;
}

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get all trade numbers and find the max numerically
    // Supports both legacy "42" and new "OKTA-0042" (TICKER-XXXX) formats
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
        const num = extractTradeNumber(r.tradeNum);
        if (num > maxTradeNum) {
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
