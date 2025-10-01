const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Adding investment tab conditional wrapper...\n');

// The spending tab closes at line 771 with )}
// Investment content starts at line 773 without any wrapper
// We need to wrap everything from line 773 to where investments end

// Find the line with the investment button div (around line 773)
let wrapperAdded = false;
for (let i = 771; i < 775; i++) {
  if (lines[i] && lines[i].trim() === ')}') {
    console.log(`Found spending closing at line ${i+1}`);
    
    // The next non-empty line should be the investment content
    for (let j = i+1; j < i+5; j++) {
      if (lines[j] && lines[j].trim().length > 0) {
        console.log(`Investment content starts at line ${j+1}`);
        
        // Add the investment conditional before this line
        lines[j] = `
          {activeTab === 'investments' && (
            <>
              ${lines[j]}`;
        
        // Now find where to close it - after the investment table
        for (let k = 915; k < 930; k++) {
          if (lines[k] && lines[k].includes('Total Investment Transactions')) {
            // Find closing divs
            for (let m = k; m < k+10; m++) {
              if (lines[m] && lines[m].includes('</div>')) {
                // Find the last </div> in sequence
                let lastDiv = m;
                while (lines[lastDiv+1] && lines[lastDiv+1].trim() === '</div>') {
                  lastDiv++;
                }
                lines[lastDiv] = lines[lastDiv] + `
            </>
          )}`;
                console.log(`Added closing at line ${lastDiv+1}`);
                wrapperAdded = true;
                break;
              }
            }
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

if (wrapperAdded) {
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log('\n✅ Investment content is now properly wrapped and will ONLY show on investments tab!');
} else {
  console.log('\n❌ Could not add wrapper - structure may have changed');
}
