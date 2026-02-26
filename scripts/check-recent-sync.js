const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
// Check transactions by date
const recentTxns = await prisma.transactions.groupBy({
by: ['date'],
_count: { id: true },
orderBy: { date: 'desc' },
take: 30
});
console.log('Most recent transaction dates in DB:');
recentTxns.forEach(r => {
const dateStr = new Date(r.date).toISOString().split('T')[0];
console.log(dateStr + ': ' + r._count.id + ' transactions');
});
const total = await prisma.transactions.count();
console.log('\nTotal transactions:', total);
}
main().catch(console.error).finally(() => prisma.$disconnect());
