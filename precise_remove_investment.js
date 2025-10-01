const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// Simply comment out the investment table in spending tab rather than removing it
// This is safer and won't break the structure
const updated = content.replace(
  /<div className="overflow-auto" style=\{\{maxHeight: '600px'\}\}>\s*<table[\s\S]*?investmentTransactions[\s\S]*?<\/table>\s*<\/div>/g,
  (match) => {
    // Only replace if it's NOT inside an investments tab check
    if (!match.includes('activeTab') && match.includes('investmentTransactions')) {
      return '<!-- Investment table removed from spending tab -->';
    }
    return match;
  }
);

// If that didn't work, try a different approach
if (updated === content) {
  // Find the specific table and replace it
  const lines = content.split('\n');
  let inInvestmentTable = false;
  let tableDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    // Check if we're starting an investment table that's NOT in the investment tab
    if (lines[i].includes('investmentTransactions.map') || 
        lines[i].includes('investmentTransactions.filter')) {
      // Check if this is wrapped in activeTab === 'investments'
      let isInInvestmentTab = false;
      for (let j = Math.max(0, i-10); j < i; j++) {
        if (lines[j].includes("activeTab === 'investments'")) {
          isInInvestmentTab = true;
          break;
        }
      }
      
      if (!isInInvestmentTab) {
        // This investment table should not be here
        console.log(`Found misplaced investment table at line ${i+1}`);
        
        // Find the containing div
        for (let j = i-1; j >= Math.max(0, i-30); j--) {
          if (lines[j].includes('<div className="overflow-auto"')) {
            // Replace this entire div with a placeholder
            lines[j] = '<!-- Investment table removed from spending tab -->';
            
            // Remove all lines until we find the closing div
            let divCount = 1;
            for (let k = j+1; k < lines.length && divCount > 0; k++) {
              if (lines[k].includes('<div')) divCount++;
              if (lines[k].includes('</div>')) divCount--;
              lines[k] = '';
            }
            break;
          }
        }
        break;
      }
    }
  }
  
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
  console.log('✅ Removed investment table from spending tab');
} else {
  fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
  console.log('✅ Removed investment table from spending tab');
}
