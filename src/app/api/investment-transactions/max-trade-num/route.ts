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

    const result = await prisma.investment_transactions.findFirst({
      where: {
        tradeNum: { not: null },
        accounts: { userId: user.id }
      },
      orderBy: {
        tradeNum: 'desc'
      },
      select: {
        tradeNum: true
      }
    });

    const maxTradeNum = result?.tradeNum ? parseInt(result.tradeNum, 10) : 0;

    return NextResponse.json({ maxTradeNum });
  } catch (error) {
    console.error('Max trade num error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
