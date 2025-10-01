const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Searching for investment table in spending tab...\n');

// Find ALL instances of investmentTransactions.map or investmentTransactions.filter
const investmentRefs = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('investmentTransactions.filter') || 
      lines[i].includes('investmentTransactions.map')) {
    // Check if this is wrapped in activeTab === 'investments'
    let isInInvestmentTab = false;
    for (let j = Math.max(0, i-10); j < i; j++) {
      if (lines[j].includes("activeTab === 'investments'")) {
        isInInvestmentTab = true;
        break;
      }
    }
    
    investmentRefs.push({
      line: i + 1,
      content: lines[i].substring(0, 80) + '...',
      inInvestmentTab: isInInvestmentTab
    });
  }
}

console.log('Found investment references:');
investmentRefs.forEach(ref => {
  console.log(`Line ${ref.line}: ${ref.inInvestmentTab ? '✅ IN INVESTMENT TAB' : '❌ NOT IN INVESTMENT TAB'}`);
  console.log(`  ${ref.content}\n`);
});

// Remove the ones NOT in investment tab
let removed = 0;
for (let ref of investmentRefs.filter(r => !r.inInvestmentTab).reverse()) {
  const lineIdx = ref.line - 1;
  
  // Find the containing table/div structure
  let startLine = lineIdx;
  let endLine = lineIdx;
  
  // Go back to find table start
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 30); i--) {
    if (lines[i].includes('<table') || 
        (lines[i].includes('<div') && lines[i].includes('overflow'))) {
      startLine = i;
      break;
    }
  }
  
  // Go forward to find table end
  for (let i = lineIdx + 1; i < Math.min(lines.length, lineIdx + 100); i++) {
    if (lines[i].includes('</table>')) {
      // Find the closing div after the table
      for (let j = i; j < i + 10; j++) {
        if (lines[j].includes('</div>')) {
          endLine = j;
          break;
        }
      }
      break;
    }
    // Also check if it's the total line
    if (lines[i].includes('Total Investment Transactions:')) {
      for (let j = i; j < i + 5; j++) {
        if (lines[j].includes('</div>')) {
          endLine = j;
          break;
        }
      }
      break;
    }
  }
  
  if (startLine < lineIdx && endLine > lineIdx) {
    console.log(`Removing investment table from lines ${startLine + 1} to ${endLine + 1}`);
    lines.splice(startLine, endLine - startLine + 1);
    removed++;
  }
}

if (removed > 0) {
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log(`\n✅ Removed ${removed} investment table(s) from spending tab`);
} else {
  console.log('\n⚠️  Could not find investment tables outside investment tab');
}
