'use client';

import { useState, useMemo } from 'react';

interface Transaction {
  id: string;
  date: string;
  name: string;
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

interface GeneralLedgerProps {
  transactions: Transaction[];
  coaOptions: CoaOption[];
  onUpdate: (id: string, field: 'accountCode' | 'subAccount', value: string) => Promise<void>;
}

export default function GeneralLedger({ transactions, coaOptions, onUpdate }: GeneralLedgerProps) {
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'accountCode' | 'subAccount' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);

  // Group COA by type for dropdown
  const coaGrouped = useMemo(() => {
    const g: Record<string, CoaOption[]> = {};
    coaOptions.forEach(o => {
      if (!g[o.accountType]) g[o.accountType] = [];
      g[o.accountType].push(o);
    });
    return g;
  }, [coaOptions]);

  // Get unique accounts used
  const usedAccounts = useMemo(() => {
    const codes = new Set<string>();
    transactions.forEach(t => { if (t.accountCode) codes.add(t.accountCode); });
    return Array.from(codes).map(code => {
      const coa = coaOptions.find(c => c.code === code);
      return { code, name: coa?.name || code };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }, [transactions, coaOptions]);

  // Get unique vendors
  const vendors = useMemo(() => {
    const v = new Set<string>();
    transactions.forEach(t => { if (t.subAccount) v.add(t.subAccount); });
    return Array.from(v).sort();
  }, [transactions]);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (filterAccount !== 'all' && t.accountCode !== filterAccount) return false;
        if (filterDateFrom && new Date(t.date) < new Date(filterDateFrom)) return false;
        if (filterDateTo && new Date(t.date) > new Date(filterDateTo)) return false;
        if (filterSearch) {
          const s = filterSearch.toLowerCase();
          if (!t.name.toLowerCase().includes(s) && !t.subAccount?.toLowerCase().includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterAccount, filterDateFrom, filterDateTo, filterSearch]);

  // Calculate running balance per account
  const withBalance = useMemo(() => {
    const balances: Record<string, number> = {};
    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return sorted.map(t => {
      const code = t.accountCode || 'uncategorized';
      if (!balances[code]) balances[code] = 0;
      balances[code] += t.amount;
      return { ...t, runningBalance: balances[code] };
    }).reverse();
  }, [filtered]);

  const getCoaName = (code: string | null) => {
    if (!code) return 'Uncategorized';
    return coaOptions.find(c => c.code === code)?.name || code;
  };

  const handleEdit = (id: string, field: 'accountCode' | 'subAccount', currentValue: string | null) => {
    setEditingCell({ id, field });
    setEditValue(currentValue || '');
  };

  const handleSave = async () => {
    if (!editingCell) return;
    setSaving(true);
    await onUpdate(editingCell.id, editingCell.field, editValue);
    setEditingCell(null);
    setEditValue('');
    setSaving(false);
  };

  const handleCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const formatDebitCredit = (amount: number) => {
    // Positive = expense (debit), Negative = income (credit)
    if (amount > 0) {
      return { debit: `$${amount.toFixed(2)}`, credit: '-' };
    } else {
      return { debit: '-', credit: `$${Math.abs(amount).toFixed(2)}` };
    }
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Filters */}
      <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-2">
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm min-w-[180px]"
        >
          <option value="all">All Accounts</option>
          {usedAccounts.map(a => (
            <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
          placeholder="To"
        />
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Search description..."
          className="flex-1 min-w-[150px] px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-blue-50 border-b text-xs text-blue-700 flex items-center gap-4">
        <span>✏️ = Click to edit</span>
        <span>🔒 = Locked (source data)</span>
        <span className="ml-auto">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-24">Date 🔒</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Account ✏️</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Vendor ✏️</th>
              <th className="px-3 py-2 text-left font-semibold">Description 🔒</th>
              <th className="px-3 py-2 text-right font-semibold w-24">Debit 🔒</th>
              <th className="px-3 py-2 text-right font-semibold w-24">Credit 🔒</th>
              <th className="px-3 py-2 text-right font-semibold w-28 bg-gray-200">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {withBalance.slice(0, visibleCount).map(txn => {
              const { debit, credit } = formatDebitCredit(txn.amount);
              const isEditingAccount = editingCell?.id === txn.id && editingCell?.field === 'accountCode';
              const isEditingVendor = editingCell?.id === txn.id && editingCell?.field === 'subAccount';

              return (
                <tr key={txn.id} className={`hover:bg-gray-50 ${!txn.accountCode ? 'bg-amber-50/50' : ''}`}>
                  {/* Date - Locked */}
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {new Date(txn.date).toLocaleDateString()}
                  </td>

                  {/* Account - Editable */}
                  <td className="px-3 py-2">
                    {isEditingAccount ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-xs"
                          autoFocus
                        >
                          <option value="">Select...</option>
                          {Object.entries(coaGrouped).map(([type, opts]) => (
                            <optgroup key={type} label={type}>
                              {opts.map(o => <option key={o.id} value={o.code}>{o.code}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-800">✓</button>
                        <button onClick={handleCancel} className="text-red-600 hover:text-red-800">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(txn.id, 'accountCode', txn.accountCode)}
                        className={`text-left hover:bg-blue-100 px-1 py-0.5 rounded w-full truncate ${txn.accountCode ? 'text-gray-900' : 'text-amber-500 font-medium'}`}
                      >
                        {txn.accountCode || '+ Add'}
                      </button>
                    )}
                  </td>

                  {/* Vendor - Editable */}
                  <td className="px-3 py-2">
                    {isEditingVendor ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          list="vendor-list"
                          className="w-full px-2 py-1 border rounded text-xs"
                          autoFocus
                        />
                        <datalist id="vendor-list">
                          {vendors.map(v => <option key={v} value={v} />)}
                        </datalist>
                        <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-800">✓</button>
                        <button onClick={handleCancel} className="text-red-600 hover:text-red-800">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(txn.id, 'subAccount', txn.subAccount)}
                        className={`text-left hover:bg-blue-100 px-1 py-0.5 rounded w-full truncate ${txn.subAccount ? 'text-gray-700' : 'text-gray-400'}`}
                      >
                        {txn.subAccount || '+ Add'}
                      </button>
                    )}
                  </td>

                  {/* Description - Locked */}
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[300px]" title={txn.name}>
                    {txn.name}
                  </td>

                  {/* Debit - Locked */}
                  <td className={`px-3 py-2 text-right font-mono tabular-nums ${debit !== '-' ? 'text-red-600' : 'text-gray-300'}`}>
                    {debit}
                  </td>

                  {/* Credit - Locked */}
                  <td className={`px-3 py-2 text-right font-mono tabular-nums ${credit !== '-' ? 'text-green-600' : 'text-gray-300'}`}>
                    {credit}
                  </td>

                  {/* Running Balance */}
                  <td className={`px-3 py-2 text-right font-mono tabular-nums bg-gray-50 ${txn.runningBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    ${Math.abs(txn.runningBalance).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {visibleCount < filtered.length && (
        <button
          onClick={() => setVisibleCount(v => v + 100)}
          className="w-full py-3 text-sm text-[#2d1b4e] hover:bg-gray-50 border-t"
        >
          Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t flex justify-between text-sm">
        <span className="text-gray-600">
          Total Debits: <span className="font-semibold text-red-600">
            ${filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0).toLocaleString()}
          </span>
        </span>
        <span className="text-gray-600">
          Total Credits: <span className="font-semibold text-green-600">
            ${Math.abs(filtered.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)).toLocaleString()}
          </span>
        </span>
        <span className="text-gray-600">
          Net: <span className={`font-semibold ${filtered.reduce((s, t) => s + t.amount, 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${Math.abs(filtered.reduce((s, t) => s + t.amount, 0)).toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}
