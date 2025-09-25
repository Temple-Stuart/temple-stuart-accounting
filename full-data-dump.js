const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullDataDump() {
  console.log('=== COMPLETE DATA DUMP ===\n');
  
  try {
    // 1. ALL PLAID ITEMS
    console.log('🏦 PLAID ITEMS');
    console.log('='.repeat(50));
    const items = await prisma.plaid_items.findMany();
    items.forEach((item, i) => {
      console.log(`${i + 1}. ID: ${item.id}`);
      console.log(`   Institution: ${item.institutionName}`);
      console.log(`   Access Token: ${item.accessToken ? 'Present' : 'Missing'}`);
      console.log(`   Created: ${item.createdAt}`);
      console.log('');
    });

    // 2. ALL ACCOUNTS
    console.log('💳 ALL ACCOUNTS');
    console.log('='.repeat(50));
    const accounts = await prisma.accounts.findMany({
      include: {
        plaidItem: true,
        _count: {
          select: {
            transactions: true,
            investment_transactions: true
          }
        }
      }
    });
    
    accounts.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.name}`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Account ID: ${acc.accountId}`);
      console.log(`   Type: ${acc.type} / ${acc.subtype}`);
      console.log(`   Balance: ${acc.balance} (type: ${typeof acc.balance})`);
      console.log(`   Available: ${acc.available_balance}`);
      console.log(`   Institution: ${acc.plaidItem?.institutionName}`);
      console.log(`   Regular Transactions: ${acc._count.transactions}`);
      console.log(`   Investment Transactions: ${acc._count.investment_transactions}`);
      console.log('');
    });

    // 3. ALL REGULAR TRANSACTIONS
    console.log('💸 ALL REGULAR TRANSACTIONS');
    console.log('='.repeat(50));
    const allTransactions = await prisma.transactions.findMany({
      include: {
        account: true
      },
      orderBy: { date: 'desc' }
    });
    
    console.log(`Total Regular Transactions: ${allTransactions.length}\n`);
    
    allTransactions.forEach((txn, i) => {
      console.log(`${i + 1}. ${txn.name} - $${txn.amount}`);
      console.log(`   Date: ${txn.date.toISOString().split('T')[0]}`);
      console.log(`   Account: ${txn.account?.name} (${txn.account?.type})`);
      console.log(`   Merchant: ${txn.merchant_name || 'N/A'}`);
      console.log(`   Category: ${txn.category || 'N/A'}`);
      console.log(`   Pending: ${txn.pending}`);
      console.log('');
    });

    // 4. ALL INVESTMENT TRANSACTIONS  
    console.log('📈 ALL INVESTMENT TRANSACTIONS');
    console.log('='.repeat(50));
    const allInvestments = await prisma.investment_transactions.findMany({
      include: {
        account: {
          include: {
            plaidItem: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });
    
    console.log(`Total Investment Transactions: ${allInvestments.length}\n`);
    
    // Show first 20 investment transactions
    allInvestments.slice(0, 20).forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.name}`);
      console.log(`   Amount: $${inv.amount}`);
      console.log(`   Date: ${inv.date.toISOString().split('T')[0]}`);
      console.log(`   Type: ${inv.type} / ${inv.subtype}`);
      console.log(`   Quantity: ${inv.quantity}`);
      console.log(`   Price: $${inv.price}`);
      console.log(`   Account: ${inv.account?.name} (${inv.account?.type})`);
      console.log(`   Institution: ${inv.account?.plaidItem?.institutionName}`);
      console.log(`   Security ID: ${inv.security_id}`);
      console.log('');
    });

    if (allInvestments.length > 20) {
      console.log(`... and ${allInvestments.length - 20} more investment transactions\n`);
    }

    // 5. SUMMARY STATS
    console.log('📊 SUMMARY STATISTICS');
    console.log('='.repeat(50));
    console.log(`Total Plaid Items: ${items.length}`);
    console.log(`Total Accounts: ${accounts.length}`);
    console.log(`Total Regular Transactions: ${allTransactions.length}`);
    console.log(`Total Investment Transactions: ${allInvestments.length}`);
    console.log('');
    
    // Account breakdown
    console.log('Account Breakdown:');
    accounts.forEach(acc => {
      console.log(`  ${acc.name}: ${acc._count.transactions} regular + ${acc._count.investment_transactions} investment`);
    });

    // 6. DATA TYPE ANALYSIS
    console.log('\n🔍 DATA TYPE ANALYSIS');
    console.log('='.repeat(50));
    
    const sampleAccount = accounts[0];
    if (sampleAccount) {
      console.log('Sample Account Data Types:');
      Object.entries(sampleAccount).forEach(([key, value]) => {
        console.log(`  ${key}: ${typeof value} = ${value}`);
      });
    }

  } catch (error) {
    console.error('❌ ERROR IN DATA DUMP:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fullDataDump();
