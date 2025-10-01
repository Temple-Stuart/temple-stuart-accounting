const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Looking for investment transactions in committed section...\n');

// Find the committed transactions section
let inCommittedSection = false;
let foundInvestmentInCommitted = false;

for (let i = 0; i < lines.length; i++) {
  // Look for the committed transactions table
  if (lines[i] && lines[i].includes('committedTransactions.map')) {
    inCommittedSection = true;
    console.log(`Found committed transactions section at line ${i+1}`);
  }
  
  // If we're in committed section, look for any investment references
  if (inCommittedSection && lines[i]) {
    if (lines[i].includes('investmentTransactions') || 
        lines[i].includes('committedInvestments')) {
      console.log(`Found investment reference in committed section at line ${i+1}`);
      foundInvestmentInCommitted = true;
      
      // Find the containing structure and remove it
      // Look for the table or div containing this
      for (let j = i-1; j >= Math.max(0, i-30); j--) {
        if (lines[j] && (lines[j].includes('<table') || lines[j].includes('<div'))) {
          // This might be the start of the investment section
          let endLine = -1;
          for (let k = i; k < Math.min(lines.length, i+50); k++) {
            if (lines[k] && (lines[k].includes('</table>') || 
                (lines[k].includes('</div>') && lines[k+1] && lines[k+1].includes('</div>')))) {
              endLine = k;
              break;
            }
          }
          
          if (endLine > 0) {
            console.log(`Removing investment content from lines ${j+1} to ${endLine+1}`);
            for (let k = j; k <= endLine; k++) {
              lines[k] = '';
            }
            break;
          }
        }
      }
      break;
    }
  }
  
  // Check if we've left the committed section
  if (inCommittedSection && lines[i] && lines[i].includes('</div>') && 
      lines[i+1] && lines[i+1].includes(')}')) {
    inCommittedSection = false;
  }
}

// Also check if there's a separate investment committed table that shouldn't be in spending
for (let i = 0; i < lines.length; i++) {
  if (lines[i] && lines[i].includes('committedInvestments.map')) {
    // Check if this is in the investments tab
    let isInInvestmentsTab = false;
    for (let j = Math.max(0, i-15); j < i; j++) {
      if (lines[j] && lines[j].includes("activeTab === 'investments'")) {
        isInInvestmentsTab = true;
        break;
      }
    }
    
    if (!isInInvestmentsTab) {
      console.log(`Found committedInvestments table outside investments tab at line ${i+1}`);
      // Wrap it with activeTab check
      for (let j = i-1; j >= Math.max(0, i-20); j--) {
        if (lines[j] && lines[j].includes('<div') || lines[j] && lines[j].includes('<table')) {
          lines[j] = `          {activeTab === 'investments' && (\n${lines[j]}`;
          
          // Find the end and close it
          for (let k = i; k < Math.min(lines.length, i+50); k++) {
            if (lines[k] && lines[k].includes('</table>')) {
              for (let m = k; m < k+5; m++) {
                if (lines[m] && lines[m].includes('</div>')) {
                  lines[m] = lines[m] + '\n          )}';
                  console.log(`Wrapped investment committed section`);
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
  }
}

// Clean up empty lines
const cleanedLines = lines.filter((line, index) => {
  if (line.trim()) return true;
  if (index > 0 && index < lines.length - 1) {
    const prev = lines[index-1].trim();
    const next = lines[index+1].trim();
    if (prev && next) return true;
  }
  return false;
});

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', cleanedLines.join('\n'));
console.log('\n✅ Removed investment transactions from spending tab');
