import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const investmentTxns = await prisma.investment_transactions.findMany({
      where: {
        account: {
          userId: user.id
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Return as direct array, not wrapped object
    return NextResponse.json(investmentTxns);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json([]);
  }
}
