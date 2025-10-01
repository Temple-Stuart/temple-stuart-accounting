const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing duplicate variable declarations...\n');

// Find the filter function with duplicates
for (let i = 850; i < 900; i++) {
  if (lines[i] && lines[i].includes('investmentTransactions.filter(txn =>')) {
    console.log(`Found filter at line ${i+1}`);
    
    // Look for the duplicate declarations
    let filterEnd = -1;
    for (let j = i; j < i+20; j++) {
      if (lines[j] && lines[j].includes('return (')) {
        // Check if there are duplicate const declarations after the return
        if (lines[j+1] && lines[j+1].includes('const txnDate')) {
          // Remove the duplicate declarations after the return
          console.log('Removing duplicate declarations after return statement');
          lines[j+1] = ''; // Remove duplicate txnDate
          lines[j+2] = ''; // Remove duplicate symbol
          lines[j+3] = ''; // Remove duplicate position
        }
        break;
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed duplicate declarations');
