const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function main() {
  console.log('🎯 Finding assignment/exercise pairs...\n');
  
  // Find all transfer transactions (exercise/assignment)
  const transfers = await prisma.investment_transactions.findMany({
    where: {
      type: 'transfer',
      subtype: { in: ['exercise', 'assignment'] }
    },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  
  console.log(`Found ${transfers.length} transfer transactions\n`);
  
  // Find corresponding stock transactions
  const pairs = [];
  
  for (const transfer of transfers) {
    // Extract symbol and strike from name
    const nameMatch = transfer.name.match(/(\w+)\s+call.*\$?(\d+\.?\d*)/i);
    if (!nameMatch) continue;
    
    const symbol = nameMatch[1];
    const strike = parseFloat(nameMatch[2]);
    
    // Find the matching stock transaction (same date, same symbol)
    const stockTxn = await prisma.investment_transactions.findFirst({
      where: {
        date: transfer.date,
        type: 'buy',
        subtype: { in: ['buy', 'sell'] },
        name: {
          contains: symbol,
          mode: 'insensitive'
        },
        price: strike
      },
      include: { security: true }
    });
    
    if (stockTxn) {
      pairs.push({
        transferId: transfer.id,
        stockId: stockTxn.id,
        symbol,
        strike,
        type: transfer.subtype,
        date: transfer.date.toISOString().split('T')[0]
      });
      
      console.log(`✅ Paired: ${symbol} $${strike} ${transfer.subtype} on ${pairs[pairs.length-1].date}`);
    } else {
      console.log(`⚠️  No stock match for: ${transfer.name}`);
    }
  }
  
  console.log(`\n📊 Total pairs found: ${pairs.length}\n`);
  
  if (pairs.length === 0) {
    console.log('No pairs to commit.');
    await prisma.$disconnect();
    return;
  }
  
  // Group pairs by date for trade numbering
  const pairsByDate = {};
  pairs.forEach(p => {
    if (!pairsByDate[p.date]) pairsByDate[p.date] = [];
    pairsByDate[p.date].push(p);
  });
  
  // Commit pairs
  for (const [date, datePairs] of Object.entries(pairsByDate)) {
    console.log(`\n🚀 Committing ${datePairs.length} pairs from ${date}...`);
    
    try {
      const response = await axios.post('http://localhost:3000/api/investments/assignment-exercise', {
        pairs: datePairs.map(p => ({ transferId: p.transferId, stockId: p.stockId })),
        strategy: `${datePairs[0].symbol} ITM Spread Expiration`,
        tradeNum: `EXP_${date}`
      });
      
      console.log(`✅ Success: ${response.data.processed} pairs committed`);
    } catch (error) {
      console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
