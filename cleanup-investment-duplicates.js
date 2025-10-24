const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    const count = await prisma.investment_transactions.count();
    console.log('Found ' + count + ' investment transactions to delete');
    
    const deleted = await prisma.investment_transactions.deleteMany({});
    console.log('✅ Deleted ' + deleted.count + ' investment transactions');
    console.log('Regular transactions and journal entries preserved');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
