const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing closing div structure...\n');

// Find the problematic area around line 869
for (let i = 865; i < 875; i++) {
  if (lines[i] && lines[i].includes('{/* Close spacing div */}')) {
    // Remove this comment and the extra div
    lines.splice(i, 2); // Remove the comment and the div after it
    console.log('Removed extra closing divs');
    break;
  }
}

// Count opening and closing divs to ensure balance
let openDivs = 0;
let closeDivs = 0;
for (let line of lines) {
  if (line) {
    openDivs += (line.match(/<div/g) || []).length;
    closeDivs += (line.match(/<\/div>/g) || []).length;
  }
}

console.log(`Div balance: ${openDivs} opening, ${closeDivs} closing`);

if (openDivs < closeDivs) {
  // Too many closing divs - remove some from the end
  for (let i = lines.length - 10; i < lines.length; i++) {
    if (lines[i] && lines[i].includes('</div>') && closeDivs > openDivs) {
      lines[i] = '';
      closeDivs--;
      if (closeDivs === openDivs) break;
    }
  }
  console.log('Balanced div tags');
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.filter(l => l !== '').join('\n'));
console.log('\n✅ Fixed structure');
