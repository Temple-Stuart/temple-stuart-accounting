const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find the investment tab display (around line 710)
let investmentTabStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("activeTab === 'investments'") && lines[i].includes('{')) {
    investmentTabStart = i;
    break;
  }
}

// Replace the investment tab content
if (investmentTabStart !== -1) {
  // Find the end of this investment section
  let braceCount = 0;
  let investmentTabEnd = investmentTabStart;
  for (let i = investmentTabStart; i < lines.length; i++) {
    braceCount += (lines[i].match(/{/g) || []).length;
    braceCount -= (lines[i].match(/}/g) || []).length;
    if (braceCount === 0 && i > investmentTabStart) {
      investmentTabEnd = i;
      break;
    }
  }

  // New investment display with commit functionality
  const newInvestmentDisplay = `          {activeTab === 'investments' && (
            <div className="space-y-4">
              {/* Commit Button */}
              <div className="flex justify-between items-center p-4 bg-gray-50">
                <span className="text-sm font-medium">
                  {investmentTransactions.length} uncommitted, {committedInvestments.length} committed
                </span>
                <button onClick={commitSelectedInvestmentRows} 
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
                </button>
              </div>

              {/* Uncommitted Investments Table */}
              <div className="overflow-auto" style={{maxHeight: '400px'}}>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Symbol</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Subtype</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Price</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-right">Fees</th>
                      <th className="px-2 py-2 text-left bg-yellow-50 min-w-[120px]">Strategy</th>
                      <th className="px-2 py-2 text-left bg-yellow-50 min-w-[180px]">COA</th>
                      <th className="px-2 py-2 text-left bg-yellow-50">Sub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {investmentTransactions.map((txn: any) => (
                      <tr key={txn.id || txn.investment_transaction_id} className="hover:bg-gray-50">
                        <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-2 py-2 font-medium">{txn.security?.ticker_symbol || '-'}</td>
                        <td className="px-2 py-2">{txn.name}</td>
                        <td className="px-2 py-2">{txn.type}</td>
                        <td className="px-2 py-2">{txn.subtype}</td>
                        <td className="px-2 py-2 text-right">{txn.quantity || '-'}</td>
                        <td className="px-2 py-2 text-right">${txn.price || 0}</td>
                        <td className={\`px-2 py-2 text-right font-medium \${
                          txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                        }\`}>
                          \${Math.abs(txn.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right">\${txn.fees || 0}</td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select value={investmentRowChanges[txn.id]?.strategy || ''}
                            onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id]: {...(investmentRowChanges[txn.id] || {}), strategy: e.target.value}})}
                            className="text-xs border rounded px-1 py-0.5 w-24">
                            <option value="">Select</option>
                            <optgroup label="Credit Spreads">
                              <option value="call-credit">Call Credit</option>
                              <option value="put-credit">Put Credit</option>
                              <option value="iron-condor">Iron Condor</option>
                            </optgroup>
                            <optgroup label="Debit Spreads">
                              <option value="call-debit">Call Debit</option>
                              <option value="put-debit">Put Debit</option>
                            </optgroup>
                            <optgroup label="Volatility">
                              <option value="straddle">Straddle</option>
                              <option value="strangle">Strangle</option>
                            </optgroup>
                            <optgroup label="Single Options">
                              <option value="long-call">Long Call</option>
                              <option value="long-put">Long Put</option>
                              <option value="short-call">Short Call</option>
                              <option value="short-put">Short Put</option>
                              <option value="covered-call">Covered Call</option>
                              <option value="csp">Cash Secured Put</option>
                            </optgroup>
                            <optgroup label="Stock">
                              <option value="buy">Buy Stock</option>
                              <option value="sell">Sell Stock</option>
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select value={investmentRowChanges[txn.id]?.coa || ''}
                            onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id]: {...(investmentRowChanges[txn.id] || {}), coa: e.target.value}})}
                            className="text-xs border rounded px-1 py-0.5 w-full">
                            <option value="">Select COA</option>
                            <optgroup label="Income">
                              <option value="4120">4120 - Options Premium</option>
                              <option value="4110">4110 - Dividends</option>
                              <option value="4130">4130 - Capital Gains</option>
                              <option value="4140">4140 - Capital Losses</option>
                            </optgroup>
                            <optgroup label="Assets">
                              <option value="1500">1500 - Options Positions</option>
                              <option value="1510">1510 - Stock Holdings</option>
                            </optgroup>
                            <optgroup label="Expenses">
                              <option value="6650">6650 - Trading Fees</option>
                              <option value="6660">6660 - Margin Interest</option>
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <input type="text" value={investmentRowChanges[txn.id]?.sub || ''}
                            onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txn.id]: {...(investmentRowChanges[txn.id] || {}), sub: e.target.value}})}
                            placeholder="Sub-account"
                            className="text-xs border rounded px-1 py-0.5 w-full" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Committed Investments Table */}
              {committedInvestments.length > 0 && (
                <div className="border-t bg-green-50">
                  <div className="p-3 bg-green-100 flex justify-between">
                    <h4 className="text-sm font-medium text-green-800">Committed Investments ({committedInvestments.length})</h4>
                    <button onClick={massUncommitInvestments} className="px-3 py-1 bg-red-600 text-white rounded text-xs">
                      Uncommit Selected
                    </button>
                  </div>
                  <div className="overflow-auto" style={{maxHeight: '300px'}}>
                    <table className="w-full text-xs">
                      <thead className="bg-green-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-2">
                            <input type="checkbox" onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCommittedInvestments(committedInvestments.map((t: any) => t.id));
                              } else {
                                setSelectedCommittedInvestments([]);
                              }
                            }} />
                          </th>
                          <th className="px-2 py-2 text-left">Date</th>
                          <th className="px-2 py-2 text-left">Symbol</th>
                          <th className="px-2 py-2 text-left">Name</th>
                          <th className="px-2 py-2 text-right">Amount</th>
                          <th className="px-2 py-2 text-left">Strategy</th>
                          <th className="px-2 py-2 text-left">COA</th>
                          <th className="px-2 py-2 text-left">Sub</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-200">
                        {committedInvestments.map((txn: any) => (
                          <tr key={txn.id} className="bg-white">
                            <td className="px-2 py-2">
                              <input type="checkbox" checked={selectedCommittedInvestments.includes(txn.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCommittedInvestments([...selectedCommittedInvestments, txn.id]);
                                  } else {
                                    setSelectedCommittedInvestments(selectedCommittedInvestments.filter((id: string) => id !== txn.id));
                                  }
                                }} />
                            </td>
                            <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                            <td className="px-2 py-2">{txn.security?.ticker_symbol || '-'}</td>
                            <td className="px-2 py-2">{txn.name}</td>
                            <td className="px-2 py-2 text-right">\${Math.abs(txn.amount).toFixed(2)}</td>
                            <td className="px-2 py-2 font-semibold text-blue-700">{txn.strategy || '-'}</td>
                            <td className="px-2 py-2 font-semibold text-green-700">{txn.accountCode}</td>
                            <td className="px-2 py-2">{txn.subAccount || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}`;

  // Replace the old investment section with the new one
  lines.splice(investmentTabStart, investmentTabEnd - investmentTabStart + 1, ...newInvestmentDisplay.split('\n'));
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Updated investment display with commit functionality');
