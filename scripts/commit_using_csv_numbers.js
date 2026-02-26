const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Using YOUR CSV Trade Numbers\n');
  
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const tradesByNum = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const csvTradeNum = parts[0];
    const position = parts[8];
    const plaidId = parts[12];
    
    if (!tradesByNum[csvTradeNum]) {
      tradesByNum[csvTradeNum] = { opens: [], closes: [] };
    }
    
    if (position === 'open') {
      tradesByNum[csvTradeNum].opens.push(plaidId);
    } else if (position === 'close') {
      tradesByNum[csvTradeNum].closes.push(plaidId);
    }
  }
  
  const sorted = Object.entries(tradesByNum).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  console.log('PASS 1: Committing OPENS');
  console.log('='.repeat(60));
  
  for (const [csvNum, trade] of sorted) {
    if (trade.opens.length === 0) continue;
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.opens,
        strategy: 'Spread',
        tradeNum: csvNum
      });
      console.log(`✅ Trade ${csvNum} - ${trade.opens.length} open legs`);
    } catch (error) {
      console.error(`❌ Trade ${csvNum} OPEN - ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\nPASS 2: Committing CLOSES');
  console.log('='.repeat(60));
  
  for (const [csvNum, trade] of sorted) {
    if (trade.closes.length === 0) continue;
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.closes,
        strategy: 'Spread',
        tradeNum: csvNum
      });
      console.log(`✅ Trade ${csvNum} - ${trade.closes.length} close legs`);
    } catch (error) {
      console.error(`❌ Trade ${csvNum} CLOSE - ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\n✅ Complete! Now run: node scripts/show_pl.js');
  
  await prisma.$disconnect();
})();
