const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing div structure...\n');

// Find the problem area around line 823-825
for (let i = 822; i < 826; i++) {
  if (lines[i] && lines[i].trim() === '</div>' && 
      lines[i+1] && lines[i+1].trim() === '</div>' &&
      lines[i+2] && lines[i+2].trim() === '</div>') {
    console.log(`Found triple closing divs at lines ${i+1}-${i+3}`);
    // Remove one of the extra closing divs
    lines.splice(i+1, 1);
    console.log('Removed extra closing div');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed div structure');
