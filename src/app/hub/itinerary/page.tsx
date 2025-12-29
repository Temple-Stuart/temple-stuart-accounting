'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout, Card, PageHeader } from '@/components/ui';
import BudgetBuilder from '@/components/dashboard/BudgetBuilder';

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

interface Budget {
  accountCode: string;
  year: number;
  jan: number | null;
  feb: number | null;
  mar: number | null;
  apr: number | null;
  may: number | null;
  jun: number | null;
  jul: number | null;
  aug: number | null;
  sep: number | null;
  oct: number | null;
  nov: number | null;
  dec: number | null;
}

export default function ItineraryBuilderPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [txnRes, coaRes, budgetRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/chart-of-accounts'),
        fetch(`/api/budgets?year=${selectedYear}`)
      ]);
      if (txnRes.ok) { const data = await txnRes.json(); setTransactions(data.transactions || []); }
      if (coaRes.ok) { const data = await coaRes.json(); setCoaOptions(data.accounts || []); }
      if (budgetRes.ok) { const data = await budgetRes.json(); setBudgets(data.budgets || []); }
    } catch (err) { console.error('Failed to load data:', err); }
    finally { setLoading(false); }
  }, [selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveBudget = async (accountCode: string, year: number, months: Record<string, number | null>) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountCode, year, months })
    });
    loadData();
  };

  return (
    <AppLayout>
      <PageHeader
        title="Budget Review"
        subtitle={`Track spending vs targets for ${selectedYear}`}
        backHref="/hub"
      />

      <div className="px-4 lg:px-8 py-8 space-y-6">
        {loading ? (
          <Card className="py-12 text-center">
            <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading budget data...</p>
          </Card>
        ) : (
          <BudgetBuilder
            transactions={transactions}
            coaOptions={coaOptions}
            budgets={budgets}
            selectedYear={selectedYear}
            onSaveBudget={saveBudget}
          />
        )}

        {/* Future Calendar */}
        <Card className="text-center py-8">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold text-gray-900 mb-2">Calendar Coming Soon</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Link your budgets to a calendar. Schedule flights, hotel check-ins, events — 
            and see your financial plan come to life.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
