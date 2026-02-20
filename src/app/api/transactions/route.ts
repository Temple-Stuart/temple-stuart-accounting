import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Case-insensitive user lookup
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get transactions for accounts owned by this user
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
      personal_finance_category: txn.personal_finance_category,
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
