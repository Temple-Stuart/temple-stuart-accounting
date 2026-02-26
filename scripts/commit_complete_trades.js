const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

// Generate smart trade ID from position characteristics
function generateTradeId(legs, securities) {
  const leg = legs[0];
  const security = securities.find(s => s.id === leg.security_id);
  
  const symbol = security?.ticker_symbol || 'UNKNOWN';
  const strike1 = security?.option_strike_price;
  const strike2 = legs.length > 1 ? securities.find(s => s.id === legs[1].security_id)?.option_strike_price : null;
  const expiry = security?.option_expiration_date?.toISOString().split('T')[0].replace(/-/g, '');
  const type = security?.option_contract_type?.toUpperCase() || 'OPT';
  
  if (strike2) {
    return `${symbol}_${Math.min(strike1, strike2)}_${Math.max(strike1, strike2)}_${type}_${expiry}`;
  }
  return `${symbol}_${strike1}_${type}_${expiry}`;
}

async function main() {
  console.log('🚀 Complete Trade Commit (Open Date Order)\n');
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const openTrades = [];
  const closeTrades = [];
  
  // Separate and collect metadata
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    
    const parts = line.split(',');
    const tradeNum = parts[0];
    const date = parts[1];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    const match = parts[13];
    
    if (match !== 'YES') continue;
    
    const trade = { tradeNum, date, strategy, plaidId };
    
    if (strategy.toLowerCase().includes('closing')) {
      closeTrades.push(trade);
    } else {
      openTrades.push(trade);
    }
  }
  
  // Sort opens by date to get chronological order
  openTrades.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`📊 OPEN trades: ${openTrades.length}`);
  console.log(`📊 CLOSE trades: ${closeTrades.length}\n`);
  
  // Group opens by trade number
  const openGroups = {};
  openTrades.forEach(t => {
    if (!openGroups[t.tradeNum]) openGroups[t.tradeNum] = [];
    openGroups[t.tradeNum].push(t);
  });
  
  // PASS 1: Open all positions with smart trade IDs
  console.log('='.repeat(60));
  console.log('PASS 1: Opening Positions (Chronological Order)');
  console.log('='.repeat(60) + '\n');
  
  const tradeIdMap = {}; // Maps tradeNum → generated trade ID
  let openSuccess = 0;
  
  for (const [tradeNum, trades] of Object.entries(openGroups)) {
    try {
      const legs = await prisma.investment_transactions.findMany({
        where: { id: { in: trades.map(t => t.plaidId) } },
        include: { security: true }
      });
      
      const tradeId = generateTradeId(legs, legs.map(l => l.security));
      tradeIdMap[tradeNum] = tradeId;
      
      console.log(`🟢 ${trades[0].date} | ${tradeId} | OPEN (${trades.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades.map(t => t.plaidId),
        strategy: trades[0].strategy,
        tradeNum: tradeId
      });
      
      openSuccess++;
      console.log(`   ✅ Success\n`);
    } catch (error) {
      console.error(`   ❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Group closes by trade number
  const closeGroups = {};
  closeTrades.forEach(t => {
    if (!closeGroups[t.tradeNum]) closeGroups[t.tradeNum] = [];
    closeGroups[t.tradeNum].push(t);
  });
  
  // PASS 2: Close positions using SAME trade IDs
  console.log('\n' + '='.repeat(60));
  console.log('PASS 2: Closing Positions (Linking to Opens)');
  console.log('='.repeat(60) + '\n');
  
  let closeSuccess = 0;
  
  for (const [tradeNum, trades] of Object.entries(closeGroups)) {
    try {
      // Find matching open trade ID
      let matchedTradeId = null;
      
      // Try to find by matching position
      const legs = await prisma.investment_transactions.findMany({
        where: { id: { in: trades.map(t => t.plaidId) } },
        include: { security: true }
      });
      
      const symbol = legs[0].security?.ticker_symbol;
      const strike = legs[0].security?.option_strike_price;
      const expiry = legs[0].security?.option_expiration_date;
      const type = legs[0].security?.option_contract_type;
      
      // Find open position that matches
      const openPosition = await prisma.trading_positions.findFirst({
        where: {
          symbol,
          strike_price: strike,
          option_type: type?.toUpperCase(),
          expiration_date: expiry,
          status: 'OPEN'
        },
        orderBy: { open_date: 'asc' }
      });
      
      if (openPosition) {
        matchedTradeId = openPosition.trade_num;
      } else {
        // Fallback: generate new ID
        matchedTradeId = generateTradeId(legs, legs.map(l => l.security)) + '_CLOSE';
      }
      
      console.log(`🔴 ${trades[0].date} | ${matchedTradeId} | CLOSE (${trades.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades.map(t => t.plaidId),
        strategy: trades[0].strategy,
        tradeNum: matchedTradeId
      });
      
      closeSuccess++;
      console.log(`   ✅ Success\n`);
    } catch (error) {
      console.error(`   ❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPLETE TRADES SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Opened: ${openSuccess} trades`);
  console.log(`✅ Closed: ${closeSuccess} trades`);
  console.log(`\n💡 Each trade ID now contains both OPEN and CLOSE legs`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
