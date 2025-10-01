const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing duplicate filter declarations...\n');

// Find the filter function around line 845
for (let i = 844; i < 847; i++) {
  if (lines[i] && lines[i].includes('investmentTransactions.filter(txn =>')) {
    console.log(`Found filter at line ${i+1}`);
    
    // Look for the duplicate declarations after the first return
    for (let j = i; j < i+30; j++) {
      if (lines[j] && lines[j].includes('return (')) {
        // Check if there are duplicate declarations after this return
        let k = j + 1;
        while (k < j + 10) {
          if (lines[k] && lines[k].includes('const txnDate') && 
              lines[k-3] && lines[k-3].includes('return (')) {
            // This is a duplicate - remove it and the next few lines
            console.log(`Removing duplicate declarations at line ${k+1}`);
            // Remove the duplicate const declarations and the duplicate return
            for (let m = 0; m < 7; m++) {
              lines[k] = '';
            }
            break;
          }
          k++;
        }
        break;
      }
    }
    break;
  }
}

// Clean up empty lines
const cleanedContent = lines.join('\n').replace(/\n{3,}/g, '\n\n');
fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', cleanedContent);
console.log('✅ Fixed duplicate declarations');
