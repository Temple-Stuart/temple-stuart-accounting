import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const transactions = await prisma.transactions.findMany({
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
      accountCode: txn.accountCode,
      subAccount: txn.subAccount,
      plaidAccountId: txn.plaidAccountId,
      account: txn.accounts ? {
        name: txn.accounts.name,
        type: txn.accounts.type,
        plaidItem: txn.accounts.plaid_items ? {
          institutionName: txn.accounts.plaid_items.institutionName
        } : null
      } : null
    }));

    return NextResponse.json({ transactions: transformedTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
