const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find where the investment section ends (around line 676)
// The problem is we're missing proper closing divs
for (let i = 670; i < 680; i++) {
  if (lines[i] && lines[i].trim() === ')}') {
    // This should be the end of the investment section
    // We need to add proper closing divs before this
    lines[i] = '          )}';
    
    // Now add the missing closing divs after the investment section
    lines.splice(i+1, 0, '        </div>');
    lines.splice(i+2, 0, '      </div>');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed structure');
