const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find where the spending tab truly ends (look for the closing of committed transactions table)
let spendingEndFound = -1;
for (let i = 700; i < 768; i++) {
  if (lines[i].includes('</tbody>') && 
      lines[i+1].includes('</table>') &&
      lines[i-5].includes('committedTransactions.map')) {
    // Found the end of committed transactions table
    for (let j = i; j < i+10; j++) {
      if (lines[j].includes('</div>') && lines[j+1].includes(')}')) {
        spendingEndFound = j+1;
        console.log(`Found spending end at line ${j+2}`);
        break;
      }
    }
    if (spendingEndFound > 0) break;
  }
}

// Remove the floating investment section (lines 768+)
let floatingStart = -1;
let floatingEnd = -1;
for (let i = 767; i < lines.length; i++) {
  if (lines[i].includes('{activeTab === \'investments\' && (')) {
    floatingStart = i;
    // Find where this section ends
    let braceCount = 1;
    for (let j = i+1; j < lines.length; j++) {
      braceCount += (lines[j].match(/{/g) || []).length;
      braceCount -= (lines[j].match(/}/g) || []).length;
      if (braceCount === 0 || lines[j].includes(')}')) {
        floatingEnd = j;
        break;
      }
    }
    break;
  }
}

if (floatingStart > 0 && floatingEnd > 0) {
  // Extract the investment content
  const investmentContent = lines.slice(floatingStart, floatingEnd + 1);
  
  // Remove it from its current location
  lines.splice(floatingStart, floatingEnd - floatingStart + 1);
  console.log(`Removed floating investment section from lines ${floatingStart}-${floatingEnd}`);
  
  // Now insert it in the right place - right after spending closes
  if (spendingEndFound > 0) {
    // Adjust the index since we removed lines
    const insertAt = floatingStart < spendingEndFound ? spendingEndFound - (floatingEnd - floatingStart) : spendingEndFound;
    lines.splice(insertAt + 1, 0, ...investmentContent);
    console.log(`Inserted investment section at line ${insertAt + 1}`);
  } else {
    // If we can't find spending end, put it before the final closing divs
    for (let i = lines.length - 20; i < lines.length; i++) {
      if (lines[i].includes('</div>') && lines[i+1].includes('</div>') && lines[i+2].includes('</>')) {
        lines.splice(i, 0, ...investmentContent);
        console.log(`Inserted investment section at line ${i}`);
        break;
      }
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Moved investment section to correct location');
