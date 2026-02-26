const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

(async () => {
  console.log('🔄 Renumbering trades using CSV groupings...\n');
  
  // Parse CSV
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const csvTrades = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    const csvNum = parts[0];
    const date = parts[1];
    const symbol = parts[2];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    
    if (!csvTrades[csvNum]) {
      csvTrades[csvNum] = { date, symbol, strategy, plaidIds: [] };
    }
    csvTrades[csvNum].plaidIds.push(plaidId);
  }
  
  // Sort by date
  const sortedTrades = Object.entries(csvTrades).sort((a, b) => 
    new Date(a[1].date) - new Date(b[1].date)
  );
  
  console.log('Trade# | Date | Symbol | Strategy | Legs');
  console.log('='.repeat(70));
  
  let newNum = 1;
  for (const [csvNum, trade] of sortedTrades) {
    // Update all positions with these plaid IDs
    await prisma.trading_positions.updateMany({
      where: { 
        OR: [
          { open_investment_txn_id: { in: trade.plaidIds } },
          { close_investment_txn_id: { in: trade.plaidIds } }
        ]
      },
      data: { trade_num: String(newNum) }
    });
    
    // Update journal entries
    await prisma.journal_transactions.updateMany({
      where: { external_transaction_id: { in: trade.plaidIds } },
      data: { trade_num: String(newNum) }
    });
    
    // Update investment transactions
    await prisma.investment_transactions.updateMany({
      where: { id: { in: trade.plaidIds } },
      data: { tradeNum: String(newNum) }
    });
    
    console.log(`${newNum.toString().padStart(3)} | ${trade.date} | ${trade.symbol.padEnd(6)} | ${trade.strategy.padEnd(20)} | ${trade.plaidIds.length} legs`);
    newNum++;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`🎯 Total trades: ${newNum - 1}`);
  
  await prisma.$disconnect();
})();
