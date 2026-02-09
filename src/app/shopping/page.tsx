'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Button, Badge } from '@/components/ui';
import MealPlannerForm, { MealPlan, Ingredient } from '@/components/shopping/MealPlannerForm';
import MealPlanDashboard from '@/components/shopping/MealPlanDashboard';
function getMealPlanKey(): string {
  const email = document.cookie.split('; ').find(c => c.startsWith('userEmail='))?.split('=')[1] || 'default';
  return `mealPlan_${email}`;
}


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
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [userTier, setUserTier] = useState<string>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'meals' | 'expenses'>('meals');

  useEffect(() => {
    loadExpenses();
    fetch('/api/auth/me').then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); });
    const saved = localStorage.getItem(getMealPlanKey());
    if (saved) {
      try { setMealPlan(JSON.parse(saved)); } catch (e) { console.error('Failed to load saved meal plan'); }
    }
  }, []);

  const loadExpenses = async () => {
    try {
      const res = await fetch('/api/shopping');
      if (res.ok) { const data = await res.json(); setExpenses(data.expenses || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
      setForm({ name: '', coa_code: 'P-8120', amount: '', cadence: 'weekly', target_date: new Date().toISOString().split('T')[0] });
      loadExpenses();
    fetch('/api/auth/me').then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); });
    }
  };

  const handleAction = async (id: string, action: 'commit' | 'uncommit') => {
    if (!confirm(action === 'commit' ? 'Commit?' : 'Uncommit?')) return;
    setActionLoading(id);
    await fetch(`/api/shopping/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    loadExpenses();
    fetch('/api/auth/me').then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); });
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    await fetch(`/api/shopping/${id}`, { method: 'DELETE' });
    loadExpenses();
    fetch('/api/auth/me').then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); });
  };

  const handlePlanGenerated = (plan: MealPlan) => {
    setMealPlan(plan);
    localStorage.setItem(getMealPlanKey(), JSON.stringify(plan));
  };

  const handleUpdatePrices = (shoppingList: Ingredient[]) => {
    if (!mealPlan) return;
    const updated = { ...mealPlan, shoppingList, totalActual: shoppingList.reduce((sum, item) => sum + (Number(item.actualPrice) || 0), 0) };
    setMealPlan(updated);
    localStorage.setItem(getMealPlanKey(), JSON.stringify(updated));
  };

  const handleResetPlan = () => {
    setMealPlan(null);
    localStorage.removeItem(getMealPlanKey());
  };

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');
  const totalDraft = draft.reduce((sum, e) => sum + e.amount, 0);
  const totalCommitted = committed.reduce((sum, e) => sum + e.amount, 0);
  const mealBudget = Number(mealPlan?.totalEstimated) || 0;
  const mealActual = Number(mealPlan?.totalActual) || 0;
  const pendingCount = draft.length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#2d1b4e] border-t-transparent rounded-full animate-spin" />
        </div>
        {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-gray-200 p-6 max-w-md">
            <div className="text-sm font-medium text-gray-900 mb-2">AI Meal Planning requires Pro+</div>
            <div className="text-xs text-gray-500 mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered meal planning.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Not Now</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">

          {/* Header - Wall Street Style */}
          <div className="mb-4 bg-[#2d1b4e] text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Shopping & Meal Planning</h1>
                <p className="text-gray-300 text-xs font-mono">
                  {mealPlan ? `${(mealPlan.meals || []).length} meals planned` : 'No meal plan'} · {expenses.length} recurring items
                </p>
              </div>
              <div className="flex items-center gap-2">
                {mealPlan && (
                  <button onClick={handleResetPlan} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 transition-colors">
                    Reset Plan
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Meal Budget</div>
              <div className="text-xl font-bold font-mono text-gray-900">{fmt(mealBudget)}</div>
              <div className="text-[10px] text-gray-400">weekly estimate</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Meal Actual</div>
              <div className={`text-xl font-bold font-mono ${mealActual > 0 ? (mealActual <= mealBudget ? 'text-emerald-700' : 'text-red-700') : 'text-gray-400'}`}>
                {mealActual > 0 ? fmt(mealActual) : '—'}
              </div>
              <div className="text-[10px] text-gray-400">{mealActual > 0 ? `${((mealActual / mealBudget) * 100).toFixed(0)}% of budget` : 'enter prices'}</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Draft Items</div>
              <div className="text-xl font-bold font-mono text-amber-600">{fmt(totalDraft)}</div>
              <div className="text-[10px] text-gray-400">{draft.length} pending</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Committed</div>
              <div className="text-xl font-bold font-mono text-emerald-700">{fmt(totalCommitted)}</div>
              <div className="text-[10px] text-gray-400">{committed.length} active</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Weekly</div>
              <div className="text-xl font-bold font-mono text-gray-900">{fmt(mealBudget + totalCommitted)}</div>
              <div className="text-[10px] text-gray-400">all categories</div>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto bg-white border border-gray-200">
            <button
              onClick={() => setActiveTab('meals')}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'meals' ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Meal Planning
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'expenses' ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Recurring Expenses{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          </div>

          {/* Section Content */}
          <div className="bg-white border border-gray-200">
            
            {/* Meal Planning Tab */}
            {activeTab === 'meals' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                  AI Meal Planner
                </div>
                <div className="p-4">
                  {mealPlan ? (
                    <MealPlanDashboard
                      plan={mealPlan}
                      onUpdatePrices={handleUpdatePrices}
                      onReset={handleResetPlan}
                    />
                  ) : (
                    userTier === 'free' ? (
                      <div className="text-center py-8">
                        <div className="text-sm font-medium text-gray-900 mb-2">AI Meal Planning requires Pro+</div>
                        <div className="text-xs text-gray-500 mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered meal planning.</div>
                        <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">View Plans</button>
                      </div>
                    ) : (
                      <MealPlannerForm onPlanGenerated={handlePlanGenerated} />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Recurring Expenses Tab */}
            {activeTab === 'expenses' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Recurring Household Expenses</span>
                  <button onClick={() => setShowForm(!showForm)} className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 transition-colors">
                    + Add Item
                  </button>
                </div>

                {/* Add Form */}
                {showForm && (
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Item name"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          required
                        />
                        <select
                          className="border border-gray-300 px-3 py-2 text-sm"
                          value={form.coa_code}
                          onChange={e => setForm({ ...form, coa_code: e.target.value })}
                        >
                          {COA_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          className="border border-gray-300 px-3 py-2 text-sm"
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={form.amount}
                          onChange={e => setForm({ ...form, amount: e.target.value })}
                          required
                        />
                        <select
                          className="border border-gray-300 px-3 py-2 text-sm"
                          value={form.cadence}
                          onChange={e => setForm({ ...form, cadence: e.target.value })}
                        >
                          {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input
                          className="border border-gray-300 px-3 py-2 text-sm"
                          type="date"
                          value={form.target_date}
                          onChange={e => setForm({ ...form, target_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
                          Cancel
                        </button>
                        <button type="submit" className="px-3 py-1.5 text-xs bg-[#2d1b4e] text-white hover:bg-[#3d2b5e]">
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Expenses Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#3d2b5e] text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="px-3 py-2 text-left font-medium">Category</th>
                        <th className="px-3 py-2 text-left font-medium">Frequency</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-center font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expenses.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No recurring expenses</td></tr>
                      )}
                      {expenses.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{e.name}</td>
                          <td className="px-3 py-2 text-gray-600">{COA_OPTIONS.find(c => c.code === e.coa_code)?.name || e.coa_code}</td>
                          <td className="px-3 py-2 text-gray-600">{CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 text-[10px] uppercase font-medium ${
                              e.status === 'committed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(e.amount)}</td>
                          <td className="px-3 py-2 text-center">
                            {e.status === 'draft' ? (
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleAction(e.id, 'commit')}
                                  disabled={actionLoading === e.id}
                                  className="px-2 py-0.5 text-[10px] bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  {actionLoading === e.id ? '...' : 'Commit'}
                                </button>
                                <button onClick={() => handleDelete(e.id)} className="px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50">
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAction(e.id, 'uncommit')}
                                className="px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100"
                              >
                                Undo
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {expenses.length > 0 && (
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 font-semibold text-gray-900">Total Committed</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{fmt(totalCommitted)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-gray-200 p-6 max-w-md">
            <div className="text-sm font-medium text-gray-900 mb-2">AI Meal Planning requires Pro+</div>
            <div className="text-xs text-gray-500 mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered meal planning.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Not Now</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
