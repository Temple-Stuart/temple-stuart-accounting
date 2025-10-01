const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find the investment section (around line 769)
for (let i = 768; i < 780; i++) {
  if (lines[i].includes('{activeTab === \'investments\' && (')) {
    // Wrap the two divs in a fragment
    lines[i] = '          {activeTab === \'investments\' && (';
    lines[i+1] = '            <>';  // Add fragment opening
    
    // Shift everything else down and adjust indentation
    for (let j = i+2; j < i+10; j++) {
      if (lines[j-1].includes('<>')) {
        // This line should stay as is (the first div)
        continue;
      }
    }
    
    // Find where to close the fragment (after the table's closing div)
    for (let j = i+50; j < i+100; j++) {
      if (lines[j].includes('</table>') && lines[j+1].includes('</div>')) {
        // Add fragment closing after the div
        lines.splice(j+2, 0, '            </>');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed investment structure with fragment');
