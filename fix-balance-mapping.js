const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBalanceMapping() {
  console.log('Fixing balance field mapping...');
  
  try {
    const accounts = await prisma.accounts.findMany();
    
    for (const account of accounts) {
      if (account.currentBalance !== null && account.balance === null) {
        await prisma.accounts.update({
          where: { id: account.id },
          data: { 
            balance: account.currentBalance,
            available_balance: account.availableBalance
          }
        });
        console.log(`Fixed ${account.name}: $${account.currentBalance}`);
      }
    }
    
    console.log('✅ Balance mapping fixed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBalanceMapping();
