const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Creating unified transaction dashboard...\n');

// 1. Remove the tab buttons section
let tabStart = -1;
let tabEnd = -1;
for (let i = 520; i < 540; i++) {
  if (lines[i] && lines[i].includes('flex gap-2 border-b')) {
    tabStart = i;
    for (let j = i; j < i+20; j++) {
      if (lines[j] && lines[j].includes('</button>') && lines[j+1] && lines[j+1].includes('</div>')) {
        tabEnd = j+1;
        break;
      }
    }
    break;
  }
}

if (tabStart > 0 && tabEnd > 0) {
  // Replace tabs with a unified header
  const unifiedHeader = `          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {transactions.length + investmentTransactions.length} total • 
                  {committedTransactions.length + committedInvestments.length} committed
                </p>
              </div>
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ${Math.abs(transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">Income</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    ${Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">Expenses</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ${Math.abs(investmentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">Investments</div>
                </div>
              </div>
            </div>
          </div>`;
  
  lines.splice(tabStart, tabEnd - tabStart + 1, unifiedHeader);
  console.log('✅ Replaced tabs with unified header');
}

// 2. Remove activeTab conditionals and merge both tables into sections
for (let i = 0; i < lines.length; i++) {
  if (lines[i] && lines[i].includes("{activeTab === 'spending'")) {
    lines[i] = '          {/* Spending Transactions Section */}';
  }
  if (lines[i] && lines[i].includes("{activeTab === 'investments'")) {
    lines[i] = '          {/* Investment Transactions Section */}';
  }
}

// 3. Add section headers and styling
for (let i = 600; i < 700; i++) {
  if (lines[i] && lines[i].includes('Spending Transactions Section')) {
    // Add a nice section header
    const spendingHeader = `
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Spending & Banking
              </h3>
              <p className="text-sm text-gray-600 mt-1">{transactions.length} transactions • {committedTransactions.length} committed</p>
            </div>
            <div className="p-6">`;
    
    lines.splice(i+1, 0, spendingHeader);
    console.log('✅ Added spending section header');
    break;
  }
}

// 4. Style the investment section
for (let i = 770; i < 850; i++) {
  if (lines[i] && lines[i].includes('Investment Transactions Section')) {
    const investmentHeader = `
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Investments & Trading
              </h3>
              <p className="text-sm text-gray-600 mt-1">{investmentTransactions.length} trades • {committedInvestments.length} committed</p>
            </div>
            <div className="p-6">`;
    
    lines.splice(i+1, 0, investmentHeader);
    
    // Add closing divs after the investment table
    for (let j = i; j < i+100; j++) {
      if (lines[j] && lines[j].includes('</table>')) {
        for (let k = j; k < j+10; k++) {
          if (lines[k] && lines[k].includes('</div>') && !lines[k+1].includes('</div>')) {
            lines.splice(k+1, 0, '            </div>\n          </div>');
            break;
          }
        }
        break;
      }
    }
    console.log('✅ Added investment section header');
    break;
  }
}

// 5. Update table styling to be more modern
const oldTableClass = 'className="w-full text-xs"';
const newTableClass = 'className="w-full text-sm"';

for (let i = 0; i < lines.length; i++) {
  if (lines[i] && lines[i].includes(oldTableClass)) {
    lines[i] = lines[i].replace(oldTableClass, newTableClass);
  }
  
  // Update header styling
  if (lines[i] && lines[i].includes('className="bg-gray-50 sticky top-0"')) {
    lines[i] = lines[i].replace(
      'className="bg-gray-50 sticky top-0"',
      'className="bg-gray-50 sticky top-0 text-xs uppercase tracking-wider text-gray-600"'
    );
  }
  
  // Update row hover styling
  if (lines[i] && lines[i].includes('className="hover:bg-gray-50"')) {
    lines[i] = lines[i].replace(
      'className="hover:bg-gray-50"',
      'className="hover:bg-gray-50 transition-colors duration-150"'
    );
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Created unified, beautiful transaction dashboard!');
