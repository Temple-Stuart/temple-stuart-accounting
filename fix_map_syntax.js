const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing map function syntax...\n');

// Find and fix the broken map syntax
for (let i = 785; i < 795; i++) {
  if (!lines[i]) continue;
  
  if (lines[i].includes('investmentTransactions.map((txn: any) => ( {')) {
    console.log(`Found broken syntax at line ${i+1}`);
    
    // Fix the syntax - should be => { not => ( {
    lines[i] = '                  {investmentTransactions.map((txn: any) => {';
    lines[i+1] = '                    const txnId = txn.id || txn.investment_transaction_id;';
    
    // Need to add a return statement before the JSX
    lines[i+2] = '                    return (';
    
    // Shift the <tr> to line i+3
    const trLine = '                      <tr key={txnId} className="hover:bg-gray-50">';
    lines.splice(i+3, 0, trLine);
    
    console.log('✅ Fixed map function syntax');
    break;
  }
}

// Find where the map ends and close it properly
let mapEndFound = false;
for (let i = 850; i < 900; i++) {
  if (!lines[i]) continue;
  
  if (lines[i].includes('</tr>') && !mapEndFound) {
    // Check if this is the end of the investment row
    for (let j = i; j < Math.min(i+5, lines.length); j++) {
      if (lines[j] && lines[j].includes('))}')) {
        // Replace with proper closing
        lines[j] = '                    );\n                  })}';
        mapEndFound = true;
        console.log(`✅ Fixed map closing at line ${j+1}`);
        break;
      }
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Map function syntax fixed');
