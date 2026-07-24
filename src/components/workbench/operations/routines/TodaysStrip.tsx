/**
 * TodaysStrip — today's pending/completed/missed routines with mark-complete.
 *
 * Self-fetches GET /api/operations/routines/today on mount. Renders one row
 * per active routine with an occurrence in today's window. Click ✓ →
 * POST /api/operations/routines/[id]/completions with the expected_at.
 *
 * Statuses:
 *   pending   — expected_at <= now, not yet completed, within fail threshold
 *   completed — completion row exists for expected_at
 *   missed    — past fail threshold without completion
 *   upcoming  — expected_at > now
 *
 * On successful completion, the parent's onCommitted callback fires so the
 * cadence-grouped list refetches its streak counters too.
 */

'use client';

import { useEffect, useState } from 'react';
import type { TodayStatus } from './types';
import { formatBudgetPerOccurrence } from './types';
import { themed, type Surface } from '@/lib/ds';

interface TodayEntry {
  routine: {
    id: string;
    name: string;
    timezone: string;
    fail_threshold_minutes: number;
    consecutive_completion_streak: number;
    consecutive_miss_streak: number;
    // ROUTINES-UX-2: ALREADY in the payload as merged — the today route
    // returns FULL operations_routines rows (findMany with include, no
    // select; today/route.ts entries push `routine: r`), so budget_amount
    // (Decimal → JSON string) + coa_code ride every entry. This interface
    // was just a narrow view; widening it types existing data — zero new
    // fetches, zero route changes.
    budget_amount?: string | null;
    coa_code?: string | null;
  };
  expected_at: string;
  status: TodayStatus;
  completion: { id: string; completed_at: string; delta_minutes: number; notes: string | null } | null;
}

interface Props {
  onCommitted?: () => void;
}

const STATUS_PILL: Record<TodayStatus, string> = {
  pending: 'bg-amber-50 text-amber-800',
  completed: 'bg-green-50 text-green-800',
  missed: 'bg-red-50 text-red-800',
  upcoming: 'bg-blue-50 text-blue-800',
};

const STATUS_LABEL: Record<TodayStatus, string> = {
  pending: 'pending',
  completed: 'completed',
  missed: 'missed',
  upcoming: 'upcoming',
};

function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TodaysStrip({ surface = 'light', onCommitted }: Props & { surface?: Surface }) {
  const dk = surface === 'dark';
  const [entries, setEntries] = useState<TodayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/routines/today');
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load today');
        setEntries([]);
        return;
      }
      setEntries(body.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load today');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  const handleComplete = async (routineId: string, expectedAt: string) => {
    setCompletingId(routineId);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routineId}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_at: expectedAt }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to mark complete');
        return;
      }
      fetchToday();
      onCommitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to mark complete');
    } finally {
      setCompletingId(null);
    }
  };

  const totalDue = entries.filter((e) => e.status === 'pending' || e.status === 'upcoming').length;
  const totalDone = entries.filter((e) => e.status === 'completed').length;
  const totalMissed = entries.filter((e) => e.status === 'missed').length;

  if (loading) {
    return <div className={themed('text-xs text-text-muted', dk)}>loading today's routines…</div>;
  }

  if (entries.length === 0) {
    return (
      <div className={themed('text-xs text-text-muted italic', dk)}>
        no routines scheduled for today.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className={themed('text-text-muted', dk)}>
          {totalDone} done · {totalDue} due · {totalMissed} missed
        </div>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-1">
        {entries.map((e) => {
          const pillClass = `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[e.status]}`;
          const canComplete = e.status === 'pending' || e.status === 'upcoming' || e.status === 'missed';
          return (
            <div
              key={e.routine.id}
              className={themed('flex items-center justify-between gap-2 py-1.5 px-3 border border-border-light rounded bg-white text-xs', dk)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={themed('text-text-muted shrink-0 w-14 text-right tabular-nums', dk)}>
                  {formatTime(e.expected_at, e.routine.timezone)}
                </span>
                <span className={
                  e.status === 'completed'
                    ? themed('text-text-muted line-through truncate', dk)
                    : themed('text-text-primary truncate', dk)
                }>
                  {e.routine.name}
                </span>
                <span className={pillClass}>{STATUS_LABEL[e.status]}</span>
                {e.status === 'completed' && e.completion && (
                  <span className={themed('text-text-muted', dk)}>
                    Δ {e.completion.delta_minutes} min
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* ROUTINES-UX-2: the occurrence's money — the same mono cell
                    as the routine row (one shared formatter). For a single due
                    item the amount IS this occurrence's budget, so the bare
                    figure is the tightest honest form; the lifted form label
                    rides the title. Null → nothing renders. */}
                {e.routine.budget_amount != null && (
                  <span
                    className={themed('font-mono tabular-nums font-bold text-text-primary', dk)}
                    title="budget / occurrence"
                  >
                    {formatBudgetPerOccurrence(e.routine.budget_amount)}
                  </span>
                )}
                {canComplete && (
                  <button
                    type="button"
                    onClick={() => handleComplete(e.routine.id, e.expected_at)}
                    disabled={completingId === e.routine.id}
                    className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs"
                    title="Mark this occurrence as completed"
                  >
                    {completingId === e.routine.id ? '…' : '✓ mark done'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
