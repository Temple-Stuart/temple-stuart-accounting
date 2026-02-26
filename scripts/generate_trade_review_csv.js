const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

function parseRobinhoodHistory(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split('Download Trade Confirmation');
  const trades = [];
  
  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    const statusIdx = lines.indexOf('Status');
    if (statusIdx === -1 || lines[statusIdx + 1] !== 'Filled') {
      continue;
    }
    
    const filledSectionStart = statusIdx + 2;
    const filledLines = lines.slice(filledSectionStart);
    
    let blockDate = null;
    for (let i = 0; i < Math.min(statusIdx, 30); i++) {
      const line = lines[i];
      const dateMatch = line.match(/^([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s+(\d{4}))?$/);
      if (dateMatch) {
        blockDate = line;
        break;
      }
    }
    
    let fees = 0;
    const feeIdx = lines.indexOf('Est regulatory fees');
    if (feeIdx !== -1 && feeIdx < statusIdx && lines[feeIdx + 1]) {
      fees = parseFloat(lines[feeIdx + 1].replace('$', '')) || 0;
    }
    
    let strategyTitle = 'Unknown Strategy';
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      if (line.length > 5 && !line.match(/^\d/) && !line.includes('Pending') && !line.includes('Recent') && !line.includes('Older')) {
        strategyTitle = line;
        break;
      }
    }
    
    const legs = [];
    for (let i = 0; i < filledLines.length; i++) {
      const line = filledLines[i];
      
      const legMatch = line.match(/^(Buy|Sell)\s+([A-Z]{2,5})\s+\$?([\d.]+)\s+(Call|Put)\s+([\d\/]+)$/);
      
      if (legMatch) {
        const [, action, symbol, strike, contractType, expiry] = legMatch;
        
        let positionEffect = null;
        for (let j = i + 1; j < i + 10 && j < filledLines.length; j++) {
          if (filledLines[j] === 'Position effect' && filledLines[j + 1]) {
            positionEffect = filledLines[j + 1].toLowerCase();
            break;
          }
        }
        
        let filledQty = null;
        let filledPrice = null;
        for (let j = i + 1; j < i + 15 && j < filledLines.length; j++) {
          const filledMatch = filledLines[j].match(/^([\d.]+)\s+contract[s]?\s+at\s+\$([\d.]+)$/);
          if (filledMatch) {
            filledQty = parseFloat(filledMatch[1]);
            filledPrice = parseFloat(filledMatch[2]);
            break;
          }
        }
        
        let filledDate = null;
        for (let j = i + 1; j < i + 20 && j < filledLines.length; j++) {
          if (filledLines[j] === 'Filled' && filledLines[j + 1]) {
            const dateMatch = filledLines[j + 1].match(/^(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const month = dateMatch[1].padStart(2, '0');
              const day = dateMatch[2].padStart(2, '0');
              filledDate = `2025-${month}-${day}`;
            }
            break;
          }
        }
        
        if (filledQty && filledPrice) {
          legs.push({
            action: action.toLowerCase(),
            symbol: symbol,
            strike: parseFloat(strike),
            contractType: contractType.toLowerCase(),
            expiry: expiry,
            positionEffect: positionEffect || 'unknown',
            quantity: filledQty,
            price: filledPrice,
            filledDate: filledDate || blockDate
          });
        }
      }
    }
    
    if (legs.length > 0) {
      const symbol = legs[0].symbol;
      const tradeDate = legs[0].filledDate || blockDate || 'UNKNOWN';
      
      trades.push({
        title: strategyTitle,
        symbol: symbol,
        strategy: strategyTitle,
        date: tradeDate,
        fees: fees,
        legs: legs
      });
    }
  }
  
  return trades;
}

function parseRHDate(dateStr) {
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateStr);
  }
  
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

async function matchLegToPlaid(leg, trade, plaidTxns, usedPlaidIds) {
  const rhDate = parseRHDate(trade.date);
  
  const matches = plaidTxns.filter(txn => {
    if (usedPlaidIds.has(txn.id)) return false;
    
    const txnDate = new Date(txn.date);
    const daysDiff = Math.abs(txnDate - rhDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 7) return false;
    
    if (txn.security?.option_strike_price !== undefined) {
      const strikeMatch = Math.abs(txn.security.option_strike_price - leg.strike) < 0.01;
      const typeMatch = txn.security.option_contract_type?.toLowerCase() === leg.contractType;
      const actionMatch = txn.type?.toLowerCase() === leg.action;
      
      const qtyMatch = Math.abs((txn.quantity || 0) - leg.quantity) < 0.01;
      const priceMatch = Math.abs((txn.price || 0) - leg.price) < 0.01;
      
      const nameMatch = leg.positionEffect === 'open' ? 
        txn.name.toLowerCase().includes('to open') :
        leg.positionEffect === 'close' ?
        txn.name.toLowerCase().includes('to close') :
        true;
      
      return strikeMatch && typeMatch && actionMatch && qtyMatch && priceMatch && nameMatch;
    }
    
    return false;
  });
  
  return matches[0] || null;
}

async function main() {
  console.log('🚀 Generating Trade Review CSV...\n');
  
  console.log('📄 Parsing robinhood_history.txt...');
  const trades = parseRobinhoodHistory('./robinhood_history.txt');
  console.log(`✅ Found ${trades.length} trades with filled legs\n`);
  
  const totalLegs = trades.reduce((sum, t) => sum + t.legs.length, 0);
  console.log(`📊 Total legs extracted: ${totalLegs}\n`);
  
  console.log('🔍 Fetching Plaid transactions...');
  const plaidTxns = await prisma.investment_transactions.findMany({
    where: {
      date: { gte: new Date('2025-06-01') }
    },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  console.log(`✅ Found ${plaidTxns.length} Plaid transactions\n`);
  
  const optionTxns = plaidTxns.filter(t => t.security?.option_contract_type);
  const nonOptionTxns = plaidTxns.filter(t => !t.security?.option_contract_type);
  
  console.log(`   - Option transactions: ${optionTxns.length}`);
  console.log(`   - Non-option transactions: ${nonOptionTxns.length}\n`);
  
  const csvRows = [
    'Trade#,Date,Symbol,Strategy,Leg#,Action,Strike,Type,PositionEffect,Quantity,Price,PlaidID,Match,Fees'
  ];
  
  let tradeNum = 1;
  let matchedCount = 0;
  let unmatchedCount = 0;
  const usedPlaidIds = new Set();
  
  for (const trade of trades) {
    const feePerLeg = trade.fees / trade.legs.length;
    
    for (let i = 0; i < trade.legs.length; i++) {
      const leg = trade.legs[i];
      const match = await matchLegToPlaid(leg, trade, optionTxns, usedPlaidIds);
      
      if (match) {
        usedPlaidIds.add(match.id);
        matchedCount++;
      } else {
        unmatchedCount++;
      }
      
      const row = [
        tradeNum,
        trade.date,
        trade.symbol,
        `"${trade.strategy}"`,
        i + 1,
        leg.action,
        leg.strike,
        leg.contractType,
        leg.positionEffect,
        leg.quantity,
        leg.price,
        match ? match.id : 'NO_MATCH',
        match ? 'YES' : 'NO',
        feePerLeg.toFixed(4)
      ];
      
      csvRows.push(row.join(','));
    }
    
    tradeNum++;
  }
  
  console.log('\n📋 Non-option Plaid transactions:');
  for (const txn of nonOptionTxns) {
    console.log(`   ${txn.date.toISOString().split('T')[0]} | ${txn.type} | ${txn.subtype || 'N/A'} | ${txn.name}`);
    
    csvRows.push([
      'NON_OPT',
      txn.date.toISOString().split('T')[0],
      'N/A',
      `"${txn.name}"`,
      'N/A',
      txn.type || 'N/A',
      'N/A',
      txn.subtype || 'N/A',
      'N/A',
      txn.quantity || 'N/A',
      txn.price || 'N/A',
      txn.id,
      'PLAID_ONLY',
      (txn.fees || 0).toFixed(4)
    ].join(','));
  }
  
  const csvContent = csvRows.join('\n');
  fs.writeFileSync('trade_review.csv', csvContent);
  
  console.log(`\n✅ Generated trade_review.csv`);
  console.log(`📊 Option legs extracted: ${totalLegs}`);
  console.log(`✅ Matched: ${matchedCount}`);
  console.log(`❌ Unmatched: ${unmatchedCount}`);
  console.log(`📋 Non-option Plaid records: ${nonOptionTxns.length}`);
  console.log(`🎯 Total rows in CSV: ${csvRows.length - 1}`);
  console.log(`🎯 Match rate: ${((matchedCount / totalLegs) * 100).toFixed(1)}%`);
  
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
