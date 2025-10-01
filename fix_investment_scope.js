const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing investment table scope...\n');

// Find line 782 where the investment conditional currently ends
for (let i = 780; i < 785; i++) {
  if (lines[i] && lines[i].trim() === ')}') {
    console.log(`Found closing )} at line ${i+1}`);
    
    // Remove this closing
    lines[i] = '';
    
    // Find where the investment table actually ends (around line 920+)
    for (let j = 900; j < 950; j++) {
      if (lines[j] && lines[j].includes('Total Investment Transactions:')) {
        // Find the closing divs after this
        for (let k = j; k < j+10; k++) {
          if (lines[k] && lines[k].includes('</div>')) {
            // Add the closing here instead
            lines[k] = lines[k] + '\n          )}';
            console.log(`Moved closing to line ${k+1}`);
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment table now only shows in investments tab!');
