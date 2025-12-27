'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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

      if (txnRes.ok) {
        const data = await txnRes.json();
        setTransactions(data.transactions || []);
      }
      if (coaRes.ok) {
        const data = await coaRes.json();
        setCoaOptions(data.accounts || []);
      }
      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudgets(data.budgets || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveBudget = async (accountCode: string, year: number, months: Record<string, number | null>) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountCode, year, months })
    });
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-gray-900">Itinerary Builder</div>
              <div className="text-xs text-gray-400">Budget by category</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/hub')}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Hub
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            Loading...
          </div>
        ) : (
          <BudgetBuilder
            transactions={transactions}
            coaOptions={coaOptions}
            budgets={budgets}
            selectedYear={selectedYear}
            onSaveBudget={saveBudget}
          />
        )}

        {/* Future: Calendar integration */}
        <div className="mt-8 bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold text-gray-900 mb-2">Calendar Coming Soon</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Link your budgets to a calendar. Schedule flights, hotel check-ins, events — 
            and see your financial plan come to life.
          </p>
        </div>
      </main>
    </div>
  );
}
