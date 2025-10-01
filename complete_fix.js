const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// First, fix the totalTransactions calculation (should include investments)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const totalTransactions = transactions.length + committedTransactions.length')) {
    lines[i] = '  const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;';
    console.log('Fixed total transactions calculation');
    break;
  }
}

// Find and replace the investment tab section completely
let investStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("activeTab === 'investments'") && lines[i].includes('{')) {
    investStart = i;
    break;
  }
}

if (investStart !== -1) {
  // Find the end of investment section
  let braceCount = 0;
  let investEnd = investStart;
  for (let i = investStart; i < lines.length; i++) {
    braceCount += (lines[i].match(/{/g) || []).length;
    braceCount -= (lines[i].match(/}/g) || []).length;
    if (braceCount === 0 && i > investStart) {
      investEnd = i;
      break;
    }
  }
  
  // Complete replacement of investment section
  const newInvestmentSection = `          {activeTab === 'investments' && (
            <div className="space-y-4">
              {/* Sub-Account Manager Bar */}
              <div className="p-4 bg-gray-50 rounded">
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={newSubAccount} 
                    onChange={(e) => setNewSubAccount(e.target.value)}
                    placeholder="Add new sub-account (e.g., 'TSLA Spreads', 'SPY Iron Condors')" 
                    className="flex-1 px-3 py-2 border rounded text-sm"
                  />
                  <button 
                    onClick={() => {
                      if(newSubAccount && !subAccountsList.includes(newSubAccount)) {
                        setSubAccountsList([...subAccountsList, newSubAccount]); 
                        setNewSubAccount('');
                      }
                    }}
                    className="px-4 py-2 bg-[#b4b237] text-white rounded text-sm hover:bg-[#9a9630]"
                  >
                    Add Sub-Account
                  </button>
                </div>
                {subAccountsList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {subAccountsList.map((sub: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-white rounded text-xs border">
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Commit Button Bar */}
              <div className="flex justify-between items-center p-4 bg-gray-50 border rounded">
                <div>
                  <span className="text-sm font-medium">
                    Uncommitted: {investmentTransactions.length} | Committed: {committedInvestments.length}
                  </span>
                  <div className="text-xs text-gray-600 mt-1">
                    Total Investment Transactions: {investmentTransactions.length + committedInvestments.length}
                  </div>
                </div>
                <button 
                  onClick={commitSelectedInvestmentRows} 
                  disabled={Object.keys(investmentRowChanges).filter(id => 
                    investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy
                  ).length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => 
                    investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy
                  ).length})
                </button>
              </div>

              {/* Uncommitted Investment Transactions Table */}
              <div className="border rounded overflow-hidden">
                <div className="overflow-auto" style={{maxHeight: '400px'}}>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
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
                        <th className="px-2 py-2 text-left bg-yellow-50 min-w-[140px]">Strategy</th>
                        <th className="px-2 py-2 text-left bg-yellow-50 min-w-[200px]">COA</th>
                        <th className="px-2 py-2 text-left bg-yellow-50 min-w-[150px]">Sub</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {investmentTransactions.map((txn: any) => {
                        const txnId = txn.id || txn.investment_transaction_id;
                        return (
                          <tr key={txnId} className="hover:bg-gray-50">
                            <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                            <td className="px-2 py-2 font-medium">{txn.security?.ticker_symbol || '-'}</td>
                            <td className="px-2 py-2 text-xs">{txn.name}</td>
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
                              <select 
                                value={investmentRowChanges[txnId]?.strategy || ''}
                                onChange={(e) => setInvestmentRowChanges({
                                  ...investmentRowChanges, 
                                  [txnId]: {...(investmentRowChanges[txnId] || {}), strategy: e.target.value}
                                })}
                                className="text-xs border rounded px-1 py-0.5 w-full"
                              >
                                <option value="">Select Strategy</option>
                                <optgroup label="Credit Spreads">
                                  <option value="call-credit">Call Credit Spread</option>
                                  <option value="put-credit">Put Credit Spread</option>
                                  <option value="iron-condor">Iron Condor</option>
                                </optgroup>
                                <optgroup label="Debit Spreads">
                                  <option value="call-debit">Call Debit Spread</option>
                                  <option value="put-debit">Put Debit Spread</option>
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
                                  <option value="cash-secured-put">Cash Secured Put</option>
                                </optgroup>
                                <optgroup label="Stock">
                                  <option value="buy-stock">Buy Stock</option>
                                  <option value="sell-stock">Sell Stock</option>
                                  <option value="dividend">Dividend</option>
                                </optgroup>
                              </select>
                            </td>
                            <td className="px-2 py-1 bg-yellow-50">
                              <select 
                                value={investmentRowChanges[txnId]?.coa || ''}
                                onChange={(e) => setInvestmentRowChanges({
                                  ...investmentRowChanges, 
                                  [txnId]: {...(investmentRowChanges[txnId] || {}), coa: e.target.value}
                                })}
                                className="text-xs border rounded px-1 py-0.5 w-full"
                              >
                                <option value="">Select COA</option>
                                {coaOptions.map(group => (
                                  <optgroup key={group.group} label={group.group}>
                                    {group.options.map(opt => (
                                      <option key={opt.code} value={opt.code}>
                                        {opt.code} - {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 bg-yellow-50">
                              <select 
                                value={investmentRowChanges[txnId]?.sub || ''}
                                onChange={(e) => setInvestmentRowChanges({
                                  ...investmentRowChanges, 
                                  [txnId]: {...(investmentRowChanges[txnId] || {}), sub: e.target.value}
                                })}
                                className="text-xs border rounded px-1 py-0.5 w-full"
                              >
                                <option value="">-</option>
                                {subAccountsList.map((sub: string) => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Committed Investment Transactions Table */}
              {committedInvestments.length > 0 && (
                <div className="border rounded overflow-hidden bg-green-50">
                  <div className="p-3 bg-green-100 flex justify-between items-center">
                    <h4 className="text-sm font-medium text-green-800">
                      Committed Investment Transactions ({committedInvestments.length})
                    </h4>
                    <button 
                      onClick={massUncommitInvestments} 
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Uncommit Selected
                    </button>
                  </div>
                  <div className="overflow-auto" style={{maxHeight: '300px'}}>
                    <table className="w-full text-xs">
                      <thead className="bg-green-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left">
                            <input 
                              type="checkbox" 
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCommittedInvestments(committedInvestments.map((t: any) => t.id));
                                } else {
                                  setSelectedCommittedInvestments([]);
                                }
                              }} 
                            />
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
                      <tbody className="divide-y divide-green-200 bg-white">
                        {committedInvestments.map((txn: any) => (
                          <tr key={txn.id} className="hover:bg-green-50">
                            <td className="px-2 py-2">
                              <input 
                                type="checkbox" 
                                checked={selectedCommittedInvestments.includes(txn.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCommittedInvestments([...selectedCommittedInvestments, txn.id]);
                                  } else {
                                    setSelectedCommittedInvestments(
                                      selectedCommittedInvestments.filter((id: string) => id !== txn.id)
                                    );
                                  }
                                }} 
                              />
                            </td>
                            <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                            <td className="px-2 py-2 font-medium">{txn.security?.ticker_symbol || '-'}</td>
                            <td className="px-2 py-2 text-xs">{txn.name}</td>
                            <td className={\`px-2 py-2 text-right font-medium \${
                              txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                            }\`}>
                              \${Math.abs(txn.amount).toFixed(2)}
                            </td>
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
  
  // Replace the old investment section
  lines.splice(investStart, investEnd - investStart + 1, ...newInvestmentSection.split('\n'));
  console.log(`Replaced investment section from line ${investStart + 1} to ${investEnd + 1}`);
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Complete fix applied!');
