const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('Adding investment filters cleanly...\n');

// Add filter states after activeTab state
let updated = content.replace(
  "const [activeTab, setActiveTab] = useState<'spending' | 'investments'>('spending');",
  `const [activeTab, setActiveTab] = useState<'spending' | 'investments'>('spending');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('');`
);

// Add filter UI before the investment table
const investmentSectionPattern = /<div className="p-4 bg-gray-50 flex justify-between items-center">/;
updated = updated.replace(investmentSectionPattern, 
  `<div className="space-y-4">
                {/* Filter Row */}
                <div className="flex gap-3 p-4 bg-white border rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <input 
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Symbol</label>
                    <input 
                      type="text"
                      placeholder="e.g. INTC, SPY"
                      value={symbolFilter}
                      onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                    <select
                      value={positionFilter}
                      onChange={(e) => setPositionFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">All Positions</option>
                      <option value="open">Open</option>
                      <option value="close">Close</option>
                    </select>
                  </div>
                </div>
                
                {/* Commit Button Bar */}
                <div className="p-4 bg-gray-50 flex justify-between items-center">`
);

// Close the filter section div after the button
updated = updated.replace(
  /Commit Investments\s*<\/button>\s*<\/div>/,
  'Commit Investments\n              </button>\n            </div>\n          </div>'
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Filters added successfully!');
