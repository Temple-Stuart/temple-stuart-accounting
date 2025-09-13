import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { prisma } from '@/lib/prisma';

const configuration = new Configuration({
  basePath: process.env.PLAID_ENV === 'sandbox' 
    ? PlaidEnvironments.sandbox 
    : process.env.PLAID_ENV === 'development'
    ? PlaidEnvironments.development
    : PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export async function syncTransactions(accessToken: string, accountId?: string) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 24);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Fetching transactions from ${startDateStr} to ${endDateStr}`);

    let hasMore = true;
    let offset = 0;
    const allTransactions = [];
    
    while (hasMore) {
      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDateStr,
        end_date: endDateStr,
        options: {
          count: 500,
          offset: offset,
          account_ids: accountId ? [accountId] : undefined,
        },
      });

      allTransactions.push(...response.data.transactions);
      hasMore = response.data.total_transactions > allTransactions.length;
      offset += response.data.transactions.length;
      
      console.log(`Fetched ${allTransactions.length} of ${response.data.total_transactions} transactions`);
    }

    return {
      transactions: allTransactions,
      startDate: startDateStr,
      endDate: endDateStr,
      totalFetched: allTransactions.length,
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}
