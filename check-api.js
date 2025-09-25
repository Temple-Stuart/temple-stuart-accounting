const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAPI() {
  console.log('=== CHECKING API DATA ===\n');
  
  try {
    const items = await prisma.plaid_items.findMany({
      include: {
        accounts: {
          include: {
            transactions: { take: 3, orderBy: { date: 'desc' }},
            investment_transactions: { take: 3, orderBy: { date: 'desc' }}
          }
        }
      }
    });

    items.forEach(item => {
      console.log(`Item: ${item.institutionName}`);
      item.accounts.forEach(acc => {
        console.log(`  Account: ${acc.name} - Balance: $${acc.balance}`);
        console.log(`  Regular transactions: ${acc.transactions.length}`);
        console.log(`  Investment transactions: ${acc.investment_transactions.length}`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAPI();
