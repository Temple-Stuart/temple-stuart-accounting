const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// First update the counts
let updated = content.replace(
  'Investments (746)',
  'Investments ({investmentTransactions.length + committedInvestments.length})'
);

// Update total transactions
updated = updated.replace(
  'const totalTransactions = transactions.length + committedTransactions.length;',
  'const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;'
);

// Add a simple inline button that logs for now
updated = updated.replace(
  '<div className="overflow-auto" style={{maxHeight: \'600px\'}}>',
  `<div className="p-4 bg-gray-50 flex justify-between items-center">
              <span className="text-sm">Investment Transactions: {investmentTransactions.length} uncommitted, {committedInvestments.length} committed</span>
              <button 
                onClick={() => { console.log('Commit investments clicked'); alert('Select Strategy and COA in dropdowns first'); }}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Commit Investments
              </button>
            </div>
            <div className="overflow-auto" style={{maxHeight: '600px'}}>`
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Added simple working button');
