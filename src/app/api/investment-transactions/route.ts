import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const investmentTxns = await prisma.investment_transactions.findMany({
      where: {
        accounts: {
          userId: user.id
        }
      },
      include: {
        security: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    return NextResponse.json(investmentTxns);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json([]);
  }
}
