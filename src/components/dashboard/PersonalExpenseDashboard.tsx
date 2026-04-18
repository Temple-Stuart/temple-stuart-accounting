'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════
// PersonalExpenseDashboard — monthly spend chart, category breakdown
// with vendor drill-down, rendered on the Personal bookkeeping tab.
// ═══════════════════════════════════════════════════════════════════

interface MonthlyTotal {
  month: string;
  txnCount: number;
  totalOutflow: number;
}

interface Merchant {
  merchantName: string;
  logoUrl: string | null;
  txnCount: number;
  totalSpend: number;
  avgPerTxn: number;
}

interface Category {
  accountCode: string;
  accountName: string;
  txnCount: number;
  totalSpend: number;
  merchants: Merchant[];
}

interface AnalyticsData {
  monthlyTotals: MonthlyTotal[];
  categoryBreakdown: Category[];
  topMerchants: Merchant[];
}

interface Props {
  entityId: string;
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function PersonalExpenseDashboard({ entityId }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/personal/expense-analytics?months=6');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
        {error}
        <button onClick={loadData} className="ml-2 underline hover:no-underline">Retry</button>
      </div>
    );
  }

  if (!data || data.categoryBreakdown.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No committed expense transactions found for this period.
      </div>
    );
  }

  // Prepare chart data (oldest → newest, left to right)
  const chartData = [...data.monthlyTotals].reverse().map((m, i, arr) => {
    const prev = i > 0 ? arr[i - 1].totalOutflow : m.totalOutflow;
    const direction: 'up' | 'down' | 'flat' =
      m.totalOutflow > prev ? 'up' : m.totalOutflow < prev ? 'down' : 'flat';
    return { ...m, label: fmtMonth(m.month), direction };
  });

  // MoM comparison for the two most recent FULL months
  const sorted = [...data.monthlyTotals].sort((a, b) => b.month.localeCompare(a.month));
  const recentMonth = sorted[0];
  const priorMonth = sorted[1];
  const momPctChange =
    recentMonth && priorMonth && priorMonth.totalOutflow > 0
      ? ((recentMonth.totalOutflow - priorMonth.totalOutflow) / priorMonth.totalOutflow) * 100
      : null;

  const grandTotal = data.categoryBreakdown.reduce((s, c) => s + c.totalSpend, 0);

  const BAR_COLORS: Record<string, string> = { up: '#fca5a5', down: '#86efac', flat: '#93c5fd' };

  return (
    <div className="p-4 space-y-5">
      {/* ── Section A: Monthly Spend Bar Chart ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Monthly spending</h3>
          {momPctChange !== null && recentMonth && (
            <span className="text-xs font-mono text-gray-600">
              {fmtMonth(recentMonth.month)}: {fmtMoney(recentMonth.totalOutflow)}{' '}
              <span className={momPctChange > 0 ? 'text-red-600' : 'text-emerald-600'}>
                {momPctChange > 0 ? '↑' : '↓'}{Math.abs(momPctChange).toFixed(1)}%
              </span>
              {priorMonth && <span className="text-gray-400"> vs {fmtMonth(priorMonth.month)}</span>}
            </span>
          )}
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value: number | undefined) => [fmtMoney(value ?? 0), 'Spend']}
                labelFormatter={(label: string) => label}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Bar dataKey="totalOutflow" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={BAR_COLORS[entry.direction]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section B + C: Category Breakdown Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">By category</h3>
          <span className="text-xs text-gray-500 font-mono">
            {data.categoryBreakdown.length} categories · {fmtMoney(grandTotal)} total
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.categoryBreakdown.map((cat) => {
            const isOpen = expanded.has(cat.accountCode);
            const pct = grandTotal > 0 ? ((cat.totalSpend / grandTotal) * 100).toFixed(1) : '0';
            return (
              <div
                key={cat.accountCode}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(cat.accountCode)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-gray-400 w-3">{isOpen ? '▼' : '▶'}</span>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {cat.accountName}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {cat.txnCount} txn{cat.txnCount === 1 ? '' : 's'} · {pct}%
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-gray-900 shrink-0">
                    {fmtMoney(cat.totalSpend)}
                  </span>
                </button>

                {/* Section C: Vendor mini-table */}
                {isOpen && cat.merchants.length > 0 && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50">
                        <tr className="text-gray-500 font-semibold uppercase tracking-wider">
                          <th className="text-left px-3 py-1.5">Merchant</th>
                          <th className="text-right px-2 py-1.5 w-12">Txns</th>
                          <th className="text-right px-2 py-1.5 w-20">Total</th>
                          <th className="text-right px-3 py-1.5 w-20">Avg/Txn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cat.merchants.map((m) => (
                          <tr key={m.merchantName} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                {m.logoUrl ? (
                                  <img
                                    src={m.logoUrl}
                                    alt=""
                                    className="w-4 h-4 rounded-sm object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-sm bg-gray-200 flex items-center justify-center text-[8px] text-gray-500 font-bold">
                                    {m.merchantName.charAt(0)}
                                  </div>
                                )}
                                <span className="text-gray-800 truncate">
                                  {m.merchantName}
                                </span>
                              </div>
                            </td>
                            <td className="text-right px-2 py-1.5 font-mono text-gray-600">
                              {m.txnCount}
                            </td>
                            <td className="text-right px-2 py-1.5 font-mono text-gray-900">
                              {fmtMoney(m.totalSpend)}
                            </td>
                            <td className="text-right px-3 py-1.5 font-mono text-gray-500">
                              {fmtMoney(m.avgPerTxn)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
