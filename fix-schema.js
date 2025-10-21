const fs = require('fs');
const schema = fs.readFileSync('./prisma/schema.prisma', 'utf8');
const lines = schema.split('\n');

// Find the accounts model and add entityType after subAccount
const newLines = [];
for (let i = 0; i < lines.length; i++) {
newLines.push(lines[i]);
// Check if this is the subAccount line inside accounts model (line 71)
if (i === 70 && lines[i].includes('subAccount') && lines[i].includes('String?')) {
newLines.push('  entityType              String?');
}
}
fs.writeFileSync('./prisma/schema.prisma', newLines.join('\n'));
console.log('✅ Added entityType to accounts model');
