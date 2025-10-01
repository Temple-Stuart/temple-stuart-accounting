const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing duplicate select tags...\n');

// Find and fix the duplicate select
for (let i = 840; i < 850; i++) {
  if (!lines[i]) continue;
  
  if (lines[i].includes('<select') && lines[i+1] && lines[i+1].includes('<select')) {
    console.log(`Found duplicate select at lines ${i+1} and ${i+2}`);
    
    // Combine the attributes from both lines into one
    lines[i] = '                        <select';
    lines[i+1] = '                          value={investmentRowChanges[txnId]?.coa || ""}';
    lines.splice(i+2, 0, '                          className="text-xs border rounded px-1 py-0.5 w-full"');
    
    // Move onChange to next line if it's on the wrong line
    for (let j = i+3; j < i+10; j++) {
      if (lines[j] && lines[j].includes('onChange=')) {
        // It's already in the right place
        break;
      }
    }
    
    console.log('✅ Fixed duplicate select tag');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Duplicate select fixed');
