const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔄 Numbering trades by CLOSE date...\n');
  
  // Get all positions (no includes needed)
  const allPositions = await prisma.trading_positions.findMany({
    orderBy: { close_date: 'asc' }
  });
  
  // Separate closed vs open
  const closedPositions = allPositions.filter(p => p.status === 'CLOSED' && p.close_date);
  const openPositions = allPositions.filter(p => p.status === 'OPEN');
  
  console.log('Trade# | Close Date | Symbol | Strike | Type | Status');
  console.log('='.repeat(70));
  
  let tradeNum = 1;
  
  // Number CLOSED positions
  for (const pos of closedPositions) {
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
    
    const closeDate = pos.close_date.toISOString().split('T')[0];
    console.log(`${tradeNum.toString().padStart(3)} | ${closeDate} | ${pos.symbol.padEnd(6)} | $${pos.strike_price} | ${pos.option_type} | CLOSED`);
    tradeNum++;
  }
  
  // Number OPEN positions
  for (const pos of openPositions) {
    await prisma.trading_positions.update({
      where: { id: pos.id },
      data: { trade_num: String(tradeNum) }
    });
    
    if (pos.open_investment_txn_id) {
      await prisma.investment_transactions.update({
        where: { id: pos.open_investment_txn_id },
        data: { tradeNum: String(tradeNum) }
      }).catch(() => {});
    }
    
    const openDate = pos.open_date.toISOString().split('T')[0];
    console.log(`${tradeNum.toString().padStart(3)} | ${openDate} | ${pos.symbol.padEnd(6)} | $${pos.strike_price} | ${pos.option_type} | OPEN`);
    tradeNum++;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`🎯 Total: ${tradeNum - 1} positions`);
  
  await prisma.$disconnect();
})();
