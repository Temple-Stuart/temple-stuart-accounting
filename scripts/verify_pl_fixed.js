const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 Trade P&L (FIXED SIGNS)\n');
  
  const positions = await prisma.trading_positions.findMany({
    orderBy: { trade_num: 'asc' }
  });
  
  const trades = {};
  
  for (const pos of positions) {
    const tradeNum = pos.trade_num;
    if (!trades[tradeNum]) {
      trades[tradeNum] = { pl: 0, symbol: pos.symbol, openDate: pos.open_date, status: 'OPEN' };
    }
    
    const openTxn = await prisma.investment_transactions.findUnique({
      where: { id: pos.open_investment_txn_id }
    });
    
    // FIX: Multiply by -1 to flip the sign!
    trades[tradeNum].pl += Number(openTxn.amount) * -1 * 100;
    
    if (pos.close_investment_txn_id) {
      const closeTxn = await prisma.investment_transactions.findUnique({
        where: { id: pos.close_investment_txn_id }
      });
      trades[tradeNum].pl += Number(closeTxn.amount) * -1 * 100;
      trades[tradeNum].status = 'CLOSED';
    }
  }
  
  console.log('Trade# | Symbol | Open Date  | Status | P&L');
  console.log('='.repeat(60));
  
  for (const [num, trade] of Object.entries(trades).slice(0, 30)) {
    const plDisplay = trade.status === 'CLOSED' ? `$${trade.pl.toFixed(2)}` : '-';
    const date = trade.openDate.toISOString().split('T')[0];
    console.log(`${num.padStart(3)} | ${trade.symbol.padEnd(6)} | ${date} | ${trade.status.padEnd(6)} | ${plDisplay.padStart(10)}`);
  }
  
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
})();
