const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔄 Correct Trade Numbering (Groups by Close Date)...\n');
  
  // Get all positions
  const allPositions = await prisma.trading_positions.findMany();
  
  // Group by open_date + symbol (= one complete spread/trade)
  const tradeGroups = {};
  
  for (const pos of allPositions) {
    const openDate = pos.open_date.toISOString().split('T')[0];
    const key = `${openDate}_${pos.symbol}`;
    
    if (!tradeGroups[key]) {
      tradeGroups[key] = {
        positions: [],
        earliestClose: null,
        allClosed: true
      };
    }
    
    tradeGroups[key].positions.push(pos);
    
    if (pos.close_date) {
      if (!tradeGroups[key].earliestClose || pos.close_date < tradeGroups[key].earliestClose) {
        tradeGroups[key].earliestClose = pos.close_date;
      }
    } else {
      tradeGroups[key].allClosed = false;
    }
  }
  
  // Sort: closed trades first (by close date), then open trades (by open date)
  const sortedGroups = Object.entries(tradeGroups).sort((a, b) => {
    const [keyA, groupA] = a;
    const [keyB, groupB] = b;
    
    // Both closed: sort by close date
    if (groupA.earliestClose && groupB.earliestClose) {
      return groupA.earliestClose - groupB.earliestClose;
    }
    
    // Closed before open
    if (groupA.earliestClose) return -1;
    if (groupB.earliestClose) return 1;
    
    // Both open: sort by open date
    return groupA.positions[0].open_date - groupB.positions[0].open_date;
  });
  
  console.log('Trade# | Close Date | Symbol | Legs | Strikes');
  console.log('='.repeat(65));
  
  let tradeNum = 1;
  
  for (const [key, group] of sortedGroups) {
    const [openDate, symbol] = key.split('_');
    const closeDate = group.earliestClose?.toISOString().split('T')[0] || 'OPEN';
    const strikes = [...new Set(group.positions.map(p => p.strike_price))].sort((a,b) => a-b).join('/');
    
    // Assign SAME trade number to ALL positions in this group
    for (const pos of group.positions) {
      await prisma.trading_positions.update({
        where: { id: pos.id },
        data: { trade_num: String(tradeNum) }
      });
      
      if (pos.open_investment_txn_id) {
        await prisma.investment_transactions.updateMany({
          where: { id: pos.open_investment_txn_id },
          data: { tradeNum: String(tradeNum) }
        }).catch(() => {});
      }
      
      if (pos.close_investment_txn_id) {
        await prisma.investment_transactions.updateMany({
          where: { id: pos.close_investment_txn_id },
          data: { tradeNum: String(tradeNum) }
        }).catch(() => {});
      }
    }
    
    console.log(`${String(tradeNum).padStart(3)} | ${closeDate.padEnd(10)} | ${symbol.padEnd(6)} | ${group.positions.length} | $${strikes}`);
    tradeNum++;
  }
  
  console.log('\n' + '='.repeat(65));
  console.log(`🎯 Total complete trades: ${tradeNum - 1}`);
  
  await prisma.$disconnect();
})();
