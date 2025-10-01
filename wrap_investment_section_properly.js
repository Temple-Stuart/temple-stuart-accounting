const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Wrapping investment section in tab conditional...\n');

// The investment section starts at line 773 (after spending closes at 771)
// Find the exact line with the investment button div
let investmentStartFound = false;
for (let i = 772; i < 775; i++) {
  if (lines[i] && lines[i].trim().startsWith('<div className="p-4 bg-gray-50 flex justify-between')) {
    console.log(`Found investment section start at line ${i+1}`);
    
    // Add the conditional wrapper BEFORE this div
    lines[i] = `          {activeTab === 'investments' && (
            <>
              ${lines[i]}`;
    investmentStartFound = true;
    break;
  }
}

// Find where to close the conditional (after the investment table)
if (investmentStartFound) {
  // Look for "Total Investment Transactions" which is near the end
  for (let i = 900; i < 930; i++) {
    if (lines[i] && lines[i].includes('Total Investment Transactions:')) {
      console.log(`Found investment total at line ${i+1}`);
      
      // Find the closing </div> tags after this
      let divCount = 0;
      for (let j = i; j < i+15; j++) {
        if (lines[j] && lines[j].includes('</div>')) {
          divCount++;
          // After the second closing div (which closes the table container)
          if (divCount === 2) {
            lines[j] = lines[j] + `
            </>
          )}`;
            console.log(`Added closing at line ${j+1}`);
            break;
          }
        }
      }
      break;
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment section is now wrapped in activeTab === "investments" conditional!');
