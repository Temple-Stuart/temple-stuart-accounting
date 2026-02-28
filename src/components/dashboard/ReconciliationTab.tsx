'use client';

import { useState, useEffect } from 'react';

interface BankAccount {
  id: string;
  institutionName: string;
  accountName: string;
  accountType: string;
  balance: number;
  lastSynced: string;
}

interface LedgerAccount {
  accountCode: string;
  accountName: string;
  closingBalance: number;
}

interface ReconciliationItem {
  bankAccountId: string;
  bankAccountName: string;
  institutionName: string;
  ledgerBalance: number;
  bankBalance: number;
  difference: number;
  isReconciled: boolean;
}

export default function ReconciliationTab() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [reconciliationItems, setReconciliationItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/bank-accounts').then(res => res.json()),
      fetch('/api/ledger/accounts').then(res => res.json())
    ])
      .then(([bankData, ledgerData]) => {
        setBankAccounts(bankData.accounts || []);
        setLedgerAccounts(ledgerData.accounts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load reconciliation data:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (bankAccounts.length > 0 && ledgerAccounts.length > 0) {
      const items = bankAccounts.map(bankAcc => {
        // Match bank account to ledger account
        // This is simplified - in production you'd have proper mapping
        const ledgerAccount = ledgerAccounts.find(
          l => l.accountName.toLowerCase().includes(bankAcc.accountName.toLowerCase())
        );

        const ledgerBalance = ledgerAccount?.closingBalance || 0;
        const bankBalance = bankAcc.balance || 0;
        const difference = bankBalance - ledgerBalance;

        return {
          bankAccountId: bankAcc.id,
          bankAccountName: bankAcc.accountName,
          institutionName: bankAcc.institutionName,
          ledgerBalance,
          bankBalance,
          difference,
          isReconciled: Math.abs(difference) < 0.01 // Within 1 cent
        };
      });

      setReconciliationItems(items);
    }
  }, [bankAccounts, ledgerAccounts]);

  const totalDifference = reconciliationItems.reduce(
    (sum, item) => sum + Math.abs(item.difference),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-text-secondary">Loading reconciliation data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded shadow p-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-text-secondary">Total Accounts</p>
            <p className="text-sm font-bold text-text-primary">
              {reconciliationItems.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Reconciled</p>
            <p className="text-sm font-bold text-brand-green">
              {reconciliationItems.filter(i => i.isReconciled).length}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Total Variance</p>
            <p className="text-sm font-bold text-brand-red">
              ${totalDifference.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Reconciliation Items */}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-bg-row">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Account
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Bank Balance
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Ledger Balance
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Difference
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {reconciliationItems.map((item) => (
              <tr key={item.bankAccountId} className="hover:bg-bg-row">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-text-primary">
                    {item.bankAccountName}
                  </div>
                  <div className="text-sm text-text-muted">
                    {item.institutionName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-text-primary">
                  ${item.bankBalance.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-text-primary">
                  ${item.ledgerBalance.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span className={item.difference === 0 ? 'text-text-primary' : 'text-brand-red font-medium'}>
                    ${Math.abs(item.difference).toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {item.isReconciled ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Reconciled
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Needs Review
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  <button className="text-brand-purple hover:text-brand-purple font-medium">
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reconciliationItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted">No accounts to reconcile</p>
          </div>
        )}
      </div>
    </div>
  );
}
