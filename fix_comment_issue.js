const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find and replace the HTML comment with JSX comment or remove it
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<!-- Investment table removed from spending tab -->')) {
    // Replace with JSX comment
    lines[i] = '          {/* Investment table removed from spending tab */}';
    console.log(`Fixed comment at line ${i+1}`);
    break;
  }
}

// Also remove any empty lines that might cause issues
const cleanedLines = lines.filter((line, index) => {
  // Keep non-empty lines or important empty lines
  if (line.trim() !== '') return true;
  // Keep empty lines between major sections
  if (index > 0 && index < lines.length - 1) {
    const prevLine = lines[index - 1].trim();
    const nextLine = lines[index + 1].trim();
    // Keep empty line if it's between meaningful content
    if (prevLine && nextLine) return true;
  }
  return false;
});

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', cleanedLines.join('\n'));
console.log('✅ Fixed JSX comment syntax');
