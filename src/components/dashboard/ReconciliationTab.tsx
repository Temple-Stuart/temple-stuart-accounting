'use client';

import { useState, useEffect } from 'react';

interface BankAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
  institutionName?: string;
}

interface ReconciliationItem {
  bankAccount: BankAccount;
  ledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

export default function ReconciliationTab() {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReconciliation();
  }, []);

  const loadReconciliation = async () => {
    setLoading(true);
    try {
      // Load bank accounts
      const accountsRes = await fetch('/api/accounts');
      const accountsData = await accountsRes.json();
      
      let bankAccounts: BankAccount[] = [];
      if (accountsData.accounts) {
        bankAccounts = accountsData.accounts;
      } else if (accountsData.items) {
        accountsData.items.forEach((item: any) => {
          if (item.accounts) {
            bankAccounts.push(...item.accounts.map((acc: any) => ({
              ...acc,
              institutionName: item.institutionName
            })));
          }
        });
      }

      // Load ledger balances
      const ledgerRes = await fetch('/api/ledger');
      const ledgerData = await ledgerRes.json();

      // Match bank accounts to ledger accounts
      const reconciliationItems: ReconciliationItem[] = bankAccounts.map(bankAcc => {
        // Find matching ledger account (simplified matching by name)
        const ledgerAccount = ledgerData.ledgers?.find((l: any) => 
          l.accountName.toLowerCase().includes(bankAcc.name.toLowerCase()) ||
          l.accountName.toLowerCase().includes('checking') && bankAcc.subtype === 'checking' ||
          l.accountName.toLowerCase().includes('brokerage') && bankAcc.type === 'investment'
        );

        const ledgerBalance = ledgerAccount?.closingBalance || 0;
        const bankBalance = bankAcc.balance || bankAcc.currentBalance || 0;
        const difference = bankBalance - ledgerBalance;

        return {
          bankAccount: bankAcc,
          ledgerBalance,
          difference,
          isReconciled: Math.abs(difference) < 0.01
        };
      });

      setItems(reconciliationItems);
    } catch (error) {
      console.error('Error loading reconciliation:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading reconciliation...</div>;
  }

  const totalBankBalance = items.reduce((sum, item) => sum + (item.bankAccount.balance || item.bankAccount.currentBalance || 0), 0);
  const totalLedgerBalance = items.reduce((sum, item) => sum + item.ledgerBalance, 0);
  const totalDifference = totalBankBalance - totalLedgerBalance;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Bank Reconciliation</h2>
          <p className="text-sm text-gray-600 mt-1">{items.length} accounts to reconcile</p>
        </div>
        <button 
          onClick={loadReconciliation}
          className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Bank Balance</div>
          <div className="text-2xl font-bold text-blue-600">${totalBankBalance.toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Ledger Balance</div>
          <div className="text-2xl font-bold text-green-600">${totalLedgerBalance.toFixed(2)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Difference</div>
          <div className={`text-2xl font-bold ${
            Math.abs(totalDifference) < 0.01 ? 'text-green-600' : 'text-red-600'
          }`}>
            ${Math.abs(totalDifference).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Account</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Institution</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Bank Balance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Ledger Balance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Difference</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const bankBalance = item.bankAccount.balance || item.bankAccount.currentBalance || 0;
              
              return (
                <tr key={item.bankAccount.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{item.bankAccount.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.bankAccount.institutionName || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {item.bankAccount.subtype}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                    ${bankBalance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                    ${item.ledgerBalance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    <span className={Math.abs(item.difference) < 0.01 ? 'text-gray-400' : 'text-red-600'}>
                      ${Math.abs(item.difference).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.isReconciled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {item.isReconciled ? 'Reconciled' : 'Review Needed'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Reconciliation</h3>
        <p className="text-sm text-blue-800">
          Bank reconciliation compares your bank account balances (from Plaid) with your accounting ledger balances. 
          Differences may occur due to timing differences, pending transactions, or unrecorded items. 
          Review accounts marked "Review Needed" to investigate discrepancies.
        </p>
      </div>
    </div>
  );
}
