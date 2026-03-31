'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Button, Badge } from '@/components/ui';
import COAManagementTable from '@/components/bookkeeping/COAManagementTable';

interface Expense {
  id: string;
  name: string;
  coa_code: string;
  amount: number;
  cadence: string;
  target_date: string | null;
  status: string;
}

interface COAAccount {
  code: string;
  name: string;
}

const CADENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-annual' },
  { value: 'annual', label: 'Annual' },
];

export interface BudgetingPageProps {
  category: string;
  emoji: string;
  apiPath: string;
}

export default function BudgetingPage({ category, emoji, apiPath }: BudgetingPageProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<COAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', coa_code: '', amount: '', cadence: 'monthly', target_date: new Date().toISOString().split('T')[0] });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); loadEntity(); }, []);

  const loadEntity = async () => {
    try {
      const res = await fetch('/api/entities');
      if (res.ok) {
        const data = await res.json();
        const categoryLower = category.toLowerCase();
        const matchTypes = categoryLower === 'business'
          ? ['business', 'sole_prop']
          : [categoryLower];
        const entity = (data.entities || []).find((e: any) => matchTypes.includes(e.entity_type));
        if (entity) setEntityId(entity.id);
      }
    } catch (err) { console.error('Failed to load entity:', err); }
  };

  const loadExpenses = async () => {
    try {
      const res = await fetch(apiPath);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setCoaAccounts(data.coaAccounts || []);
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
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
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
    await fetch(`${apiPath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    loadExpenses();
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await fetch(`${apiPath}/${id}`, { method: 'DELETE' });
    loadExpenses();
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '\u2014';
  const draft = expenses.filter(e => e.status === 'draft');
  const committed = expenses.filter(e => e.status === 'committed');
  const totalCommitted = committed.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        {/* Budget Section */}
        <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
          <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase text-white/60 font-mono tracking-wider">{category.slice(0, 4).toUpperCase()}</span>
              <span>{emoji} {category}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/70">
                {draft.length} draft · {committed.length} committed · Total: {fmt(totalCommitted)}
              </span>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>+ ADD</Button>
            </div>
          </div>
          <div className="bg-white">
            {/* Add Form */}
            {showForm && (
              <div className="border-b border-gray-200/50 p-3">
                <form onSubmit={handleSubmit} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="border border-border rounded px-2 py-1 text-terminal-base font-mono bg-white focus:border-brand-purple outline-none"
                      placeholder="Expense name"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                    />
                    <select
                      className="border border-border rounded px-2 py-1 text-terminal-base font-mono bg-white focus:border-brand-purple outline-none"
                      value={form.coa_code}
                      onChange={e => setForm({ ...form, coa_code: e.target.value })}
                      required
                    >
                      {coaAccounts.length === 0 && <option value="">No accounts found</option>}
                      {coaAccounts.map(o => <option key={o.code} value={o.code}>{o.code} - {o.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="border border-border rounded px-2 py-1 text-terminal-base font-mono bg-white focus:border-brand-purple outline-none"
                      type="number"
                      step="0.01"
                      placeholder="Amount $"
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                    <select
                      className="border border-border rounded px-2 py-1 text-terminal-base font-mono bg-white focus:border-brand-purple outline-none"
                      value={form.cadence}
                      onChange={e => setForm({ ...form, cadence: e.target.value })}
                    >
                      {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input
                      className="border border-border rounded px-2 py-1 text-terminal-base font-mono bg-white focus:border-brand-purple outline-none"
                      type="date"
                      value={form.target_date}
                      onChange={e => setForm({ ...form, target_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={!form.coa_code}>Save</Button>
                  </div>
                </form>
              </div>
            )}

            {/* No COA Warning */}
            {coaAccounts.length === 0 && (
              <div className="bg-amber-50 border-b border-brand-amber/30 px-3 py-2 flex items-start gap-2">
                <span className="text-terminal-base">⚠️</span>
                <div>
                  <span className="text-terminal-sm font-semibold text-brand-amber">No {category} Accounts Found</span>
                  <p className="text-terminal-xs text-text-muted mt-0.5">
                    Create Chart of Accounts entries to track {category.toLowerCase()} expenses. Go to Chart of Accounts to add them.
                  </p>
                </div>
              </div>
            )}

            {/* Budget Entries Table */}
            {expenses.length > 0 && (
              <table className="w-full text-terminal-base border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary">NAME</th>
                    <th className="px-2 py-1.5 text-left text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary w-20">COA</th>
                    <th className="px-2 py-1.5 text-left text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary w-20">CADENCE</th>
                    <th className="px-2 py-1.5 text-left text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary w-20">DATE</th>
                    <th className="px-2 py-1.5 text-right text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary w-24">AMOUNT</th>
                    <th className="px-2 py-1.5 text-center text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary w-20">STATUS</th>
                    <th className="px-2 py-1.5 text-right text-terminal-xs font-semibold uppercase tracking-widest font-mono text-text-secondary w-28">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((e, i) => (
                    <tr key={e.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-bg-row'} border-b border-border-light hover:bg-brand-purple-deep/[.05]`}>
                      <td className="px-2 py-1 text-text-primary font-medium">{e.name}</td>
                      <td className="px-2 py-1 text-text-muted font-mono">{e.coa_code}</td>
                      <td className="px-2 py-1 text-text-secondary">{CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label || e.cadence}</td>
                      <td className="px-2 py-1 text-text-muted font-mono">{fmtDate(e.target_date)}</td>
                      <td className="px-2 py-1 text-right font-mono font-semibold">{fmt(e.amount)}</td>
                      <td className="px-2 py-1 text-center"><Badge variant="warning" size="sm">Draft</Badge></td>
                      <td className="px-2 py-1 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Button size="sm" onClick={() => handleAction(e.id, 'commit')} disabled={actionLoading === e.id}>
                            {actionLoading === e.id ? '...' : 'Commit'}
                          </Button>
                          <button className="text-brand-red text-terminal-sm hover:text-brand-red px-1" onClick={() => handleDelete(e.id)}>×</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {committed.map((e, i) => (
                    <tr key={e.id} className={`${(draft.length + i) % 2 === 0 ? 'bg-white' : 'bg-bg-row'} border-b border-border-light hover:bg-brand-purple-deep/[.05]`}>
                      <td className="px-2 py-1 text-text-primary font-medium">{e.name}</td>
                      <td className="px-2 py-1 text-text-muted font-mono">{e.coa_code}</td>
                      <td className="px-2 py-1 text-text-secondary">{CADENCE_OPTIONS.find(c => c.value === e.cadence)?.label || e.cadence}</td>
                      <td className="px-2 py-1 text-text-muted font-mono">{fmtDate(e.target_date)}</td>
                      <td className="px-2 py-1 text-right font-mono font-semibold text-brand-green">{fmt(e.amount)}</td>
                      <td className="px-2 py-1 text-center"><Badge variant="success" size="sm">Active</Badge></td>
                      <td className="px-2 py-1 text-right">
                        <Button size="sm" variant="secondary" onClick={() => handleAction(e.id, 'uncommit')} disabled={actionLoading === e.id}>
                          {actionLoading === e.id ? '...' : 'Undo'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Empty State */}
            {expenses.length === 0 && coaAccounts.length > 0 && (
              <div className="px-4 py-6 text-center">
                <span className="text-terminal-lg">{emoji}</span>
                <p className="text-terminal-sm text-text-muted mt-1 font-mono">No {category.toLowerCase()} expenses yet</p>
                <p className="text-terminal-xs text-text-faint mt-0.5">Click "+ ADD" to create your first entry</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart of Accounts Management */}
        {entityId && (
          <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
            <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase text-white/60 font-mono tracking-wider">COA</span>
                <span>Chart of Accounts</span>
              </div>
              <span className="text-xs text-white/70">{category}</span>
            </div>
            <div className="bg-white p-3">
              <COAManagementTable
                entityId={entityId}
                entityName={category}
                entityType={category.toLowerCase()}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
