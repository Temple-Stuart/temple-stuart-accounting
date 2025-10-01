const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find the OLD investment section (the one that's broken around line 1050)
let oldSectionStart = -1;
let oldSectionEnd = -1;

// Look for the old investment section (it's the second one, around line 1050)
let foundCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("activeTab === 'investments'") && lines[i].includes('{')) {
    foundCount++;
    if (foundCount === 2) {  // This is the OLD broken one
      oldSectionStart = i;
      // Find where this section ends
      let braceCount = 0;
      for (let j = i; j < lines.length; j++) {
        braceCount += (lines[j].match(/{/g) || []).length;
        braceCount -= (lines[j].match(/}/g) || []).length;
        if (braceCount === 0 && j > i) {
          oldSectionEnd = j;
          break;
        }
      }
      break;
    }
  }
}

// If we found the old section, remove it
if (oldSectionStart !== -1 && oldSectionEnd !== -1) {
  console.log(`Removing old investment section from line ${oldSectionStart + 1} to ${oldSectionEnd + 1}`);
  lines.splice(oldSectionStart, oldSectionEnd - oldSectionStart + 1);
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log('✅ Fixed! Old investment section removed.');
} else {
  console.log('Could not find duplicate section. Checking structure...');
  
  // Alternative: Just look for the problematic lines around 1050-1060
  for (let i = 1040; i < Math.min(1070, lines.length); i++) {
    if (lines[i].includes("activeTab === 'investments'")) {
      // Remove this section
      console.log(`Found problematic section at line ${i + 1}`);
      // Find the end (looking for the closing }))
      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j].includes(')}')) {
          lines.splice(i, j - i + 1);
          fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
          console.log('✅ Fixed! Removed duplicate section.');
          break;
        }
      }
      break;
    }
  }
}
