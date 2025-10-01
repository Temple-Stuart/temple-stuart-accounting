const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find the investment button/table section (around line 769)
let buttonLine = -1;
for (let i = 765; i < 780; i++) {
  if (lines[i].includes('Investment Transactions: {investmentTransactions.length}')) {
    // Back up to find the start of this section
    buttonLine = i - 1;
    break;
  }
}

if (buttonLine > 0) {
  // Add the activeTab check BEFORE the button div
  lines[buttonLine] = '          {activeTab === \'investments\' && (\n            <>\n' + lines[buttonLine];
  
  // Now find where to close it (after the investment table)
  for (let i = buttonLine + 50; i < buttonLine + 100; i++) {
    if (lines[i].includes('Total Investment Transactions:')) {
      // Find the closing divs after this
      for (let j = i; j < i + 5; j++) {
        if (lines[j].includes('</div>')) {
          lines[j] = lines[j] + '\n            </>\n          )}';
          console.log(`Added closing at line ${j + 1}`);
          break;
        }
      }
      break;
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Wrapped investment section in activeTab conditional');
