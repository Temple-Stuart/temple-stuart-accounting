const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🚀 Correct Trade Commit (Your Way)\n');
  
  // Clear
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  // Parse CSV - keep ALL legs together by CSV trade#
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const tradeGroups = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const csvNum = parts[0];
    const date = parts[1];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    
    if (!tradeGroups[csvNum]) {
      tradeGroups[csvNum] = { date, strategy, plaidIds: [] };
    }
    tradeGroups[csvNum].plaidIds.push(plaidId);
  }
  
  // Sort by earliest date
  const sorted = Object.entries(tradeGroups).sort((a, b) => 
    new Date(a[1].date) - new Date(b[1].date)
  );
  
  console.log(`📊 ${sorted.length} complete trades\n`);
  console.log('='.repeat(70));
  
  let tradeNum = 1;
  let success = 0;
  
  for (const [csvNum, trade] of sorted) {
    try {
      // Commit ALL legs together
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.plaidIds,
        strategy: trade.strategy,
        tradeNum: String(tradeNum)
      });
      
      console.log(`✅ ${String(tradeNum).padStart(3)} | ${trade.date} | ${trade.strategy.padEnd(25)} | ${trade.plaidIds.length} legs`);
      tradeNum++;
      success++;
    } catch (error) {
      console.error(`❌ CSV ${csvNum} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('='.repeat(70));
  console.log(`\n✅ ${success} trades committed`);
  
  await prisma.$disconnect();
})();
