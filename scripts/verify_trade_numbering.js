const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔍 Trade Verification Report\n');
  
  // Get all positions with related transaction data
  const positions = await prisma.trading_positions.findMany({
    include: {
      investment_transactions_trading_positions_open_investment_txn_idToinvestment_transactions: true,
      investment_transactions_trading_positions_close_investment_txn_idToinvestment_transactions: true
    },
    orderBy: { open_date: 'asc' }
  });
  
  // Group by open_date + symbol to show complete trades
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
  
  console.log('Trade# | Ticker | Open Date  | Close Date | Strategy             | P/L      | Legs | Strikes');
  console.log('='.repeat(95));
  
  for (const [key, positions] of sortedGroups.slice(0, 50)) {
    const [openDate, symbol] = key.split('_');
    const tradeNum = positions[0].trade_num || '???';
    const closeDate = positions[0].close_date?.toISOString().split('T')[0] || 'OPEN';
    
    // Get strategy from first transaction
    const openTxn = positions[0].investment_transactions_trading_positions_open_investment_txn_idToinvestment_transactions;
    const strategy = openTxn?.strategy || 'Unknown';
    
    // Calculate total P/L
    let totalPL = 0;
    for (const pos of positions) {
      if (pos.realized_pnl) totalPL += Number(pos.realized_pnl);
    }
    
    const strikes = [...new Set(positions.map(p => p.strike_price))].sort((a,b) => a-b).join('/');
    const plDisplay = totalPL !== 0 ? `$${totalPL.toFixed(2)}` : 'N/A';
    
    console.log(`${tradeNum.padStart(3)} | ${symbol.padEnd(6)} | ${openDate} | ${closeDate.padEnd(10)} | ${strategy.padEnd(20)} | ${plDisplay.padStart(8)} | ${positions.length} | $${strikes}`);
  }
  
  console.log('\n' + '='.repeat(95));
  console.log('Showing first 50 trades. Want to see more? Let me know!\n');
  
  await prisma.$disconnect();
})();
