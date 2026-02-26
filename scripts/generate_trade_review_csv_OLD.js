const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

/**
 * Parse Robinhood TXT - COMPLETE REWRITE
 * Split by "Download Trade Confirmation", check Status, parse all formats
 */
function parseRobinhoodHistory(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Split into blocks by separator
  const blocks = content.split('Download Trade Confirmation');
  
  const trades = [];
  
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    // Skip if no Status line or not Filled
    const statusIdx = lines.indexOf('Status');
    if (statusIdx === -1 || lines[statusIdx + 1] !== 'Filled') {
      continue;
    }
    
    // Extract title (first line that looks like a trade)
    let title = null;
    for (const line of lines) {
      if (line.match(/^[A-Z]{2,5}\s+(Call|Put|Short|2-Option)/i) || 
          line.match(/^(Buy|Sell)\s+[A-Z]{2,5}\s+\$/)) {
        title = line;
        break;
      }
    }
    
    if (!title) continue;
    
    // Extract symbol from title
    const symbolMatch = title.match(/^(?:Buy|Sell)?\s*([A-Z]{2,5})/);
    const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';
    
    // Extract date (format: "Oct 15" or "Oct 15, 2025")
    let date = null;
    for (const line of lines) {
      if (line.match(/^[A-Z][a-z]{2}\s+\d{1,2}(,\s+\d{4})?$/)) {
        date = line;
        break;
      }
    }
    
    // Extract fees
    let fees = 0;
    const feeIdx = lines.indexOf('Est regulatory fees');
    if (feeIdx !== -1 && lines[feeIdx + 1]) {
      fees = parseFloat(lines[feeIdx + 1].replace('$', '')) || 0;
    }
    
    // Parse legs - look for "Filled quantity" markers
    const legs = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find leg descriptor: "Buy/Sell SYMBOL $STRIKE Call/Put EXPIRY"
      const legMatch = line.match(/^(Buy|Sell)\s+([A-Z]{2,5})\s+\$?([\d.]+)\s+(Call|Put)\s+([\d\/]+)$/);
      
      if (legMatch) {
        // Look ahead for Position Effect
        let positionEffect = null;
        for (let j = i + 1; j < i + 10 && j < lines.length; j++) {
          if (lines[j] === 'Position effect') {
            positionEffect = lines[j + 1]?.toLowerCase();
            break;
          }
        }
        
        // Look ahead for Filled quantity
        let filledQty = null;
        let filledPrice = null;
        for (let j = i + 1; j < i + 15 && j < lines.length; j++) {
          const filledMatch = lines[j].match(/^([\d.]+)\s+contract[s]?\s+at\s+\$([\d.]+)$/);
          if (filledMatch) {
            filledQty = parseFloat(filledMatch[1]);
            filledPrice = parseFloat(filledMatch[2]);
            break;
          }
        }
        
        // Only add if it has filled quantity (executed leg)
        if (filledQty && filledPrice) {
          legs.push({
            action: legMatch[1].toLowerCase(),
            symbol: legMatch[2],
            strike: parseFloat(legMatch[3]),
            contractType: legMatch[4].toLowerCase(),
            expiry: legMatch[5],
            positionEffect: positionEffect || 'unknown',
            quantity: filledQty,
            price: filledPrice
          });
        }
      }
    }
    
    // Only add if we found executed legs
    if (legs.length > 0) {
      trades.push({
        title,
        symbol,
        strategy: title, // Use full title as strategy
        date: date || 'UNKNOWN',
        fees,
        legs
      });
    }
  }
  
  return trades;
}

/**
 * Convert RH date string to Date object
 */
function parseRHDate(dateStr) {
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const parts = dateStr.replace(',', '').split(' ');
  const month = months[parts[0]];
  const day = parseInt(parts[1]);
  const year = parts[2] ? parseInt(parts[2]) : 2025;
  
  return new Date(year, month, day);
}

/**
 * Match RH leg to Plaid transaction
 */
async function matchLegToPlaid(leg, trade, plaidTxns) {
  const rhDate = parseRHDate(trade.date);
  
  const matches = plaidTxns.filter(txn => {
    const txnDate = new Date(txn.date);
    const daysDiff = Math.abs(txnDate - rhDate) / (1000 * 60 * 60 * 24);
    
    const strikeMatch = txn.security?.option_strike_price === leg.strike;
    const typeMatch = txn.security?.option_contract_type === leg.contractType;
    const actionMatch = txn.type === leg.action;
    
    const nameMatch = leg.positionEffect === 'open' ? 
      txn.name.toLowerCase().includes('to open') :
      leg.positionEffect === 'close' ?
      txn.name.toLowerCase().includes('to close') :
      true; // unknown position effect, match anyway
    
    return daysDiff <= 7 && strikeMatch && typeMatch && actionMatch && nameMatch;
  });
  
  return matches[0] || null;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Generating Trade Review CSV (FIXED PARSER)...\n');
  
  // Parse TXT
  console.log('📄 Parsing robinhood_history.txt...');
  const trades = parseRobinhoodHistory('./robinhood_history.txt');
  console.log(`✅ Found ${trades.length} FILLED trades\n`);
  
  // Show summary
  console.log('📊 Trade Summary:');
  trades.slice(0, 10).forEach((t, idx) => {
    console.log(`  ${idx + 1}. ${t.date} - ${t.symbol} (${t.legs.length} legs)`);
  });
  if (trades.length > 10) {
    console.log(`  ... and ${trades.length - 10} more`);
  }
  console.log('');
  
  // Fetch Plaid transactions
  console.log('🔍 Fetching Plaid transactions...');
  const plaidTxns = await prisma.investment_transactions.findMany({
    where: {
      date: { gte: new Date('2025-06-01') },
      security: { option_contract_type: { not: null } }
    },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  console.log(`✅ Found ${plaidTxns.length} Plaid transactions\n`);
  
  // Build CSV rows
  const csvRows = [
    'Trade#,Date,Symbol,Strategy,Leg#,Action,Strike,Type,PositionEffect,PlaidID,Match,Fees'
  ];
  
  let tradeNum = 1;
  let matchedCount = 0;
  let unmatchedCount = 0;
  
  for (const trade of trades) {
    const feePerLeg = trade.fees / trade.legs.length;
    
    for (let i = 0; i < trade.legs.length; i++) {
      const leg = trade.legs[i];
      const match = await matchLegToPlaid(leg, trade, plaidTxns);
      
      const row = [
        tradeNum,
        trade.date,
        trade.symbol,
        `"${trade.strategy}"`, // Quote strategy to handle commas
        i + 1,
        leg.action,
        leg.strike,
        leg.contractType,
        leg.positionEffect,
        match ? match.id : 'NO_MATCH',
        match ? 'YES' : 'NO',
        feePerLeg.toFixed(4)
      ];
      
      csvRows.push(row.join(','));
      
      if (match) {
        matchedCount++;
      } else {
        unmatchedCount++;
        console.log(`⚠️  No match: Trade #${tradeNum} - ${trade.symbol} ${leg.strike} ${leg.contractType} ${leg.action} ${leg.positionEffect}`);
      }
    }
    
    tradeNum++;
  }
  
  // Write CSV
  const csvContent = csvRows.join('\n');
  fs.writeFileSync('trade_review.csv', csvContent);
  
  console.log(`\n✅ Generated trade_review.csv`);
  console.log(`📊 Total legs: ${csvRows.length - 1}`);
  console.log(`✅ Matched: ${matchedCount}`);
  console.log(`❌ Unmatched: ${unmatchedCount}`);
  console.log(`\n📋 NEXT STEPS:`);
  console.log(`1. Open trade_review.csv`);
  console.log(`2. Review unmatched rows`);
  console.log(`3. Run: node scripts/commit_from_csv.js`);
  
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
