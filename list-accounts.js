const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const accounts = await prisma.accounts.findMany({
select: {
id: true,
name: true,
officialName: true,
type: true,
subtype: true,
entityType: true
},
orderBy: { name: 'asc' }
});
console.log('\nFound ' + accounts.length + ' accounts:\n');
accounts.forEach((acc, i) => {
const entityStatus = acc.entityType || 'NOT SET';
console.log((i+1) + '. ' + acc.name + ' (' + acc.type + (acc.subtype ? '/' + acc.subtype : '') + ') - entityType: ' + entityStatus);
});
}
main().catch(console.error).finally(() => prisma.$disconnect());
