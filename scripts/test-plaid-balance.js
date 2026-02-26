require('dotenv').config({ path: '.env.local' });
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const plaidConfig = new Configuration({
basePath: PlaidEnvironments.production,
baseOptions: {
headers: {
'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
'PLAID-SECRET': process.env.PLAID_SECRET,
},
},
});
const plaidClient = new PlaidApi(plaidConfig);
async function testBalance() {
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const item = await prisma.plaid_items.findFirst({
where: { institutionName: 'Wells Fargo' }
});
console.log('Testing balance fetch for Wells Fargo...');
console.log('Access token:', item.accessToken.substring(0, 20) + '...');
try {
const response = await plaidClient.accountsBalanceGet({
access_token: item.accessToken
});
console.log('SUCCESS! Got', response.data.accounts.length, 'accounts');
response.data.accounts.forEach(acc => {
console.log('  -', acc.name, ': $' + acc.balances.current);
});
} catch (error) {
console.log('PLAID ERROR:', error.response?.data || error.message);
}
await prisma.$disconnect();
}
testBalance();
