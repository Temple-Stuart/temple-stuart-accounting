const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const fs = require('fs');

(async () => {
  console.log('🚀 Clean Trade Commit\n');
  
  // Step 1: Clear existing positions
  console.log('🗑️  Clearing old positions...');
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  console.log('✅ Cleared\n');
  
  // Step 2: Parse CSV
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const trades = [];
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    trades.push({
      csvNum: parts[0],
      date: parts[1],
      strategy: parts[3].replace(/"/g, ''),
      plaidId: parts[12]
    });
  }
  
  // Group by CSV trade number
  const groups = {};
  trades.forEach(t => {
    if (!groups[t.csvNum]) groups[t.csvNum] = [];
    groups[t.csvNum].push(t);
  });
  
  console.log(`📊 Found ${Object.keys(groups).length} trade groups\n`);
  
  // Step 3: Commit each group
  console.log('='.repeat(60));
  console.log('Committing All Trades');
  console.log('='.repeat(60) + '\n');
  
  let success = 0;
  let failed = 0;
  
  for (const [csvNum, legs] of Object.entries(groups)) {
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: legs.map(l => l.plaidId),
        strategy: legs[0].strategy,
        tradeNum: `CSV_${csvNum}`
      });
      
      console.log(`✅ ${csvNum.padStart(3)} | ${legs[0].date} | ${legs[0].strategy.padEnd(25)} | ${legs.length} legs`);
      success++;
    } catch (error) {
      console.error(`❌ ${csvNum.padStart(3)} | ${error.response?.data?.error || error.message}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
})();
