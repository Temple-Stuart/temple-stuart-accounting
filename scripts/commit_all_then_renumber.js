const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Three-Pass Trade Commit\n');
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const openTrades = [];
  const closeTrades = [];
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    
    const parts = line.split(',');
    const tradeNum = parts[0];
    const date = parts[1];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    const match = parts[13];
    
    if (match !== 'YES') continue;
    
    if (strategy.toLowerCase().includes('closing')) {
      closeTrades.push({ tradeNum, date, strategy, plaidId });
    } else {
      openTrades.push({ tradeNum, date, strategy, plaidId });
    }
  }
  
  // Sort by date
  openTrades.sort((a, b) => new Date(a.date) - new Date(b.date));
  closeTrades.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Group opens by CSV trade number
  const openGroups = {};
  openTrades.forEach(t => {
    if (!openGroups[t.tradeNum]) openGroups[t.tradeNum] = [];
    openGroups[t.tradeNum].push(t);
  });
  
  // Group closes by CSV trade number
  const closeGroups = {};
  closeTrades.forEach(t => {
    if (!closeGroups[t.tradeNum]) closeGroups[t.tradeNum] = [];
    closeGroups[t.tradeNum].push(t);
  });
  
  console.log(`📊 OPEN groups: ${Object.keys(openGroups).length}`);
  console.log(`📊 CLOSE groups: ${Object.keys(closeGroups).length}\n`);
  
  // PASS 1: Open all with temp IDs
  console.log('='.repeat(60));
  console.log('PASS 1: Opening All Positions');
  console.log('='.repeat(60) + '\n');
  
  let openSuccess = 0;
  
  for (const [origNum, trades] of Object.entries(openGroups)) {
    try {
      console.log(`🟢 ${trades[0].date} | ${trades[0].strategy} (${trades.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades.map(t => t.plaidId),
        strategy: trades[0].strategy,
        tradeNum: `TEMP_OPEN_${origNum}`
      });
      
      openSuccess++;
      console.log(`   ✅ Opened\n`);
    } catch (error) {
      console.error(`   ❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // PASS 2: Close all (DB will match by position)
  console.log('\n' + '='.repeat(60));
  console.log('PASS 2: Closing All Positions');
  console.log('='.repeat(60) + '\n');
  
  let closeSuccess = 0;
  let closeFail = 0;
  
  for (const [origNum, trades] of Object.entries(closeGroups)) {
    try {
      console.log(`🔴 ${trades[0].date} | ${trades[0].strategy} (${trades.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades.map(t => t.plaidId),
        strategy: trades[0].strategy,
        tradeNum: `TEMP_CLOSE_${origNum}`
      });
      
      closeSuccess++;
      console.log(`   ✅ Closed\n`);
    } catch (error) {
      closeFail++;
      console.error(`   ❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // PASS 3: Renumber everything sequentially
  console.log('\n' + '='.repeat(60));
  console.log('PASS 3: Renumbering Trades Sequentially');
  console.log('='.repeat(60) + '\n');
  
  // Get all positions ordered by open date
  const positions = await prisma.trading_positions.findMany({
    orderBy: { open_date: 'asc' }
  });
  
  // Group by position characteristics to find complete trades
  const tradeGroups = {};
  
  for (const pos of positions) {
    const key = `${pos.symbol}_${pos.strike_price}_${pos.option_type}_${pos.expiration_date?.toISOString()}`;
    if (!tradeGroups[key]) tradeGroups[key] = [];
    tradeGroups[key].push(pos);
  }
  
  let tradeNum = 1;
  
  for (const [key, positions] of Object.entries(tradeGroups)) {
    const newTradeNum = String(tradeNum++);
    
    for (const pos of positions) {
      await prisma.trading_positions.update({
        where: { id: pos.id },
        data: { trade_num: newTradeNum }
      });
    }
    
    // Update journal transactions
    const posIds = positions.map(p => p.open_investment_txn_id);
    await prisma.journal_transactions.updateMany({
      where: { external_transaction_id: { in: posIds } },
      data: { trade_num: newTradeNum }
    });
    
    console.log(`✅ Trade ${newTradeNum}: ${positions[0].symbol} ${positions[0].strike_price} ${positions[0].option_type} (${positions.length} positions)`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Opened: ${openSuccess} position groups`);
  console.log(`✅ Closed: ${closeSuccess} position groups`);
  console.log(`❌ Failed closes: ${closeFail} (may be from before CSV date range)`);
  console.log(`🎯 Total complete trades: ${tradeNum - 1}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
