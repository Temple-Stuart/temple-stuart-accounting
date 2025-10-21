const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const accounts = await prisma.accounts.findMany({
orderBy: { createdAt: 'asc' }
});
const groups = new Map();
accounts.forEach(acc => {
const key = acc.plaidAccountId || acc.name;
if (!groups.has(key)) groups.set(key, []);
groups.get(key).push(acc);
});
for (const [key, accs] of groups) {
if (accs.length > 1) {
const keep = accs[accs.length - 1]; // Keep newest
const deleteIds = accs.slice(0, -1).map(a => a.id);
  console.log('Merging ' + key + ': keeping ' + keep.id);
  
  // Move transactions to newest account
  await prisma.transactions.updateMany({
    where: { accountId: { in: deleteIds } },
    data: { accountId: keep.id }
  });
  
  await prisma.investment_transactions.updateMany({
    where: { accountId: { in: deleteIds } },
    data: { accountId: keep.id }
  });
  
  // Delete old accounts
  await prisma.accounts.deleteMany({
    where: { id: { in: deleteIds } }
  });
}
}
console.log('Done! Remaining: ' + await prisma.accounts.count());
}
main().catch(console.error).finally(() => prisma.$disconnect());
