const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Batch Committing All Option Trades...\n');
  
  // Read CSV
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1); // Skip header
  
  // Group by trade number
  const trades = {};
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    
    const parts = line.split(',');
    const tradeNum = parts[0];
    const plaidId = parts[12];
    const match = parts[13];
    
    if (match !== 'YES') {
      console.log(`⚠️  Skipping unmatched leg: ${plaidId}`);
      continue;
    }
    
    if (!trades[tradeNum]) {
      trades[tradeNum] = {
        symbol: parts[2],
        strategy: parts[3].replace(/"/g, ''),
        legs: []
      };
    }
    
    trades[tradeNum].legs.push(plaidId);
  }
  
  console.log(`📊 Total trades to commit: ${Object.keys(trades).length}`);
  console.log(`📊 Total legs: ${Object.values(trades).reduce((sum, t) => sum + t.legs.length, 0)}\n`);
  
  // Commit trades
  let successCount = 0;
  let errorCount = 0;
  
  for (const [tradeNum, trade] of Object.entries(trades)) {
    try {
      console.log(`\n🔄 Trade ${tradeNum}: ${trade.strategy} (${trade.legs.length} legs)`);
      
      const response = await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        transactionIds: trade.legs,
        strategy: trade.strategy,
        tradeNum: `TRADE_${tradeNum}`
      });
      
      if (response.data.success) {
        successCount++;
        console.log(`✅ Committed successfully`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    
    // Brief pause to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 BATCH COMMIT SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`🎯 Success Rate: ${((successCount / (successCount + errorCount)) * 100).toFixed(1)}%`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
