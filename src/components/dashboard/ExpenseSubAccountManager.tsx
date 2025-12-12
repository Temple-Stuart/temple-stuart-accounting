'use client';

import { useState, useMemo } from 'react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  accountCode: string | null;
  subAccount: string | null;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface Props {
  transactions: Transaction[];
  coaOptions: CoaOption[];
  onUpdate: () => void;
}

export default function ExpenseSubAccountManager({ transactions, coaOptions, onUpdate }: Props) {
  const [expandedCoa, setExpandedCoa] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [selectedTxns, setSelectedTxns] = useState<string[]>([]);
  const [newSubValue, setNewSubValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const expenseCoas = useMemo(() => 
    coaOptions.filter(c => c.accountType === 'expense').sort((a, b) => a.code.localeCompare(b.code)),
  [coaOptions]);

  const expenseData = useMemo(() => {
    const data: Record<string, { 
      coa: CoaOption; 
      total: number;
      subs: Record<string, { txns: Transaction[]; total: number }> 
    }> = {};

    expenseCoas.forEach(coa => {
      const coaTxns = transactions.filter(t => t.accountCode === coa.code);
      if (coaTxns.length === 0) return;

      const subs: Record<string, { txns: Transaction[]; total: number }> = {};
      coaTxns.forEach(t => {
        const subKey = t.subAccount || '(No Sub-Account)';
        if (!subs[subKey]) subs[subKey] = { txns: [], total: 0 };
        subs[subKey].txns.push(t);
        subs[subKey].total += t.amount;
      });

      data[coa.code] = {
        coa,
        total: coaTxns.reduce((s, t) => s + t.amount, 0),
        subs
      };
    });

    return data;
  }, [transactions, expenseCoas]);

  const handleUpdateSub = async () => {
    if (selectedTxns.length === 0) return;
    setIsUpdating(true);
    
    try {
      await fetch('/api/transactions/update-sub-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transactionIds: selectedTxns, 
          subAccount: newSubValue.trim() || null 
        })
      });
      setSelectedTxns([]);
      setNewSubValue('');
      onUpdate();
    } catch (err) {
      console.error('Update error:', err);
    }
    setIsUpdating(false);
  };

  const formatAmount = (val: number) => `$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const allSubs = useMemo(() => {
    const subs = new Set<string>();
    Object.values(expenseData).forEach(d => {
      Object.keys(d.subs).forEach(s => {
        if (s !== '(No Sub-Account)') subs.add(s);
      });
    });
    return Array.from(subs).sort();
  }, [expenseData]);

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold">Expense Sub-Accounts</h2>
        <p className="text-sm text-gray-500">Expand categories, select transactions, update sub-accounts</p>
      </div>

      <div className="divide-y">
        {Object.entries(expenseData).map(([code, data]) => {
          const isExpanded = expandedCoa === code;
          const subCount = Object.keys(data.subs).length;
          const txnCount = Object.values(data.subs).reduce((s, sub) => s + sub.txns.length, 0);

          return (
            <div key={code}>
              <button
                onClick={() => { setExpandedCoa(isExpanded ? null : code); setExpandedSub(null); setSelectedTxns([]); }}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs transition ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <span className="font-mono text-xs text-gray-400">{code}</span>
                  <span className="font-medium">{data.coa.name}</span>
                  <span className="text-xs text-gray-400">{subCount} subs · {txnCount} txns</span>
                </div>
                <span className="font-semibold text-red-600">{formatAmount(data.total)}</span>
              </button>

              {isExpanded && (
                <div className="bg-gray-50">
                  {Object.entries(data.subs)
                    .sort((a, b) => b[1].txns.length - a[1].txns.length)
                    .map(([subName, subData]) => {
                      const subKey = `${code}:${subName}`;
                      const isSubExpanded = expandedSub === subKey;

                      return (
                        <div key={subName} className="border-t">
                          <button
                            onClick={() => { setExpandedSub(isSubExpanded ? null : subKey); setSelectedTxns([]); }}
                            className={`w-full pl-10 pr-4 py-2 flex items-center justify-between hover:bg-white ${isSubExpanded ? 'bg-white' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-xs transition ${isSubExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <span className={`text-sm ${subName === '(No Sub-Account)' ? 'text-amber-600 italic' : ''}`}>
                                {subName}
                              </span>
                              <span className="text-xs text-gray-400">{subData.txns.length}</span>
                            </div>
                            <span className="text-sm font-medium text-red-600">{formatAmount(subData.total)}</span>
                          </button>

                          {isSubExpanded && (
                            <div className="bg-white border-t">
                              {selectedTxns.length > 0 && (
                                <div className="px-4 py-2 bg-[#b4b237]/10 flex items-center gap-2 border-b">
                                  <span className="text-sm font-medium">{selectedTxns.length} selected</span>
                                  <input
                                    type="text"
                                    value={newSubValue}
                                    onChange={(e) => setNewSubValue(e.target.value)}
                                    placeholder="New sub-account..."
                                    list="sub-list"
                                    className="border rounded px-2 py-1 text-sm flex-1 max-w-xs"
                                  />
                                  <datalist id="sub-list">
                                    {allSubs.map(s => <option key={s} value={s} />)}
                                  </datalist>
                                  <button
                                    onClick={handleUpdateSub}
                                    disabled={isUpdating}
                                    className="px-3 py-1 bg-[#b4b237] text-white rounded text-sm disabled:opacity-50"
                                  >
                                    {isUpdating ? '...' : 'Update'}
                                  </button>
                                  <button onClick={() => setSelectedTxns([])} className="text-sm text-gray-500">Clear</button>
                                </div>
                              )}

                              <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-1.5 w-8">
                                        <input
                                          type="checkbox"
                                          checked={selectedTxns.length === subData.txns.length && subData.txns.length > 0}
                                          onChange={(e) => setSelectedTxns(e.target.checked ? subData.txns.map(t => t.id) : [])}
                                        />
                                      </th>
                                      <th className="px-3 py-1.5 text-left text-xs">Date</th>
                                      <th className="px-3 py-1.5 text-left text-xs">Description</th>
                                      <th className="px-3 py-1.5 text-right text-xs">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {subData.txns
                                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                      .map(txn => (
                                        <tr key={txn.id} className={`hover:bg-gray-50 ${selectedTxns.includes(txn.id) ? 'bg-blue-50' : ''}`}>
                                          <td className="px-3 py-1.5">
                                            <input
                                              type="checkbox"
                                              checked={selectedTxns.includes(txn.id)}
                                              onChange={(e) => setSelectedTxns(
                                                e.target.checked ? [...selectedTxns, txn.id] : selectedTxns.filter(id => id !== txn.id)
                                              )}
                                            />
                                          </td>
                                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                                            {new Date(txn.date).toLocaleDateString()}
                                          </td>
                                          <td className="px-3 py-1.5 truncate max-w-[200px]">{txn.name}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-red-600">{formatAmount(txn.amount)}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(expenseData).length === 0 && (
        <div className="p-8 text-center text-gray-500">No expense transactions</div>
      )}
    </div>
  );
}
