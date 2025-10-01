const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Removing investment table from spending tab...\n');

// Find line 801 where the unwrapped investment table is
let tableStartLine = -1;
let tableEndLine = -1;

for (let i = 795; i < 810; i++) {
  if (lines[i].includes('investmentTransactions.filter(txn =>')) {
    console.log(`Found investment table at line ${i+1}`);
    
    // Find where this table structure starts (go back to find the overflow div)
    for (let j = i; j >= i-20; j--) {
      if (lines[j].includes('<div className="overflow-auto"') && lines[j].includes('600px')) {
        tableStartLine = j;
        console.log(`Table starts at line ${j+1}`);
        break;
      }
    }
    
    // Find where this table structure ends
    for (let j = i; j < i+100; j++) {
      if (lines[j].includes('Total Investment Transactions:')) {
        // Find the closing divs after this
        for (let k = j; k < j+5; k++) {
          if (lines[k].includes('</div>') && lines[k+1].includes('</div>')) {
            tableEndLine = k+1;
            console.log(`Table ends at line ${k+2}`);
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

if (tableStartLine > 0 && tableEndLine > 0) {
  // Remove the entire investment table section
  const linesToRemove = tableEndLine - tableStartLine + 1;
  lines.splice(tableStartLine, linesToRemove);
  console.log(`\nRemoved ${linesToRemove} lines (${tableStartLine+1} to ${tableEndLine+1})`);
  
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log('✅ Successfully removed investment table from spending tab');
} else {
  console.log('❌ Could not find table boundaries');
}
