'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface AutoExpense {
  id: string;
  name: string;
  coa_code: string;
  amount: number;
  cadence: string;
  due_day: number | null;
  target_date: string | null;
  status: string;
}

const COA_OPTIONS = [
  { code: 'P-6400', name: 'Gas & Fuel' },
  { code: 'P-6500', name: 'Vehicle Maintenance' },
  { code: 'P-6600', name: 'Auto Insurance' },
  { code: 'P-6610', name: 'Auto Registration' },
  { code: 'P-6620', name: 'Parking' },
  { code: 'P-6630', name: 'Tolls' },
];

const CADENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-annually' },
  { value: 'annual', label: 'Annually' },
];

export default function AutoPage() {
  const [expenses, setExpenses] = useState<AutoExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    name: '', 
    coa_code: 'P-6400', 
    amount: '', 
    cadence: 'monthly', 
    target_date: new Date().toISOString().split('T')[0]
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const res = await fetch('/api/auto');
      if (res.ok) { const data = await res.json(); setExpenses(data.expenses || []); }
    } catch (err) { console.error('Failed:', err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auto', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        ...form, 
        amount: parseFloat(form.amount),
      }) 
    });
    if (res.ok) { 
      setShowForm(false); 
      setForm({ name: '', coa_code: 'P-6400', amount: '', cadence: 'monthly', target_date: new Date().toISOString().split('T')[0] }); 
      loadExpenses(); 
    }
  };

  const handleAction = async (id: string, action: 'commit' | 'uncommit') => {
    if (!confirm(action === 'commit' ? 'Commit to budget & calendar?' : 'Uncommit?')) return;
    setActionLoading(id);
    await fetch(`/api/auto/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    loadExpenses(); setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    await fetch(`/api/auto/${id}`, { method: 'DELETE' }); loadExpenses();
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '-';
  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');
  const totalCommitted = committed.reduce((s, e) => {
    const amt = Number(e.amount);
    if (e.cadence === 'weekly') return s + amt * 4.33;
    if (e.cadence === 'quarterly') return s + amt / 3;
    if (e.cadence === 'semi-annual') return s + amt / 6;
    if (e.cadence === 'annual') return s + amt / 12;
    if (e.cadence === 'once') return s;
    return s + amt;
  }, 0);

  if (loading) return <AppLayout><div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">🚗 Auto Expenses</h1><p className="text-gray-600">Vehicle costs - gas, maintenance, insurance</p></div>
          <Button onClick={() => setShowForm(!showForm)}>+ Add Expense</Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Draft</div><div className="text-2xl font-bold">{draft.length}</div></Card>
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Committed</div><div className="text-2xl font-bold text-green-600">{committed.length}</div></Card>
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Monthly Avg</div><div className="text-2xl font-bold text-blue-600">{fmt(totalCommitted)}</div></Card>
        </div>

        {showForm && (
          <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input className="border rounded px-3 py-2" placeholder="Name (e.g. Shell Gas)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                <select className="border rounded px-3 py-2" value={form.coa_code} onChange={e => setForm({...form, coa_code: e.target.value})}>
                  {COA_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <input className="border rounded px-3 py-2" type="number" step="0.01" placeholder="Amount $" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                <select className="border rounded px-3 py-2" value={form.cadence} onChange={e => setForm({...form, cadence: e.target.value})}>
                  {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input className="border rounded px-3 py-2" type="date" value={form.target_date} onChange={e => setForm({...form, target_date: e.target.value})} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">Save Draft</Button>
              </div>
            </form>
          </Card>
        )}

        {draft.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-700">📝 Draft ({draft.length})</h2>
            {draft.map(e => (
              <Card key={e.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-gray-500">{e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label || e.cadence} • Start: {fmtDate(e.target_date)}</div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="font-bold">{fmt(e.amount)}</span>
                  <Button size="sm" onClick={() => handleAction(e.id, 'commit')} disabled={actionLoading === e.id}>
                    {actionLoading === e.id ? '...' : '✓ Commit'}
                  </Button>
                  <button className="text-red-500 text-sm hover:underline" onClick={() => handleDelete(e.id)}>Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {committed.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-green-700">✓ Committed ({committed.length})</h2>
            {committed.map(e => (
              <Card key={e.id} className="p-4 flex justify-between items-center bg-green-50">
                <div>
                  <div className="font-medium">{e.name} <Badge variant="success">Active</Badge></div>
                  <div className="text-sm text-gray-500">{e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label || e.cadence}</div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="font-bold text-green-700">{fmt(e.amount)}</span>
                  <Button size="sm" variant="secondary" onClick={() => handleAction(e.id, 'uncommit')} disabled={actionLoading === e.id}>
                    {actionLoading === e.id ? '...' : 'Uncommit'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
