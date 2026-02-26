const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
const items = await prisma.plaid_items.findMany();
console.log('Found ' + items.length + ' Plaid connections');
for (const item of items) {
if (!item.accessToken) {
console.log('Skipping ' + item.institutionName + ' (no access token)');
continue;
}
console.log('Syncing ' + item.institutionName + '...');

const response = await fetch('http://localhost:3000/api/plaid/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ itemId: item.id })
});

const result = await response.json();
console.log('  → Added ' + (result.addedCount || 0) + ' transactions');
}
console.log('Sync complete!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
