const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing investment table placement...\n');

// First, update the counts and progress bar
for (let i = 300; i < 320; i++) {
  if (lines[i].includes('const totalTransactions = transactions.length + committedTransactions.length;')) {
    lines[i] = '  const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;';
    console.log('✅ Fixed total transactions');
  }
}

// Update investment button text
for (let i = 520; i < 540; i++) {
  if (lines[i].includes('Investments (746)')) {
    lines[i] = '              Investments ({investmentTransactions.length + committedInvestments.length})';
    console.log('✅ Updated investment button');
    break;
  }
}

// Find the investment table that's floating (not wrapped in activeTab check)
let floatingTableStart = -1;
for (let i = 770; i < 900; i++) {
  if ((lines[i].includes('investmentTransactions.map') || 
       lines[i].includes('investmentTransactions.filter')) &&
      !lines[i-10].includes("activeTab === 'investments'")) {
    
    console.log(`Found unwrapped investment table at line ${i+1}`);
    
    // Find the start of this table section
    for (let j = i-1; j >= i-30; j--) {
      if (lines[j].includes('<div className="overflow-auto"')) {
        floatingTableStart = j;
        break;
      }
    }
    
    if (floatingTableStart > 0) {
      // Wrap this section with activeTab check
      lines[floatingTableStart] = `          {activeTab === 'investments' && (
            <>
${lines[floatingTableStart]}`;
      
      // Find the end and close it
      for (let j = i; j < i+100; j++) {
        if (lines[j].includes('</div>') && lines[j+1].includes('</div>')) {
          lines[j+1] = lines[j+1] + `
            </>
          )}`;
          console.log('✅ Wrapped investment table in activeTab check');
          break;
        }
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment table now only shows in investments tab');
