const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing txnId scope issue...\n');

// Find the investment map function and fix the scope
let inMapFunction = false;
let mapStartLine = -1;

for (let i = 780; i < Math.min(900, lines.length); i++) {
  if (!lines[i]) continue;
  
  // Find where the map function starts
  if (lines[i].includes('investmentTransactions.map((txn: any)')) {
    mapStartLine = i;
    inMapFunction = true;
    console.log(`Found map function at line ${i+1}`);
    
    // Check if txnId is defined
    let hasTxnId = false;
    for (let j = i; j < Math.min(i+5, lines.length); j++) {
      if (lines[j] && lines[j].includes('const txnId')) {
        hasTxnId = true;
        break;
      }
    }
    
    if (!hasTxnId) {
      // Add txnId definition
      lines[i] = lines[i] + ` {
                    const txnId = txn.id || txn.investment_transaction_id;`;
      console.log('Added txnId definition');
    }
  }
  
  // Only fix dropdowns if we're inside the map function
  if (inMapFunction && lines[i].includes('value={investmentRowChanges[txnId]')) {
    // This is already correct, just make sure it's properly formatted
    console.log(`Found dropdown reference at line ${i+1} - already using txnId`);
  }
  
  // Check if we've exited the map function
  if (inMapFunction && lines[i].includes('))}') && i > mapStartLine + 50) {
    inMapFunction = false;
    console.log(`Map function ends at line ${i+1}`);
  }
}

// Now remove any dropdown modifications that are outside the map function
for (let i = 800; i < Math.min(900, lines.length); i++) {
  if (!lines[i]) continue;
  
  // If we find a dropdown with txnId reference but it's not inside a map
  if (lines[i].includes('value={investmentRowChanges[txnId]')) {
    // Check if this is inside a map function
    let isInsideMap = false;
    for (let j = Math.max(0, i-20); j < i; j++) {
      if (lines[j] && lines[j].includes('investmentTransactions.map')) {
        isInsideMap = true;
        break;
      }
    }
    
    if (!isInsideMap) {
      // This is outside the map - revert to original
      console.log(`Found dropdown outside map at line ${i+1} - reverting`);
      if (lines[i].includes('strategy')) {
        lines[i] = '                        <select className="text-xs border rounded px-1 py-0.5 w-24">';
      } else if (lines[i].includes('coa')) {
        lines[i] = '                        <select className="text-xs border rounded px-1 py-0.5 w-full">';
      }
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Fixed txnId scope issues');
