'use client';

import { useState, useEffect } from 'react';

export function ChartOfAccountsSection({ entityId }: { entityId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    accountNumber: '',
    accountName: '',
    accountType: 'Asset',
    subType: '',
    normalBalance: 'debit'
  });

  const accountTypes = {
    Asset: ['Current Asset', 'Fixed Asset', 'Other Asset'],
    Liability: ['Current Liability', 'Long-term Liability'],
    Equity: ["Owner's Equity", 'Retained Earnings'],
    Revenue: ['Operating Revenue', 'Other Revenue'],
    Expense: ['Operating Expense', 'Other Expense']
  };

  useEffect(() => {
    loadAccounts();
  }, [entityId]);

  const loadAccounts = async () => {
    const res = await fetch(`/api/chart-of-accounts?entityId=${entityId}`);
    if (res.ok) {
      const data = await res.json();
      setAccounts(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const res = await fetch('/api/chart-of-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, entityId })
    });
    
    if (res.ok) {
      await loadAccounts();
      setShowAddModal(false);
      setFormData({
        accountNumber: '',
        accountName: '',
        accountType: 'Asset',
        subType: '',
        normalBalance: 'debit'
      });
    }
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.accountType]) {
      acc[account.accountType] = [];
    }
    acc[account.accountType].push(account);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Chart of Accounts</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Add Account
            </button>
          </div>
        </div>

        <div className="p-6">
          {Object.keys(accountTypes).map((type) => (
            <div key={type} className="mb-8">
              <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">{type}s</h4>
              <div className="space-y-2">
                {(groupedAccounts[type] || []).map((account: any) => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-mono text-gray-500">{account.accountNumber}</span>
                      <span className="font-medium">{account.accountName}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{account.subType}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">Normal: {account.normalBalance}</span>
                    </div>
                  </div>
                ))}
                {(!groupedAccounts[type] || groupedAccounts[type].length === 0) && (
                  <p className="text-sm text-gray-400 italic">No {type.toLowerCase()} accounts defined</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add New Account</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Account Number (e.g., 1000)"
                required
              />
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Account Name (e.g., Cash)"
                required
              />
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({...formData, accountType: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {Object.keys(accountTypes).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
