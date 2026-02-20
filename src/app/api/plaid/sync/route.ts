import { requireTier } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

export async function POST(request: NextRequest) {
  try {
    // Verify user
    const userEmail = await getVerifiedEmail();
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tierGate = requireTier(user.tier, 'plaid');
    if (tierGate) return tierGate;

    const { itemId } = await request.json();
    
    // Verify user owns this item
    const item = await prisma.plaid_items.findFirst({
      where: { 
        id: itemId,
        userId: user.id 
      }
    });

    if (!item?.accessToken) {
      return NextResponse.json({ error: 'Item not found or unauthorized' }, { status: 400 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Sync transactions
    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: item.accessToken,
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });

    const transactions = transactionsResponse.data.transactions;
    const accounts = transactionsResponse.data.accounts;

    // Update accounts
    for (const account of accounts) {
      await prisma.accounts.upsert({
        where: { accountId: account.account_id },
        update: {
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
        },
        create: {
          id: `acct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          updatedAt: new Date(),
          accountId: account.account_id,
          plaidItemId: item.id,
          userId: user.id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype || '',
          mask: account.mask,
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
        },
      });
    }

    // Upsert transactions
    for (const txn of transactions) {
      const account = await prisma.accounts.findUnique({
        where: { accountId: txn.account_id }
      });
      
      if (account) {
        await prisma.transactions.upsert({
          where: { transactionId: txn.transaction_id },
          update: {
            amount: txn.amount,
            date: new Date(txn.date),
            name: txn.name,
            merchantName: txn.merchant_name,
            category: txn.category?.[0] || null,
            pending: txn.pending,
          },
          create: {
          id: `acct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          updatedAt: new Date(),
            transactionId: txn.transaction_id,
            accountId: account.id,
            amount: txn.amount,
            date: new Date(txn.date),
            name: txn.name,
            merchantName: txn.merchant_name,
            category: txn.category?.[0] || null,
            pending: txn.pending,
          },
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      synced: transactions.length 
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
