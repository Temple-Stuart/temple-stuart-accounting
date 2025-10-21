const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const accounts = await prisma.accounts.findMany({
orderBy: { createdAt: 'asc' }
});
const seen = new Map();
const toDelete = [];
accounts.forEach(acc => {
const key = acc.plaidAccountId || acc.name;
if (seen.has(key)) {
toDelete.push(seen.get(key)); // Delete older one
}
seen.set(key, acc.id);
});
console.log('Deleting ' + toDelete.length + ' duplicate accounts');
for (const id of toDelete) {
await prisma.accounts.delete({ where: { id } });
}
const remaining = await prisma.accounts.count();
console.log('Remaining accounts: ' + remaining);
}
main().catch(console.error).finally(() => prisma.$disconnect());
