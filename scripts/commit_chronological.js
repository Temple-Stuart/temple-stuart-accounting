const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Commit in Chronological Order\n');
  
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const trades = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const csvNum = parts[0];
    const date = parts[1];
    const symbol = parts[2];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    
    if (!trades[csvNum]) {
      trades[csvNum] = { date, symbol, strategy, plaidIds: [] };
    }
    
    trades[csvNum].plaidIds.push(plaidId);
  }
  
  // Sort by DATE, not CSV number
  const sorted = Object.values(trades).sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  console.log('New# | Date | Symbol | Strategy | Legs');
  console.log('='.repeat(70));
  
  let newTradeNum = 1;
  
  for (const trade of sorted) {
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.plaidIds,
        strategy: trade.strategy,
        tradeNum: String(newTradeNum)
      });
      
      console.log(`✅ ${String(newTradeNum).padStart(3)} | ${trade.date} | ${trade.symbol.padEnd(6)} | ${trade.strategy.padEnd(25)} | ${trade.plaidIds.length} legs`);
      newTradeNum++;
    } catch (error) {
      console.error(`❌ ${trade.symbol} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('='.repeat(70));
  
  await prisma.$disconnect();
})();
