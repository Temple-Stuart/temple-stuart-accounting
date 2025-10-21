const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
// Find Uber transaction from 9/22
const uberTxns = await prisma.transactions.findMany({
where: {
date: { gte: new Date('2025-09-22'), lte: new Date('2025-09-23') },
name: { contains: 'UBR' }
},
select: {
id: true,
transactionId: true,
date: true,
name: true,
amount: true,
accountCode: true,
pending: true
}
});
console.log('Found', uberTxns.length, 'Uber transactions on 9/22:');
uberTxns.forEach(t => {
console.log('ID:', t.id);
console.log('  TransactionId:', t.transactionId);
console.log('  Amount:', t.amount);
console.log('  COA:', t.accountCode || 'NONE');
console.log('  Pending:', t.pending);
console.log('');
});
}
main().catch(console.error).finally(() => prisma.$disconnect());
