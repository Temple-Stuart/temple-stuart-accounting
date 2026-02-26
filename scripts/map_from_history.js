const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Mapping trades from robinhood_history.txt\n');
  
  await prisma.trading_positions.deleteMany({});
  await prisma.investment_transactions.updateMany({ data: { tradeNum: null } });
  
  const history = fs.readFileSync('robinhood_history.txt', 'utf-8');
  const lines = history.split('\n');
  
  const trades = [];
  let currentTrade = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for trade entries
    if (line.match(/^[A-Z]+.*Spread$/) || line.match(/^[A-Z]+.*Condor$/)) {
      const symbol = line.split(' ')[0];
      const date = lines[i + 1]?.trim();
      
      // Get filled status
      let filled = false;
      for (let j = i; j < i + 20; j++) {
        if (lines[j]?.includes('Status') && lines[j+1]?.includes('Filled')) {
          filled = true;
          break;
        }
      }
      
      if (filled && date) {
        trades.push({ symbol, date, line: i });
      }
    }
  }
  
  console.log(`Found ${trades.length} filled trades in history\n`);
  
  for (let t = 0; t < Math.min(10, trades.length); t++) {
    console.log(`${t + 1}. ${trades[t].date} ${trades[t].symbol}`);
  }
  
  await prisma.$disconnect();
})();
