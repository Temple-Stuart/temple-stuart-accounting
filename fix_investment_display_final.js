const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing investment table display...\n');

// Find the investment table that's showing in spending tab
// It has headers like Symbol, Position, Strategy, COA
let tableFound = false;
for (let i = 0; i < lines.length; i++) {
  // Look for investment table characteristics
  if (lines[i] && lines[i].includes('<th') && 
      lines[i].includes('Symbol') && 
      i < lines.length - 10) {
    
    // Check if Position, Strategy, COA headers follow
    let hasInvestmentHeaders = false;
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      if (lines[j] && lines[j].includes('Strategy') && 
          lines[j].includes('COA')) {
        hasInvestmentHeaders = true;
        break;
      }
    }
    
    if (hasInvestmentHeaders) {
      console.log(`Found investment table headers at line ${i+1}`);
      
      // Go back to find the start of this table section
      let tableStart = -1;
      for (let j = i-1; j >= Math.max(0, i-20); j--) {
        if (lines[j] && lines[j].includes('<table')) {
          // Go back further to find the containing div
          for (let k = j-1; k >= Math.max(0, j-10); k--) {
            if (lines[k] && lines[k].includes('<div') && 
                lines[k].includes('overflow')) {
              tableStart = k;
              break;
            }
          }
          break;
        }
      }
      
      if (tableStart > 0) {
        // Check if it's already wrapped
        let alreadyWrapped = false;
        for (let j = Math.max(0, tableStart-5); j < tableStart; j++) {
          if (lines[j] && lines[j].includes("activeTab === 'investments'")) {
            alreadyWrapped = true;
            break;
          }
        }
        
        if (!alreadyWrapped) {
          console.log(`Wrapping table starting at line ${tableStart+1}`);
          
          // Add the conditional wrapper
          lines[tableStart] = `          {activeTab === 'investments' && (
            <>
              ${lines[tableStart]}`;
          
          // Find the end of the table section
          let tableEnd = -1;
          for (let j = i; j < Math.min(lines.length, i + 200); j++) {
            if (lines[j] && lines[j].includes('</table>')) {
              // Find the closing div after </table>
              for (let k = j; k < Math.min(j + 10, lines.length); k++) {
                if (lines[k] && lines[k].includes('</div>')) {
                  tableEnd = k;
                  break;
                }
              }
              break;
            }
          }
          
          if (tableEnd > 0) {
            lines[tableEnd] = `${lines[tableEnd]}
            </>
          )}`;
            console.log(`Closed wrapper at line ${tableEnd+1}`);
            tableFound = true;
          }
        } else {
          console.log('Table already wrapped');
        }
      }
      break;
    }
  }
}

if (tableFound) {
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log('\n✅ Investment table now only displays in investments tab!');
} else {
  console.log('\n⚠️ Could not find unwrapped investment table');
}
