const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('Replacing Sub column with Trade Counter...\n');

// Add state for trade counters
let updated = content.replace(
  'const [investmentRowChanges, setInvestmentRowChanges] = useState<Record<string, any>>({});',
  `const [investmentRowChanges, setInvestmentRowChanges] = useState<Record<string, any>>({});
  const [tradeCounters, setTradeCounters] = useState<Record<string, number>>({});`
);

// Replace Sub header with Trade #
updated = updated.replace(
  /<th className="px-2 py-2 text-left bg-yellow-50">Sub<\/th>/g,
  '<th className="px-2 py-2 text-center bg-blue-50 min-w-[60px]">Trade #</th>'
);

// Find and replace the Sub dropdown with trade counter input
// This will be in the investment transactions map
updated = updated.replace(
  /<td className="px-2 py-1 bg-yellow-50">\s*<select[^>]*>\s*<option value="">-<\/option>\s*{subAccountsList\.map[^}]*}\s*<\/select>\s*<\/td>/g,
  `<td className="px-2 py-1 bg-blue-50 text-center">
                        <input
                          type="number"
                          value={tradeCounters[txnId] || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : '';
                            setTradeCounters({...tradeCounters, [txnId]: value});
                          }}
                          className="w-12 px-1 py-0.5 text-xs text-center border rounded"
                          placeholder="#"
                          min="1"
                        />
                      </td>`
);

// Add auto-numbering button in the filter section
updated = updated.replace(
  /<\/select>\s*<\/div>\s*<\/div>\s*<\/div>/,
  `</select>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const filtered = investmentTransactions.filter(txn => {
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
                        
                        return (!dateFilter || txnDate === dateFilter) &&
                               (!symbolFilter || symbol.includes(symbolFilter)) &&
                               (!positionFilter || position === positionFilter);
                      });
                      
                      // Auto-number from bottom up (reverse order)
                      const newCounters = {...tradeCounters};
                      const reversed = [...filtered].reverse();
                      reversed.forEach((txn, idx) => {
                        const txnId = txn.id || txn.investment_transaction_id;
                        newCounters[txnId] = idx + 1;
                      });
                      setTradeCounters(newCounters);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 font-medium"
                    title="Number trades from bottom to top"
                  >
                    Auto # ↑
                  </button>
                </div>
              </div>`
);

// Update commit logic to include trade counter
updated = updated.replace(
  'investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy',
  'investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy && tradeCounters[id]'
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Replaced Sub column with Trade Counter!');
