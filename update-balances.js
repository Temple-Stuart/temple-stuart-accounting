require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const prisma = new PrismaClient();

// Initialize Plaid client
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

async function updateBalances() {
  try {
    const plaidItems = await prisma.plaid_items.findMany({
      include: { accounts: true }
    });
    
    console.log(`Found ${plaidItems.length} Plaid connections`);
    
    for (const item of plaidItems) {
      console.log(`\nUpdating balances for item ${item.id}...`);
      
      try {
        const response = await plaidClient.accountsBalanceGet({
          access_token: item.accessToken
        });
        
        let holdings = null;
        try {
          const holdingsResponse = await plaidClient.investmentsHoldingsGet({
            access_token: item.accessToken
          });
          holdings = holdingsResponse.data.holdings;
          console.log(`  Found ${holdings.length} holdings`);
        } catch (e) {
          console.log('  Not an investment account');
        }
        
        for (const plaidAccount of response.data.accounts) {
          let balance = plaidAccount.balances.current;
          
          if (holdings && plaidAccount.type === 'investment') {
            const accountHoldings = holdings.filter(h => h.account_id === plaidAccount.account_id);
            if (accountHoldings.length > 0) {
              balance = accountHoldings.reduce((sum, holding) => {
                const value = holding.institution_value || (holding.institution_price * holding.quantity);
                return sum + value;
              }, 0);
              console.log(`  Investment account ${plaidAccount.name}: calculated balance = $${balance}`);
            }
          }
          
          const updated = await prisma.accounts.updateMany({
            where: { 
              accountId: plaidAccount.account_id,
              plaidItemId: item.id
            },
            data: {
              currentBalance: balance,
              availableBalance: plaidAccount.balances.available || balance,
              mask: plaidAccount.mask
            }
          });
          
          if (updated.count > 0) {
            console.log(`  Updated ${plaidAccount.name}: $${balance}`);
          }
        }
      } catch (error) {
        console.error(`  Error updating item ${item.id}:`, error.message);
      }
    }
    
    console.log('\nDone! Refresh your dashboard to see updated balances.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateBalances();
