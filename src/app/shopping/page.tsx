'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button, Badge } from '@/components/ui';
import MealPlannerForm, { MealPlan, Ingredient } from '@/components/shopping/MealPlannerForm';
import MealPlanDashboard from '@/components/shopping/MealPlanDashboard';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  name: string;
  coa_code: string;
  amount: number;
  cadence: string;
  target_date: string | null;
  status: string;
}

const COA_OPTIONS = [
  { code: 'P-8120', name: 'Groceries' },
  { code: 'P-8150', name: 'Clothing & Personal Care' },
  { code: 'P-8310', name: 'Hygiene & Toiletries' },
  { code: 'P-8320', name: 'Cleaning Supplies' },
  { code: 'P-8330', name: 'Kitchen & Household' },
];

const CADENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-annually' },
  { value: 'annual', label: 'Annually' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ShoppingPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    coa_code: 'P-8120',
    amount: '',
    cadence: 'weekly',
    target_date: new Date().toISOString().split('T')[0]
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Meal plan state
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'meals' | 'expenses'>('meals');

  useEffect(() => {
    loadExpenses();
    // Load saved meal plan from localStorage
    const saved = localStorage.getItem('mealPlan');
    if (saved) {
      try {
        setMealPlan(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved meal plan');
      }
    }
  }, []);

  const loadExpenses = async () => {
    try {
      const res = await fetch('/api/shopping');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) })
    });
    if (res.ok) {
      setShowForm(false);
      setForm({
        name: '',
        coa_code: 'P-8120',
        amount: '',
        cadence: 'weekly',
        target_date: new Date().toISOString().split('T')[0]
      });
      loadExpenses();
    }
  };

  const handleAction = async (id: string, action: 'commit' | 'uncommit') => {
    if (!confirm(action === 'commit' ? 'Commit this expense?' : 'Uncommit this expense?')) return;
    setActionLoading(id);
    await fetch(`/api/shopping/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    loadExpenses();
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/shopping/${id}`, { method: 'DELETE' });
    loadExpenses();
  };

  const handlePlanGenerated = (plan: MealPlan) => {
    setMealPlan(plan);
    localStorage.setItem('mealPlan', JSON.stringify(plan));
  };

  const handleUpdatePrices = (shoppingList: Ingredient[]) => {
    if (!mealPlan) return;
    const updated = {
      ...mealPlan,
      shoppingList,
      totalActual: shoppingList.reduce((sum, item) => sum + (item.actualPrice || 0), 0)
    };
    setMealPlan(updated);
    localStorage.setItem('mealPlan', JSON.stringify(updated));
  };

  const handleResetPlan = () => {
    setMealPlan(null);
    localStorage.removeItem('mealPlan');
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(n);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '-';

  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');

  // Calculate totals
  const totalDraft = draft.reduce((sum, e) => sum + e.amount, 0);
  const totalCommitted = committed.reduce((sum, e) => sum + e.amount, 0);
  const mealBudget = mealPlan?.totalEstimated || 0;
  const mealActual = mealPlan?.totalActual || 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">🛒 Shopping</h1>
              <p className="text-zinc-400">Meal planning, groceries & household supplies</p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Meal Budget</div>
              <div className="text-2xl font-bold text-white">{fmt(mealBudget)}</div>
              <div className="text-xs text-zinc-500 mt-1">weekly estimate</div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Meal Actual</div>
              <div className={`text-2xl font-bold ${mealActual > 0 ? 'text-white' : 'text-zinc-600'}`}>
                {mealActual > 0 ? fmt(mealActual) : '—'}
              </div>
              <div className={`text-xs mt-1 ${
                mealActual === 0 ? 'text-zinc-500' :
                mealActual <= mealBudget ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {mealActual > 0 ? `${((mealActual / mealBudget) * 100).toFixed(0)}% of budget` : 'enter prices'}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Draft Expenses</div>
              <div className="text-2xl font-bold text-amber-400">{fmt(totalDraft)}</div>
              <div className="text-xs text-zinc-500 mt-1">{draft.length} items pending</div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Committed</div>
              <div className="text-2xl font-bold text-emerald-400">{fmt(totalCommitted)}</div>
              <div className="text-xs text-zinc-500 mt-1">{committed.length} items active</div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Weekly</div>
              <div className="text-2xl font-bold text-white">{fmt(mealBudget + totalCommitted)}</div>
              <div className="text-xs text-zinc-500 mt-1">meals + recurring</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-zinc-800 pb-4">
            <button
              onClick={() => setActiveTab('meals')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'meals'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              🥗 Meal Planning
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'expenses'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              📦 Recurring Expenses
            </button>
          </div>

          {/* Meal Planning Tab */}
          {activeTab === 'meals' && (
            <div>
              {mealPlan ? (
                <MealPlanDashboard
                  plan={mealPlan}
                  onUpdatePrices={handleUpdatePrices}
                  onReset={handleResetPlan}
                />
              ) : (
                <MealPlannerForm onPlanGenerated={handlePlanGenerated} />
              )}
            </div>
          )}

          {/* Recurring Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              {/* Add Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowForm(!showForm)}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  + Add Expense
                </Button>
              </div>

              {/* Add Form */}
              {showForm && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                  <h3 className="font-medium text-white mb-4">New Recurring Expense</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500"
                        placeholder="Name"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        required
                      />
                      <select
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white"
                        value={form.coa_code}
                        onChange={e => setForm({ ...form, coa_code: e.target.value })}
                      >
                        {COA_OPTIONS.map(o => (
                          <option key={o.code} value={o.code}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <input
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500"
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={form.amount}
                        onChange={e => setForm({ ...form, amount: e.target.value })}
                        required
                      />
                      <select
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white"
                        value={form.cadence}
                        onChange={e => setForm({ ...form, cadence: e.target.value })}
                      >
                        {CADENCE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white"
                        type="date"
                        value={form.target_date}
                        onChange={e => setForm({ ...form, target_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowForm(false)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">
                        Save
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Draft Expenses */}
              {draft.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-semibold text-amber-400 flex items-center gap-2">
                    📝 Draft
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                      {draft.length}
                    </span>
                  </h2>
                  {draft.map(e => (
                    <div
                      key={e.id}
                      className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-white">{e.name}</div>
                        <div className="text-sm text-zinc-500">
                          {e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label} • {fmtDate(e.target_date)}
                        </div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="font-bold text-white">{fmt(e.amount)}</span>
                        <Button
                          size="sm"
                          onClick={() => handleAction(e.id, 'commit')}
                          disabled={actionLoading === e.id}
                          className="bg-emerald-600 hover:bg-emerald-500"
                        >
                          {actionLoading === e.id ? '...' : '✓'}
                        </Button>
                        <button
                          className="text-red-400 hover:text-red-300 text-sm font-medium"
                          onClick={() => handleDelete(e.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Committed Expenses */}
              {committed.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-semibold text-emerald-400 flex items-center gap-2">
                    ✓ Committed
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                      {committed.length}
                    </span>
                  </h2>
                  {committed.map(e => (
                    <div
                      key={e.id}
                      className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-4 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {e.name}
                          <Badge variant="success">Active</Badge>
                        </div>
                        <div className="text-sm text-zinc-500">
                          {e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label}
                        </div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="font-bold text-emerald-400">{fmt(e.amount)}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAction(e.id, 'uncommit')}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                        >
                          Undo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {expenses.length === 0 && (
                <div className="text-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
                  <div className="text-5xl mb-4">📦</div>
                  <h3 className="font-bold text-lg text-white mb-2">No Recurring Expenses</h3>
                  <p className="text-zinc-500">Add hygiene, cleaning supplies, and household items</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
