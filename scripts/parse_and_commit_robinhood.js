const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

/**
 * Parse Robinhood history TXT file
 * Extracts filled spreads with all legs and fees
 */
function parseRobinhoodHistory(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim());
  
  const spreads = [];
  let currentSpread = null;
  let currentLeg = null;
  let inFilledSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect spread start: "SYMBOL Type Spread"
    if (line.match(/^[A-Z]{2,5}\s+(Call|Put)\s+(Credit|Debit)\s+Spread$/)) {
      if (currentSpread) spreads.push(currentSpread);
      currentSpread = {
        title: line,
        symbol: line.split(' ')[0],
        type: line.includes('Call') ? 'call' : 'put',
        spreadType: line.includes('Credit') ? 'credit' : 'debit',
        date: null,
        totalAmount: null,
        fees: null,
        legs: []
      };
      continue;
    }
    
    // Extract date (format: "Oct 15" or "Sep 16, 2025")
    if (currentSpread && !currentSpread.date && line.match(/^[A-Z][a-z]{2}\s+\d{1,2}(,\s+\d{4})?$/)) {
      currentSpread.date = line;
      continue;
    }
    
    // Extract total amount
    if (currentSpread && line.match(/^\$[\d,]+\.\d{2}$/)) {
      if (!currentSpread.totalAmount) {
        currentSpread.totalAmount = parseFloat(line.replace(/[$,]/g, ''));
      }
      continue;
    }
    
    // Extract fees
    if (currentSpread && line === 'Est regulatory fees') {
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.match(/^\$[\d.]+$/)) {
        currentSpread.fees = parseFloat(nextLine.replace('$', ''));
        i++; // Skip next line
      }
      continue;
    }
    
    // Detect leg start: "Buy/Sell SYMBOL $STRIKE Type EXPIRY"
    const legMatch = line.match(/^(Buy|Sell)\s+([A-Z]{2,5})\s+\$?([\d.]+)\s+(Call|Put)\s+([\d\/]+)$/);
    if (legMatch && currentSpread) {
      if (currentLeg) currentSpread.legs.push(currentLeg);
      currentLeg = {
        action: legMatch[1].toLowerCase(),
        symbol: legMatch[2],
        strike: parseFloat(legMatch[3]),
        contractType: legMatch[4].toLowerCase(),
        expiry: legMatch[5],
        positionEffect: null,
        quantity: null,
        price: null,
        filledDate: null
      };
      continue;
    }
    
    // Extract position effect
    if (currentLeg && line === 'Position effect') {
      const nextLine = lines[i + 1];
      if (nextLine) {
        currentLeg.positionEffect = nextLine.toLowerCase();
        i++;
      }
      continue;
    }
    
    // Extract filled quantity and price: "1 contract at $9.23"
    const filledMatch = line.match(/^([\d.]+)\s+contract[s]?\s+at\s+\$([\d.]+)$/);
    if (filledMatch && currentLeg) {
      currentLeg.quantity = parseFloat(filledMatch[1]);
      currentLeg.price = parseFloat(filledMatch[2]);
      continue;
    }
    
    // Extract filled date: "10/15, 12:43 PM PDT"
    if (currentLeg && line.match(/^\d{1,2}\/\d{1,2},\s+\d{1,2}:\d{2}\s+(AM|PM)\s+\w+$/)) {
      currentLeg.filledDate = line;
      continue;
    }
    
    // Detect spread end
    if (line === 'Download Trade Confirmation' && currentSpread) {
      if (currentLeg) currentSpread.legs.push(currentLeg);
      spreads.push(currentSpread);
      currentSpread = null;
      currentLeg = null;
    }
  }
  
  // Handle last spread
  if (currentSpread) {
    if (currentLeg) currentSpread.legs.push(currentLeg);
    spreads.push(currentSpread);
  }
  
  return spreads.filter(s => s.legs.length > 0);
}

/**
 * Convert RH date to ISO date
 */
function parseRHDate(rhDate) {
  const year = new Date().getFullYear();
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const parts = rhDate.split(' ');
  const month = months[parts[0]];
  const day = parseInt(parts[1].replace(',', ''));
  
  return new Date(year, month, day);
}

/**
 * Match RH leg to Plaid transaction
 */
async function matchLegToPlaid(leg, spread, plaidTxns) {
  const rhDate = parseRHDate(spread.date);
  
  // Find matching Plaid transaction
  const matches = plaidTxns.filter(txn => {
    const txnDate = new Date(txn.date);
    const dateDiff = Math.abs(txnDate - rhDate) / (1000 * 60 * 60 * 24);
    
    return dateDiff <= 3 && // Within 3 days
           txn.security?.option_strike_price === leg.strike &&
           txn.security?.option_contract_type === leg.contractType &&
           txn.type === leg.action &&
           txn.name.toLowerCase().includes(leg.positionEffect);
  });
  
  if (matches.length === 0) {
    console.log('❌ No match for:', leg.symbol, leg.strike, leg.contractType, leg.action, leg.positionEffect);
    return null;
  }
  
  if (matches.length > 1) {
    console.log('⚠️  Multiple matches for:', leg.symbol, leg.strike, leg.contractType);
  }
  
  return matches[0];
}

/**
 * Determine strategy from spread type and legs
 */
function determineStrategy(spread) {
  const legCount = spread.legs.length;
  const type = spread.type;
  const spreadType = spread.spreadType;
  
  if (legCount === 2) {
    if (spreadType === 'credit') {
      return type === 'call' ? 'call-credit' : 'put-credit';
    } else {
      return type === 'call' ? 'call-debit' : 'put-debit';
    }
  }
  
  if (legCount === 4) {
    return 'iron-condor';
  }
  
  return 'other';
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Robinhood import automation...\n');
  
  // Parse TXT file
  console.log('📄 Parsing robinhood_history.txt...');
  const spreads = parseRobinhoodHistory('./robinhood_history.txt');
  console.log(`✅ Found ${spreads.length} spreads with ${spreads.reduce((sum, s) => sum + s.legs.length, 0)} total legs\n`);
  
  // Fetch all uncommitted Plaid transactions
  console.log('🔍 Fetching uncommitted investment transactions...');
  const plaidTxns = await prisma.investment_transactions.findMany({
    where: {
      date: { gte: new Date('2025-06-10') },
      accountCode: null,
      security: { option_contract_type: { not: null } }
    },
    include: { security: true }
  });
  console.log(`✅ Found ${plaidTxns.length} uncommitted options transactions\n`);
  
  // Match and update
  let matchedCount = 0;
  let tradeNum = 2; // Start at 2 since Trade #1 is already committed
  
  const commitCommands = [];
  
  for (const spread of spreads) {
    console.log(`\n📊 Processing: ${spread.title} (${spread.date})`);
    
    const matchedLegs = [];
    
    for (const leg of spread.legs) {
      const match = await matchLegToPlaid(leg, spread, plaidTxns);
      if (match) {
        matchedLegs.push(match.id);
        matchedCount++;
        
        // Update with RH fees
        const feePerLeg = spread.fees / spread.legs.length;
        await prisma.investment_transactions.update({
          where: { id: match.id },
          data: {
            rhFees: feePerLeg,
            rhTranFee: feePerLeg,
            rhPrice: leg.price,
            rhQuantity: leg.quantity,
            rhAction: leg.action === 'buy' ? 'B' : 'S',
            reconciliationStatus: 'matched'
          }
        });
        
        console.log(`  ✅ Matched: ${leg.action} ${leg.strike} ${leg.contractType} ${leg.positionEffect}`);
      }
    }
    
    if (matchedLegs.length === spread.legs.length) {
      const strategy = determineStrategy(spread);
      commitCommands.push({
        transactionIds: matchedLegs,
        strategy,
        tradeNum: String(tradeNum)
      });
      tradeNum++;
    } else {
      console.log(`  ⚠️  Incomplete match: ${matchedLegs.length}/${spread.legs.length} legs`);
    }
  }
  
  console.log(`\n✅ Matched ${matchedCount} total legs`);
  console.log(`✅ Generated ${commitCommands.length} commit commands\n`);
  
  // Execute commits
  console.log('💾 Committing trades to ledger...\n');
  
  let committed = 0;
  let errors = 0;
  
  for (const cmd of commitCommands) {
    try {
      const response = await fetch('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Trade #${cmd.tradeNum} (${cmd.strategy}): ${cmd.transactionIds.length} legs`);
        committed++;
      } else {
        console.log(`❌ Trade #${cmd.tradeNum}: ${result.error}`);
        errors++;
      }
    } catch (error) {
      console.log(`❌ Trade #${cmd.tradeNum}: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n🎉 COMPLETE!`);
  console.log(`✅ Committed: ${committed} trades`);
  console.log(`❌ Errors: ${errors}`);
  
  process.exit(0);
}

main().catch(console.error);
