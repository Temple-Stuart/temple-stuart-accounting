import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get user from cookie
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only get transactions for accounts owned by this user
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

    const transformedTransactions = transactions.map(txn => ({
      id: txn.id,
      date: txn.date,
      name: txn.name,
      merchantName: txn.merchantName,
      amount: txn.amount,
      category: txn.category,
      accountId: txn.accountId,
      accountName: txn.accounts?.name,
      accountType: txn.accounts?.type,
      institutionName: txn.accounts?.plaid_items?.institutionName,
      accountCode: txn.accountCode,
      subAccount: txn.subAccount,
    }));

    return NextResponse.json({ transactions: transformedTransactions });
  } catch (error) {
    console.error('Transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
