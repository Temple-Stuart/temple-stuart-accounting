const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find where investmentTransactions.map is (around line 790-810)
let mapLine = -1;
for (let i = 790; i < 830; i++) {
  if (lines[i].includes('{investmentTransactions.map((txn: any) => (')) {
    mapLine = i;
    break;
  }
}

if (mapLine > 0) {
  // Add symbol extraction logic right after the map
  lines[mapLine] = `                  {investmentTransactions.map((txn: any) => {
                    const txnId = txn.id || txn.investment_transaction_id;
                    // Extract symbol from name (e.g., "INTC 241227C45000" -> "INTC")
                    const symbol = txn.name?.split(' ')[0] || txn.security?.ticker_symbol || '-';
                    return (`;
  
  // Update the symbol column to use extracted symbol
  for (let i = mapLine; i < mapLine + 10; i++) {
    if (lines[i].includes('{txn.security?.ticker_symbol || \'-\'}')) {
      lines[i] = '                      <td className="px-2 py-2 font-medium">{symbol}</td>';
      break;
    }
  }
  
  // Fix the Strategy dropdown to track changes
  for (let i = mapLine; i < mapLine + 50; i++) {
    if (lines[i].includes('<select className="text-xs border rounded px-1 py-0.5 w-24">')) {
      lines[i] = `                        <select 
                          value={investmentRowChanges[txnId]?.strategy || ''}
                          onChange={(e) => setInvestmentRowChanges({
                            ...investmentRowChanges, 
                            [txnId]: {...(investmentRowChanges[txnId] || {}), strategy: e.target.value}
                          })}
                          className="text-xs border rounded px-1 py-0.5 w-24">`;
      console.log('Connected Strategy dropdown');
      break;
    }
  }
  
  // Fix the COA dropdown
  for (let i = mapLine; i < mapLine + 70; i++) {
    if (lines[i].includes('<option value="">Select COA</option>')) {
      lines[i-1] = `                        <select 
                          value={investmentRowChanges[txnId]?.coa || ''}
                          onChange={(e) => setInvestmentRowChanges({
                            ...investmentRowChanges, 
                            [txnId]: {...(investmentRowChanges[txnId] || {}), coa: e.target.value}
                          })}
                          className="text-xs border rounded px-1 py-0.5 w-full">`;
      console.log('Connected COA dropdown');
      break;
    }
  }
  
  // Close the return statement properly
  for (let i = mapLine + 70; i < mapLine + 90; i++) {
    if (lines[i].includes('))}')) {
      lines[i] = '                    );\n                  })}';
      break;
    }
  }
}

// Update the commit button to use the real function
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("console.log('Commit investments clicked')")) {
    lines[i] = '                onClick={async () => { const selected = Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy); if(selected.length === 0) { alert("Select Strategy and COA for transactions to commit"); return; } await commitSelectedInvestmentRows(); }}';
    console.log('Connected commit button to real function');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Added symbol extraction and dropdown tracking');
