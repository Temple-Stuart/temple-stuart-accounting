const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Two-Pass Commit (Opens then Closes)\n');
  
  // Clear
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  // Parse CSV into groups by CSV Trade#
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const csvTrades = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    if (parts[13] !== 'YES') continue;
    
    const csvNum = parts[0];
    
    if (!csvTrades[csvNum]) {
      csvTrades[csvNum] = {
        date: parts[1],
        symbol: parts[2],
        strategy: parts[3].replace(/"/g, ''),
        position: parts[8],
        plaidIds: [],
        strikes: []
      };
    }
    
    csvTrades[csvNum].plaidIds.push(parts[12]);
    csvTrades[csvNum].strikes.push(parseFloat(parts[6]));
  }
  
  // Separate opens and closes
  const opens = [];
  const closes = [];
  
  for (const [csvNum, trade] of Object.entries(csvTrades)) {
    trade.strikeKey = trade.strikes.sort((a,b) => a-b).join('/');
    
    if (trade.position === 'open') {
      opens.push({ csvNum, ...trade });
    } else if (trade.position === 'close') {
      closes.push({ csvNum, ...trade });
    }
  }
  
  // Sort opens by date
  opens.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Match opens to closes
  const tradeMap = new Map(); // csvNum -> system trade#
  
  console.log('PASS 1: Committing OPENS');
  console.log('='.repeat(80));
  
  let systemTradeNum = 1;
  
  for (const open of opens) {
    // Find matching close
    const closeMatch = closes.find(c => 
      c.symbol === open.symbol && c.strikeKey === open.strikeKey
    );
    
    try {
      // Commit OPEN
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: open.plaidIds,
        strategy: open.strategy,
        tradeNum: String(systemTradeNum)
      });
      
      tradeMap.set(open.csvNum, systemTradeNum);
      if (closeMatch) tradeMap.set(closeMatch.csvNum, systemTradeNum);
      
      const status = closeMatch ? 'HAS_CLOSE' : 'OPEN_ONLY';
      console.log(`✅ ${String(systemTradeNum).padStart(3)} | ${open.date} | ${open.symbol.padEnd(6)} | ${open.strategy.padEnd(20)} | ${status}`);
      
      systemTradeNum++;
    } catch (error) {
      console.error(`❌ CSV ${open.csvNum} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('PASS 2: Committing CLOSES');
  console.log('='.repeat(80));
  
  for (const close of closes) {
    const systemNum = tradeMap.get(close.csvNum);
    
    if (!systemNum) {
      console.log(`⚠️  CSV ${close.csvNum} | No matching open found`);
      continue;
    }
    
    try {
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: close.plaidIds,
        strategy: close.strategy,
        tradeNum: String(systemNum)
      });
      
      console.log(`✅ ${String(systemNum).padStart(3)} | ${close.date} | ${close.symbol.padEnd(6)} | CLOSE`);
    } catch (error) {
      console.error(`❌ CSV ${close.csvNum} -> Trade ${systemNum} | ${error.response?.data?.error || error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`✅ ${systemTradeNum - 1} trades committed`);
  
  await prisma.$disconnect();
})();
