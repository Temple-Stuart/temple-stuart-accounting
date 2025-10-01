const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Adding investment tab conditional...\n');

// Find the investment content starting at line 772
for (let i = 771; i < 774; i++) {
  if (lines[i] && lines[i].includes('<div className="p-4 bg-gray-50 flex justify-between')) {
    console.log(`Found investment content at line ${i+1}`);
    
    // Add conditional wrapper
    lines[i] = `
          {activeTab === 'investments' && (
            <>
              ${lines[i]}`;
    
    // Find where to close it - look for the Total Investment line
    let closed = false;
    for (let j = 900; j < 930; j++) {
      if (lines[j] && lines[j].includes('Total Investment Transactions')) {
        console.log(`Found end marker at line ${j+1}`);
        // Find the closing divs
        for (let k = j+1; k < j+10; k++) {
          if (lines[k] && lines[k].includes('</div>')) {
            // Check if next line also has </div>
            if (lines[k+1] && lines[k+1].includes('</div>')) {
              lines[k+1] = lines[k+1] + `
            </>
          )}`;
            } else {
              lines[k] = lines[k] + `
            </>  
          )}`;
            }
            console.log(`Added closing at line ${k+2}`);
            closed = true;
            break;
          }
        }
        break;
      }
    }
    
    if (closed) {
      fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
      console.log('\n✅ Investment section wrapped with activeTab conditional!');
    } else {
      console.log('\n❌ Could not find proper closing point');
    }
    break;
  }
}
