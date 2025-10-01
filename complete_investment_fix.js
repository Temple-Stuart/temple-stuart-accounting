const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('Applying complete investment fix...\n');

// 1. Fix totalTransactions to include investments
let updated = content.replace(
  'const totalTransactions = transactions.length + committedTransactions.length;',
  'const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;'
);

// 2. Fix progressPercent to include investments
updated = updated.replace(
  'const progressPercent = totalTransactions > 0 ? (committedTransactions.length / totalTransactions * 100) : 0;',
  'const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;'
);

// 3. Update investment button text
updated = updated.replace(
  'Investments (746)',
  'Investments ({investmentTransactions.length} uncommitted, {committedInvestments.length} committed)'
);

// 4. Wrap investment table in activeTab check and add ALL features
const investmentTableRegex = /(<div className="overflow-auto" style={{maxHeight: '600px'}}>[\s\S]*?investmentTransactions\.map[\s\S]*?<\/table>\s*<\/div>)/g;

updated = updated.replace(investmentTableRegex, (match) => {
  // Only modify if NOT already wrapped in activeTab check
  if (!match.includes('activeTab')) {
    return `{activeTab === 'investments' && (
            <>
              <div className="p-4 bg-gray-50 flex justify-between items-center mb-4">
                <span className="text-sm">Investment Transactions: {investmentTransactions.length} uncommitted, {committedInvestments.length} committed</span>
                <button 
                  onClick={() => { 
                    const selected = Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy);
                    if(selected.length === 0) { 
                      alert("Select Strategy and COA for transactions to commit"); 
                    } else { 
                      alert(\`Ready to commit \${selected.length} investments (backend integration pending)\`);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
                </button>
              </div>
              ${match}
            </>
          )}`;
  }
  return match;
});

// 5. Fix the investment map function to include symbol extraction and proper dropdowns
updated = updated.replace(
  /{investmentTransactions\.map\((txn: any)\) => \(/g,
  `{investmentTransactions.map((txn: any) => {
                    const txnId = txn.id || txn.investment_transaction_id;
                    // Extract symbol from name
                    let symbol = '-';
                    const nameParts = txn.name?.split(' ') || [];
                    for (let k = 0; k < nameParts.length; k++) {
                      if (nameParts[k].match(/^[A-Z]+$/)) {
                        symbol = nameParts[k];
                        break;
                      }
                    }
                    return (`
);

// 6. Update symbol column to use extracted symbol
updated = updated.replace(
  /<td className="px-2 py-2 font-medium">{txn\.security\?\.ticker_symbol \|\| '-'}<\/td>/g,
  '<td className="px-2 py-2 font-medium">{symbol}</td>'
);

// 7. Fix strategy dropdown to track changes
updated = updated.replace(
  /<select className="text-xs border rounded px-1 py-0.5 w-24">/g,
  `<select 
                          value={investmentRowChanges[txnId]?.strategy || ''}
                          onChange={(e) => setInvestmentRowChanges({
                            ...investmentRowChanges,
                            [txnId]: {...(investmentRowChanges[txnId] || {}), strategy: e.target.value}
                          })}
                          className="text-xs border rounded px-1 py-0.5 w-24">`
);

// 8. Fix COA dropdown
updated = updated.replace(
  /<select className="text-xs border rounded px-1 py-0.5 w-full">\s*<option value="">Select COA<\/option>/g,
  `<select 
                          value={investmentRowChanges[txnId]?.coa || ''}
                          onChange={(e) => setInvestmentRowChanges({
                            ...investmentRowChanges,
                            [txnId]: {...(investmentRowChanges[txnId] || {}), coa: e.target.value}
                          })}
                          className="text-xs border rounded px-1 py-0.5 w-full">
                          <option value="">Select COA</option>`
);

// 9. Fix the map closing
updated = updated.replace(/\)\)}/g, (match, offset) => {
  // Check if this is inside investmentTransactions context
  const before = updated.substring(Math.max(0, offset - 200), offset);
  if (before.includes('investmentTransactions')) {
    return ');\n                  })}';
  }
  return match;
});

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Complete investment fix applied successfully!');
