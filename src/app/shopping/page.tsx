'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface ShoppingExpense {
  id: string;
  name: string;
  coa_code: string;
  amount: number;
  cadence: string;
  status: string;
}

const COA_OPTIONS = [
  { code: 'P-8120', name: 'Groceries' },
  { code: 'P-8150', name: 'Clothing & Personal Care' },
  { code: 'P-8310', name: 'Hygiene & Toiletries' },
  { code: 'P-8320', name: 'Cleaning Supplies' },
  { code: 'P-8330', name: 'Kitchen & Household' },
];

export default function ShoppingPage() {
  const [expenses, setExpenses] = useState<ShoppingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', coa_code: 'P-8120', amount: '', cadence: 'monthly' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const res = await fetch('/api/shopping');
      if (res.ok) { const data = await res.json(); setExpenses(data.expenses || []); }
    } catch (err) { console.error('Failed:', err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/shopping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
    if (res.ok) { setShowForm(false); setForm({ name: '', coa_code: 'P-8120', amount: '', cadence: 'monthly' }); loadExpenses(); }
  };

  const handleAction = async (id: string, action: 'commit' | 'uncommit') => {
    if (!confirm(action === 'commit' ? 'Commit?' : 'Uncommit?')) return;
    setActionLoading(id);
    await fetch(`/api/shopping/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    loadExpenses(); setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    await fetch(`/api/shopping/${id}`, { method: 'DELETE' }); loadExpenses();
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');

  if (loading) return <AppLayout><div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">🛒 Shopping</h1><p className="text-gray-600">Groceries, hygiene, household supplies</p></div>
          <Button onClick={() => setShowForm(!showForm)}>+ Add</Button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Draft</div><div className="text-2xl font-bold">{draft.length}</div></Card>
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Committed</div><div className="text-2xl font-bold text-green-600">{committed.length}</div></Card>
          <Card className="p-4 text-center"><div className="text-sm text-gray-500">Monthly</div><div className="text-2xl font-bold text-blue-600">{fmt(committed.reduce((s,e) => s + Number(e.amount), 0))}</div></Card>
        </div>
        {showForm && <Card className="p-4"><form onSubmit={handleSubmit} className="grid grid-cols-5 gap-4">
          <input className="col-span-2 border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <select className="border rounded px-3 py-2" value={form.coa_code} onChange={e => setForm({...form, coa_code: e.target.value})}>{COA_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}</select>
          <input className="border rounded px-3 py-2" type="number" placeholder="$" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
          <Button type="submit">Save</Button>
        </form></Card>}
        <div className="space-y-3">{draft.map(e => <Card key={e.id} className="p-4 flex justify-between"><div><div className="font-medium">{e.name}</div><div className="text-sm text-gray-500">{e.coa_code}</div></div><div className="flex gap-3 items-center"><span className="font-bold">{fmt(e.amount)}</span><Button size="sm" onClick={() => handleAction(e.id, 'commit')} disabled={actionLoading === e.id}>{actionLoading === e.id ? '...' : '✓'}</Button><button className="text-red-500 text-sm" onClick={() => handleDelete(e.id)}>×</button></div></Card>)}</div>
        <div className="space-y-3">{committed.map(e => <Card key={e.id} className="p-4 flex justify-between bg-green-50"><div><div className="font-medium">{e.name} <Badge variant="success">✓</Badge></div><div className="text-sm text-gray-500">{e.coa_code}</div></div><div className="flex gap-3 items-center"><span className="font-bold text-green-700">{fmt(e.amount)}</span><Button size="sm" variant="secondary" onClick={() => handleAction(e.id, 'uncommit')}>Undo</Button></div></Card>)}</div>
      </div>
    </AppLayout>
  );
}
