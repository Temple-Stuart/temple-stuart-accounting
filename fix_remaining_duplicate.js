const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Removing remaining duplicate positionFilter...\n');

// Find the duplicate positionFilter
let foundFirst = false;
for (let i = 20; i < 40; i++) {
  if (lines[i] && lines[i].includes('const [positionFilter')) {
    if (foundFirst) {
      console.log(`Removing duplicate at line ${i+1}`);
      lines[i] = '';
    } else {
      foundFirst = true;
      console.log(`Keeping first declaration at line ${i+1}`);
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed!');
