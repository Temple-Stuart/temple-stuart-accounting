import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { 
        email: { equals: userEmail, mode: 'insensitive' } 
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
