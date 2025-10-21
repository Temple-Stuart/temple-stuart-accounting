const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
// Tag trading accounts (all brokerages)
const trading = await prisma.accounts.updateMany({
where: { type: 'investment', subtype: 'brokerage' },
data: { entityType: 'trading' }
});
// Tag personal checking accounts
const personal = await prisma.accounts.updateMany({
where: { type: 'depository', subtype: 'checking' },
data: { entityType: 'personal' }
});
console.log('Tagged ' + trading.count + ' trading accounts');
console.log('Tagged ' + personal.count + ' personal accounts');
}
main().catch(console.error).finally(() => prisma.$disconnect());
