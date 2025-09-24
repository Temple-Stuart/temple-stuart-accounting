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

async function syncEverything() {
  const plaidItems = await prisma.plaid_items.findMany({
    include: { accounts: true }
  });

  for (const item of plaidItems) {
    console.log(`\nSyncing ${item.institutionName}...`);
    
    // Update account balances
    try {
      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: item.accessToken
      });
      
      for (const plaidAcc of balanceResponse.data.accounts) {
        const dbAccount = item.accounts.find(a => a.accountId === plaidAcc.account_id);
        if (dbAccount) {
          await prisma.accounts.update({
            where: { id: dbAccount.id },
            data: {
              currentBalance: plaidAcc.balances.current || 0,
              availableBalance: plaidAcc.balances.available || plaidAcc.balances.current || 0
            }
          });
          console.log(`  Updated ${plaidAcc.name}: $${plaidAcc.balances.current}`);
        }
      }
    } catch (e) {
      console.error('Balance error:', e.message);
    }
    
    // Sync investment transactions
    try {
      const investResponse = await plaidClient.investmentsTransactionsGet({
        access_token: item.accessToken,
        start_date: '2024-01-01',
        end_date: new Date().toISOString().split('T')[0]
      });
      
      console.log(`  Found ${investResponse.data.investment_transactions.length} trades`);
      
      for (const txn of investResponse.data.investment_transactions) {
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
      console.log(`  Synced ${investResponse.data.investment_transactions.length} trades`);
    } catch (e) {
      console.log('  No investment data or error:', e.message);
    }
  }
  
  await prisma.$disconnect();
  console.log('\nSync complete!');
}

syncEverything();
