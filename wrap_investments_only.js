const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Adding investments tab conditional...\n');

// Find line 773 where investment content starts
for (let i = 772; i < 775; i++) {
  if (lines[i] && lines[i].includes('<div className="p-4 bg-gray-50 flex justify-between')) {
    console.log(`Found investment content at line ${i+1}`);
    
    // Add opening conditional
    lines[i] = `          {activeTab === 'investments' && (
            <>
              ${lines[i]}`;
    
    // Find where the investment table ends - look for the Total Investment Transactions text
    for (let j = 900; j < 930; j++) {
      if (lines[j] && lines[j].includes('Total Investment Transactions:')) {
        console.log(`Found end marker at line ${j+1}`);
        // Find the closing divs after this
        for (let k = j; k < j+10; k++) {
          if (lines[k] && lines[k].includes('</div>')) {
            // Find the last </div> in this section
            let lastDiv = k;
            for (let m = k+1; m < k+5; m++) {
              if (lines[m] && lines[m].includes('</div>')) {
                lastDiv = m;
              } else {
                break;
              }
            }
            // Add closing after the last div
            lines[lastDiv] = lines[lastDiv] + `
            </>
          )}`;
            console.log(`Added closing at line ${lastDiv+1}`);
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
console.log('\n✅ Investment content wrapped in activeTab conditional!');
