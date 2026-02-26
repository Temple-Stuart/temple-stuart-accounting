const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const accounts = await prisma.accounts.findMany({
select: {
name: true,
currentBalance: true,
availableBalance: true,
updatedAt: true
}
});
console.log('Current account balances in DB:\n');
accounts.forEach(acc => {
const updated = new Date(acc.updatedAt).toISOString().split('T')[0];
console.log(acc.name);
console.log('  Current: $' + (acc.currentBalance || 0).toFixed(2));
console.log('  Available: $' + (acc.availableBalance || 0).toFixed(2));
console.log('  Last updated: ' + updated);
console.log('');
});
}
main().catch(console.error).finally(() => prisma.$disconnect());
