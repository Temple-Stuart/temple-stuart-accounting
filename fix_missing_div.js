const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find line 771 where the div is missing
for (let i = 770; i < 775; i++) {
  if (lines[i].includes('<>') && lines[i+1].includes('<span className=')) {
    // Insert the missing div opening tag after the fragment
    lines[i+1] = '              <div className="p-4 bg-gray-50 flex justify-between items-center">\n' + lines[i+1];
    console.log('Added missing div opening tag');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed missing div tag');
