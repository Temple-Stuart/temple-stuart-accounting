const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Removing investment table from spending tab only...\n');

// Find investment tables that are NOT wrapped in activeTab === 'investments'
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  
  // Look for investment table references
  if (lines[i].includes('investmentTransactions.map') || 
      lines[i].includes('investmentTransactions.filter')) {
    
    // Check if this is inside the investments tab
    let isInInvestmentsTab = false;
    for (let j = Math.max(0, i-15); j < i; j++) {
      if (lines[j] && lines[j].includes("activeTab === 'investments'")) {
        isInInvestmentsTab = true;
        break;
      }
    }
    
    if (!isInInvestmentsTab) {
      console.log(`Found investment table outside investments tab at line ${i+1}`);
      
      // Find the start of this table (the overflow div)
      let tableStart = -1;
      for (let j = i-1; j >= Math.max(0, i-30); j--) {
        if (lines[j] && lines[j].includes('<div className="overflow-auto"') && 
            lines[j].includes('600px')) {
          tableStart = j;
          break;
        }
      }
      
      // Find the end of this table
      let tableEnd = -1;
      for (let j = i; j < Math.min(lines.length, i+100); j++) {
        if (lines[j] && lines[j].includes('</table>')) {
          // Find the closing div after </table>
          for (let k = j; k < Math.min(j+10, lines.length); k++) {
            if (lines[k] && lines[k].includes('</div>')) {
              tableEnd = k;
              break;
            }
          }
          break;
        }
      }
      
      if (tableStart > 0 && tableEnd > 0) {
        console.log(`Removing lines ${tableStart+1} to ${tableEnd+1}`);
        // Replace with a comment to maintain structure
        lines[tableStart] = '          {/* Investment table removed from spending tab */}';
        // Remove the lines between
        for (let j = tableStart + 1; j <= tableEnd; j++) {
          lines[j] = '';
        }
        found = true;
        break;
      }
    }
  }
}

if (found) {
  // Clean up empty lines
  const cleanedLines = lines.filter((line, index) => {
    // Keep non-empty lines
    if (line.trim()) return true;
    // Keep some structural empty lines
    if (index > 0 && index < lines.length - 1) {
      const prev = lines[index-1].trim();
      const next = lines[index+1].trim();
      if (prev && next) return true;
    }
    return false;
  });
  
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', cleanedLines.join('\n'));
  console.log('\n✅ Successfully removed investment table from spending tab');
} else {
  console.log('\n✅ No investment table found in spending tab - already clean');
}
