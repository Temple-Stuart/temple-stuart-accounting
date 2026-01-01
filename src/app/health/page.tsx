'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface Expense { id: string; name: string; coa_code: string; amount: number; cadence: string; target_date: string | null; status: string; }

const COA_OPTIONS = [
  { code: 'P-8130', name: 'Healthcare & Medical' },
  { code: 'P-8140', name: 'Health Insurance' },
  { code: 'P-8410', name: 'Gym & Fitness' },
  { code: 'P-8420', name: 'Supplements & Vitamins' },
  { code: 'P-8430', name: 'Mental Health' },
];

const CADENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-annually' },
  { value: 'annual', label: 'Annually' },
];

export default function HealthPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', coa_code: 'P-8410', amount: '', cadence: 'monthly', target_date: new Date().toISOString().split('T')[0] });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, []);
  const loadExpenses = async () => { try { const res = await fetch('/api/health'); if (res.ok) { const data = await res.json(); setExpenses(data.expenses || []); } } catch (err) { console.error(err); } finally { setLoading(false); } };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); const res = await fetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) }); if (res.ok) { setShowForm(false); setForm({ name: '', coa_code: 'P-8410', amount: '', cadence: 'monthly', target_date: new Date().toISOString().split('T')[0] }); loadExpenses(); } };
  const handleAction = async (id: string, action: 'commit' | 'uncommit') => { if (!confirm(action === 'commit' ? 'Commit?' : 'Uncommit?')) return; setActionLoading(id); await fetch(`/api/health/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); loadExpenses(); setActionLoading(null); };
  const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; await fetch(`/api/health/${id}`, { method: 'DELETE' }); loadExpenses(); };
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '-';
  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');

  if (loading) return <AppLayout><div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">💪 Health</h1><p className="text-gray-600">Medical, insurance, fitness, wellness</p></div>
          <Button onClick={() => setShowForm(!showForm)}>+ Add</Button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Draft</div><div className="text-2xl font-bold">{draft.length}</div></Card>
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Committed</div><div className="text-2xl font-bold text-green-600">{committed.length}</div></Card>
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Items</div><div className="text-2xl font-bold text-emerald-600">{expenses.length}</div></Card>
        </div>
        {showForm && <Card className="p-4"><form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input className="border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            <select className="border rounded px-3 py-2" value={form.coa_code} onChange={e => setForm({...form, coa_code: e.target.value})}>{COA_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}</select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <input className="border rounded px-3 py-2" type="number" step="0.01" placeholder="$" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            <select className="border rounded px-3 py-2" value={form.cadence} onChange={e => setForm({...form, cadence: e.target.value})}>{CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <input className="border rounded px-3 py-2" type="date" value={form.target_date} onChange={e => setForm({...form, target_date: e.target.value})} required />
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form></Card>}
        {draft.length > 0 && <div className="space-y-3"><h2 className="font-semibold text-gray-700">📝 Draft ({draft.length})</h2>
          {draft.map(e => <Card key={e.id} className="p-4 flex justify-between items-center"><div><div className="font-medium">{e.name}</div><div className="text-sm text-gray-500">{e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label} • {fmtDate(e.target_date)}</div></div><div className="flex gap-3 items-center"><span className="font-bold">{fmt(e.amount)}</span><Button size="sm" onClick={() => handleAction(e.id, 'commit')} disabled={actionLoading === e.id}>{actionLoading === e.id ? '...' : '✓'}</Button><button className="text-red-500 text-sm" onClick={() => handleDelete(e.id)}>×</button></div></Card>)}
        </div>}
        {committed.length > 0 && <div className="space-y-3"><h2 className="font-semibold text-green-700">✓ Committed ({committed.length})</h2>
          {committed.map(e => <Card key={e.id} className="p-4 flex justify-between items-center bg-green-50"><div><div className="font-medium">{e.name} <Badge variant="success">Active</Badge></div><div className="text-sm text-gray-500">{e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label}</div></div><div className="flex gap-3 items-center"><span className="font-bold text-green-700">{fmt(e.amount)}</span><Button size="sm" variant="secondary" onClick={() => handleAction(e.id, 'uncommit')}>Undo</Button></div></Card>)}
        </div>}
      </div>
    </AppLayout>
  );
}
