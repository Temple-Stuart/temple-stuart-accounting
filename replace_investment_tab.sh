#!/bin/bash

# Create a backup first
cp src/components/dashboard/ImportDataSection.tsx src/components/dashboard/ImportDataSection.backup.tsx

# Find line where investment tab starts
START_LINE=$(grep -n "{activeTab === 'investments'" src/components/dashboard/ImportDataSection.tsx | tail -1 | cut -d: -f1)

# Get everything before the investment section
head -n $((START_LINE - 1)) src/components/dashboard/ImportDataSection.tsx > temp_investment.tsx

# Add the complete new investment section
cat >> temp_investment.tsx << 'INVESTMENT_CODE'
          {activeTab === 'investments' && (
            <div className="space-y-4">
              {/* Add Sub-Account Bar */}
              <div className="p-4 bg-gray-50 rounded">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newSubAccount} 
                    onChange={(e) => setNewSubAccount(e.target.value)}
                    placeholder="Add new sub-account" 
                    className="flex-1 px-3 py-2 border rounded text-sm"
                  />
                  <button 
                    onClick={() => {
                      if(newSubAccount) {
                        setSubAccountsList([...subAccountsList, newSubAccount]); 
                        setNewSubAccount('');
                      }
                    }}
                    className="px-4 py-2 bg-[#b4b237] text-white rounded text-sm"
                  >
                    Add Sub-Account
                  </button>
                </div>
              </div>

              {/* Commit Button */}
              <div className="flex justify-between items-center">
                <span className="text-sm">
                  Uncommitted: {investmentTransactions.length} | Committed: {committedInvestments.length}
                </span>
                <button 
                  onClick={commitSelectedInvestmentRows}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  Commit Selected
                </button>
              </div>

              {/* Investment Table */}
              <div className="overflow-auto" style={{maxHeight: '600px'}}>
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
                        <td className={`px-2 py-2 text-right font-medium ${
                          txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ${Math.abs(txn.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right">${txn.fees || 0}</td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select 
                            value={investmentRowChanges[txn.id]?.strategy || ''}
                            onChange={(e) => setInvestmentRowChanges({
                              ...investmentRowChanges, 
                              [txn.id]: {...(investmentRowChanges[txn.id] || {}), strategy: e.target.value}
                            })}
                            className="text-xs border rounded px-1 py-0.5 w-24"
                          >
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
                            <optgroup label="Single Options">
                              <option value="long-call">Long Call</option>
                              <option value="long-put">Long Put</option>
                              <option value="short-put">Short Put</option>
                            </optgroup>
                            <optgroup label="Stock">
                              <option value="buy">Buy Stock</option>
                              <option value="sell">Sell Stock</option>
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select 
                            value={investmentRowChanges[txn.id]?.coa || ''}
                            onChange={(e) => setInvestmentRowChanges({
                              ...investmentRowChanges, 
                              [txn.id]: {...(investmentRowChanges[txn.id] || {}), coa: e.target.value}
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
                            value={investmentRowChanges[txn.id]?.sub || ''}
                            onChange={(e) => setInvestmentRowChanges({
                              ...investmentRowChanges, 
                              [txn.id]: {...(investmentRowChanges[txn.id] || {}), sub: e.target.value}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
INVESTMENT_CODE

# Add everything after the old investment section
tail -n +867 src/components/dashboard/ImportDataSection.backup.tsx >> temp_investment.tsx

# Replace the file
mv temp_investment.tsx src/components/dashboard/ImportDataSection.tsx

echo "✅ Investment tab replaced!"
