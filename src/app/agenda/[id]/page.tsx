'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge } from '@/components/ui';

interface AgendaItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  cadence: string;
  start_date: string | null;
  end_date: string | null;
  time_block: string | null;
  duration_mins: number;
  intensity: string | null;
  goal: string | null;
  definition_of_done: string[] | null;
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
  vehicle: { icon: '🚗', color: 'bg-bg-row0', label: 'Vehicle' },
};

const CADENCE_LABELS: Record<string, string> = {
  once: 'One-time',
  daily: 'Daily',
  weekdays: 'Weekdays',
  custom: 'Custom',
};

export default function AgendaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<AgendaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    try {
      const res = await fetch(`/api/agenda/${id}`);
      if (res.ok) {
        const data = await res.json();
        setItem(data.item);
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!confirm('Commit this agenda item to your budget? This will create monthly budget entries.')) return;
    setCommitting(true);
    try {
      await fetch(`/api/agenda/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'commit' }),
      });
      await loadItem();
    } catch (err) {
      console.error('Commit failed:', err);
    } finally {
      setCommitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this agenda item?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/agenda/${id}`, { method: 'DELETE' });
      router.push('/agenda');
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!item) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-text-muted">Agenda item not found</p>
          <Button onClick={() => router.push('/agenda')} className="mt-4">
            Back to Agenda
          </Button>
        </div>
      </AppLayout>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[item.category];
  const isCommitted = item.status === 'committed';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/agenda')} className="text-text-faint hover:text-text-secondary">
              ← Back
            </button>
            <span className={`w-14 h-14 ${categoryConfig?.color || 'bg-bg-row0'} rounded flex items-center justify-center text-3xl text-white`}>
              {categoryConfig?.icon || '📋'}
            </span>
            <div>
              <h1 className="text-sm font-bold text-text-primary">{item.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-text-muted">{categoryConfig?.label || item.category}</span>
                <Badge variant={isCommitted ? 'success' : 'warning'}>
                  {isCommitted ? 'Committed' : 'Draft'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Schedule */}
            <Card className="p-6">
              <h2 className="text-terminal-lg font-semibold text-text-primary mb-4">Schedule</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-text-muted">Cadence</div>
                  <div className="font-medium">{CADENCE_LABELS[item.cadence] || item.cadence}</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted">Duration</div>
                  <div className="font-medium">{item.duration_mins} minutes</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted">Time Block</div>
                  <div className="font-medium capitalize">{item.time_block || 'Flexible'}</div>
                </div>
                {item.intensity && (
                  <div>
                    <div className="text-sm text-text-muted">Intensity</div>
                    <div className="font-medium">{item.intensity}</div>
                  </div>
                )}
                {item.start_date && (
                  <div>
                    <div className="text-sm text-text-muted">Start Date</div>
                    <div className="font-medium">{new Date(item.start_date).toLocaleDateString()}</div>
                  </div>
                )}
                {item.end_date && (
                  <div>
                    <div className="text-sm text-text-muted">End Date</div>
                    <div className="font-medium">{new Date(item.end_date).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Goal */}
            {item.goal && (
              <Card className="p-6">
                <h2 className="text-terminal-lg font-semibold text-text-primary mb-2">Goal</h2>
                <p className="text-text-secondary">{item.goal}</p>
              </Card>
            )}

            {/* Definition of Done */}
            {item.definition_of_done && item.definition_of_done.length > 0 && (
              <Card className="p-6">
                <h2 className="text-terminal-lg font-semibold text-text-primary mb-4">Definition of Done</h2>
                <div className="space-y-2">
                  {item.definition_of_done.map((dod, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-bg-row rounded">
                      <span className="text-text-faint">☐</span>
                      <span className="text-text-secondary">{dod}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Budget */}
            <Card className="p-6">
              <h2 className="text-terminal-lg font-semibold text-text-primary mb-4">Budget</h2>
              {item.budget_amount > 0 ? (
                <>
                  <div className="text-3xl font-bold text-brand-accent-dark mb-2">
                    {formatCurrency(item.budget_amount)}<span className="text-sm font-normal text-text-faint">/mo</span>
                  </div>
                  {item.coa_code && (
                    <div className="text-sm text-text-muted">
                      COA: {item.coa_code}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-text-faint">No budget set</div>
              )}
            </Card>

            {/* Actions */}
            <Card className="p-6">
              <h2 className="text-terminal-lg font-semibold text-text-primary mb-4">Actions</h2>
              <div className="space-y-3">
                {!isCommitted && (
                  <Button
                    onClick={handleCommit}
                    disabled={committing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {committing ? 'Committing...' : '✓ Commit to Budget'}
                  </Button>
                )}
                
                {isCommitted && (
                  <div className="p-4 bg-green-50 rounded text-center">
                    <div className="text-brand-green font-medium">✓ Committed</div>
                    <div className="text-sm text-brand-green mt-1">
                      {item.committed_at && new Date(item.committed_at).toLocaleDateString()}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  variant="secondary"
                  className="w-full border-red-200 text-brand-red hover:bg-red-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Item'}
                </Button>
              </div>
            </Card>

            {/* Streak (placeholder) */}
            <Card className="p-6 bg-bg-row">
              <h2 className="text-terminal-lg font-semibold text-text-primary mb-4">Streak</h2>
              <div className="text-center">
                <div className="text-4xl mb-2">🔥</div>
                <div className="text-sm font-bold text-text-primary">0 days</div>
                <div className="text-sm text-text-muted">Check in to start your streak</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
