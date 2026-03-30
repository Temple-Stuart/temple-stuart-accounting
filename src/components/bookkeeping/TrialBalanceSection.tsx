'use client';

import { useState, useEffect } from 'react';
import BookkeepingSection from './BookkeepingSection';

interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceType: string;
  entityId: string;
  entityName: string;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
  normalBalance: number;
  displaySide: 'debit' | 'credit';
}

interface TrialBalanceTotals {
  totalDebits: number;
  totalCredits: number;
  imbalance: number;
  isBalanced: boolean;
}

interface TrialBalanceData {
  asOfDate: string | null;
  startDate: string | null;
  entityId: string | null;
  accounts: TrialBalanceAccount[];
  totals: TrialBalanceTotals;
}

const fmtCents = (cents: number) => {
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(dollars);
  return cents < 0 ? `(${formatted})` : formatted;
};

export default function TrialBalanceSection() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/trial-balance');
        if (!res.ok) throw new Error('Failed to load trial balance');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const status = data?.totals.isBalanced ? 'complete' : data ? 'error' : 'pending';
  const subtitle = data
    ? `${data.accounts.length} accounts · ${data.totals.isBalanced ? 'Balanced' : 'UNBALANCED'}`
    : undefined;

  return (
    <BookkeepingSection title="Trial Balance" pipelineKey="TB" subtitle={subtitle} status={status}>
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="p-6 text-center text-brand-red text-sm">{error}</div>
      ) : data && data.accounts.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-sm">
          No ledger entries found. Commit transactions to generate a trial balance.
        </div>
      ) : data ? (
        <div className="p-4">
          {/* Balance status banner */}
          {data.totals.isBalanced ? (
            <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700">Balanced</span>
              <span className="text-xs text-emerald-600 ml-1">Debits equal credits</span>
            </div>
          ) : (
            <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-sm font-semibold text-red-700">Unbalanced</span>
              <span className="text-xs text-red-600 ml-1">Imbalance: {fmtCents(data.totals.imbalance)}</span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Account Code</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Account Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Entity</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Debit</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.accounts.map((acct, idx) => {
                  const absBalance = Math.abs(acct.normalBalance);
                  return (
                    <tr key={`${acct.accountCode}-${acct.entityId}`} className={idx % 2 === 1 ? 'bg-bg-row' : ''}>
                      <td className="px-3 py-2 font-mono text-text-secondary">{acct.accountCode}</td>
                      <td className="px-3 py-2 text-text-primary">{acct.accountName}</td>
                      <td className="px-3 py-2 text-text-muted capitalize">{acct.accountType}</td>
                      <td className="px-3 py-2 text-text-muted">{acct.entityName}</td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary">
                        {acct.displaySide === 'debit' ? fmtCents(absBalance) : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary">
                        {acct.displaySide === 'credit' ? fmtCents(absBalance) : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-border">
                <tr className="font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-text-primary">Totals</td>
                  <td className="px-3 py-2 text-right font-mono text-text-primary">{fmtCents(data.totals.totalDebits)}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-primary">{fmtCents(data.totals.totalCredits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </BookkeepingSection>
  );
}
