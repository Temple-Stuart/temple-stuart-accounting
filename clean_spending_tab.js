const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Cleaning up spending tab...\n');

// Find where spending tab content is (activeTab === 'spending')
let spendingStart = -1;
let spendingEnd = -1;

for (let i = 600; i < 700; i++) {
  if (lines[i].includes("{activeTab === 'spending'")) {
    spendingStart = i;
    console.log(`Found spending tab start at line ${i+1}`);
    break;
  }
}

// Now find where spending tab ends (look for the closing )}
if (spendingStart > 0) {
  let braceCount = 0;
  for (let i = spendingStart; i < spendingStart + 200; i++) {
    if (lines[i].includes('{')) braceCount++;
    if (lines[i].includes('}')) braceCount--;
    if (braceCount === 0 && i > spendingStart) {
      spendingEnd = i;
      console.log(`Found spending tab end at line ${i+1}`);
      break;
    }
  }
}

// Remove any investment-related content between spending start and end
let removedSomething = false;
if (spendingStart > 0 && spendingEnd > 0) {
  for (let i = spendingEnd; i >= spendingStart; i--) {
    // Remove investment button
    if (lines[i].includes('Investment Transactions:') && lines[i].includes('uncommitted')) {
      // Find the start of this div block
      let divStart = i;
      for (let j = i-1; j >= i-10; j--) {
        if (lines[j].includes('<div className=')) {
          divStart = j;
          break;
        }
      }
      // Find the end of this div block
      let divEnd = i;
      for (let j = i; j <= i+10; j++) {
        if (lines[j].includes('</div>')) {
          divEnd = j;
          break;
        }
      }
      console.log(`Removing investment button (lines ${divStart+1}-${divEnd+1})`);
      lines.splice(divStart, divEnd - divStart + 1);
      removedSomething = true;
      spendingEnd -= (divEnd - divStart + 1); // Adjust end position
    }
    
    // Remove investment transactions table if it exists here
    if (lines[i] && lines[i].includes('investmentTransactions.map')) {
      // Find table start
      let tableStart = i;
      for (let j = i-1; j >= i-20; j--) {
        if (lines[j].includes('<table') || lines[j].includes('<div className="overflow-auto"')) {
          tableStart = j;
          break;
        }
      }
      // Find table end
      let tableEnd = i;
      for (let j = i; j <= i+50; j++) {
        if (lines[j].includes('</table>')) {
          for (let k = j; k <= j+5; k++) {
            if (lines[k].includes('</div>')) {
              tableEnd = k;
              break;
            }
          }
          break;
        }
      }
      console.log(`Removing investment table (lines ${tableStart+1}-${tableEnd+1})`);
      lines.splice(tableStart, tableEnd - tableStart + 1);
      removedSomething = true;
      break;
    }
  }
}

if (removedSomething) {
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log('\n✅ Cleaned spending tab - removed all investment content');
} else {
  console.log('\n✅ Spending tab appears clean - no investment content found');
}
