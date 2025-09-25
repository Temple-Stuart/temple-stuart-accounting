const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addInstitutionToAccounts() {
  console.log('Adding institution names to accounts...');
  
  try {
    const accounts = await prisma.accounts.findMany({
      include: { plaidItem: true }
    });
    
    for (const account of accounts) {
      await prisma.accounts.update({
        where: { id: account.id },
        data: { 
          institutionName: account.plaidItem.institutionName
        }
      });
      console.log(`Added ${account.plaidItem.institutionName} to ${account.name}`);
    }
    
    console.log('✅ Institution names added!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addInstitutionToAccounts();
