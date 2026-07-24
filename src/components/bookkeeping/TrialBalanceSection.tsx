'use client';

import { useState, useEffect } from 'react';
import { themed, type Surface } from '@/lib/ds';

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

export default function TrialBalanceSection({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
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

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-brand-red text-sm">{error}</div>;
  }

  if (!data || data.accounts.length === 0) {
    return (
      <div className={themed('p-8 text-center text-text-muted text-sm', dk)}>
        No ledger entries found. Commit transactions to generate a trial balance.
      </div>
    );
  }

  return (
    <div>
      {/* Subtle status pill */}
      <div className={themed('px-4 py-2 border-b border-border flex items-center gap-2', dk)}>
        {data.totals.isBalanced ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {'\u2713'} Balanced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {'\u2717'} Unbalanced by {fmtCents(data.totals.imbalance)}
          </span>
        )}
        <span className={themed('text-terminal-sm text-text-muted font-mono', dk)}>{data.accounts.length} accounts</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className={themed('bg-gray-50', dk)}>
            <tr>
              <th className={themed('px-3 py-2 text-left font-medium text-text-secondary', dk)}>Account Code</th>
              <th className={themed('px-3 py-2 text-left font-medium text-text-secondary', dk)}>Account Name</th>
              <th className={themed('px-3 py-2 text-left font-medium text-text-secondary', dk)}>Type</th>
              <th className={themed('px-3 py-2 text-left font-medium text-text-secondary', dk)}>Entity</th>
              <th className={themed('px-3 py-2 text-right font-medium text-text-secondary', dk)}>Debit</th>
              <th className={themed('px-3 py-2 text-right font-medium text-text-secondary', dk)}>Credit</th>
            </tr>
          </thead>
          <tbody className={themed('divide-y divide-border', dk)}>
            {data.accounts.map((acct, idx) => {
              const absBalance = Math.abs(acct.normalBalance);
              return (
                <tr key={`${acct.accountCode}-${acct.entityId}`} className={idx % 2 === 1 ? themed('bg-bg-row', dk) : ''}>
                  <td className={themed('px-3 py-2 font-mono text-text-secondary', dk)}>{acct.accountCode}</td>
                  <td className={themed('px-3 py-2 text-text-primary', dk)}>{acct.accountName}</td>
                  <td className={themed('px-3 py-2 text-text-muted capitalize', dk)}>{acct.accountType}</td>
                  <td className={themed('px-3 py-2 text-text-muted', dk)}>{acct.entityName}</td>
                  <td className={themed('px-3 py-2 text-right font-mono text-text-primary', dk)}>
                    {acct.displaySide === 'debit' ? fmtCents(absBalance) : ''}
                  </td>
                  <td className={themed('px-3 py-2 text-right font-mono text-text-primary', dk)}>
                    {acct.displaySide === 'credit' ? fmtCents(absBalance) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className={themed('bg-gray-50 border-t-2 border-border', dk)}>
            <tr className="font-semibold">
              <td colSpan={4} className={themed('px-3 py-2 text-text-primary', dk)}>Totals</td>
              <td className={themed('px-3 py-2 text-right font-mono text-text-primary', dk)}>{fmtCents(data.totals.totalDebits)}</td>
              <td className={themed('px-3 py-2 text-right font-mono text-text-primary', dk)}>{fmtCents(data.totals.totalCredits)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
