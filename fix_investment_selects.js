const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find the investment select dropdowns (around line 803-820)
for (let i = 800; i < 830; i++) {
  // Fix Strategy select
  if (lines[i].includes('<select className="text-xs border rounded px-1 py-0.5 w-24">')) {
    lines[i] = `                        <select value={investmentRowChanges[txn.id || txn.investment_transaction_id]?.strategy || ''} onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id || txn.investment_transaction_id]: {...(investmentRowChanges[txn.id || txn.investment_transaction_id] || {}), strategy: e.target.value}})} className="text-xs border rounded px-1 py-0.5 w-24">`;
    console.log('Fixed strategy select at line', i+1);
  }
  
  // Fix COA select (it's a bit further down)
  if (lines[i].includes('<select className="text-xs border rounded px-1 py-0.5 w-full">') && lines[i-2].includes('bg-yellow-50')) {
    // First occurrence is COA
    lines[i] = `                        <select value={investmentRowChanges[txn.id || txn.investment_transaction_id]?.coa || ''} onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id || txn.investment_transaction_id]: {...(investmentRowChanges[txn.id || txn.investment_transaction_id] || {}), coa: e.target.value}})} className="text-xs border rounded px-1 py-0.5 w-full">`;
    console.log('Fixed COA select at line', i+1);
    
    // The Sub select is a few lines later
    for (let j = i+1; j < i+20; j++) {
      if (lines[j].includes('<select className="text-xs border rounded px-1 py-0.5 w-full">')) {
        lines[j] = `                        <select value={investmentRowChanges[txn.id || txn.investment_transaction_id]?.sub || ''} onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id || txn.investment_transaction_id]: {...(investmentRowChanges[txn.id || txn.investment_transaction_id] || {}), sub: e.target.value}})} className="text-xs border rounded px-1 py-0.5 w-full">`;
        console.log('Fixed Sub select at line', j+1);
        break;
      }
    }
    break;
  }
}

// Add a commit button before the investment table (around line 770)
for (let i = 765; i < 775; i++) {
  if (lines[i].includes('<div className="overflow-auto"')) {
    // Insert commit button before the table
    const commitButton = `            <div className="p-4 bg-gray-50 flex justify-between items-center">
              <span className="text-sm">Uncommitted: {investmentTransactions.length} | Committed: {committedInvestments.length}</span>
              <button onClick={commitSelectedInvestmentRows} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
              </button>
            </div>`;
    lines.splice(i, 0, commitButton);
    console.log('Added commit button at line', i+1);
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Connected investment dropdowns to state!');
