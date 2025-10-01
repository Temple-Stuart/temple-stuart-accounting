const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('FINAL FIX - Making investments work properly...\n');

// 1. Fix the total transaction calculation to include investments
for (let i = 300; i < 320; i++) {
  if (lines[i].includes('const totalTransactions = transactions.length + committedTransactions.length;')) {
    lines[i] = '  const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;';
    console.log('✅ Fixed total transactions calculation');
  }
  if (lines[i].includes('const progressPercent =')) {
    lines[i] = '  const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;';
    console.log('✅ Fixed progress calculation');
  }
}

// 2. Update investment button to show counts
for (let i = 520; i < 540; i++) {
  if (lines[i].includes('Investments (746)')) {
    lines[i] = '              Investments ({investmentTransactions.length} uncommitted, {committedInvestments.length} committed)';
    console.log('✅ Updated investment button');
    break;
  }
}

// 3. Find where spending tab content ends (inside the return statement)
let spendingEndLine = -1;
for (let i = 700; i < 770; i++) {
  if (lines[i].includes('</div>') && lines[i+1].includes(')}') && 
      lines[i-20] && lines[i-20].includes('committedTransactions.map')) {
    spendingEndLine = i + 1;
    console.log(`✅ Found spending end at line ${spendingEndLine + 1}`);
    break;
  }
}

// 4. Insert complete investment section right after spending
if (spendingEndLine > 0) {
  const investmentSection = `
          {activeTab === 'investments' && (
            <>
              {/* Sub-Account Manager */}
              <div className="p-4 bg-gray-50 rounded mb-4">
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
                      if(newSubAccount && !subAccountsList.includes(newSubAccount)) {
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

              {/* Commit Button Bar */}
              <div className="p-4 bg-white border rounded mb-4 flex justify-between items-center">
                <span className="text-sm font-medium">
                  Uncommitted: {investmentTransactions.length} | Committed: {committedInvestments.length}
                </span>
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
                          <td className="px-2 py-2 text-right">\${txn.price || 0}</td>
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
                                <option value="covered-call">Covered Call</option>
                                <option value="cash-secured-put">CSP</option>
                              </optgroup>
                              <optgroup label="Stock">
                                <option value="buy">Buy Stock</option>
                                <option value="sell">Sell Stock</option>
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

              {/* Committed Investments */}
              {committedInvestments.length > 0 && (
                <div className="mt-4 border-t bg-green-50">
                  <div className="p-3 bg-green-100 flex justify-between">
                    <h4 className="text-sm font-medium text-green-800">
                      Committed Investments ({committedInvestments.length})
                    </h4>
                    <button 
                      onClick={massUncommitInvestments} 
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                    >
                      Uncommit Selected
                    </button>
                  </div>
                  <div className="overflow-auto" style={{maxHeight: '300px'}}>
                    <table className="w-full text-xs">
                      <thead className="bg-green-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-2">
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
                          <th className="px-2 py-2 text-left">Name</th>
                          <th className="px-2 py-2 text-right">Amount</th>
                          <th className="px-2 py-2 text-left">Strategy</th>
                          <th className="px-2 py-2 text-left">COA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-200">
                        {committedInvestments.map((txn: any) => (
                          <tr key={txn.id} className="bg-white">
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
                            <td className="px-2 py-2">{txn.name}</td>
                            <td className="px-2 py-2 text-right">\${Math.abs(txn.amount).toFixed(2)}</td>
                            <td className="px-2 py-2 font-semibold text-blue-700">{txn.strategy || '-'}</td>
                            <td className="px-2 py-2 font-semibold text-green-700">{txn.accountCode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}`;
  
  lines.splice(spendingEndLine + 1, 0, ...investmentSection.split('\n'));
  console.log('✅ Added complete investment section');
}

// 5. Remove any floating investment content that's outside the return statement
for (let i = lines.length - 200; i < lines.length; i++) {
  if (lines[i].includes('<div className="overflow-auto" style={{maxHeight: \'600px\'}}>')
      && lines[i-5] && !lines[i-5].includes('activeTab')) {
    // This is the floating investment table - remove it
    let endLine = i;
    for (let j = i; j < i + 100; j++) {
      if (lines[j].includes('Total Investment Transactions:')) {
        endLine = j + 3;
        break;
      }
    }
    lines.splice(i, endLine - i + 1);
    console.log('✅ Removed floating investment content');
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ COMPLETE! Investment functionality fully integrated!');
