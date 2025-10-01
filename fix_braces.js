const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find the problematic area around line 865
// The issue is we have an extra closing brace somewhere
// Let's check the investment section structure

let investmentSectionLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("activeTab === 'investments'") && lines[i].includes('{')) {
    investmentSectionLine = i;
    console.log(`Found investment section at line ${i + 1}`);
  }
}

// Look for the duplicate "Total Investment Transactions" line
let duplicateFound = false;
for (let i = 850; i < Math.min(870, lines.length); i++) {
  if (lines[i].includes('Total Investment Transactions')) {
    console.log(`Found Total Investment Transactions at line ${i + 1}`);
    // This appears to be the end of a duplicate section
    // Check if there's a closing )} after this
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].trim() === ')}') {
        console.log(`Removing duplicate closing at line ${j + 1}`);
        lines.splice(j, 1);
        duplicateFound = true;
        break;
      }
    }
    if (duplicateFound) break;
  }
}

if (!duplicateFound) {
  // Alternative: just remove the extra closing brace at line 865
  if (lines[864] && lines[864].trim() === ')}') {
    console.log('Removing extra closing brace at line 865');
    lines.splice(864, 1);
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed brace mismatch');
