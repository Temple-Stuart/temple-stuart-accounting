const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Sequential Trade Commit\n');
  
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
  
  // Group by original trade number
  const openGroups = {};
  openTrades.forEach(t => {
    if (!openGroups[t.tradeNum]) openGroups[t.tradeNum] = [];
    openGroups[t.tradeNum].push(t);
  });
  
  console.log(`📊 OPEN trades: ${Object.keys(openGroups).length}`);
  console.log(`📊 CLOSE trades to match: ${closeTrades.length}\n`);
  
  // PASS 1: Open all with sequential IDs
  console.log('='.repeat(60));
  console.log('PASS 1: Opening Positions (Sequential)');
  console.log('='.repeat(60) + '\n');
  
  let tradeCounter = 1;
  const tradeIdMap = {}; // maps original CSV tradeNum → sequential ID
  let openSuccess = 0;
  
  for (const [origNum, trades] of Object.entries(openGroups)) {
    const seqId = String(tradeCounter++);
    tradeIdMap[origNum] = seqId;
    
    try {
      console.log(`🟢 Trade ${seqId} | ${trades[0].date} | ${trades[0].strategy} (${trades.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades.map(t => t.plaidId),
        strategy: trades[0].strategy,
        tradeNum: seqId
      });
      
      openSuccess++;
      console.log(`   ✅ Success\n`);
    } catch (error) {
      console.error(`   ❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Group closes
  const closeGroups = {};
  closeTrades.forEach(t => {
    if (!closeGroups[t.tradeNum]) closeGroups[t.tradeNum] = [];
    closeGroups[t.tradeNum].push(t);
  });
  
  // PASS 2: Close using matched IDs
  console.log('\n' + '='.repeat(60));
  console.log('PASS 2: Closing Positions');
  console.log('='.repeat(60) + '\n');
  
  let closeSuccess = 0;
  
  for (const [origNum, trades] of Object.entries(closeGroups)) {
    const matchedId = tradeIdMap[origNum];
    
    if (!matchedId) {
      console.log(`⚠️  No matching open for trade ${origNum}, skipping...`);
      continue;
    }
    
    try {
      console.log(`🔴 Trade ${matchedId} | ${trades[0].date} | ${trades[0].strategy} (${trades.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trades.map(t => t.plaidId),
        strategy: trades[0].strategy,
        tradeNum: matchedId
      });
      
      closeSuccess++;
      console.log(`   ✅ Success\n`);
    } catch (error) {
      console.error(`   ❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Opened: ${openSuccess} trades`);
  console.log(`✅ Closed: ${closeSuccess} trades`);
  console.log(`\n💡 Trades numbered 1-${tradeCounter - 1} in chronological order`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
