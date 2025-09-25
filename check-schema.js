const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    // Check what fields actually exist on accounts
    const account = await prisma.accounts.findFirst();
    console.log('ACTUAL ACCOUNT FIELDS:');
    console.log(Object.keys(account));
    console.log('');
    console.log('SAMPLE VALUES:');
    Object.entries(account).forEach(([key, value]) => {
      console.log(`${key}: ${typeof value} = ${value}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
