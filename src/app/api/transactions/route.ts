import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId },
      include: { accounts: true }
    });

    if (!plaidItems.length) {
      return NextResponse.json({ 
        transactions: [], 
        accounts: [],
        message: 'No connected accounts' 
      });
    }

    // Now fetch ALL columns including the new ones
    const transactions = await prisma.transactions.findMany({
      where: {
        accountId: {
          in: plaidItems.flatMap(item => 
            item.accounts.map(acc => acc.id)
          )
        }
      },
      orderBy: { date: 'desc' }
    });

    const mappedTransactions = transactions.map(txn => ({
      transaction_id: txn.transactionId,
      account_id: txn.accountId,
      amount: Number(txn.amount),
      date: txn.date.toISOString(),
      name: txn.name,
      merchant_name: txn.merchantName,
      category: Array.isArray(txn.category) ? txn.category : [],
      pending: txn.pending,
      institution_name: plaidItems.find(item => 
        item.accounts.some(acc => acc.id === txn.accountId)
      )?.institutionName,
      // Add all the new rich data fields
      personal_finance_category: txn.personal_finance_category,
      personal_finance_category_icon_url: txn.personal_finance_category_icon_url,
      counterparties: txn.counterparties,
      logo_url: txn.logo_url,
      website: txn.website,
      payment_channel: txn.payment_channel,
      location: txn.location,
      payment_meta: txn.payment_meta
    }));

    return NextResponse.json({ 
      transactions: mappedTransactions,
      accounts: plaidItems.flatMap(item => item.accounts),
      count: mappedTransactions.length
    });

  } catch (error: any) {
    console.error('Transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error.message },
      { status: 500 }
    );
  }
}
