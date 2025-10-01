const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find where we added the symbol extraction
for (let i = 790; i < 830; i++) {
  if (lines[i].includes('// Extract symbol from name')) {
    // Replace with better extraction logic
    lines[i] = `                    // Extract symbol from name
                    // For options: "sell 1,000 INTC put for $0.17" -> "INTC"
                    // For stocks: "buy 1,000 INTC" -> "INTC"
                    let symbol = '-';
                    const nameParts = txn.name?.split(' ') || [];
                    // Skip "buy"/"sell", find first text after number that's all caps
                    for (let j = 0; j < nameParts.length; j++) {
                      if (nameParts[j].match(/^[A-Z]+$/)) {
                        symbol = nameParts[j];
                        break;
                      }
                    }
                    if (symbol === '-' && txn.security?.ticker_symbol) {
                      symbol = txn.security.ticker_symbol;
                    }`;
    console.log('Fixed symbol extraction logic');
    break;
  }
}

// Also add a filter input at the top of the investment section
for (let i = 770; i < 790; i++) {
  if (lines[i].includes('Investment Transactions:')) {
    // Add filter input before the commit button
    const filterHtml = `            <div className="p-4 bg-gray-50 space-y-3">
              <input 
                type="text"
                placeholder="Filter by symbol (e.g., INTC, SPY)"
                value={investmentFilter}
                onChange={(e) => setInvestmentFilter(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <div className="flex justify-between items-center">`;
    
    lines[i-1] = filterHtml;
    lines[i] = '                <span className="text-sm">Investment Transactions: {investmentTransactions.filter(txn => !investmentFilter || txn.name?.toUpperCase().includes(investmentFilter)).length} shown</span>';
    console.log('Added filter input');
    break;
  }
}

// Update the map to use filtered transactions
for (let i = 790; i < 830; i++) {
  if (lines[i].includes('{investmentTransactions.map((txn: any)')) {
    lines[i] = lines[i].replace(
      'investmentTransactions.map',
      'investmentTransactions.filter(txn => !investmentFilter || txn.name?.toUpperCase().includes(investmentFilter)).map'
    );
    console.log('Applied filter to transaction list');
    break;
  }
}

// Add investmentFilter state if not exists
let hasFilterState = false;
for (let i = 0; i < 50; i++) {
  if (lines[i].includes('const [investmentFilter')) {
    hasFilterState = true;
    break;
  }
}

if (!hasFilterState) {
  for (let i = 0; i < 50; i++) {
    if (lines[i].includes('const [newSubAccount')) {
      lines.splice(i+1, 0, '  const [investmentFilter, setInvestmentFilter] = useState<string>(\'\');');
      console.log('Added investmentFilter state');
      break;
    }
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed symbol extraction and added filtering');
