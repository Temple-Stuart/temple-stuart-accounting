import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const prisma = new PrismaClient();
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
    const { itemId } = await request.json();
    const item = await prisma.plaid_items.findUnique({
      where: { id: itemId }
    });

    if (!item?.accessToken) {
      return NextResponse.json({ error: 'No access token' }, { status: 400 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const txResponse = await plaidClient.transactionsSync({
      access_token: item.accessToken,
    });

    let addedCount = 0;

    for (const tx of txResponse.data.added) {
      const account = await prisma.accounts.findFirst({
        where: { accountId: tx.account_id }
      });
      
      if (account) {
        await prisma.transactions.upsert({
          where: { transactionId: tx.transaction_id },
          create: {
            id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            accountId: account.id,
            transactionId: tx.transaction_id,
            amount: tx.amount,
            date: new Date(tx.date),
            name: tx.name,
            merchantName: tx.merchant_name,
            category: tx.category?.join(', '),
            pending: tx.pending
          },
          update: {
            amount: tx.amount,
            pending: tx.pending
          }
        });
        addedCount++;
      }
    }

    const balances = await plaidClient.accountsBalanceGet({
      access_token: item.accessToken
    });

    for (const acc of balances.data.accounts) {
      await prisma.accounts.updateMany({
        where: { accountId: acc.account_id },
        data: {
          balance: acc.balances.current || 0,
          currentBalance: acc.balances.current || 0,
          availableBalance: acc.balances.available || 0
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      addedCount,
      updatedBalances: balances.data.accounts.length
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
