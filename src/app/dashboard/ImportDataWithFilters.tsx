// Import Data with COA Filters - Complete Implementation with Edit/Uncommit
function ImportDataWithFilters({ entityId }: { entityId: string }) {
  const [selectedFilter, setSelectedFilter] = useState<{type: string, value: string} | null>(null);
  const [showCOAAssignment, setShowCOAAssignment] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [committedTransactions, setCommittedTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [subAccountInput, setSubAccountInput] = useState('');
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{coa: string, sub: string}>({coa: '', sub: ''});
  const [loading, setLoading] = useState(false);
  
  // Helper functions for display
  const getInstCode = (txn) => {
    const inst = txn.account?.plaidItem?.institutionName || '';
    if (inst.toLowerCase().includes('wells')) return 'WF';
    if (inst.toLowerCase().includes('robinhood')) return 'RH';
    return 'UNK';
  };
  
  const getAccType = (txn) => {
    const acc = txn.account?.name || '';
    if (acc.toLowerCase().includes('checking')) return 'Checking';
    if (acc.toLowerCase().includes('brokerage')) return 'Brokerage';
    return acc || '-';
  };
  
  // Load transactions
  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        const txns = Array.isArray(data) ? data : data.transactions || [];
        const committed = txns.filter(t => t.accountCode);
        const uncommitted = txns.filter(t => !t.accountCode);
        setCommittedTransactions(committed);
        setTransactions(uncommitted);
        setFilteredTransactions(uncommitted);
      });
  }, []);
  
  // Calculate filters from uncommitted only
  const merchants = useMemo(() => {
    const merchantMap = new Map();
    transactions.forEach(t => {
      const merchant = t.merchantName || t.merchant_name || t.name || 'Unknown';
      if (merchant !== 'Unknown') {
        merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + 1);
      }
    });
    return Array.from(merchantMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [transactions]);
  
  const primaryCategories = useMemo(() => {
    const catMap = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.primary || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count);
  }, [transactions]);
  
  const detailedCategories = useMemo(() => {
    const catMap = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.detailed;
      if (cat) {
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [transactions]);
  
  // Filter effect
  useEffect(() => {
    if (!selectedFilter) {
      setFilteredTransactions(transactions);
      return;
    }
    
    const filtered = transactions.filter(t => {
      if (selectedFilter.type === 'merchant') {
        const merchant = t.merchantName || t.merchant_name || t.name || 'Unknown';
        return merchant === selectedFilter.value;
      }
      if (selectedFilter.type === 'primary') {
        return (t.personal_finance_category?.primary || 'Uncategorized') === selectedFilter.value;
      }
      if (selectedFilter.type === 'detailed') {
        return t.personal_finance_category?.detailed === selectedFilter.value;
      }
      return true;
    });
    
    setFilteredTransactions(filtered);
  }, [selectedFilter, transactions]);

  // Apply bulk COA
  const applyBulkCOA = async () => {
    if (!selectedAccount) {
      alert('Please select a Chart of Account');
      return;
    }
    
    setLoading(true);
    const transactionIds = filteredTransactions.map(t => t.id);
    
    try {
      const res = await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          accountCode: selectedAccount,
          subAccount: subAccountInput || null
        })
      });
      
      if (res.ok) {
        const updatedTransactions = filteredTransactions.map(t => ({
          ...t,
          accountCode: selectedAccount,
          subAccount: subAccountInput || null
        }));
        
        setCommittedTransactions([...committedTransactions, ...updatedTransactions]);
        setTransactions(transactions.filter(t => !transactionIds.includes(t.id)));
        setSelectedFilter(null);
        setShowCOAAssignment(false);
        setSelectedAccount('');
        setSubAccountInput('');
        
        alert(`✅ Committed ${transactionIds.length} transactions`);
      }
    } catch (error) {
      alert('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Save individual edit
  const saveEdit = async (txnId) => {
    try {
      await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [txnId],
          accountCode: editValues.coa,
          subAccount: editValues.sub || null
        })
      });
      
      // Update local state
      setCommittedTransactions(prev => prev.map(t => 
        t.id === txnId ? {...t, accountCode: editValues.coa, subAccount: editValues.sub} : t
      ));
      setEditingRow(null);
    } catch (error) {
      alert('Failed to save edit');
    }
  };

  // Uncommit transaction
  const uncommitTransaction = async (txn) => {
    try {
      await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [txn.id],
          accountCode: null,
          subAccount: null
        })
      });
      
      // Move back to uncommitted
      setTransactions([...transactions, {...txn, accountCode: null, subAccount: null}]);
      setCommittedTransactions(committedTransactions.filter(t => t.id !== txn.id));
    } catch (error) {
      alert('Failed to uncommit');
    }
  };

  const totalCount = transactions.length + committedTransactions.length;
  const progressPercent = totalCount > 0 ? (committedTransactions.length / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm text-gray-600">
            {committedTransactions.length} / {totalCount} committed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{width: `${progressPercent}%`}}></div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-4">
        {/* Merchant Filter */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">MERCHANT</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {merchants.map(m => (
              <div
                key={m.name}
                onClick={() => {
                  setSelectedFilter({type: 'merchant', value: m.name});
                  setShowCOAAssignment(true);
                }}
                className={`px-2 py-1 text-xs rounded cursor-pointer hover:bg-gray-50 flex justify-between ${
                  selectedFilter?.value === m.name ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <span className="truncate">{m.name}</span>
                <span className="text-gray-500">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Primary Category */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">PRIMARY</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {primaryCategories.map(c => (
              <div
                key={c.name}
                onClick={() => {
                  setSelectedFilter({type: 'primary', value: c.name});
                  setShowCOAAssignment(true);
                }}
                className={`px-2 py-1 text-xs rounded cursor-pointer hover:bg-gray-50 flex justify-between ${
                  selectedFilter?.value === c.name ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <span>{c.name}</span>
                <span className="text-gray-500">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Detailed Category */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">DETAILED</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {detailedCategories.map(c => (
              <div
                key={c.name}
                onClick={() => {
                  setSelectedFilter({type: 'detailed', value: c.name});
                  setShowCOAAssignment(true);
                }}
                className={`px-2 py-1 text-xs rounded cursor-pointer hover:bg-gray-50 flex justify-between ${
                  selectedFilter?.value === c.name ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-gray-500">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* COA Assignment */}
      {showCOAAssignment && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{selectedFilter?.value}</h4>
              <p className="text-sm text-gray-600">{filteredTransactions.length} transactions</p>
            </div>
            <div className="flex gap-2">
              <select 
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-2 py-1 text-sm border rounded bg-white"
              >
                <option value="">Select COA</option>
                <optgroup label="1000 - Assets">
                  <option value="1010">1010 - Petty Cash</option>
                  <option value="1020">1020 - Cash in Bank</option>
                  <option value="1100">1100 - Accounts Receivable</option>
                  <option value="1200">1200 - Inventory</option>
                  <option value="1300">1300 - Prepaid Expenses</option>
                </optgroup>
                <optgroup label="2000 - Liabilities">
                  <option value="2010">2010 - Accounts Payable</option>
                  <option value="2020">2020 - Credit Card</option>
                  <option value="2100">2100 - Wages Payable</option>
                </optgroup>
                <optgroup label="3000 - Equity">
                  <option value="3010">3010 - Owner's Capital</option>
                  <option value="3020">3020 - Owner's Draw</option>
                  <option value="3100">3100 - Retained Earnings</option>
                </optgroup>
                <optgroup label="4000 - Revenue">
                  <option value="4010">4010 - Sales Revenue</option>
                  <option value="4020">4020 - Service Revenue</option>
                  <option value="4100">4100 - Interest Income</option>
                  <option value="4110">4110 - Dividend Income</option>
                </optgroup>
                <optgroup label="5000 - COGS">
                  <option value="5010">5010 - Cost of Goods Sold</option>
                  <option value="5020">5020 - Materials</option>
                  <option value="5030">5030 - Labor</option>
                </optgroup>
                <optgroup label="6000 - Operating Expenses">
                  <option value="6010">6010 - Salaries & Wages</option>
                  <option value="6100">6100 - Rent</option>
                  <option value="6110">6110 - Utilities</option>
                  <option value="6120">6120 - Phone & Internet</option>
                  <option value="6200">6200 - Office Supplies</option>
                  <option value="6230">6230 - Software & Subscriptions</option>
                  <option value="6300">6300 - Advertising</option>
                  <option value="6400">6400 - Travel</option>
                  <option value="6410">6410 - Meals (50% Deductible)</option>
                  <option value="6420">6420 - Meals (100% Deductible)</option>
                  <option value="6430">6430 - Vehicle</option>
                  <option value="6440">6440 - Gas & Fuel</option>
                  <option value="6500">6500 - Professional Fees</option>
                  <option value="6510">6510 - Legal</option>
                  <option value="6520">6520 - Accounting</option>
                  <option value="6600">6600 - Bank Fees</option>
                  <option value="6700">6700 - Depreciation</option>
                  <option value="6800">6800 - Repairs & Maintenance</option>
                  <option value="6810">6810 - Equipment</option>
                  <option value="6820">6820 - Tools</option>
                  <option value="6900">6900 - Insurance</option>
                  <option value="6910">6910 - Licenses & Permits</option>
                  <option value="6950">6950 - Miscellaneous</option>
                </optgroup>
                <optgroup label="8000 - Personal">
                  <option value="8010">8010 - Personal Draw</option>
                  <option value="8020">8020 - Personal Expenses</option>
                  <option value="8050">8050 - Personal Meals</option>
                  <option value="8100">8100 - Home Mortgage</option>
                  <option value="8120">8120 - Groceries</option>
                  <option value="8130">8130 - Healthcare</option>
                  <option value="8150">8150 - Clothing</option>
                </optgroup>
              </select>
              
              <input 
                type="text"
                placeholder="Sub-account"
                value={subAccountInput}
                onChange={(e) => setSubAccountInput(e.target.value)}
                className="px-2 py-1 text-sm border rounded bg-white w-32"
              />
              
              <button 
                onClick={applyBulkCOA}
                disabled={loading || !selectedAccount}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Apply
              </button>
              
              <button 
                onClick={() => {
                  setSelectedFilter(null);
                  setShowCOAAssignment(false);
                }}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Uncommitted Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b">
          <h3 className="text-sm font-semibold">Uncommitted ({filteredTransactions.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <colgroup>
              <col className="w-16" />  {/* Date */}
              <col className="w-10" />  {/* Inst */}
              <col className="w-20" />  {/* Account */}
              <col className="w-48" />  {/* Name - wider */}
              <col className="w-24" />  {/* Merchant */}
              <col className="w-16" />  {/* Amount */}
              <col className="w-24" />  {/* Primary */}
              <col className="w-32" />  {/* Detailed */}
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-1 text-left text-xs">Date</th>
                <th className="px-1 py-1 text-left text-xs">In</th>
                <th className="px-1 py-1 text-left text-xs">Acct</th>
                <th className="px-1 py-1 text-left text-xs">Transaction</th>
                <th className="px-1 py-1 text-left text-xs">Merchant</th>
                <th className="px-1 py-1 text-right text-xs">Amt</th>
                <th className="px-1 py-1 text-left text-xs">Primary</th>
                <th className="px-1 py-1 text-left text-xs">Detailed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTransactions.slice(0, 100).map(txn => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-1 py-1 text-xs">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-1 py-1">
                    <span className={`px-1 text-xs font-bold ${
                      getInstCode(txn) === 'WF' ? 'text-blue-600' :
                      getInstCode(txn) === 'RH' ? 'text-green-600' : ''
                    }`}>
                      {getInstCode(txn)}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-xs truncate">{getAccType(txn)}</td>
                  <td className="px-1 py-1 text-xs">
                    <div className="truncate">{txn.name}</div>
                  </td>
                  <td className="px-1 py-1 text-xs truncate">{txn.merchantName || '-'}</td>
                  <td className="px-1 py-1 text-xs text-right">${Math.abs(txn.amount).toFixed(0)}</td>
                  <td className="px-1 py-1 text-xs truncate">{txn.personal_finance_category?.primary || '-'}</td>
                  <td className="px-1 py-1 text-xs truncate">{txn.personal_finance_category?.detailed || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Committed Table */}
      {committedTransactions.length > 0 && (
        <div className="bg-green-50 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-green-100 border-b flex justify-between">
            <h3 className="text-sm font-semibold text-green-800">✓ Committed ({committedTransactions.length})</h3>
            {committedTransactions.length === totalCount && (
              <button className="text-sm bg-blue-600 text-white px-3 py-1 rounded">
                Proceed to Step 2 →
              </button>
            )}
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col className="w-16" />
                <col className="w-10" />
                <col className="w-20" />
                <col className="w-40" />
                <col className="w-16" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-12" />
              </colgroup>
              <thead className="bg-green-100 sticky top-0">
                <tr>
                  <th className="px-1 py-1 text-left">Date</th>
                  <th className="px-1 py-1 text-left">In</th>
                  <th className="px-1 py-1 text-left">Acct</th>
                  <th className="px-1 py-1 text-left">Transaction</th>
                  <th className="px-1 py-1 text-right">Amt</th>
                  <th className="px-1 py-1 text-left">COA</th>
                  <th className="px-1 py-1 text-left">Sub</th>
                  <th className="px-1 py-1"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-200">
                {committedTransactions.map(txn => (
                  <tr key={txn.id} className="bg-white">
                    <td className="px-1 py-1 text-xs">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-1 py-1">
                      <span className={`px-1 text-xs font-bold ${
                        getInstCode(txn) === 'WF' ? 'text-blue-600' :
                        getInstCode(txn) === 'RH' ? 'text-green-600' : ''
                      }`}>
                        {getInstCode(txn)}
                      </span>
                    </td>
                    <td className="px-1 py-1 text-xs truncate">{getAccType(txn)}</td>
                    <td className="px-1 py-1 text-xs truncate">{txn.name}</td>
                    <td className="px-1 py-1 text-xs text-right">${Math.abs(txn.amount).toFixed(0)}</td>
                    <td className="px-1 py-1">
                      {editingRow === txn.id ? (
                        <input 
                          value={editValues.coa}
                          onChange={(e) => setEditValues({...editValues, coa: e.target.value})}
                          className="w-full px-1 text-xs border rounded"
                        />
                      ) : (
                        <span 
                          onClick={() => {
                            setEditingRow(txn.id);
                            setEditValues({coa: txn.accountCode, sub: txn.subAccount || ''});
                          }}
                          className="text-xs font-semibold text-green-700 cursor-pointer hover:underline"
                        >
                          {txn.accountCode}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {editingRow === txn.id ? (
                        <input 
                          value={editValues.sub}
                          onChange={(e) => setEditValues({...editValues, sub: e.target.value})}
                          className="w-full px-1 text-xs border rounded"
                        />
                      ) : (
                        <span 
                          onClick={() => {
                            setEditingRow(txn.id);
                            setEditValues({coa: txn.accountCode, sub: txn.subAccount || ''});
                          }}
                          className="text-xs cursor-pointer hover:underline"
                        >
                          {txn.subAccount || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {editingRow === txn.id ? (
                        <button 
                          onClick={() => saveEdit(txn.id)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Save
                        </button>
                      ) : (
                        <button 
                          onClick={() => uncommitTransaction(txn)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          ↩
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
