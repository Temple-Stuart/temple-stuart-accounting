import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    let updated = 0;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 2 years

    for (const item of plaidItems) {
      let offset = 0;
      const count = 500;
      let totalTransactions = Infinity;
      const allTransactions: any[] = [];

      while (offset < totalTransactions) {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            count,
            offset,
            include_personal_finance_category: true
          }
        });

        allTransactions.push(...response.data.transactions);
        totalTransactions = response.data.total_transactions;
        offset += response.data.transactions.length;

        if (response.data.transactions.length === 0) break;
      }

      for (const txn of allTransactions) {
        const transaction: any = txn;

        await prisma.$executeRaw`
          UPDATE transactions
          SET
            personal_finance_category = ${JSON.stringify(transaction.personal_finance_category || null)}::jsonb,
            payment_channel = ${transaction.payment_channel || null},
            location = ${JSON.stringify(transaction.location || null)}::jsonb,
            "merchantName" = ${transaction.merchant_name || null}
          WHERE "transactionId" = ${transaction.transaction_id}
        `;
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `Updated ${updated} transactions with rich data!`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
