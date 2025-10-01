const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Properly wrapping investment table...\n');

// Find the investment table that starts around line 783
for (let i = 782; i < 785; i++) {
  if (lines[i] && lines[i].includes('<div className="overflow-auto"') && 
      lines[i].includes('600px')) {
    console.log(`Found investment table at line ${i+1}`);
    
    // This table needs to be wrapped in activeTab check
    // First, add opening conditional
    lines[i] = `          {activeTab === 'investments' && (
            ${lines[i]}`;
    
    // Find where this table ends (look for closing div after </table>)
    for (let j = i+100; j < i+150; j++) {
      if (lines[j] && lines[j].includes('</table>')) {
        // Find the closing div
        for (let k = j; k < j+5; k++) {
          if (lines[k] && lines[k].includes('</div>')) {
            lines[k] = lines[k] + `
          )}`;
            console.log(`Added closing at line ${k+1}`);
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
console.log('\n✅ Investment table properly wrapped!');
