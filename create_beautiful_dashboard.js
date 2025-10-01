const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('Creating beautiful unified dashboard...\n');

// 1. Update total transactions and progress to include investments
let updated = content.replace(
  'const totalTransactions = transactions.length + committedTransactions.length;',
  'const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;'
);

updated = updated.replace(
  'const progressPercent = totalTransactions > 0 ? (committedTransactions.length / totalTransactions * 100) : 0;',
  'const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;'
);

// 2. Replace the tab buttons with a beautiful unified header
const oldTabSection = /<div className="border-b flex gap-2">[\s\S]*?<\/button>\s*<\/div>/;

const newHeader = `<div className="mb-8">
            {/* Dashboard Header */}
            <div className="bg-gradient-to-r from-[#b4b237]/10 to-transparent rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Transaction Dashboard</h2>
                  <p className="text-gray-600 mt-2">Manage all your financial activity in one place</p>
                </div>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      \${Math.abs(transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Income</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600">
                      \${Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Spending</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#b4b237]">
                      \${Math.abs(investmentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Investments</p>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar Section */}
              <div className="mt-6 bg-white/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Processing Progress</span>
                  <span className="text-sm font-bold text-gray-900">
                    {committedTransactions.length + committedInvestments.length} / {totalTransactions} committed ({progressPercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-[#b4b237] to-[#9a9630] h-3 rounded-full transition-all duration-500"
                    style={{width: \`\${progressPercent}%\`}}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">`;

updated = updated.replace(oldTabSection, newHeader);

// 3. Wrap spending section in a nice card
const spendingTableStart = /<div className="overflow-auto"[\s\S]*?{transactions\.map/;
updated = updated.replace(spendingTableStart, 
  `{/* Spending & Banking Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Banking Transactions</h3>
                    <p className="text-sm text-gray-600">{transactions.length} total • {committedTransactions.length} committed</p>
                  </div>
                </div>
                <button 
                  onClick={() => commitSelectedRows()}
                  className="px-4 py-2 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630] transition-colors"
                >
                  Commit Selected ({Object.keys(rowChanges).filter(id => rowChanges[id]?.coa).length})
                </button>
              </div>
            </div>
            <div className="overflow-auto" style={{maxHeight: '500px'}}>
              {transactions.map`
);

// 4. Style investment section
const investmentTablePattern = /<div className="overflow-auto"[\s\S]*?{investmentTransactions\.map/g;
let investmentCount = 0;
updated = updated.replace(investmentTablePattern, (match) => {
  investmentCount++;
  if (investmentCount === 2) { // Only replace the second occurrence (the actual investment table)
    return `{/* Investment & Trading Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#b4b237]/10 to-white px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#b4b237]/20 rounded-lg">
                    <svg className="w-6 h-6 text-[#b4b237]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Investment Activity</h3>
                    <p className="text-sm text-gray-600">{investmentTransactions.length} trades • {committedInvestments.length} committed</p>
                  </div>
                </div>
                <button 
                  onClick={() => alert('Commit investments coming soon')}
                  className="px-4 py-2 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630] transition-colors"
                >
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
                </button>
              </div>
            </div>
            <div className="overflow-auto" style={{maxHeight: '500px'}}>
              {investmentTransactions.map`;
  }
  return match;
});

// 5. Add closing div for the sections
updated = updated.replace(
  '</div>\n      </div>\n    </>\n  );',
  `            </div>
          </div>
          
          {/* Close spacing div */}
          </div>
        </div>
      </div>
    </>
  );`
);

// 6. Remove old tab state checks
updated = updated.replace(/{activeTab === 'spending' && \(/g, '{true && (');
updated = updated.replace(/{activeTab === 'investments' && \(/g, '{true && (');

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Beautiful unified dashboard created!');
