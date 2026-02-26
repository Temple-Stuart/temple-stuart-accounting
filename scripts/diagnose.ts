import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('\n=== GITHUB USER DATA ===');
  const githubUser = await prisma.users.findUnique({ 
    where: { email: 'stuart.alexander.phi@gmail.com' } 
  });
  console.log('User ID:', githubUser?.id);
  
  if (githubUser) {
    const plaid = await prisma.plaid_items.findMany({ 
      where: { userId: githubUser.id },
      include: { accounts: true }
    });
    console.log('Plaid items:', plaid.length);
    plaid.forEach(p => {
      console.log(`  ${p.institutionName}: ${p.accounts.length} accounts`);
    });
    
    const budgets = await prisma.budgets.count({ where: { userId: githubUser.id } });
    console.log('Budgets:', budgets);
  }
  
  console.log('\n=== ASTUART USER ===');
  const astuartUser = await prisma.users.findUnique({ 
    where: { email: 'Astuart@templestuart.com' } 
  });
  console.log('User ID:', astuartUser?.id);
  console.log('Password set:', astuartUser?.password ? 'YES (' + astuartUser.password.length + ' chars)' : 'NO');
  
  console.log('\n=== ALL TRANSACTIONS ===');
  const txnCount = await prisma.transactions.count();
  console.log('Total transactions:', txnCount);
  
  // Check plaid items and their transactions
  const allPlaid = await prisma.plaid_items.findMany({
    include: { 
      accounts: {
        include: { _count: { select: { transactions: true } } }
      }
    }
  });
  console.log('\n=== PLAID ITEMS OWNERSHIP ===');
  allPlaid.forEach(p => {
    const txnTotal = p.accounts.reduce((sum, a) => sum + a._count.transactions, 0);
    console.log(`${p.institutionName} | User: ${p.userId} | Txns: ${txnTotal}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
