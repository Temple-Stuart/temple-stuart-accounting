const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔍 Trade Verification Report\n');
  
  // Get all positions
  const positions = await prisma.trading_positions.findMany({
    orderBy: { open_date: 'asc' }
  });
  
  // Group by open_date + symbol
  const tradeGroups = {};
  
  for (const pos of positions) {
    const openDate = pos.open_date.toISOString().split('T')[0];
    const key = `${openDate}_${pos.symbol}`;
    
    if (!tradeGroups[key]) {
      tradeGroups[key] = [];
    }
    tradeGroups[key].push(pos);
  }
  
  // Sort by earliest close date
  const sortedGroups = Object.entries(tradeGroups).sort((a, b) => {
    const closeDatesA = a[1].map(p => p.close_date).filter(Boolean);
    const closeDatesB = b[1].map(p => p.close_date).filter(Boolean);
    
    if (closeDatesA.length > 0 && closeDatesB.length > 0) {
      return Math.min(...closeDatesA.map(d => d.getTime())) - Math.min(...closeDatesB.map(d => d.getTime()));
    }
    if (closeDatesA.length > 0) return -1;
    if (closeDatesB.length > 0) return 1;
    return a[1][0].open_date - b[1][0].open_date;
  });
  
  // Get strategy from investment_transactions for each trade
  console.log('Trade# | Ticker | Open Date  | Close Date | Strategy             | P/L      | Legs | Strikes');
  console.log('='.repeat(100));
  
  for (const [key, positions] of sortedGroups.slice(0, 50)) {
    const [openDate, symbol] = key.split('_');
    const tradeNum = positions[0].trade_num || '???';
    const closeDate = positions[0].close_date?.toISOString().split('T')[0] || 'OPEN';
    
    // Get strategy from investment_transactions
    let strategy = 'Unknown';
    if (positions[0].open_investment_txn_id) {
      const txn = await prisma.investment_transactions.findUnique({
        where: { id: positions[0].open_investment_txn_id }
      });
      strategy = txn?.strategy || 'Unknown';
    }
    
    // Calculate total P/L
    let totalPL = 0;
    for (const pos of positions) {
      if (pos.realized_pnl) totalPL += Number(pos.realized_pnl);
    }
    
    const strikes = [...new Set(positions.map(p => p.strike_price))].sort((a,b) => a-b).join('/');
    const plDisplay = totalPL !== 0 ? `$${totalPL.toFixed(2)}` : '-';
    
    console.log(`${tradeNum.padStart(3)} | ${symbol.padEnd(6)} | ${openDate} | ${closeDate.padEnd(10)} | ${strategy.padEnd(20)} | ${plDisplay.padStart(8)} | ${positions.length} | $${strikes}`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('📊 Showing first 50 trades\n');
  
  await prisma.$disconnect();
})();
