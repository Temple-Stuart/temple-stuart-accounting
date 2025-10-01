const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('Hiding investment table from spending tab...\n');

// Find investment tables and wrap them with activeTab check
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  // Find investment transactions that aren't wrapped
  if (lines[i] && lines[i].includes('investmentTransactions.map')) {
    // Check if already wrapped in activeTab check
    let hasActiveTabCheck = false;
    for (let j = Math.max(0, i-10); j < i; j++) {
      if (lines[j] && lines[j].includes("activeTab === 'investments'")) {
        hasActiveTabCheck = true;
        break;
      }
    }
    
    if (!hasActiveTabCheck) {
      console.log(`Found unwrapped investment table at line ${i+1}`);
      // Find the div that contains this table
      for (let j = i-1; j >= Math.max(0, i-20); j--) {
        if (lines[j] && lines[j].includes('<div') && lines[j].includes('overflow')) {
          // Wrap this div with activeTab check
          lines[j] = `          {activeTab === 'investments' && (\n${lines[j]}`;
          
          // Find the closing div and close the conditional
          let divCount = 1;
          for (let k = j+1; k < lines.length; k++) {
            if (lines[k]) {
              divCount += (lines[k].match(/<div/g) || []).length;
              divCount -= (lines[k].match(/<\/div>/g) || []).length;
              if (divCount === 0) {
                lines[k] = lines[k] + '\n          )}';
                console.log(`Wrapped investment table (lines ${j+1} to ${k+1})`);
                break;
              }
            }
          }
          break;
        }
      }
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment table now only shows in investments tab');
