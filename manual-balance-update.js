require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateBalances() {
  // Update your Robinhood accounts with approximate balances
  // You can adjust these values to match your actual balances
  
  const updates = [
    { name: 'Robinhood individual', balance: 10000 }, // Set your actual investment balance
    { name: 'Robinhood Spending', balance: 500 },     // Set your actual checking balance
    { name: 'EVERYDAY CHECKING ...7948', balance: 2000 } // Set your actual bank balance
  ];
  
  for (const update of updates) {
    const result = await prisma.accounts.updateMany({
      where: { name: update.name },
      data: {
        currentBalance: update.balance,
        availableBalance: update.balance
      }
    });
    console.log(`Updated ${update.name}: ${result.count} accounts set to $${update.balance}`);
  }
  
  await prisma.$disconnect();
}

updateBalances();
