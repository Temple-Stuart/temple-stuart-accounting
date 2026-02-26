const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Regrouping trades by date + symbol...\n');
  
  // Get all positions ordered by open date
  const positions = await prisma.trading_positions.findMany({
    orderBy: [{ open_date: 'asc' }, { symbol: 'asc' }]
  });
  
  // Group by date + symbol (all legs of a spread opened same day)
  const tradeGroups = {};
  
  for (const pos of positions) {
    const dateKey = pos.open_date.toISOString().split('T')[0];
    const key = `${dateKey}_${pos.symbol}`;
    
    if (!tradeGroups[key]) {
      tradeGroups[key] = [];
    }
    tradeGroups[key].push(pos);
  }
  
  // Renumber sequentially
  let tradeNum = 1;
  
  for (const [key, positions] of Object.entries(tradeGroups)) {
    const newTradeNum = String(tradeNum++);
    const [date, symbol] = key.split('_');
    
    // Update all positions in this group
    for (const pos of positions) {
      await prisma.trading_positions.update({
        where: { id: pos.id },
        data: { trade_num: newTradeNum }
      });
    }
    
    // Update journal entries
    const posIds = positions.map(p => p.open_investment_txn_id).filter(Boolean);
    const closeIds = positions.map(p => p.close_investment_txn_id).filter(Boolean);
    
    await prisma.journal_transactions.updateMany({
      where: { external_transaction_id: { in: [...posIds, ...closeIds] } },
      data: { trade_num: newTradeNum }
    });
    
    console.log(`✅ Trade ${newTradeNum}: ${date} | ${symbol} (${positions.length} positions)`);
  }
  
  console.log(`\n🎯 Total trades: ${tradeNum - 1}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
