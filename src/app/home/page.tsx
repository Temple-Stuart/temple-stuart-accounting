'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface HomeExpense {
  id: string;
  name: string;
  coa_code: string;
  amount: number;
  cadence: string;
  due_day: number | null;
  status: string;
  committed_at: string | null;
}

interface HistoricalCode {
  code: string;
  name: string;
  total: number;
  count: number;
  monthlyAvg: number;
}

const HOME_COA_CODES = [
  { code: 'P-8100', name: 'Rent', icon: '🏠' },
  { code: 'P-8110', name: 'Utilities', icon: '💡' },
  { code: 'P-8210', name: 'Internet', icon: '📶' },
];

const CADENCES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

export default function HomePage() {
  const [expenses, setExpenses] = useState<HomeExpense[]>([]);
  const [historical, setHistorical] = useState<HistoricalCode[]>([]);
  const [summary, setSummary] = useState({ totalMonthlyHistorical: 0, totalMonthlyCommitted: 0, draftCount: 0, committedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCadence, setFormCadence] = useState('monthly');
  const [formDueDay, setFormDueDay] = useState('1');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/home');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setHistorical(data.historicalByCode || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName || !formCode || !formAmount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          coaCode: formCode,
          amount: parseInt(formAmount),
          cadence: formCadence,
          dueDay: parseInt(formDueDay),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormName('');
        setFormCode('');
        setFormAmount('');
        loadData();
      }
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: 'commit' | 'uncommit') => {
    const msg = action === 'commit' 
      ? 'Commit this expense to your budget and calendar?' 
      : 'Uncommit this expense? This will remove it from the calendar and budget.';
    if (!confirm(msg)) return;
    
    setActionLoading(id);
    try {
      await fetch(`/api/home/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch (err) {
      console.error(`${action} failed:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/home/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const draftExpenses = expenses.filter(e => e.status === 'draft');
  const committedExpenses = expenses.filter(e => e.status === 'committed');

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏠</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Home</h1>
              <p className="text-gray-500">Your residence costs - the baseline to beat as a nomad</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-[#b4b237] hover:bg-[#9a982f] text-white">
            + Add Home Expense
          </Button>
        </div>

        {/* Key Insight */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-orange-600 font-medium mb-1">Monthly Cost of Home (Committed)</div>
              <div className="text-4xl font-bold text-orange-700">
                {formatCurrency(summary.totalMonthlyCommitted)}
              </div>
              <div className="text-sm text-orange-600 mt-1">
                Historical avg: {formatCurrency(summary.totalMonthlyHistorical)}/mo
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">This is your baseline</div>
              <div className="text-lg font-semibold text-gray-700">Can you travel for less?</div>
            </div>
          </div>
        </Card>

        {/* Add Form */}
        {showForm && (
          <Card className="p-6 mb-8 border-2 border-[#b4b237]">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">New Home Expense</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Monthly Rent"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">Select...</option>
                  {HOME_COA_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="2000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cadence</label>
                <select
                  value={formCadence}
                  onChange={(e) => setFormCadence(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  {CADENCES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Day</label>
                <input
                  type="number"
                  value={formDueDay}
                  onChange={(e) => setFormDueDay(e.target.value)}
                  min="1"
                  max="31"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleCreate} disabled={saving} className="bg-[#b4b237] text-white">
                  {saving ? 'Saving...' : 'Add'}
                </Button>
                <Button onClick={() => setShowForm(false)} variant="secondary">Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Draft</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.draftCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Committed</div>
            <div className="text-2xl font-bold text-green-600">{summary.committedCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Historical Avg</div>
            <div className="text-2xl font-bold text-gray-600">{formatCurrency(summary.totalMonthlyHistorical)}</div>
          </Card>
          <Card className="p-4 bg-orange-50">
            <div className="text-sm text-orange-600">Committed Budget</div>
            <div className="text-2xl font-bold text-orange-700">{formatCurrency(summary.totalMonthlyCommitted)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Draft Expenses */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
              Draft ({draftExpenses.length})
            </h2>
            <div className="space-y-3">
              {draftExpenses.map(expense => (
                <div key={expense.id} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">{expense.name}</div>
                    <Badge variant="warning">Draft</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{expense.coa_code} • {expense.cadence} • Due day {expense.due_day}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(expense.amount)}/mo</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => handleAction(expense.id, 'commit')}
                      disabled={actionLoading === expense.id}
                      size="sm"
                      className="bg-green-600 text-white text-xs"
                    >
                      {actionLoading === expense.id ? '...' : '✓ Commit'}
                    </Button>
                    <Button
                      onClick={() => handleDelete(expense.id)}
                      disabled={actionLoading === expense.id}
                      size="sm"
                      variant="secondary"
                      className="text-red-600 border-red-200 text-xs"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {draftExpenses.length === 0 && (
                <div className="text-gray-400 text-sm text-center py-4">No draft expenses</div>
              )}
            </div>
          </Card>

          {/* Committed Expenses */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Committed ({committedExpenses.length})
            </h2>
            <div className="space-y-3">
              {committedExpenses.map(expense => (
                <div key={expense.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">{expense.name}</div>
                    <Badge variant="success">Committed</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{expense.coa_code} • {expense.cadence} • Due day {expense.due_day}</span>
                    <span className="font-bold text-green-700">{formatCurrency(expense.amount)}/mo</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => handleAction(expense.id, 'uncommit')}
                      disabled={actionLoading === expense.id}
                      size="sm"
                      variant="secondary"
                      className="text-orange-600 border-orange-200 text-xs"
                    >
                      {actionLoading === expense.id ? '...' : '↩ Uncommit'}
                    </Button>
                  </div>
                </div>
              ))}
              {committedExpenses.length === 0 && (
                <div className="text-gray-400 text-sm text-center py-4">No committed expenses yet</div>
              )}
            </div>
          </Card>
        </div>

        {/* Historical Reference */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historical Averages (from transactions)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {historical.filter(h => h.total > 0).map(item => (
              <div key={item.code} className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">{item.name}</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(item.monthlyAvg)}<span className="text-sm font-normal">/mo</span></div>
                <div className="text-xs text-gray-400">{item.code} • {formatCurrency(item.total)} total</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
