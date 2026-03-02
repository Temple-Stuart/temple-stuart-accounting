'use client';

import { useEffect, useState } from 'react';

interface Statements {
  incomeStatement: {
    revenue: number;
    expenses: number;
    netIncome: number;
  };
  balanceSheet: {
    assets: number;
    liabilities: number;
    equity: number;
  };
}

interface Entity {
  id: string;
  name: string;
  entity_type: string;
  is_default: boolean;
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statements | null>(null);
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  useEffect(() => {
    fetch('/api/entities')
      .then(res => res.json())
      .then(data => {
        if (data.entities) setEntities(data.entities);
      })
      .catch(err => console.error('Failed to load entities:', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedEntityId) params.set('entityId', selectedEntityId);
    const qs = params.toString();

    fetch(`/api/statements${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then(data => {
        setStatements(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedEntityId]);

  const formatMoney = (dollars: number) => {
    return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) return <div className="p-8">Loading statements...</div>;
  if (!statements) return <div className="p-8">Error loading statements</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Financial Statements</h1>
        {entities.length > 0 && (
          <select
            value={selectedEntityId}
            onChange={e => setSelectedEntityId(e.target.value)}
            className="bg-white border border-border text-text-primary text-sm font-mono px-3 py-1.5"
          >
            <option value="">All Entities</option>
            {entities.map(ent => (
              <option key={ent.id} value={ent.id}>{ent.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="border rounded p-6">
          <h2 className="text-sm font-semibold mb-6">Income Statement</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Revenue</span>
              <span className="font-semibold text-brand-green">{formatMoney(statements.incomeStatement.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Expenses</span>
              <span className="font-semibold text-brand-red">{formatMoney(statements.incomeStatement.expenses)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between text-terminal-lg">
              <span className="font-bold">Net Income</span>
              <span className={`font-bold ${statements.incomeStatement.netIncome >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                {formatMoney(statements.incomeStatement.netIncome)}
              </span>
            </div>
          </div>
        </div>

        <div className="border rounded p-6">
          <h2 className="text-sm font-semibold mb-6">Balance Sheet</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Assets</span>
              <span className="font-semibold">{formatMoney(statements.balanceSheet.assets)}</span>
            </div>
            <div className="flex justify-between">
              <span>Liabilities</span>
              <span className="font-semibold">{formatMoney(statements.balanceSheet.liabilities)}</span>
            </div>
            <div className="flex justify-between">
              <span>Equity</span>
              <span className="font-semibold">{formatMoney(statements.balanceSheet.equity)}</span>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm text-text-secondary">
                Balance Check: Assets = {formatMoney(statements.balanceSheet.assets)}
              </div>
              <div className="text-sm text-text-secondary">
                Liabilities + Equity = {formatMoney(statements.balanceSheet.liabilities + statements.balanceSheet.equity)}
              </div>
              <div className={`text-sm font-semibold ${
                statements.balanceSheet.assets === statements.balanceSheet.liabilities + statements.balanceSheet.equity
                  ? 'text-brand-green'
                  : 'text-brand-red'
              }`}>
                {statements.balanceSheet.assets === statements.balanceSheet.liabilities + statements.balanceSheet.equity
                  ? '✓ Books balanced'
                  : '⚠ Books not balanced'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
