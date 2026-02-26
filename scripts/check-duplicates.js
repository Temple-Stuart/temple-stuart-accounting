const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const dups = await prisma.transactions.groupBy({
by: ['transactionId'],
_count: { transactionId: true },
having: { transactionId: { _count: { gt: 1 } } }
});
console.log('Duplicate transactions:', dups.length);
if (dups.length > 0) {
console.log('Sample duplicates:');
for (let i = 0; i < Math.min(3, dups.length); i++) {
const txns = await prisma.transactions.findMany({
where: { transactionId: dups[i].transactionId },
select: { id: true, date: true, name: true, accountCode: true }
});
console.log('Transaction ID: ' + dups[i].transactionId);
txns.forEach(t => {
const dateStr = t.date.toISOString().split('T')[0];
console.log('  - ' + dateStr + ' ' + t.name + ' (COA: ' + (t.accountCode || 'none') + ')');
});
}
}
}
main().catch(console.error).finally(() => prisma.$disconnect());
