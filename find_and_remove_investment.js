const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Finding investment table structure...\n');

// Look around line 801 for the investment table
for (let i = 795; i < 810; i++) {
  if (lines[i].includes('investmentTransactions.filter(txn =>')) {
    console.log(`Investment table found at line ${i+1}`);
    console.log('Context:');
    
    // Show context
    for (let j = i-5; j <= i+5; j++) {
      if (j >= 0 && j < lines.length) {
        console.log(`${j+1}: ${lines[j].substring(0, 60)}...`);
      }
    }
    
    // Find actual structure
    let tableStart = -1;
    let tableEnd = -1;
    
    // Look for the opening div
    for (let j = i-20; j < i; j++) {
      if (lines[j].includes('<div') && lines[j].includes('overflow')) {
        tableStart = j;
        break;
      }
    }
    
    // Look for the closing - search for where this map ends
    let braceCount = 0;
    let foundMapEnd = false;
    for (let j = i; j < i+100; j++) {
      if (lines[j].includes('})}')) {
        foundMapEnd = true;
      }
      if (foundMapEnd && lines[j].includes('</tbody>')) {
        // Find the table close
        for (let k = j; k < j+10; k++) {
          if (lines[k].includes('</table>')) {
            for (let m = k; m < k+10; m++) {
              if (lines[m].includes('</div>')) {
                tableEnd = m;
                break;
              }
            }
            break;
          }
        }
        break;
      }
    }
    
    if (tableStart > 0 && tableEnd > 0) {
      console.log(`\nRemoving lines ${tableStart+1} to ${tableEnd+1}`);
      lines.splice(tableStart, tableEnd - tableStart + 1);
      fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
      console.log('✅ Removed investment table from spending tab');
    } else {
      console.log(`\nTable boundaries: start=${tableStart+1}, end=${tableEnd+1}`);
      
      // Just remove a fixed range if we can't find exact boundaries
      if (tableStart > 0) {
        console.log('Using fixed range removal...');
        // Remove approximately 100 lines of the table
        lines.splice(tableStart, 100);
        fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
        console.log('✅ Removed investment table section');
      }
    }
    break;
  }
}
