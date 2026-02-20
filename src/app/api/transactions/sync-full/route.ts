import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST() {
  try {
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

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    if (plaidItems.length === 0) {
      return NextResponse.json({ error: 'No connected accounts' }, { status: 400 });
    }

    let totalAdded = 0;
    let totalModified = 0;

    for (const item of plaidItems) {
      try {
        console.log(`Syncing full data for item ${item.id}...`);
        
        // Get transactions with all details
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 2 years
        
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            count: 500,
            include_personal_finance_category: true
          }
        });

        for (const txn of response.data.transactions) {
          const account = item.accounts.find(acc => acc.accountId === txn.account_id);
          if (!account) continue;

          const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Store ALL available fields
          const transactionData: any = {
            id: txnId,
            transactionId: txn.transaction_id,
            accountId: account.id,
            amount: txn.amount,
            date: new Date(txn.date),
            name: txn.name,
            merchantName: txn.merchant_name,
            category: txn.category ? txn.category.join(', ') : null,
            pending: txn.pending || false,
          };

          await prisma.transactions.upsert({
            where: { transactionId: txn.transaction_id },
            create: transactionData,
            update: {
              amount: txn.amount,
              date: new Date(txn.date),
              name: txn.name,
              merchantName: txn.merchant_name,
              category: txn.category ? txn.category.join(', ') : null,
              pending: txn.pending || false,
            }
          });
          totalAdded++;
        }
      } catch (error) {
        console.error('Error syncing item:', item.id, error);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        added: totalAdded,
        modified: totalModified,
        removed: 0
      }
    });
  } catch (error) {
    console.error('Full sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
