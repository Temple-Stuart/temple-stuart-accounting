import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';

export async function POST() {
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

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const item of plaidItems) {
      try {
        console.log(`Fetching transactions for item ${item.id}...`);
        
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const response = await plaidClient.transactionsSync({
            access_token: item.accessToken,
            count: 500,
            offset
          });

          const { added, modified, removed, has_more } = response.data;

          // Process added transactions
          for (const txn of added) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await prisma.transactions.upsert({
              where: { transactionId: txn.transaction_id },
              create: {
                id: txnId,
                transactionId: txn.transaction_id,
                accountId: account.id,
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category ? txn.category.join(', ') : null,
                pending: txn.pending || false,
                updatedAt: new Date()
              },
              update: {
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category ? txn.category.join(', ') : null,
                pending: txn.pending || false,
                updatedAt: new Date()
              }
            });
          }

          // Process modified transactions
          for (const txn of modified) {
            await prisma.transactions.updateMany({
              where: { transactionId: txn.transaction_id },
              data: {
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category ? txn.category.join(', ') : null,
                pending: txn.pending || false,
                updatedAt: new Date()
              }
            });
          }

          // Process removed transactions
          for (const txn of removed) {
            await prisma.transactions.deleteMany({
              where: { transactionId: txn.transaction_id }
            });
          }

          totalAdded += added.length;
          totalModified += modified.length;
          totalRemoved += removed.length;

          hasMore = has_more;
          offset += added.length + modified.length;
        }
      } catch (error) {
        console.error('Error syncing transactions for item:', item.id, error);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved
      }
    });
  } catch (error) {
    console.error('Transaction sync error:', error);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}
