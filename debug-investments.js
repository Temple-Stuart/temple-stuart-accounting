const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugInvestments() {
  console.log('=== DEBUGGING INVESTMENT DATA ===\n');
  
  try {
    const totalInvestments = await prisma.investment_transactions.count();
    console.log(`Total investment transactions: ${totalInvestments}`);
    
    const recentInvestments = await prisma.investment_transactions.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        account: {
          include: {
            plaidItem: true
          }
        }
      }
    });
    
    console.log('\n=== RECENT INVESTMENT TRANSACTIONS ===');
    recentInvestments.forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.name} - $${inv.amount} - ${inv.date.toDateString()}`);
      console.log(`   Account: ${inv.account?.name || 'Unknown'} (${inv.account?.type})`);
      console.log(`   Institution: ${inv.account?.plaidItem?.institutionName || 'Unknown'}`);
    });
    
    const investmentAccounts = await prisma.accounts.findMany({
      where: { type: 'investment' },
      include: {
        plaidItem: true,
        _count: {
          select: { investment_transactions: true }
        }
      }
    });
    
    console.log('\n=== INVESTMENT ACCOUNTS ===');
    investmentAccounts.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.name} - ${acc.subtype}`);
      console.log(`   Balance: $${acc.balance}`);
      console.log(`   Institution: ${acc.plaidItem?.institutionName}`);
      console.log(`   Investment transactions: ${acc._count.investment_transactions}`);
    });
    
    const orphanedInvestments = await prisma.investment_transactions.findMany({
      where: { account: null },
      take: 5
    });
    
    console.log('\n=== ORPHANED INVESTMENT TRANSACTIONS ===');
    console.log(`Count: ${orphanedInvestments.length}`);
    if (orphanedInvestments.length > 0) {
      console.log('Sample orphaned transactions:');
      orphanedInvestments.forEach((inv, i) => {
        console.log(`  ${i + 1}. ${inv.name} - $${inv.amount} - accountId: ${inv.accountId}`);
      });
    }
    
  } catch (error) {
    console.error('Error debugging investments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugInvestments();
