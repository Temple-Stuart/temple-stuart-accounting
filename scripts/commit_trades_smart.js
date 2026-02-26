const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Smart Two-Pass Trade Commit\n');
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const openTrades = {};
  const closeTrades = {};
  
  // Separate OPEN vs CLOSE transactions
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    
    const parts = line.split(',');
    const tradeNum = parts[0];
    const strategy = parts[3].replace(/"/g, '');
    const plaidId = parts[12];
    const match = parts[13];
    
    if (match !== 'YES') continue;
    
    const isClosing = strategy.toLowerCase().includes('closing');
    const targetObj = isClosing ? closeTrades : openTrades;
    
    if (!targetObj[tradeNum]) {
      targetObj[tradeNum] = { strategy, legs: [] };
    }
    targetObj[tradeNum].legs.push(plaidId);
  }
  
  console.log(`📊 OPEN trades: ${Object.keys(openTrades).length}`);
  console.log(`📊 CLOSE trades: ${Object.keys(closeTrades).length}\n`);
  
  // PASS 1: Commit all OPEN transactions
  console.log('='.repeat(50));
  console.log('PASS 1: Opening All Positions');
  console.log('='.repeat(50) + '\n');
  
  let openSuccess = 0;
  let openFail = 0;
  
  for (const [tradeNum, trade] of Object.entries(openTrades)) {
    try {
      console.log(`🟢 Trade ${tradeNum}: ${trade.strategy} (${trade.legs.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.legs,
        strategy: trade.strategy,
        tradeNum: `OPEN_${tradeNum}`
      });
      
      openSuccess++;
      console.log(`✅ Success\n`);
    } catch (error) {
      openFail++;
      console.error(`❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // PASS 2: Commit all CLOSE transactions
  console.log('\n' + '='.repeat(50));
  console.log('PASS 2: Closing All Positions');
  console.log('='.repeat(50) + '\n');
  
  let closeSuccess = 0;
  let closeFail = 0;
  
  for (const [tradeNum, trade] of Object.entries(closeTrades)) {
    try {
      console.log(`🔴 Trade ${tradeNum}: ${trade.strategy} (${trade.legs.length} legs)`);
      
      await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.legs,
        strategy: trade.strategy,
        tradeNum: `CLOSE_${tradeNum}`
      });
      
      closeSuccess++;
      console.log(`✅ Success\n`);
    } catch (error) {
      closeFail++;
      console.error(`❌ ${error.response?.data?.error || error.message}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(50));
  console.log(`PASS 1 - OPEN: ${openSuccess}/${openSuccess + openFail} (${((openSuccess/(openSuccess+openFail))*100).toFixed(1)}%)`);
  console.log(`PASS 2 - CLOSE: ${closeSuccess}/${closeSuccess + closeFail} (${((closeSuccess/(closeSuccess+closeFail))*100).toFixed(1)}%)`);
  console.log(`TOTAL: ${openSuccess + closeSuccess}/${openSuccess + openFail + closeSuccess + closeFail}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
