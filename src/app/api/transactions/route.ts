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

    const transactions = await prisma.transactions.findMany({
      where: {
        accounts: {
          userId: user.id
        }
      },
      include: {
        accounts: {
          select: {
            name: true,
            type: true,
            plaid_items: {
              select: {
                institutionName: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Transform to match component expectations
    const transformedTransactions = transactions.map(txn => ({
      ...txn,
      account: txn.accounts ? {
        name: txn.accounts.name,
        type: txn.accounts.type,
        plaidItem: txn.accounts.plaid_items ? {
          institutionName: txn.accounts.plaid_items.institutionName
        } : null
      } : null,
      predictedCoaCode: txn.predicted_coa_code,
      predictionConfidence: txn.prediction_confidence,
      accounts: undefined,
      predicted_coa_code: undefined,
      prediction_confidence: undefined
    }));

    return NextResponse.json(transformedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
