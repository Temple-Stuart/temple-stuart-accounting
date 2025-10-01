#!/bin/bash

# Find the line number where investment tab display starts
LINE_NUM=$(grep -n "{activeTab === 'investments'" src/components/dashboard/ImportDataSection.tsx | tail -1 | cut -d: -f1)

# Create a temporary file with everything before the investment section
head -n $((LINE_NUM - 1)) src/components/dashboard/ImportDataSection.tsx > temp_file.tsx

# Add the new investment display
cat >> temp_file.tsx << 'INVESTMENT_SECTION'
          {activeTab === 'investments' && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{committedInvestments.length} / {investmentTransactions.length + committedInvestments.length} committed ({((committedInvestments.length / (investmentTransactions.length + committedInvestments.length)) * 100 || 0).toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-[#b4b237] h-2 rounded-full" style={{width: `${(committedInvestments.length / (investmentTransactions.length + committedInvestments.length)) * 100 || 0}%`}}></div>
                </div>
              </div>

              {/* Sub-Account Manager */}
              <div className="p-4 bg-gray-50 rounded">
                <div className="flex gap-2">
                  <input type="text" value={newSubAccount} onChange={(e) => setNewSubAccount(e.target.value)}
                    placeholder="Add new sub-account" className="flex-1 px-3 py-2 border rounded text-sm" />
                  <button onClick={() => {if(newSubAccount) {setSubAccountsList([...subAccountsList, newSubAccount]); setNewSubAccount('');}}}
                    className="px-4 py-2 bg-[#b4b237] text-white rounded text-sm">Add Sub-Account</button>
                </div>
                {subAccountsList.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subAccountsList.map((sub: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-white rounded text-xs">{sub}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Commit Button */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  Uncommitted: {investmentTransactions.length} | Committed: {committedInvestments.length}
                </span>
                <button onClick={commitSelectedInvestmentRows} 
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                  Commit Selected ({Object.keys(investmentRowChanges).filter(id => investmentRowChanges[id]?.coa && investmentRowChanges[id]?.strategy).length})
                </button>
              </div>

              {/* Uncommitted Table */}
              <div className="border rounded overflow-hidden">
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
                        <th className="px-2 py-2 text-left bg-yellow-50">Strategy</th>
                        <th className="px-2 py-2 text-left bg-yellow-50">COA</th>
                        <th className="px-2 py-2 text-left bg-yellow-50">Sub</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {investmentTransactions.map((txn: any) => {
                        const txnId = txn.id || txn.investment_transaction_id;
                        return (
                          <tr key={txnId} className="hover:bg-gray-50">
                            <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                            <td className="px-2 py-2 font-medium">{txn.security?.ticker_symbol || '-'}</td>
                            <td className="px-2 py-2">{txn.name}</td>
                            <td className="px-2 py-2">{txn.type}</td>
                            <td className="px-2 py-2">{txn.subtype}</td>
                            <td className="px-2 py-2 text-right">{txn.quantity || '-'}</td>
                            <td className="px-2 py-2 text-right">${txn.price || 0}</td>
                            <td className={`px-2 py-2 text-right font-medium ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ${Math.abs(txn.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-right">${txn.fees || 0}</td>
                            <td className="px-2 py-1 bg-yellow-50">
                              <select value={investmentRowChanges[txnId]?.strategy || ''}
                                onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txnId]: {...(investmentRowChanges[txnId] || {}), strategy: e.target.value}})}
                                className="text-xs border rounded px-1 py-0.5 w-full">
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
                                  <option value="covered-call">Covered Call</option>
                                </optgroup>
                                <optgroup label="Stock">
                                  <option value="buy-stock">Buy Stock</option>
                                  <option value="sell-stock">Sell Stock</option>
                                </optgroup>
                              </select>
                            </td>
                            <td className="px-2 py-1 bg-yellow-50">
                              <select value={investmentRowChanges[txnId]?.coa || ''}
                                onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txnId]: {...(investmentRowChanges[txnId] || {}), coa: e.target.value}})}
                                className="text-xs border rounded px-1 py-0.5 w-full">
                                <option value="">Select COA</option>
                                {coaOptions.map(group => (
                                  <optgroup key={group.group} label={group.group}>
                                    {group.options.map(opt => (
                                      <option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 bg-yellow-50">
                              <select value={investmentRowChanges[txnId]?.sub || ''}
                                onChange={(e) => setInvestmentRowChanges({...investmentRowChanges, [txnId]: {...(investmentRowChanges[txnId] || {}), sub: e.target.value}})}
                                className="text-xs border rounded px-1 py-0.5 w-full">
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

              {/* Committed Table */}
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
                            <td className="px-2 py-2 text-right">${Math.abs(txn.amount).toFixed(2)}</td>
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
          )}
INVESTMENT_SECTION

# Get everything after the old investment section (find the closing div)
TAIL_START=$(grep -n "activeTab === 'investments'" src/components/dashboard/ImportDataSection.tsx | tail -1 | cut -d: -f1)
# Find the matching closing parenthesis
awk "NR>$TAIL_START" src/components/dashboard/ImportDataSection.tsx | grep -n "^        </div>" | head -1 | cut -d: -f1 | read OFFSET
TAIL_LINE=$((TAIL_START + OFFSET + 1))
tail -n +$TAIL_LINE src/components/dashboard/ImportDataSection.tsx >> temp_file.tsx

# Replace the original file
mv temp_file.tsx src/components/dashboard/ImportDataSection.tsx
echo "✅ Investment display updated!"
