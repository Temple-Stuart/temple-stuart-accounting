const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Adding investment filters...\n');

// First, add the filter state variables near the top where other states are defined
for (let i = 20; i < 30; i++) {
  if (lines[i] && lines[i].includes('const [activeTab')) {
    // Add filter states after activeTab
    lines.splice(i+1, 0, 
      '  const [investmentDateFilter, setInvestmentDateFilter] = useState<string>(\'\');',
      '  const [investmentSymbolFilter, setInvestmentSymbolFilter] = useState<string>(\'\');', 
      '  const [investmentPositionFilter, setInvestmentPositionFilter] = useState<string>(\'\');'
    );
    console.log('Added filter states');
    break;
  }
}

// Find the investment section and add filter UI
for (let i = 772; i < 780; i++) {
  if (lines[i] && lines[i].includes('Investment Transactions:')) {
    // Find the parent div
    for (let j = i-1; j >= i-5; j--) {
      if (lines[j] && lines[j].includes('<div className="p-4 bg-gray-50')) {
        // Replace with a more complex structure including filters
        lines[j] = `              <div className="space-y-4">
                {/* Filter Row */}
                <div className="flex gap-3 p-4 bg-white border rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <input 
                      type="date"
                      value={investmentDateFilter}
                      onChange={(e) => setInvestmentDateFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Symbol</label>
                    <input 
                      type="text"
                      placeholder="e.g. INTC, SPY"
                      value={investmentSymbolFilter}
                      onChange={(e) => setInvestmentSymbolFilter(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                    <select
                      value={investmentPositionFilter}
                      onChange={(e) => setInvestmentPositionFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">All Positions</option>
                      <option value="open">Open</option>
                      <option value="close">Close</option>
                    </select>
                  </div>
                </div>
                
                {/* Commit Button Bar */}
                <div className="p-4 bg-gray-50 flex justify-between items-center">`;
        
        console.log('Added filter UI');
        break;
      }
    }
    break;
  }
}

// Update the investment transactions filter logic
for (let i = 800; i < 850; i++) {
  if (lines[i] && lines[i].includes('investmentTransactions.filter(txn =>')) {
    // Update the filter to use our new filter states
    lines[i] = `                  {investmentTransactions.filter(txn => {
                    const txnDate = new Date(txn.date).toISOString().split('T')[0];
                    const nameParts = txn.name?.split(' ') || [];
                    let symbol = '';
                    for (let j = 0; j < nameParts.length; j++) {
                      if (nameParts[j].match(/^[A-Z]+$/)) {
                        symbol = nameParts[j];
                        break;
                      }
                    }
                    const position = txn.name?.toLowerCase().includes('close') ? 'close' : 'open';
                    
                    return (!investmentDateFilter || txnDate === investmentDateFilter) &&
                           (!investmentSymbolFilter || symbol.includes(investmentSymbolFilter)) &&
                           (!investmentPositionFilter || position === investmentPositionFilter);`;
    
    console.log('Updated filter logic');
    break;
  }
}

// Close the new filter section div
for (let i = 780; i < 790; i++) {
  if (lines[i] && lines[i].includes('Commit Investments')) {
    for (let j = i+1; j < i+5; j++) {
      if (lines[j] && lines[j].includes('</button>')) {
        lines[j] = lines[j] + '\n                </div>\n              </div>';
        console.log('Closed filter section');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Investment filters added successfully!');
