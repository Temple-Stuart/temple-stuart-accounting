const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing investment UI connections...\n');

// 1. Fix investment button to show counts
for (let i = 520; i < 540; i++) {
  if (lines[i].includes('Investments (') && lines[i].includes('746')) {
    lines[i] = '              Investments ({investmentTransactions.length} uncommitted, {committedInvestments.length} committed)';
    console.log('✅ Fixed investment tab button text');
    break;
  }
}

// 2. Find the investment table section and wrap it properly
let investmentTableStart = -1;
for (let i = 760; i < 800; i++) {
  if (lines[i].includes('<div className="overflow-auto"') && lines[i].includes('600px')) {
    investmentTableStart = i;
    break;
  }
}

if (investmentTableStart > 0) {
  // Add the wrapper and commit button BEFORE the table
  const newSection = `          {activeTab === 'investments' && (
            <>
              <div className="p-4 bg-gray-50 flex justify-between items-center">
                <span className="text-sm">Uncommitted: {investmentTransactions.length} | Committed: {committedInvestments.length}</span>
                <button onClick={commitSelectedInvestmentRows} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
                </button>
              </div>`;
  
  lines.splice(investmentTableStart, 0, newSection);
  console.log('✅ Added investment wrapper and commit button');
}

// 3. Fix the dropdowns to use investmentRowChanges (around line 800-830)
for (let i = 800; i < 850; i++) {
  // Fix Strategy dropdown
  if (lines[i].includes('<select className="text-xs border rounded px-1 py-0.5 w-24">')) {
    lines[i] = '                        <select value={investmentRowChanges[txn.id || txn.investment_transaction_id]?.strategy || ""} onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id || txn.investment_transaction_id]: {...(investmentRowChanges[txn.id || txn.investment_transaction_id] || {}), strategy: e.target.value}})} className="text-xs border rounded px-1 py-0.5 w-24">';
    console.log('✅ Connected strategy dropdown');
  }
  
  // Fix COA dropdown
  if (lines[i].includes('<option value="">Select COA</option>')) {
    // Go back one line to fix the select tag
    lines[i-1] = '                        <select value={investmentRowChanges[txn.id || txn.investment_transaction_id]?.coa || ""} onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id || txn.investment_transaction_id]: {...(investmentRowChanges[txn.id || txn.investment_transaction_id] || {}), coa: e.target.value}})} className="text-xs border rounded px-1 py-0.5 w-full">';
    console.log('✅ Connected COA dropdown');
  }
  
  // Fix Sub dropdown
  if (lines[i].includes('<option value="">-</option>') && lines[i-3].includes('bg-yellow-50')) {
    lines[i-1] = '                        <select value={investmentRowChanges[txn.id || txn.investment_transaction_id]?.sub || ""} onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id || txn.investment_transaction_id]: {...(investmentRowChanges[txn.id || txn.investment_transaction_id] || {}), sub: e.target.value}})} className="text-xs border rounded px-1 py-0.5 w-full">';
    console.log('✅ Connected Sub dropdown');
    break;
  }
}

// 4. Close the investment wrapper after the table
for (let i = 850; i < 870; i++) {
  if (lines[i].includes('Total Investment Transactions:')) {
    // Add closing tags after this section
    for (let j = i; j < i+5; j++) {
      if (lines[j].includes('</div>') && lines[j+1].includes('</div>')) {
        lines.splice(j+2, 0, '            </>\n          )}');
        console.log('✅ Closed investment wrapper');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment UI completely fixed!');
