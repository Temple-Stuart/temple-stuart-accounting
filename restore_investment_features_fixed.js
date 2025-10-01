const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Restoring investment features...\n');

// 1. Fix progress calculation
for (let i = 300; i < 320; i++) {
  if (lines[i] && lines[i].includes('const progressPercent =')) {
    lines[i] = '  const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;';
    console.log('✅ Fixed progress calculation');
    break;
  }
}

// 2. Find the investment tab section
for (let i = 770; i < Math.min(lines.length, 900); i++) {
  if (!lines[i]) continue;
  
  if (lines[i].includes("activeTab === 'investments'")) {
    console.log(`Found investment tab at line ${i+1}`);
    
    // Add commit button if not present
    let hasCommitButton = false;
    for (let j = i; j < Math.min(i+50, lines.length); j++) {
      if (lines[j] && lines[j].includes('Commit Selected')) {
        hasCommitButton = true;
        break;
      }
    }
    
    if (!hasCommitButton) {
      // Find where to insert the commit button
      for (let j = i; j < Math.min(i+20, lines.length); j++) {
        if (lines[j] && lines[j].includes('<div className="overflow-auto"') && lines[j].includes('600px')) {
          const commitButton = `              <div className="p-4 bg-gray-50 flex justify-between items-center mb-4">
                <span className="text-sm">Investments: {investmentTransactions.length} uncommitted, {committedInvestments.length} committed</span>
                <button 
                  onClick={() => { 
                    const selected = Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy);
                    if(selected.length === 0) { 
                      alert("Select Strategy and COA for transactions to commit"); 
                    } else { 
                      alert(\`Ready to commit \${selected.length} investments\`);
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
    }
    
    // Fix symbol extraction in the map
    for (let j = i; j < Math.min(i+100, lines.length); j++) {
      if (lines[j] && lines[j].includes('investmentTransactions.map((txn: any)')) {
        // Check if symbol extraction already exists
        if (!lines[j+1] || !lines[j+1].includes('const txnId')) {
          lines[j] = `                  {investmentTransactions.map((txn: any) => {
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
                    return (`;
          
          // Update symbol display
          for (let k = j; k < Math.min(j+10, lines.length); k++) {
            if (lines[k] && lines[k].includes('txn.security?.ticker_symbol')) {
              lines[k] = '                      <td className="px-2 py-2 font-medium">{symbol}</td>';
              console.log('✅ Fixed symbol extraction');
              break;
            }
          }
          
          // Fix closing
          for (let k = j+60; k < Math.min(j+80, lines.length); k++) {
            if (lines[k] && lines[k].includes('))}') && !lines[k].includes('return')) {
              lines[k] = '                    );\n                  })}';
              break;
            }
          }
        }
        break;
      }
    }
    break;
  }
}

// 3. Connect dropdowns
for (let i = 800; i < Math.min(900, lines.length); i++) {
  if (!lines[i]) continue;
  
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
  if (lines[i].includes('<option value="">Select COA</option>') && i > 0) {
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
console.log('\n✅ Investment features restored!');
