const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Remove the duplicate line 770
if (lines[769] && lines[769].includes("activeTab === 'investments'") && 
    lines[768] && lines[768].includes("activeTab === 'investments'")) {
  lines.splice(769, 1); // Remove the duplicate
  console.log('Removed duplicate activeTab check');
} else if (lines[769] && lines[769].includes("activeTab === 'investments'") && 
           lines[768] && lines[768].includes("activeTab === 'investments'")) {
  lines.splice(768, 1); // Remove line 769 (0-indexed so it's 768)
  console.log('Removed duplicate activeTab check');
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed duplicate');
