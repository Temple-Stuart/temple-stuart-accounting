require('dotenv').config();
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

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

async function checkPlaidData() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  // Get access token from database
  const plaidItem = await prisma.plaid_items.findFirst();
  
  if (!plaidItem) {
    console.log('No Plaid items found');
    return;
  }
  
  console.log('Getting transactions with ALL available enrichments...\n');
  
  try {
    // Get transactions with ALL possible options
    const response = await plaidClient.transactionsGet({
      access_token: plaidItem.accessToken,
      start_date: '2025-09-01',
      end_date: '2025-09-30',
      options: {
        count: 5,
        include_personal_finance_category: true,
        include_personal_finance_category_beta: true,
        include_logo_and_counterparty_beta: true
      }
    });
    
    console.log('COMPLETE PLAID TRANSACTION DATA:');
    console.log('================================\n');
    
    // Show EVERYTHING Plaid provides for one transaction
    const txn = response.data.transactions[0];
    console.log(JSON.stringify(txn, null, 2));
    
    console.log('\n\nALL AVAILABLE FIELDS:');
    console.log('======================');
    Object.keys(txn).forEach(key => {
      console.log(`- ${key}: ${typeof txn[key]}`);
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
  
  await prisma.$disconnect();
}

checkPlaidData();
