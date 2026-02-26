const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Final Commit Using CSV Trade Numbers\n');
  
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const trades = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    
    const tradeNum = parts[0];
    const position = parts[8]; // open or close
    const plaidId = parts[12];
    const match = parts[13];
    
    if (match !== 'YES') continue;
    
    if (!trades[tradeNum]) {
      trades[tradeNum] = { opens: [], closes: [] };
    }
    
    if (position === 'open') {
      trades[tradeNum].opens.push(plaidId);
    } else if (position === 'close') {
      trades[tradeNum].closes.push(plaidId);
    }
  }
  
  const sorted = Object.keys(trades).sort((a, b) => parseInt(a) - parseInt(b));
  
  console.log('PASS 1: OPENS');
  for (const num of sorted) {
    if (trades[num].opens.length === 0) continue;
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades[num].opens,
        strategy: 'Spread',
        tradeNum: num
      });
      console.log(`✅ Trade ${num} - ${trades[num].opens.length} opens`);
    } catch (e) {
      console.error(`❌ ${num}: ${e.response?.data?.error || e.message}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\nPASS 2: CLOSES');
  for (const num of sorted) {
    if (trades[num].closes.length === 0) continue;
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades[num].closes,
        strategy: 'Spread',
        tradeNum: num
      });
      console.log(`✅ Trade ${num} - ${trades[num].closes.length} closes`);
    } catch (e) {
      console.error(`❌ ${num}: ${e.response?.data?.error || e.message}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }
  
  await prisma.$disconnect();
})();
