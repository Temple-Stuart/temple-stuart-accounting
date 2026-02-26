const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Committing by CSV Trade#\n');
  
  // Clear
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  // Group ALL legs by CSV Trade#
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const trades = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const tradeNum = parts[0];
    const date = parts[1];
    const symbol = parts[2];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    
    if (!trades[tradeNum]) {
      trades[tradeNum] = { date, symbol, strategy, plaidIds: [] };
    }
    
    trades[tradeNum].plaidIds.push(plaidId);
  }
  
  // Sort by trade number
  const sorted = Object.entries(trades).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  console.log('Trade# | Date | Symbol | Strategy | Total Legs');
  console.log('='.repeat(70));
  
  for (const [tradeNum, trade] of sorted) {
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.plaidIds,
        strategy: trade.strategy,
        tradeNum: tradeNum
      });
      
      console.log(`✅ ${tradeNum.padStart(3)} | ${trade.date} | ${trade.symbol.padEnd(6)} | ${trade.strategy.padEnd(25)} | ${trade.plaidIds.length} legs`);
    } catch (error) {
      console.error(`❌ ${tradeNum} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('='.repeat(70));
  
  await prisma.$disconnect();
})();
