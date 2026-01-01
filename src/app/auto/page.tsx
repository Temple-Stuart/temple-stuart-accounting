'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface AutoExpense {
  id: string;
  name: string;
  coa_code: string;
  amount: number;
  cadence: string;
  due_day: number | null;
  status: string;
  committed_at: string | null;
}

const COA_OPTIONS = [
  { code: 'P-6400', name: 'Gas & Fuel' },
  { code: 'P-6500', name: 'Vehicle Maintenance' },
  { code: 'P-6600', name: 'Auto Insurance' },
  { code: 'P-6610', name: 'Auto Registration' },
  { code: 'P-6620', name: 'Parking' },
  { code: 'P-6630', name: 'Tolls' },
];

export default function AutoPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<AutoExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', coa_code: 'P-6400', amount: '', cadence: 'monthly', due_day: '1' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const res = await fetch('/api/auto');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), due_day: parseInt(form.due_day) })
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', coa_code: 'P-6400', amount: '', cadence: 'monthly', due_day: '1' });
        loadExpenses();
      }
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  const handleAction = async (id: string, action: 'commit' | 'uncommit') => {
    if (!confirm(action === 'commit' ? 'Commit to budget?' : 'Uncommit from budget?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/auto/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      loadExpenses();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await fetch(`/api/auto/${id}`, { method: 'DELETE' });
      loadExpenses();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
  
  const draftExpenses = expenses.filter(e => e.status === 'draft');
  const committedExpenses = expenses.filter(e => e.status === 'committed');
  const totalCommitted = committedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) {
    return <AppLayout><div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🚗 Auto Expenses</h1>
            <p className="text-gray-600">Vehicle costs - gas, maintenance, insurance</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>+ Add Expense</Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">Draft</div>
            <div className="text-2xl font-bold text-gray-700">{draftExpenses.length}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">Committed</div>
            <div className="text-2xl font-bold text-green-600">{committedExpenses.length}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">Monthly Budget</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalCommitted)}</div>
          </Card>
        </div>

        {showForm && (
          <Card className="p-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-4">
              <input className="col-span-2 border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              <select className="border rounded px-3 py-2" value={form.coa_code} onChange={e => setForm({...form, coa_code: e.target.value})}>
                {COA_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>
              <input className="border rounded px-3 py-2" type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
              <select className="border rounded px-3 py-2" value={form.cadence} onChange={e => setForm({...form, cadence: e.target.value})}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
              <Button type="submit">Save</Button>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="font-semibold text-gray-700">Draft ({draftExpenses.length})</h2>
          {draftExpenses.map(e => (
            <Card key={e.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-sm text-gray-500">{e.coa_code} • {e.cadence}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold">{formatCurrency(e.amount)}</span>
                <Button size="sm" onClick={() => handleAction(e.id, 'commit')} disabled={actionLoading === e.id}>
                  {actionLoading === e.id ? '...' : '✓ Commit'}
                </Button>
                <button className="text-red-500 text-sm" onClick={() => handleDelete(e.id)}>Delete</button>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-green-700">Committed ({committedExpenses.length})</h2>
          {committedExpenses.map(e => (
            <Card key={e.id} className="p-4 flex items-center justify-between bg-green-50">
              <div>
                <div className="font-medium">{e.name} <Badge variant="success">Committed</Badge></div>
                <div className="text-sm text-gray-500">{e.coa_code} • {e.cadence}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-green-700">{formatCurrency(e.amount)}</span>
                <Button size="sm" variant="secondary" onClick={() => handleAction(e.id, 'uncommit')} disabled={actionLoading === e.id}>
                  {actionLoading === e.id ? '...' : 'Uncommit'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
