const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactions() {
  try {
    // Count total transactions
    const count = await prisma.transactions.count();
    console.log(`Total transactions in database: ${count}`);
    
    // Get a sample transaction
    const sample = await prisma.transactions.findFirst({
      include: { account: true }
    });
    
    if (sample) {
      console.log('\nSample transaction:');
      console.log('- Name:', sample.name);
      console.log('- Amount:', sample.amount);
      console.log('- Date:', sample.date);
      console.log('- Account:', sample.account?.name);
      console.log('- Transaction ID:', sample.transactionId);
    }
    
    // Check for orphaned transactions
    const orphaned = await prisma.transactions.findMany({
      where: { account: null }
    });
    console.log(`\nOrphaned transactions (no account): ${orphaned.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();
