const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Replicating Your Journal Logic\n');
  
  // Clear
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  // Parse CSV
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const transactions = [];
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    transactions.push({
      date: parts[1],
      symbol: parts[2],
      strategy: parts[3].replace(/"/g, ''),
      strike: parseFloat(parts[6]),
      type: parts[7],
      position: parts[8],
      plaidId: parts[12]
    });
  }
  
  // Group by position type
  const opens = transactions.filter(t => t.position === 'open');
  const closes = transactions.filter(t => t.position === 'close');
  
  // Group opens by symbol + date
  const openGroups = {};
  opens.forEach(t => {
    const key = `${t.date}_${t.symbol}`;
    if (!openGroups[key]) {
      openGroups[key] = { date: t.date, symbol: t.symbol, strategy: t.strategy, strikes: [], plaidIds: [] };
    }
    openGroups[key].strikes.push(t.strike);
    openGroups[key].plaidIds.push(t.plaidId);
  });
  
  // Create strike signature for each open
  Object.values(openGroups).forEach(g => {
    g.strikeKey = g.strikes.sort((a,b) => a-b).join('/');
  });
  
  // Group closes by symbol + date
  const closeGroups = {};
  closes.forEach(t => {
    const key = `${t.date}_${t.symbol}`;
    if (!closeGroups[key]) {
      closeGroups[key] = { date: t.date, symbol: t.symbol, strikes: [], plaidIds: [] };
    }
    closeGroups[key].strikes.push(t.strike);
    closeGroups[key].plaidIds.push(t.plaidId);
  });
  
  // Create strike signature for each close
  Object.values(closeGroups).forEach(g => {
    g.strikeKey = g.strikes.sort((a,b) => a-b).join('/');
  });
  
  // Match opens to closes
  const completeTrades = [];
  const openArray = Object.values(openGroups);
  const closeArray = Object.values(closeGroups);
  
  for (const open of openArray) {
    // Find matching close
    const matchIdx = closeArray.findIndex(close => 
      close.symbol === open.symbol && close.strikeKey === open.strikeKey
    );
    
    const matchingClose = matchIdx >= 0 ? closeArray.splice(matchIdx, 1)[0] : null;
    
    completeTrades.push({
      openDate: open.date,
      symbol: open.symbol,
      strategy: open.strategy,
      strikes: open.strikeKey,
      openPlaidIds: open.plaidIds,
      closePlaidIds: matchingClose?.plaidIds || [],
      closeDate: matchingClose?.date || null
    });
  }
  
  // Sort by open date
  completeTrades.sort((a, b) => new Date(a.openDate) - new Date(b.openDate));
  
  console.log('Trade# | Open Date  | Close Date | Symbol | Strategy             | Strikes    | Status');
  console.log('='.repeat(95));
  
  let tradeNum = 1;
  
  for (const trade of completeTrades) {
    const allPlaidIds = [...trade.openPlaidIds, ...trade.closePlaidIds];
    const status = trade.closePlaidIds.length > 0 ? 'CLOSED' : 'OPEN';
    const closeDate = trade.closeDate || 'OPEN';
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: allPlaidIds,
        strategy: trade.strategy,
        tradeNum: String(tradeNum)
      });
      
      console.log(`${String(tradeNum).padStart(3)} | ${trade.openDate} | ${closeDate.padEnd(10)} | ${trade.symbol.padEnd(6)} | ${trade.strategy.padEnd(20)} | $${trade.strikes.padEnd(9)} | ${status}`);
      tradeNum++;
    } catch (error) {
      console.error(`❌ ${trade.symbol} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('='.repeat(95));
  console.log(`\n✅ ${tradeNum - 1} complete trades logged`);
  
  await prisma.$disconnect();
})();
