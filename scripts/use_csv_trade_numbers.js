const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Using YOUR CSV Trade Numbers\n');
  
  // Clear
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  // Parse CSV and keep YOUR trade numbers
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const trades = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const csvTradeNum = parts[0];
    
    if (!trades[csvTradeNum]) {
      trades[csvTradeNum] = {
        date: parts[1],
        symbol: parts[2],
        strategy: parts[3].replace(/"/g, ''),
        position: parts[8],
        plaidIds: []
      };
    }
    
    trades[csvTradeNum].plaidIds.push(parts[12]);
  }
  
  const sorted = Object.entries(trades).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  console.log('CSV# | Date | Symbol | Strategy | Position | Legs');
  console.log('='.repeat(70));
  
  for (const [csvNum, trade] of sorted) {
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.plaidIds,
        strategy: trade.strategy,
        tradeNum: csvNum
      });
      
      console.log(`✅ ${csvNum.padStart(3)} | ${trade.date} | ${trade.symbol.padEnd(6)} | ${trade.strategy.padEnd(20)} | ${trade.position.padEnd(5)} | ${trade.plaidIds.length} legs`);
    } catch (error) {
      console.error(`❌ ${csvNum} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('='.repeat(70));
  
  await prisma.$disconnect();
})();
