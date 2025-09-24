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

async function checkSync() {
  const plaidItems = await prisma.plaid_items.findMany();
  
  for (const item of plaidItems) {
    console.log(`\nChecking item ${item.id}...`);
    
    try {
      // Get ALL transaction fields
      const response = await plaidClient.transactionsGet({
        access_token: item.accessToken,
        start_date: '2024-01-01',
        end_date: new Date().toISOString().split('T')[0],
        options: { 
          count: 500,
          include_personal_finance_category: true
        }
      });
      
      console.log(`\nFound ${response.data.total_transactions} total transactions`);
      
      // Show ALL fields for first transaction
      if (response.data.transactions.length > 0) {
        const txn = response.data.transactions[0];
        console.log('\nFULL TRANSACTION DATA STRUCTURE:');
        console.log(JSON.stringify(txn, null, 2));
      }
      
      // Check investment transactions
      try {
        const investResponse = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: '2024-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });
        
        console.log(`\nFound ${investResponse.data.total_investment_transactions} investment transactions`);
        
        // Show ALL fields for first investment transaction
        if (investResponse.data.investment_transactions.length > 0) {
          const investTxn = investResponse.data.investment_transactions[0];
          console.log('\nFULL INVESTMENT TRANSACTION DATA STRUCTURE:');
          console.log(JSON.stringify(investTxn, null, 2));
        }
      } catch (e) {
        console.log('No investment transactions or not an investment account');
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
  
  await prisma.$disconnect();
}

checkSync();
