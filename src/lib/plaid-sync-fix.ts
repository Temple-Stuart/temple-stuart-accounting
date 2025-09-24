import { prisma } from './prisma';
import { plaidClient } from './plaid';

export async function fixPlaidSync(userId: string) {
  try {
    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId }
    });

    let updatedCount = 0;

    for (const item of plaidItems) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: '2024-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        for (const plaidTxn of response.data.transactions) {
          await prisma.transactions.updateMany({
            where: { transactionId: plaidTxn.transaction_id },
            data: { 
              category: plaidTxn.category ? plaidTxn.category.join(', ') : null,
              merchantName: plaidTxn.merchant_name
            }
          });
          updatedCount++;
        }
      } catch (error) {
        console.error('Error fixing sync for item:', item.id, error);
      }
    }

    return { success: true, updatedCount };
  } catch (error) {
    console.error('Fix plaid sync error:', error);
    return { success: false, error };
  }
}
