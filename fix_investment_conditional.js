const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Wrapping investment content in investments tab conditional...\n');

// Find line 772 where investment content starts (after spending closes)
let investmentStartLine = -1;
for (let i = 770; i < 775; i++) {
  if (lines[i] && lines[i].includes('<div className="p-4 bg-gray-50 flex justify-between')) {
    investmentStartLine = i;
    console.log(`Found investment content starting at line ${i+1}`);
    break;
  }
}

if (investmentStartLine > 0) {
  // Add opening conditional before investment content
  lines[investmentStartLine] = `          {activeTab === 'investments' && (
            <>
              ${lines[investmentStartLine]}`;
  
  // Find where to close it (after the investment table ends)
  let closeAdded = false;
  for (let i = 915; i < 930; i++) {
    if (lines[i] && lines[i].includes('Total Investment Transactions:')) {
      // Find the closing divs after this
      for (let j = i; j < i+10; j++) {
        if (lines[j] && lines[j].includes('</div>')) {
          // Check if next line also has </div>
          if (lines[j+1] && lines[j+1].includes('</div>')) {
            // Add closing after the second </div>
            lines[j+1] = lines[j+1] + `
            </>
          )}`;
            console.log(`Added closing at line ${j+2}`);
            closeAdded = true;
            break;
          }
        }
      }
      if (closeAdded) break;
    }
  }
  
  if (!closeAdded) {
    console.log('Warning: Could not find proper closing point');
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment content now only displays in investments tab!');
