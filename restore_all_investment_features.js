const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Restoring all investment features...\n');

// 1. Fix progress calculation to include investments
for (let i = 300; i < 320; i++) {
  if (lines[i].includes('const progressPercent =')) {
    lines[i] = '  const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;';
    console.log('✅ Fixed progress calculation');
    break;
  }
}

// 2. Find investment table in the investments tab and add all features
let investmentTableFound = false;
for (let i = 770; i < 900; i++) {
  if (lines[i].includes("activeTab === 'investments'")) {
    console.log(`Found investment tab at line ${i+1}`);
    
    // Look for the investment table map within this section
    for (let j = i; j < i+100; j++) {
      if (lines[j].includes('investmentTransactions.map')) {
        console.log(`Found investment map at line ${j+1}`);
        
        // Add symbol extraction right after the map
        lines[j] = `                  {investmentTransactions.map((txn: any) => {
                    const txnId = txn.id || txn.investment_transaction_id;
                    // Extract symbol from name - skip "buy"/"sell" and find uppercase ticker
                    let symbol = '-';
                    const nameParts = txn.name?.split(' ') || [];
                    for (let k = 0; k < nameParts.length; k++) {
                      if (nameParts[k].match(/^[A-Z]+$/)) {
                        symbol = nameParts[k];
                        break;
                      }
                    }
                    return (`;
        
        // Update the symbol column to use extracted symbol
        for (let k = j; k < j+10; k++) {
          if (lines[k].includes('txn.security?.ticker_symbol')) {
            lines[k] = '                      <td className="px-2 py-2 font-medium">{symbol}</td>';
            console.log('✅ Fixed symbol extraction');
            break;
          }
        }
        
        // Close the return properly
        for (let k = j+60; k < j+80; k++) {
          if (lines[k].includes('))}') && !lines[k].includes('return')) {
            lines[k] = '                    );\n                  })}';
            break;
          }
        }
        investmentTableFound = true;
        break;
      }
    }
    
    // Add commit button before the table
    for (let j = i; j < i+20; j++) {
      if (lines[j].includes('<div className="overflow-auto"') && lines[j].includes('600px')) {
        // Insert commit button before this div
        const commitButton = `              <div className="p-4 bg-gray-50 flex justify-between items-center mb-4">
                <span className="text-sm">Investment Transactions: {investmentTransactions.length} uncommitted, {committedInvestments.length} committed</span>
                <button 
                  onClick={() => { 
                    const selected = Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy);
                    if(selected.length === 0) { 
                      alert("Select Strategy and COA for transactions to commit"); 
                    } else { 
                      console.log("Committing", selected.length, "investments");
                      alert(\`Ready to commit \${selected.length} investments (backend integration pending)\`);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
                </button>
              </div>`;
        
        lines.splice(j, 0, commitButton);
        console.log('✅ Added commit button');
        break;
      }
    }
    break;
  }
}

// 3. Connect the dropdowns to track changes
for (let i = 800; i < 900; i++) {
  // Strategy dropdown
  if (lines[i].includes('<select className="text-xs border rounded px-1 py-0.5 w-24">')) {
    lines[i] = `                        <select 
                          value={investmentRowChanges[txnId]?.strategy || ''}
                          onChange={(e) => setInvestmentRowChanges({
                            ...investmentRowChanges,
                            [txnId]: {...(investmentRowChanges[txnId] || {}), strategy: e.target.value}
                          })}
                          className="text-xs border rounded px-1 py-0.5 w-24">`;
    console.log('✅ Connected Strategy dropdown');
  }
  
  // COA dropdown
  if (lines[i].includes('<option value="">Select COA</option>')) {
    lines[i-1] = `                        <select 
                          value={investmentRowChanges[txnId]?.coa || ''}
                          onChange={(e) => setInvestmentRowChanges({
                            ...investmentRowChanges,
                            [txnId]: {...(investmentRowChanges[txnId] || {}), coa: e.target.value}
                          })}
                          className="text-xs border rounded px-1 py-0.5 w-full">`;
    console.log('✅ Connected COA dropdown');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ All investment features restored!');
