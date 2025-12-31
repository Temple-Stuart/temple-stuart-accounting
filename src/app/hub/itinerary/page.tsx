'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Year selector - current year + 2 forward years
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Loading budget data for year:", selectedYear);
      const [txnRes, coaRes, budgetRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/chart-of-accounts'),
        fetch('/api/budgets?year=' + selectedYear)
      ]);
      if (txnRes.ok) { const data = await txnRes.json(); setTransactions(data.transactions || []); }
      if (coaRes.ok) { const data = await coaRes.json(); setCoaOptions(data.accounts || []); }
      if (budgetRes.ok) { 
        const data = await budgetRes.json(); 
        console.log("Budgets loaded:", data.budgets);
        setBudgets(data.budgets || []); 
      }
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

      {/* Year Selector */}
      <div className="px-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedYear === year 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => router.push('/hub')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <span>📅</span> View Calendar
          </button>
        </div>
      </div>

      <div className="p-8 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
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

        {/* Calendar Coming Soon - Now Active! */}
        <Card className="p-8 mt-8 text-center bg-gradient-to-br from-[#b4b237]/10 to-[#b4b237]/5">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Calendar View Available</h3>
          <p className="text-gray-500 mb-4">
            View your committed budgets from Home, Agenda, and Trips on the calendar.
          </p>
          <button
            onClick={() => router.push('/hub')}
            className="px-6 py-3 bg-[#b4b237] hover:bg-[#9a982f] text-white rounded-lg font-medium transition-all"
          >
            Open Hub Calendar →
          </button>
        </Card>
      </div>
    </AppLayout>
  );
}
