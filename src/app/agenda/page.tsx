'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface AgendaItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  cadence: string;
  start_date: string | null;
  duration_mins: number;
  intensity: string | null;
  goal: string | null;
  coa_code: string | null;
  budget_amount: number;
  status: string;
  committed_at: string | null;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  build: { icon: '🧱', color: 'bg-blue-500', label: 'Build' },
  fitness: { icon: '💪', color: 'bg-green-500', label: 'Fitness' },
  trading: { icon: '📊', color: 'bg-purple-500', label: 'Trading' },
  community: { icon: '🤝', color: 'bg-orange-500', label: 'Community' },
  shopping: { icon: '🛒', color: 'bg-pink-500', label: 'Shopping' },
  vehicle: { icon: '🚗', color: 'bg-gray-500', label: 'Vehicle' },
};

const CADENCE_LABELS: Record<string, string> = {
  once: 'One-time',
  daily: 'Daily',
  weekdays: 'Weekdays',
  custom: 'Custom',
};

export default function AgendaPage() {
  const router = useRouter();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalItems: 0, draftCount: 0, committedCount: 0, totalBudget: 0 });
  const [filter, setFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const res = await fetch('/api/agenda');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSummary(data.summary || { totalItems: 0, draftCount: 0, committedCount: 0, totalBudget: 0 });
      }
    } catch (err) {
      console.error('Failed to load agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agenda item?')) return;
    setDeleting(id);
    try {
      await fetch(`/api/agenda/${id}`, { method: 'DELETE' });
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(i => i.category === filter);

  const draftItems = filteredItems.filter(i => i.status === 'draft');
  const committedItems = filteredItems.filter(i => i.status === 'committed');

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
            <span className="text-4xl">📋</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
              <p className="text-gray-500">Plan your routine - Build, Fitness, Trading, Community</p>
            </div>
          </div>
          <Button onClick={() => router.push('/agenda/new')} className="bg-[#b4b237] hover:bg-[#9a982f] text-white">
            + New Agenda Item
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4">
            <div className="text-sm text-gray-500">Total Items</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalItems}</div>
          </div>
          <div className="p-4">
            <div className="text-sm text-gray-500">Draft</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.draftCount}</div>
          </div>
          <div className="p-4">
            <div className="text-sm text-gray-500">Committed</div>
            <div className="text-2xl font-bold text-green-600">{summary.committedCount}</div>
          </div>
          <div className="p-4 bg-[#b4b237]/10">
            <div className="text-sm text-[#8f8c2a]">Monthly Budget</div>
            <div className="text-2xl font-bold text-[#8f8c2a]">{formatCurrency(summary.totalBudget)}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({items.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = items.filter(i => i.category === key).length;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                  filter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{config.icon}</span>
                {config.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Draft Items */}
        {draftItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
              Draft ({draftItems.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {draftItems.map(item => (
                <div
                  key={item.id}
                  className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-yellow-400"
                  onClick={() => router.push(`/agenda/${item.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 ${CATEGORY_CONFIG[item.category]?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center text-white`}>
                        {CATEGORY_CONFIG[item.category]?.icon || '📋'}
                      </span>
                      <Badge variant="warning">Draft</Badge>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      disabled={deleting === item.id}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      {deleting === item.id ? '...' : '✕'}
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                  <div className="text-sm text-gray-500 mb-2">
                    {CADENCE_LABELS[item.cadence] || item.cadence} • {item.duration_mins} min
                  </div>
                  {item.goal && (
                    <p className="text-sm text-gray-600 truncate">{item.goal}</p>
                  )}
                  {item.budget_amount > 0 && (
                    <div className="mt-2 text-sm font-medium text-[#8f8c2a]">
                      {formatCurrency(item.budget_amount)}/mo
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Committed Items */}
        {committedItems.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Committed ({committedItems.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {committedItems.map(item => (
                <div
                  key={item.id}
                  className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-green-500"
                  onClick={() => router.push(`/agenda/${item.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 ${CATEGORY_CONFIG[item.category]?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center text-white`}>
                        {CATEGORY_CONFIG[item.category]?.icon || '📋'}
                      </span>
                      <Badge variant="success">Committed</Badge>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                  <div className="text-sm text-gray-500 mb-2">
                    {CADENCE_LABELS[item.cadence] || item.cadence} • {item.duration_mins} min
                  </div>
                  {item.goal && (
                    <p className="text-sm text-gray-600 truncate">{item.goal}</p>
                  )}
                  {item.budget_amount > 0 && (
                    <div className="mt-2 text-sm font-medium text-green-600">
                      {formatCurrency(item.budget_amount)}/mo
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No agenda items yet</h3>
            <p className="text-gray-500 mb-6">Plan your routine with Build, Fitness, Trading, and Community blocks</p>
            <Button onClick={() => router.push('/agenda/new')} className="bg-[#b4b237] hover:bg-[#9a982f] text-white">
              Create Your First Agenda Item
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
