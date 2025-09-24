require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const prisma = new PrismaClient();

const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

async function syncAllInvestmentTrades() {
  const plaidItems = await prisma.plaid_items.findMany({
    include: { accounts: true }
  });

  for (const item of plaidItems) {
    if (!item.accounts.some(a => a.type === 'investment')) continue;
    
    console.log(`\nSyncing ALL investment trades for ${item.institutionName}...`);
    
    let totalSynced = 0;
    let offset = 0;
    const batchSize = 100;
    
    while (true) {
      try {
        const response = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: '2023-01-01',
          end_date: new Date().toISOString().split('T')[0],
          options: {
            offset: offset,
            count: batchSize
          }
        });
        
        const trades = response.data.investment_transactions;
        
        if (trades.length === 0) break;
        
        for (const txn of trades) {
          const account = item.accounts.find(a => a.accountId === txn.account_id);
          if (!account) continue;
          
          await prisma.investment_transactions.upsert({
            where: { investment_transaction_id: txn.investment_transaction_id },
            create: {
              investment_transaction_id: txn.investment_transaction_id,
              accountId: account.id,
              amount: txn.amount,
              cancel_transaction_id: txn.cancel_transaction_id,
              date: new Date(txn.date),
              fees: txn.fees,
              iso_currency_code: txn.iso_currency_code,
              name: txn.name,
              price: txn.price,
              quantity: txn.quantity,
              security_id: txn.security_id,
              subtype: txn.subtype,
              type: txn.type,
              unofficial_currency_code: txn.unofficial_currency_code
            },
            update: {}
          });
        }
        
        totalSynced += trades.length;
        console.log(`  Synced ${totalSynced} of ${response.data.total_investment_transactions} trades...`);
        
        if (totalSynced >= response.data.total_investment_transactions) break;
        offset += batchSize;
        
      } catch (error) {
        console.error('Error:', error.message);
        break;
      }
    }
    
    console.log(`Total synced: ${totalSynced} investment trades`);
  }
  
  await prisma.$disconnect();
}

syncAllInvestmentTrades();
