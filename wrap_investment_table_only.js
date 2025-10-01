const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Wrapping investment table with investments tab check...\n');

// Find the investment table starting around line 783
for (let i = 780; i < 790; i++) {
  if (lines[i] && lines[i].includes('<div className="overflow-auto"') && 
      lines[i].includes('600px')) {
    // Check if the next few lines contain investment table headers
    let isInvestmentTable = false;
    for (let j = i; j < i+20; j++) {
      if (lines[j] && lines[j].includes('Strategy') && lines[j].includes('COA')) {
        isInvestmentTable = true;
        break;
      }
    }
    
    if (isInvestmentTable) {
      console.log(`Found investment table at line ${i+1}`);
      
      // Wrap it with activeTab check
      lines[i] = `          {activeTab === 'investments' && (
            ${lines[i]}`;
      
      // Find the closing div after the table
      for (let j = i; j < i+150; j++) {
        if (lines[j] && lines[j].includes('</table>')) {
          // Find the closing div
          for (let k = j; k < j+10; k++) {
            if (lines[k] && lines[k].includes('</div>')) {
              lines[k] = lines[k] + `
          )}`;
              console.log(`Closed conditional at line ${k+1}`);
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment table now only shows in investments tab!');
