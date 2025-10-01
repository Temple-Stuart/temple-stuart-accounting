const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find where the investment commit button starts (around line 769)
let buttonLine = -1;
for (let i = 765; i < 775; i++) {
  if (lines[i] && lines[i].includes('Uncommitted: {investmentTransactions.length}')) {
    buttonLine = i - 1; // Start of the div
    break;
  }
}

if (buttonLine > 0) {
  // Add the conditional wrapper BEFORE the button
  lines[buttonLine] = '          {activeTab === \'investments\' && (\n' + lines[buttonLine];
  
  // Now find where to close this conditional (after the investment table ends)
  // Look for the closing of the investment section
  let closeFound = false;
  for (let i = 850; i < 870; i++) {
    if (lines[i] && lines[i].includes('</table>')) {
      // Find the next few closing divs
      for (let j = i; j < i + 10; j++) {
        if (lines[j] && lines[j].trim() === '</div>') {
          // Add the closing parenthesis after the last div
          lines[j] = lines[j] + '\n          )}';
          closeFound = true;
          console.log('Added closing at line', j+1);
          break;
        }
      }
      if (closeFound) break;
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Wrapped investment section in activeTab conditional');
