// This will show us what your current accounts API returns vs what the frontend expects

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccountsAPI() {
  try {
    const items = await prisma.plaid_items.findMany({
      include: {
        accounts: {
          include: {
            transactions: {
              take: 5,
              orderBy: { date: 'desc' }
            },
            investment_transactions: {
              take: 5,
              orderBy: { date: 'desc' }
            }
          }
        }
      }
    });

    console.log('=== WHAT YOUR API SHOULD RETURN ===\n');

    const apiResponse = {
      items: items.map(item => ({
        id: item.id,
        institutionName: item.institutionName,
        accounts: item.accounts.map(account => ({
          id: account.id,
          accountId: account.accountId,
          name: account.name,
          type: account.type,
          subtype: account.subtype,
          // THE CRITICAL FIX: Map currentBalance to balance
          balance: account.currentBalance || 0,
          available_balance: account.availableBalance,
          transactions: account.transactions,
          investment_transactions: account.investment_transactions
        }))
      }))
    };

    console.log(JSON.stringify(apiResponse, null, 2));
    console.log('\n=== KEY POINTS ===');
    console.log(`✅ Balance should be: ${apiResponse.items[0].accounts[0].balance}`);
    console.log(`✅ Investment transactions: ${apiResponse.items[0].accounts[0].investment_transactions.length}`);
    console.log(`✅ Regular transactions: ${apiResponse.items[0].accounts[1].transactions.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccountsAPI();
