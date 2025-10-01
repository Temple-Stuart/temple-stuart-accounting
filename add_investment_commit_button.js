const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find where the investment table starts (around line 770)
let tableStart = -1;
for (let i = 760; i < 800; i++) {
  if (lines[i].includes('<div className="overflow-auto" style={{maxHeight: \'600px\'}}>')
      && !lines[i-5].includes('spending')) {
    tableStart = i;
    break;
  }
}

if (tableStart > 0) {
  // Add a simple commit button before the table
  const buttonHtml = `            <div className="p-4 bg-gray-50 flex justify-between items-center">
              <span className="text-sm">Investment Transactions: {investmentTransactions.length} uncommitted, {committedInvestments.length} committed</span>
              <button 
                onClick={() => alert('Investment commit functionality coming soon!')}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Commit Investments
              </button>
            </div>`;
  
  lines.splice(tableStart, 0, buttonHtml);
  console.log('✅ Added investment commit button');
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
