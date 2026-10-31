'use client';

import { useState, useEffect } from 'react';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';

/**
 * FX-01b (Alex, 2026-10-30, ruling A): the statements are kept in integer CENTS — /api/statements sums
 * ledger_entries.amount (cents) per account and hands { accounts, availableYears } and nothing else
 * (src/app/api/statements/route.ts) — and every figure is written by the one formatter; nothing is
 * divided into dollars here. The ratios are dimensionless and computed from the same cents.
 */
interface FinancialData {
  incomeStatement: {
    revenueCents: number;
    expensesCents: number;
    netIncomeCents: number;
  };
  balanceSheet: {
    assetsCents: number;
    liabilitiesCents: number;
    equityCents: number;
  };
}

export default function FinancialStatementsTab({ }: { } = {}) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatements();
  }, []);

  const loadStatements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/statements');
      if (res.ok) {
        const statements = await res.json();
        if (Array.isArray(statements.accounts)) {
          // Derive the summary from the ledger account rows — cents in, cents kept.
          let revenue = 0, expenses = 0, assets = 0, liabilities = 0, equity = 0;
          for (const acct of statements.accounts) {
            const net = (acct.debits || 0) - (acct.credits || 0);
            const type = acct.accountType?.toLowerCase();
            if (type === 'revenue') revenue += Math.abs(net);
            else if (type === 'expense') expenses += Math.abs(net);
            else if (type === 'asset') assets += Math.abs(net);
            else if (type === 'liability') liabilities += Math.abs(net);
            else if (type === 'equity') equity += Math.abs(net);
          }
          setData({
            incomeStatement: { revenueCents: revenue, expensesCents: expenses, netIncomeCents: revenue - expenses },
            balanceSheet: { assetsCents: assets, liabilitiesCents: liabilities, equityCents: equity },
          });
        }
      }
    } catch (error) {
      console.error('Error loading statements:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading statements...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-brand-red">Failed to load statements</div>;
  }

  const { incomeStatement, balanceSheet } = data;
  const liabilitiesPlusEquityCents = balanceSheet.liabilitiesCents + balanceSheet.equityCents;
  const isBalanced = balanceSheet.assetsCents - liabilitiesPlusEquityCents === 0;

  return (
    <div className="p-4 space-y-6">
      <div className="text-xs text-text-muted font-mono" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</div>
      <div className="grid grid-cols-2 gap-6">
        {/* Income Statement */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">Income Statement</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Revenue</span>
              <span className="text-terminal-lg font-semibold text-brand-green">
                {functionalMoneyWords(incomeStatement.revenueCents)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Expenses</span>
              <span className="text-terminal-lg font-semibold text-brand-red">
                {functionalMoneyWords(incomeStatement.expensesCents)}
              </span>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-terminal-lg font-bold">Net Income</span>
                <span className={`text-sm font-bold ${
                  incomeStatement.netIncomeCents >= 0 ? 'text-brand-green' : 'text-brand-red'
                }`}>
                  {functionalMoneyWords(incomeStatement.netIncomeCents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">Balance Sheet</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Assets</span>
              <span className="text-terminal-lg font-semibold">
                {functionalMoneyWords(balanceSheet.assetsCents)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Liabilities</span>
              <span className="text-terminal-lg font-semibold">
                {functionalMoneyWords(balanceSheet.liabilitiesCents)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Equity</span>
              <span className="text-terminal-lg font-semibold">
                {functionalMoneyWords(balanceSheet.equityCents)}
              </span>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="text-sm text-text-secondary space-y-1">
                <div>Balance Check: Assets = {functionalMoneyWords(balanceSheet.assetsCents)}</div>
                <div>Liabilities + Equity = {functionalMoneyWords(liabilitiesPlusEquityCents)}</div>
                <div className={`font-semibold ${isBalanced ? 'text-brand-green' : 'text-brand-red'}`}>
                  {isBalanced ? '✓ Books balanced' : '⚠ Books not balanced'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white border rounded p-6">
        <h3 className="text-terminal-lg font-semibold mb-4">Quick Ratios</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Profit Margin</div>
            <div className="text-sm font-bold">
              {incomeStatement.revenueCents > 0
                ? ((incomeStatement.netIncomeCents / incomeStatement.revenueCents) * 100).toFixed(1)
                : '0.0'
              }%
            </div>
          </div>

          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Current Ratio</div>
            <div className="text-sm font-bold">
              {balanceSheet.liabilitiesCents !== 0
                ? (balanceSheet.assetsCents / Math.abs(balanceSheet.liabilitiesCents)).toFixed(2)
                : 'N/A'
              }
            </div>
          </div>

          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">ROE</div>
            <div className="text-sm font-bold">
              {balanceSheet.equityCents !== 0
                ? ((incomeStatement.netIncomeCents / balanceSheet.equityCents) * 100).toFixed(1)
                : '0.0'
              }%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
