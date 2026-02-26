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
    
    const legs = [];
    for (let i = 0; i < filledLines.length; i++) {
      const line = filledLines[i];
      const legMatch = line.match(/^(Buy|Sell)\s+([A-Z]{2,5})\s+\$?([\d.]+)\s+(Call|Put)\s+([\d\/]+)$/);
      
      if (legMatch) {
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
        
        if (filledQty && filledPrice) {
          legs.push({ found: true });
        }
      }
    }
    
    if (legs.length > 0) {
      trades.push({ legCount: legs.length });
    }
  }
  
  return trades;
}

async function main() {
  const trades = parseRobinhoodHistory('./robinhood_history.txt');
  const totalLegs = trades.reduce((sum, t) => sum + t.legCount, 0);
  
  const plaidTxns = await prisma.investment_transactions.findMany({
    where: { date: { gte: new Date('2025-06-01') } },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  
  const optionTxns = plaidTxns.filter(t => t.security?.option_contract_type);
  const nonOptionTxns = plaidTxns.filter(t => !t.security?.option_contract_type);
  
  console.log('📊 Count Summary:');
  console.log(`Total Plaid transactions: ${plaidTxns.length}`);
  console.log(`  - Option transactions: ${optionTxns.length}`);
  console.log(`  - Non-option transactions: ${nonOptionTxns.length}`);
  console.log(`RH parsed legs: ${totalLegs}`);
  console.log(`\nDISCREPANCY: ${optionTxns.length} - ${totalLegs} = ${optionTxns.length - totalLegs} missing option transactions\n`);
  
  console.log('🔍 Checking for unmatched Plaid option transactions...\n');
  
  const csvContent = fs.readFileSync('trade_review.csv', 'utf-8');
  const csvLines = csvContent.split('\n');
  const matchedPlaidIds = new Set();
  
  for (const line of csvLines) {
    const cols = line.split(',');
    const plaidId = cols[11];
    if (plaidId && plaidId !== 'PlaidID' && plaidId !== 'NO_MATCH' && plaidId !== 'PLAID_ONLY') {
      matchedPlaidIds.add(plaidId);
    }
  }
  
  const unmatchedOptions = optionTxns.filter(t => !matchedPlaidIds.has(t.id));
  
  console.log(`Found ${unmatchedOptions.length} unmatched option transactions:\n`);
  for (const txn of unmatchedOptions) {
    console.log(`Date: ${txn.date.toISOString().split('T')[0]}`);
    console.log(`ID: ${txn.id}`);
    console.log(`Name: ${txn.name}`);
    console.log(`Type: ${txn.type}`);
    console.log(`Subtype: ${txn.subtype}`);
    console.log(`Strike: ${txn.security?.option_strike_price}`);
    console.log(`Contract Type: ${txn.security?.option_contract_type}`);
    console.log(`Quantity: ${txn.quantity}`);
    console.log(`Price: ${txn.price}`);
    console.log('---\n');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
