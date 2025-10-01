const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find and remove the duplicate symbol declaration
let foundFirst = false;
for (let i = 790; i < 850; i++) {
  if (lines[i].includes('const symbol =') || lines[i].includes('let symbol =')) {
    if (!foundFirst) {
      foundFirst = true;
      console.log(`Found first symbol declaration at line ${i+1}`);
    } else {
      // This is a duplicate - remove it
      console.log(`Removing duplicate symbol declaration at line ${i+1}`);
      lines[i] = ''; // Remove the duplicate
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Removed duplicate symbol declaration');
