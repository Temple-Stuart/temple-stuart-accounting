const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Finding ALL investment transaction references...\n');

const investmentRefs = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i] && (lines[i].includes('investmentTransactions') || 
                   lines[i].includes('committedInvestments'))) {
    
    // Check context
    let context = 'UNKNOWN';
    for (let j = Math.max(0, i-15); j < i; j++) {
      if (lines[j]) {
        if (lines[j].includes("activeTab === 'spending'")) {
          context = 'SPENDING TAB';
          break;
        } else if (lines[j].includes("activeTab === 'investments'")) {
          context = 'INVESTMENTS TAB';
          break;
        }
      }
    }
    
    if (context === 'UNKNOWN') {
      // Check if it's outside any tab conditional
      let hasAnyTabCheck = false;
      for (let j = Math.max(0, i-20); j < i; j++) {
        if (lines[j] && lines[j].includes('activeTab')) {
          hasAnyTabCheck = true;
          break;
        }
      }
      if (!hasAnyTabCheck) context = 'NO TAB CHECK';
    }
    
    investmentRefs.push({
      line: i + 1,
      content: lines[i].trim().substring(0, 60),
      context: context
    });
  }
}

console.log('Investment references found:');
investmentRefs.forEach(ref => {
  if (ref.context !== 'INVESTMENTS TAB') {
    console.log(`❌ Line ${ref.line}: ${ref.context}`);
    console.log(`   ${ref.content}...`);
  } else {
    console.log(`✅ Line ${ref.line}: ${ref.context}`);
  }
});

// Show me exactly what needs to be fixed
const toFix = investmentRefs.filter(r => r.context === 'NO TAB CHECK' || r.context === 'SPENDING TAB');
if (toFix.length > 0) {
  console.log('\nNeed to fix these lines:');
  toFix.forEach(ref => {
    console.log(`Line ${ref.line}: ${ref.content}`);
  });
}
