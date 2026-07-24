/**
 * DailyPlanRoutineRow — read-only routine row for the Daily Plan merge.
 *
 * Renders one TodayRoutineEntry (from /api/operations/routines/today) inside
 * Section C alongside daily_plan_items. Purely presentational: routines are
 * not deletable or editable from this view, and the mark-as-done affordance
 * is deferred to PR-Ops-4.8.1 — so this component takes no callbacks.
 */

'use client';

import { useState } from 'react';
import type { TodayRoutineEntry, TodayStatus } from '../routines/types';
import { themed, type Surface } from '@/lib/ds';

function formatTime(iso: string, tz?: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz || undefined,
    });
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

function statusPillClass(status: TodayStatus): string {
  const base = 'px-1.5 py-0 border rounded text-xs font-mono';
  switch (status) {
    case 'completed':
      return `${base} bg-green-50 text-green-800 border-green-300`;
    case 'missed':
      return `${base} bg-red-50 text-red-800 border-red-200`;
    case 'pending':
      return `${base} bg-bg-row text-text-muted border-border`;
    case 'upcoming':
      return `${base} bg-purple-50/30 text-text-muted border-border`;
    default:
      return `${base} bg-bg-row text-text-muted border-border`;
  }
}

interface Props {
  entry: TodayRoutineEntry;
}

export function DailyPlanRoutineRow({ surface = 'light', entry }: Props & { surface?: Surface }) {
  const dk = surface === 'dark';
  const [showSteps, setShowSteps] = useState(false);
  const steps = entry.routine.steps ?? [];
  const hasSteps = steps.length > 0;

  return (
    <div className={themed('bg-white border border-border rounded p-3 space-y-2', dk)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={themed('text-xs font-mono text-text-muted', dk)}>[routine]</span>
            <span className={themed('font-mono text-sm text-text-primary font-bold', dk)}>{entry.routine.name}</span>
            <span className={themed(statusPillClass(entry.status), dk)}>{entry.status}</span>
          </div>

          <div className={themed('text-xs font-mono text-text-muted mt-1 flex items-center gap-3 flex-wrap', dk)}>
            <span>expected: {formatTime(entry.expected_at, entry.routine.timezone)}</span>
            {(entry.routine.start_time || entry.routine.end_time) && (
              <span title="intent time window">
                {(() => {
                  const startStr = entry.routine.start_time
                    ? entry.routine.start_time.slice(11, 16)
                    : null;
                  const endStr = entry.routine.end_time
                    ? entry.routine.end_time.slice(11, 16)
                    : null;
                  if (startStr && endStr) return `window: ${startStr}–${endStr}`;
                  if (startStr) return `from ${startStr}`;
                  if (endStr) return `until ${endStr}`;
                  return '';
                })()}
              </span>
            )}
            <span>
              🔥 {entry.routine.consecutive_completion_streak} ✓ / {entry.routine.consecutive_miss_streak} ✗
            </span>
            {hasSteps && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSteps((x) => !x);
                }}
                className={themed('text-text-muted hover:text-text-primary', dk)}
                title={showSteps ? 'hide steps' : 'show steps'}
              >
                {showSteps ? '▾' : '▸'} {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              </button>
            )}
          </div>

          {showSteps && hasSteps && (
            <div className={themed('mt-2 pl-2 border-l-2 border-border-light space-y-1', dk)}>
              {steps.map((step) => (
                <div key={step.id} className={themed('text-xs font-mono text-text-muted', dk)}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {step.time_of_day && (
                      <span className={themed('text-text-primary shrink-0', dk)}>
                        {step.time_of_day.slice(11, 16)}
                      </span>
                    )}
                    <span className={themed('text-text-primary truncate', dk)}>{step.activity}</span>
                    {step.sub_activity && <span>· {step.sub_activity}</span>}
                    {step.location && <span className="shrink-0">@ {step.location}</span>}
                    {step.duration_minutes !== null && (
                      <span className="shrink-0">{step.duration_minutes} min</span>
                    )}
                  </div>
                  {step.notes && (
                    <div className={themed('text-text-muted italic pl-2 mt-0.5', dk)}>{step.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {entry.routine.description && (
            <div className={themed('text-xs font-mono text-text-muted mt-1 italic whitespace-pre-wrap', dk)}>
              {entry.routine.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
