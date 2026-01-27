'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface Expense { id: string; name: string; coa_code: string; amount: number; cadence: string; target_date: string | null; status: string; }
interface COAAccount { code: string; name: string; }

const CADENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-annually' },
  { value: 'annual', label: 'Annually' },
];

export default function BusinessPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<COAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', coa_code: '', amount: '', cadence: 'monthly', target_date: new Date().toISOString().split('T')[0] });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, []);
  
  const loadExpenses = async () => { 
    try { 
      const res = await fetch('/api/business'); 
      if (res.ok) { 
        const data = await res.json(); 
        setExpenses(data.expenses || []); 
        setCoaAccounts(data.coaAccounts || []);
        // Set default COA if available
        if (data.coaAccounts?.length && !form.coa_code) {
          setForm(f => ({ ...f, coa_code: data.coaAccounts[0].code }));
        }
      } 
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    } 
  };
  
  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const res = await fetch('/api/business', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) 
    }); 
    if (res.ok) { 
      setShowForm(false); 
      setForm({ name: '', coa_code: coaAccounts[0]?.code || '', amount: '', cadence: 'monthly', target_date: new Date().toISOString().split('T')[0] }); 
      loadExpenses(); 
    } 
  };
  
  const handleAction = async (id: string, action: 'commit' | 'uncommit') => { 
    if (!confirm(action === 'commit' ? 'Commit this expense to the budget?' : 'Uncommit this expense?')) return; 
    setActionLoading(id); 
    await fetch(`/api/business/${id}`, { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ action }) 
    }); 
    loadExpenses(); 
    setActionLoading(null); 
  };
  
  const handleDelete = async (id: string) => { 
    if (!confirm('Delete this expense?')) return; 
    await fetch(`/api/business/${id}`, { method: 'DELETE' }); 
    loadExpenses(); 
  };
  
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '-';
  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');
  const totalCommitted = committed.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) return <AppLayout><div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">💼 Business</h1>
            <p className="text-gray-600">Business expenses tracked on personal cards</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>+ Add Expense</Button>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">Draft</div>
            <div className="text-2xl font-bold">{draft.length}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">Committed</div>
            <div className="text-2xl font-bold text-green-600">{committed.length}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">Monthly Budget</div>
            <div className="text-2xl font-bold text-indigo-600">{fmt(totalCommitted)}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-gray-500">COA Accounts</div>
            <div className="text-2xl font-bold text-purple-600">{coaAccounts.length}</div>
          </Card>
        </div>

        {/* Add Form */}
        {showForm && (
          <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input 
                  className="border rounded px-3 py-2" 
                  placeholder="Expense name (e.g., Claude Pro)" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  required 
                />
                <select 
                  className="border rounded px-3 py-2" 
                  value={form.coa_code} 
                  onChange={e => setForm({...form, coa_code: e.target.value})}
                  required
                >
                  {coaAccounts.length === 0 && <option value="">No B- accounts found</option>}
                  {coaAccounts.map(o => <option key={o.code} value={o.code}>{o.code} - {o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <input 
                  className="border rounded px-3 py-2" 
                  type="number" 
                  step="0.01" 
                  placeholder="Amount $" 
                  value={form.amount} 
                  onChange={e => setForm({...form, amount: e.target.value})} 
                  required 
                />
                <select 
                  className="border rounded px-3 py-2" 
                  value={form.cadence} 
                  onChange={e => setForm({...form, cadence: e.target.value})}
                >
                  {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input 
                  className="border rounded px-3 py-2" 
                  type="date" 
                  value={form.target_date} 
                  onChange={e => setForm({...form, target_date: e.target.value})} 
                  required 
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={!form.coa_code}>Save</Button>
              </div>
            </form>
          </Card>
        )}

        {/* No COA Accounts Warning */}
        {coaAccounts.length === 0 && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-medium text-amber-900">No Business Accounts Found</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Create Chart of Accounts with B- prefix (e.g., B-6100 Software & Tools) to track business expenses.
                  Go to Chart of Accounts to add them.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Draft Expenses */}
        {draft.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-700">📝 Draft ({draft.length})</h2>
            {draft.map(e => (
              <Card key={e.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-gray-500">
                    {e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label} • {fmtDate(e.target_date)}
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="font-bold text-indigo-600">{fmt(e.amount)}</span>
                  <Button size="sm" onClick={() => handleAction(e.id, 'commit')} disabled={actionLoading === e.id}>
                    {actionLoading === e.id ? '...' : '✓ Commit'}
                  </Button>
                  <button className="text-red-500 text-sm hover:text-red-700" onClick={() => handleDelete(e.id)}>×</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Committed Expenses */}
        {committed.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-green-700">✓ Committed ({committed.length})</h2>
            {committed.map(e => (
              <Card key={e.id} className="p-4 flex justify-between items-center bg-green-50">
                <div>
                  <div className="font-medium">{e.name} <Badge variant="success">Active</Badge></div>
                  <div className="text-sm text-gray-500">
                    {e.coa_code} • {CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label}
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="font-bold text-green-700">{fmt(e.amount)}</span>
                  <Button size="sm" variant="secondary" onClick={() => handleAction(e.id, 'uncommit')}>
                    Undo
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {expenses.length === 0 && coaAccounts.length > 0 && (
          <Card className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-3">💼</div>
            <p className="font-medium">No business expenses yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "+ Add Expense" to create your first business expense</p>
          </Card>
        )}

        {/* Info */}
        <Card className="p-4 bg-indigo-50 border-indigo-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-medium text-indigo-900">How it works</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Add recurring business expenses (software, contractors, etc.) and commit them to create budget entries.
                Committed expenses appear in the Hub's Business Budget section and are included in the calculator.
                Actuals are tracked when you map transactions to B-xxxx accounts.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
