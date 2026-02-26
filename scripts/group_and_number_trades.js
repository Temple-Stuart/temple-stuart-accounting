const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔄 Grouping spreads and numbering by close date...\n');
  
  // Get all positions
  const allPositions = await prisma.trading_positions.findMany({
    orderBy: { open_date: 'asc' }
  });
  
  // Group by open_date + symbol (= one spread)
  const trades = {};
  
  for (const pos of allPositions) {
    const key = `${pos.open_date.toISOString().split('T')[0]}_${pos.symbol}`;
    if (!trades[key]) {
      trades[key] = [];
    }
    trades[key].push(pos);
  }
  
  // Sort trade groups by earliest close date (closed first, then open)
  const sortedTrades = Object.entries(trades).sort((a, b) => {
    const closeDatesA = a[1].map(p => p.close_date).filter(Boolean);
    const closeDatesB = b[1].map(p => p.close_date).filter(Boolean);
    
    // If both have closes, sort by earliest close
    if (closeDatesA.length > 0 && closeDatesB.length > 0) {
      return Math.min(...closeDatesA.map(d => d.getTime())) - Math.min(...closeDatesB.map(d => d.getTime()));
    }
    
    // Closed trades come before open trades
    if (closeDatesA.length > 0) return -1;
    if (closeDatesB.length > 0) return 1;
    
    // Both open, sort by open date
    return a[1][0].open_date - b[1][0].open_date;
  });
  
  console.log('Trade# | Date | Symbol | Legs | Status | Strikes');
  console.log('='.repeat(70));
  
  let tradeNum = 1;
  
  for (const [key, positions] of sortedTrades) {
    const [date, symbol] = key.split('_');
    const isClosed = positions.every(p => p.status === 'CLOSED');
    const strikes = [...new Set(positions.map(p => p.strike_price))].sort((a,b) => a-b).join('/');
    const closeDate = positions[0].close_date?.toISOString().split('T')[0] || 'OPEN';
    
    // Update ALL positions in this trade
    for (const pos of positions) {
      await prisma.trading_positions.update({
        where: { id: pos.id },
        data: { trade_num: String(tradeNum) }
      });
      
      // Update related transactions
      if (pos.open_investment_txn_id) {
        await prisma.investment_transactions.update({
          where: { id: pos.open_investment_txn_id },
          data: { tradeNum: String(tradeNum) }
        }).catch(() => {});
      }
      if (pos.close_investment_txn_id) {
        await prisma.investment_transactions.update({
          where: { id: pos.close_investment_txn_id },
          data: { tradeNum: String(tradeNum) }
        }).catch(() => {});
      }
    }
    
    console.log(`${String(tradeNum).padStart(3)} | ${closeDate} | ${symbol.padEnd(6)} | ${positions.length} | ${isClosed ? 'CLOSED' : 'OPEN  '} | $${strikes}`);
    tradeNum++;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`🎯 Total trades: ${tradeNum - 1}`);
  
  await prisma.$disconnect();
})();
