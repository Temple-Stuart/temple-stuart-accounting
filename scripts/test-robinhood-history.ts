import { PrismaClient } from '@prisma/client';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const prisma = new PrismaClient();
const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

async function testRobinhoodHistory() {
  const item = await prisma.plaid_items.findFirst({
    where: { institutionName: 'Robinhood' }
  });

  if (!item) {
    console.log('No Robinhood item found');
    return;
  }

  console.log('Testing Robinhood transactions with 2-year history request...\n');

  try {
    // Request transactions going back 2 years
    const response = await plaidClient.transactionsGet({
      access_token: item.accessToken,
      start_date: '2023-01-01',
      end_date: new Date().toISOString().split('T')[0],
      options: {
        count: 500,
        offset: 0,
        include_personal_finance_category: true
      }
    });

    console.log('=== RESULTS ===');
    console.log('Total transactions available:', response.data.total_transactions);
    console.log('Transactions returned:', response.data.transactions.length);
    
    if (response.data.transactions.length > 0) {
      const dates = response.data.transactions.map(t => t.date).sort();
      console.log('Oldest transaction:', dates[0]);
      console.log('Newest transaction:', dates[dates.length - 1]);
      
      // Group by account
      const byAccount: Record<string, any[]> = {};
      response.data.transactions.forEach(t => {
        const acc = response.data.accounts.find(a => a.account_id === t.account_id);
        const name = acc?.name || t.account_id;
        if (!byAccount[name]) byAccount[name] = [];
        byAccount[name].push(t);
      });
      
      console.log('\n=== BY ACCOUNT ===');
      for (const [name, txns] of Object.entries(byAccount)) {
        const txnDates = txns.map(t => t.date).sort();
        console.log(`${name}: ${txns.length} txns (${txnDates[0]} to ${txnDates[txnDates.length-1]})`);
      }

      // Show sample transactions
      console.log('\n=== SAMPLE TRANSACTIONS (oldest 5) ===');
      response.data.transactions
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5)
        .forEach(t => {
          console.log(`${t.date} | $${t.amount} | ${t.name}`);
        });

      console.log('\n=== SAMPLE TRANSACTIONS (newest 5) ===');
      response.data.transactions
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .forEach(t => {
          console.log(`${t.date} | $${t.amount} | ${t.name}`);
        });
    }

    console.log('\n=== ACCOUNTS ===');
    response.data.accounts.forEach(acc => {
      console.log(`${acc.name} (${acc.type}/${acc.subtype}): $${acc.balances.current}`);
    });

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }

  await prisma.$disconnect();
}

testRobinhoodHistory();
