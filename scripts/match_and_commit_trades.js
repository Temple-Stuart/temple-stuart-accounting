const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Matching Opens to Closes\n');
  
  // Clear
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  // Parse CSV
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const opens = [];
  const closes = [];
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const trade = {
      csvNum: parts[0],
      date: parts[1],
      symbol: parts[2],
      strategy: parts[3].replace(/"/g, ''),
      action: parts[5],
      strike: parts[6],
      type: parts[7],
      position: parts[8],
      plaidId: parts[12]
    };
    
    if (trade.position === 'open') {
      opens.push(trade);
    } else if (trade.position === 'close') {
      closes.push(trade);
    }
  }
  
  // Group opens by CSV trade#
  const openGroups = {};
  opens.forEach(t => {
    if (!openGroups[t.csvNum]) openGroups[t.csvNum] = [];
    openGroups[t.csvNum].push(t);
  });
  
  // Group closes by CSV trade#
  const closeGroups = {};
  closes.forEach(t => {
    if (!closeGroups[t.csvNum]) closeGroups[t.csvNum] = [];
    closeGroups[t.csvNum].push(t);
  });
  
  // Match opens to closes
  const completeTrades = [];
  
  for (const [csvNum, openLegs] of Object.entries(openGroups)) {
    const symbol = openLegs[0].symbol;
    const strikes = openLegs.map(l => l.strike).sort().join('/');
    const date = openLegs[0].date;
    
    // Find matching close
    let matchingClose = null;
    for (const [closeNum, closeLegs] of Object.entries(closeGroups)) {
      if (closeLegs[0].symbol === symbol) {
        const closeStrikes = closeLegs.map(l => l.strike).sort().join('/');
        if (closeStrikes === strikes) {
          matchingClose = { csvNum: closeNum, legs: closeLegs };
          delete closeGroups[closeNum]; // Remove so it's not matched again
          break;
        }
      }
    }
    
    completeTrades.push({
      date,
      symbol,
      strategy: openLegs[0].strategy,
      openLegs,
      closeLegs: matchingClose?.legs || null,
      strikes
    });
  }
  
  // Sort by open date
  completeTrades.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`📊 ${completeTrades.length} matched trades\n`);
  console.log('='.repeat(80));
  
  let tradeNum = 1;
  
  for (const trade of completeTrades) {
    const allLegs = [...trade.openLegs.map(l => l.plaidId)];
    if (trade.closeLegs) {
      allLegs.push(...trade.closeLegs.map(l => l.plaidId));
    }
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: allLegs,
        strategy: trade.strategy,
        tradeNum: String(tradeNum)
      });
      
      const status = trade.closeLegs ? 'CLOSED' : 'OPEN';
      const legCount = allLegs.length;
      console.log(`✅ ${String(tradeNum).padStart(3)} | ${trade.date} | ${trade.symbol.padEnd(6)} | ${trade.strategy.padEnd(25)} | ${status.padEnd(6)} | ${legCount} legs`);
      tradeNum++;
    } catch (error) {
      console.error(`❌ ${trade.symbol} $${trade.strikes} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('='.repeat(80));
  console.log(`\n✅ ${tradeNum - 1} trades committed`);
  
  await prisma.$disconnect();
})();
