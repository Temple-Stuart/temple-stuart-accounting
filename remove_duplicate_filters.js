const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Checking for duplicate filter declarations...\n');

// Find and remove duplicate filter states
let foundFirst = {};
for (let i = 20; i < 35; i++) {
  if (lines[i]) {
    if (lines[i].includes('const [dateFilter')) {
      if (foundFirst.date) {
        lines[i] = ''; // Remove duplicate
        console.log('Removed duplicate dateFilter');
      } else {
        foundFirst.date = true;
      }
    }
    if (lines[i].includes('const [symbolFilter')) {
      if (foundFirst.symbol) {
        lines[i] = ''; // Remove duplicate
        console.log('Removed duplicate symbolFilter');
      } else {
        foundFirst.symbol = true;
      }
    }
    if (lines[i].includes('const [positionFilter')) {
      if (foundFirst.position) {
        lines[i] = ''; // Remove duplicate
        console.log('Removed duplicate positionFilter');
      } else {
        foundFirst.position = true;
      }
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Removed duplicate declarations');
