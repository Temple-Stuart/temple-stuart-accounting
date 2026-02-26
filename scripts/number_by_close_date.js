const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔄 Numbering trades by CLOSE date...\n');
  
  // Get all positions
  const allPositions = await prisma.trading_positions.findMany({
    include: {
      investment_transactions_trading_positions_open_investment_txn_idToinvestment_transactions: true,
      investment_transactions_trading_positions_close_investment_txn_idToinvestment_transactions: true
    }
  });
  
  // Separate closed vs open
  const closedPositions = allPositions.filter(p => p.status === 'CLOSED' && p.close_date);
  const openPositions = allPositions.filter(p => p.status === 'OPEN');
  
  // Sort closed by close_date
  closedPositions.sort((a, b) => a.close_date - b.close_date);
  
  // Sort open by open_date
  openPositions.sort((a, b) => a.open_date - b.open_date);
  
  console.log('Trade# | Close Date | Symbol | Strategy | Status | Legs');
  console.log('='.repeat(80));
  
  let tradeNum = 1;
  
  // First: number all CLOSED trades
  for (const pos of closedPositions) {
    const openTxn = pos.investment_transactions_trading_positions_open_investment_txn_idToinvestment_transactions;
    const closeTxn = pos.investment_transactions_trading_positions_close_investment_txn_idToinvestment_transactions;
    
    const strategy = openTxn?.strategy || 'Unknown';
    const closeDate = pos.close_date?.toISOString().split('T')[0] || 'N/A';
    
    // Update position
    await prisma.trading_positions.update({
      where: { id: pos.id },
      data: { trade_num: String(tradeNum) }
    });
    
    // Update journal entries
    if (openTxn?.id) {
      await prisma.journal_transactions.updateMany({
        where: { external_transaction_id: openTxn.id },
        data: { trade_num: String(tradeNum) }
      });
      await prisma.investment_transactions.update({
        where: { id: openTxn.id },
        data: { tradeNum: String(tradeNum) }
      });
    }
    
    if (closeTxn?.id) {
      await prisma.journal_transactions.updateMany({
        where: { external_transaction_id: closeTxn.id },
        data: { trade_num: String(tradeNum) }
      });
      await prisma.investment_transactions.update({
        where: { id: closeTxn.id },
        data: { tradeNum: String(tradeNum) }
      });
    }
    
    console.log(`${tradeNum.toString().padStart(3)} | ${closeDate} | ${pos.symbol.padEnd(6)} | ${strategy.padEnd(20)} | CLOSED | Open+Close`);
    tradeNum++;
  }
  
  // Then: number all OPEN trades
  for (const pos of openPositions) {
    const openTxn = pos.investment_transactions_trading_positions_open_investment_txn_idToinvestment_transactions;
    const strategy = openTxn?.strategy || 'Unknown';
    const openDate = pos.open_date?.toISOString().split('T')[0] || 'N/A';
    
    await prisma.trading_positions.update({
      where: { id: pos.id },
      data: { trade_num: String(tradeNum) }
    });
    
    if (openTxn?.id) {
      await prisma.journal_transactions.updateMany({
        where: { external_transaction_id: openTxn.id },
        data: { trade_num: String(tradeNum) }
      });
      await prisma.investment_transactions.update({
        where: { id: openTxn.id },
        data: { tradeNum: String(tradeNum) }
      });
    }
    
    console.log(`${tradeNum.toString().padStart(3)} | ${openDate} | ${pos.symbol.padEnd(6)} | ${strategy.padEnd(20)} | OPEN   | Open only`);
    tradeNum++;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`🎯 Closed trades: ${closedPositions.length}`);
  console.log(`🔵 Open trades: ${openPositions.length}`);
  console.log(`🎯 Total: ${tradeNum - 1}`);
  
  await prisma.$disconnect();
})();
