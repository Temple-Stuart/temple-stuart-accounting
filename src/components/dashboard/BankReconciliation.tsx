'use client';

import { useState, useMemo } from 'react';

interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  balance: number;
  institutionName: string;
}

interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  accountCode: string | null;
}

interface ReconciliationItem {
  id?: string;
  transactionId?: string;
  type: string;
  description: string;
  amount: string;
  cleared: boolean;
}

interface Reconciliation {
  id: string;
  accountId: string;
  periodEnd: string;
  statementBalance: number;
  bookBalance: number;
  adjustedBankBalance: number;
  adjustedBookBalance: number;
  difference: number;
  status: string;
  items: ReconciliationItem[];
  account: Account;
}

interface BankReconciliationProps {
  accounts: Account[];
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  onSave: (data: any) => Promise<void>;
  onReload: () => void;
}

export default function BankReconciliation({ accounts, transactions, reconciliations, onSave, onReload }: BankReconciliationProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState('');
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Get book balance for selected account
  const bookBalance = useMemo(() => {
    if (!selectedAccount) return 0;
    const acc = accounts.find(a => a.id === selectedAccount);
    return acc?.balance || 0;
  }, [selectedAccount, accounts]);

  // Get uncleared transactions for selected account
  const unclearedTxns = useMemo(() => {
    if (!selectedAccount) return [];
    // In a real app, you'd have a "cleared" field on transactions
    // For now, show recent transactions as potentially uncleared
    return transactions
      .filter(t => {
        const txnDate = new Date(t.date);
        const endDate = new Date(periodEnd);
        return txnDate <= endDate;
      })
      .slice(0, 20);
  }, [selectedAccount, transactions, periodEnd]);

  // Calculate adjusted balances
  const calculations = useMemo(() => {
    const depositsInTransit = items
      .filter(i => i.type === 'deposit_in_transit' && !i.cleared)
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    
    const outstandingChecks = items
      .filter(i => i.type === 'outstanding_check' && !i.cleared)
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    const bankFees = items
      .filter(i => i.type === 'bank_fee')
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    const interest = items
      .filter(i => i.type === 'interest')
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    const stmtBal = parseFloat(statementBalance) || 0;
    const adjustedBank = stmtBal + depositsInTransit - outstandingChecks;
    const adjustedBook = bookBalance - bankFees + interest;
    const difference = Math.abs(adjustedBank - adjustedBook);

    return { depositsInTransit, outstandingChecks, bankFees, interest, adjustedBank, adjustedBook, difference };
  }, [items, statementBalance, bookBalance]);

  const isReconciled = calculations.difference < 0.01 && parseFloat(statementBalance) > 0;

  const addItem = (type: string) => {
    setItems([...items, {
      type,
      description: '',
      amount: '',
      cleared: false
    }]);
  };

  const updateItem = (index: number, field: keyof ReconciliationItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async (status: 'draft' | 'reconciled') => {
    if (!selectedAccount || !statementBalance) return;
    
    setSaving(true);
    await onSave({
      accountId: selectedAccount,
      periodEnd,
      statementBalance,
      bookBalance,
      items,
      status
    });
    setSaving(false);
    onReload();
    
    if (status === 'reconciled') {
      setShowForm(false);
      setItems([]);
      setStatementBalance('');
    }
  };

  const loadExisting = (recon: Reconciliation) => {
    setSelectedAccount(recon.accountId);
    setPeriodEnd(recon.periodEnd.split('T')[0]);
    setStatementBalance(String(recon.statementBalance));
    setItems(recon.items.map(i => ({
      ...i,
      amount: String(i.amount)
    })));
    setShowForm(true);
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {reconciliations.filter(r => r.status === 'reconciled').length} reconciled periods
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 bg-[#b4b237] text-white rounded-lg text-sm font-medium"
        >
          {showForm ? '✕ Cancel' : '+ New Reconciliation'}
        </button>
      </div>

      {/* New Reconciliation Form */}
      {showForm && (
        <div className="p-4 border-b bg-blue-50">
          <h4 className="font-semibold mb-4">Bank Reconciliation</h4>

          {/* Account & Period Selection */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm min-w-[200px]"
              >
                <option value="">Select account...</option>
                {accounts.filter(a => a.type === 'depository').map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.institutionName} •••• {acc.mask}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period End Date</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Statement Balance</label>
              <input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="0.00"
                className="px-3 py-2 border rounded-lg text-sm w-32"
              />
            </div>
          </div>

          {selectedAccount && statementBalance && (
            <>
              {/* Reconciliation Summary */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg border">
                  <h5 className="text-xs text-gray-500 uppercase mb-2">Bank Side</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Statement Balance:</span>
                      <span className="font-mono">${parseFloat(statementBalance || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Deposits in Transit:</span>
                      <span className="font-mono">${calculations.depositsInTransit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>- Outstanding Checks:</span>
                      <span className="font-mono">${calculations.outstandingChecks.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Adjusted Bank Balance:</span>
                      <span className="font-mono">${calculations.adjustedBank.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border">
                  <h5 className="text-xs text-gray-500 uppercase mb-2">Book Side</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Book Balance:</span>
                      <span className="font-mono">${bookBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>- Bank Fees:</span>
                      <span className="font-mono">${calculations.bankFees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Interest Earned:</span>
                      <span className="font-mono">${calculations.interest.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Adjusted Book Balance:</span>
                      <span className="font-mono">${calculations.adjustedBook.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Difference */}
              <div className={`p-3 rounded-lg mb-4 text-center ${isReconciled ? 'bg-green-100' : 'bg-red-100'}`}>
                <span className="font-semibold">
                  Difference: ${calculations.difference.toFixed(2)}
                  {isReconciled ? ' ✓ RECONCILED' : ' ≠ NOT BALANCED'}
                </span>
              </div>

              {/* Reconciling Items */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-sm">Reconciling Items</h5>
                  <div className="flex gap-2">
                    <button onClick={() => addItem('deposit_in_transit')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">+ Deposit in Transit</button>
                    <button onClick={() => addItem('outstanding_check')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">+ Outstanding Check</button>
                    <button onClick={() => addItem('bank_fee')} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">+ Bank Fee</button>
                    <button onClick={() => addItem('interest')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">+ Interest</button>
                  </div>
                </div>

                {items.length > 0 && (
                  <table className="w-full text-sm bg-white rounded border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Cleared</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.type === 'deposit_in_transit' ? 'bg-green-100 text-green-700' :
                              item.type === 'outstanding_check' ? 'bg-red-100 text-red-700' :
                              item.type === 'bank_fee' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {item.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(idx, 'description', e.target.value)}
                              placeholder="Description..."
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                              placeholder="0.00"
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.cleared}
                              onChange={(e) => updateItem(idx, 'cleared', e.target.checked)}
                            />
                          </td>
                          <td className="px-1">
                            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={saving}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave('reconciled')}
                  disabled={!isReconciled || saving}
                  className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Mark as Reconciled'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Past Reconciliations */}
      <div className="divide-y">
        {reconciliations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No reconciliations yet. Click "+ New Reconciliation" to start.
          </div>
        ) : (
          reconciliations.map(recon => (
            <div
              key={recon.id}
              onClick={() => loadExisting(recon)}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  recon.status === 'reconciled' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {recon.status}
                </span>
                <span className="font-medium">{recon.account?.institutionName} •••• {recon.account?.mask}</span>
                <span className="text-sm text-gray-500">{new Date(recon.periodEnd).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">Stmt: ${Number(recon.statementBalance).toFixed(2)}</span>
                <span className={recon.difference < 0.01 ? 'text-green-600' : 'text-red-600'}>
                  Diff: ${Number(recon.difference).toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
