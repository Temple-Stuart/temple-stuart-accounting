const { PrismaClient } = require('@prisma/client');
const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid');

const prisma = new PrismaClient();

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

async function fullPlaidResync() {
  console.log('🔄 RE-SYNCING WITH FULL PLAID DATA');
  console.log('=' * 50);
  
  try {
    const items = await prisma.plaid_items.findMany({
      include: { accounts: true }
    });

    for (const item of items) {
      console.log(`\nRe-syncing ${item.institutionName}...`);
      
      try {
        // 1. Update account balances and details
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.accessToken
        });

        for (const plaidAccount of accountsResponse.data.accounts) {
          const dbAccount = item.accounts.find(acc => acc.accountId === plaidAccount.account_id);
          
          if (dbAccount) {
            await prisma.accounts.update({
              where: { id: dbAccount.id },
              data: {
                balance: plaidAccount.balances.current || 0,
                available_balance: plaidAccount.balances.available,
                currentBalance: plaidAccount.balances.current || 0,
                availableBalance: plaidAccount.balances.available,
                institutionName: item.institutionName
              }
            });
            console.log(`  ✅ Updated ${dbAccount.name}: $${plaidAccount.balances.current}`);
          }
        }

        // 2. Re-sync regular transactions with full data
        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: '2023-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        console.log(`  📊 Processing ${transactionsResponse.data.transactions.length} transactions...`);

        for (const txn of transactionsResponse.data.transactions) {
          const account = item.accounts.find(a => a.accountId === txn.account_id);
          if (!account) continue;

          await prisma.transactions.upsert({
            where: { transaction_id: txn.transaction_id },
            create: {
              transaction_id: txn.transaction_id,
              accountId: account.id,
              amount: txn.amount,
              name: txn.name,
              date: new Date(txn.date),
              merchant_name: txn.merchant_name || null,
              category: txn.category ? txn.category.join(', ') : null,
              location: txn.location ? JSON.stringify(txn.location) : null,
              payment_channel: txn.payment_channel,
              counterparty: txn.counterparties ? JSON.stringify(txn.counterparties) : null,
              pending: txn.pending,
              iso_currency_code: txn.iso_currency_code,
              unofficial_currency_code: txn.unofficial_currency_code
            },
            update: {
              amount: txn.amount,
              name: txn.name,
              merchant_name: txn.merchant_name || null,
              category: txn.category ? txn.category.join(', ') : null,
              location: txn.location ? JSON.stringify(txn.location) : null,
              payment_channel: txn.payment_channel,
              counterparty: txn.counterparties ? JSON.stringify(txn.counterparties) : null,
              pending: txn.pending
            }
          });
        }

        console.log(`  ✅ Updated ${transactionsResponse.data.transactions.length} regular transactions`);

      } catch (error) {
        console.error(`  ❌ Error with ${item.institutionName}:`, error.message);
      }
    }
    
    console.log('\n🎉 FULL RE-SYNC COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error in full resync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fullPlaidResync();
