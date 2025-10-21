const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const allTxns = await prisma.transactions.findMany({
orderBy: { date: 'desc' }
});
let merged = 0;
const processedOldIds = new Set();
for (let i = 0; i < allTxns.length; i++) {
const newTxn = allTxns[i];
if (newTxn.accountCode) continue; // Skip already committed
// Find matching old transaction
const oldTxn = allTxns.find(t => 
  t.id !== newTxn.id &&
  !processedOldIds.has(t.id) &&
  t.accountCode &&
  Math.abs(new Date(t.date) - new Date(newTxn.date)) < 86400000 &&
  Math.abs(t.amount - newTxn.amount) < 0.01
);

if (oldTxn) {
  console.log('Merging: ' + newTxn.name.substring(0, 50) + ' ($' + newTxn.amount + ')');
  
  // Transfer COA to new transaction
  await prisma.transactions.update({
    where: { id: newTxn.id },
    data: { 
      accountCode: oldTxn.accountCode,
      subAccount: oldTxn.subAccount
    }
  });
  
  // Delete old transaction
  await prisma.transactions.delete({
    where: { id: oldTxn.id }
  });
  
  processedOldIds.add(oldTxn.id);
  merged++;
}
}
console.log('\nMerged ' + merged + ' transactions');
}
main().catch(console.error).finally(() => prisma.$disconnect());
