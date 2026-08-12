/**
 * EvolutionTimelineView — the PURE, props-only render of a project's evolution
 * (the read-only trajectory of AI re-runs).
 *
 * Extracted from EvolutionTimeline (PR2). It owns NO data: no fetch, no /api/*
 * call, no data-loading useEffect, no context, no server import. It is FULLY
 * CONTROLLED — `loading`, `error`, and `data` arrive as props (the view is
 * READ-ONLY, so there are no action callbacks). The rendered markup is
 * byte-for-byte equivalent to the pre-extraction EvolutionTimeline output.
 */

'use client';

import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from './types';
import { themed, type Surface } from '@/lib/ds';

export interface EvolutionTask {
  id: string;
  title: string;
  status: string;
}

export interface EvolutionVersion {
  version_number: number;
  usage_id: string;
  created_at: string;
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  task_count: number;
  tasks: EvolutionTask[];
}

export interface EvolutionResponse {
  project_id: string;
  versions: EvolutionVersion[];
  unversioned: EvolutionTask[];
  unversioned_count: number;
}

export interface EvolutionTimelineViewProps {
  loading: boolean;
  error: string | null;
  data: EvolutionResponse | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Status pill, tolerant of statuses outside the TaskStatus union (e.g.
// 'superseded') so a future status never crashes the read view.
function StatusPill({ status, dk = false }: { status: string; dk?: boolean }) {
  const cls =
    (TASK_STATUS_PILL_CLASSES as Record<string, string>)[status] ??
    'bg-gray-50 text-gray-500';
  const label = (TASK_STATUS_LABELS as Record<string, string>)[status] ?? status;
  return (
    <span className={themed(`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${cls}`, dk)}>
      {label}
    </span>
  );
}

function TaskLines({ dk = false, tasks }: { dk?: boolean; tasks: EvolutionTask[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-2 min-w-0">
          <span className={themed('text-text-faint shrink-0', dk)}>+</span>
          <span
            className={
              t.status === 'completed' || t.status === 'cancelled' || t.status === 'superseded'
                ? themed('text-text-muted line-through truncate', dk)
                : themed('text-text-primary truncate', dk)
            }
          >
            {t.title}
          </span>
          <StatusPill dk={dk} status={t.status} />
        </li>
      ))}
    </ul>
  );
}

export default function EvolutionTimelineView({ surface = 'light', loading, error, data }: EvolutionTimelineViewProps & { surface?: Surface }) {
  const dk = surface === 'dark';
  if (loading) {
    return <div className={themed('text-xs text-text-muted', dk)}>loading evolution…</div>;
  }
  if (error) {
    return (
      <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { versions, unversioned } = data;
  const totalTasks =
    versions.reduce((sum, v) => sum + v.task_count, 0) + unversioned.length;

  if (totalTasks === 0) {
    return (
      <div className={themed('text-xs text-text-muted italic', dk)}>
        no tasks yet — generate tasks to start this project&apos;s trajectory.
      </div>
    );
  }

  return (
    <div className="text-xs space-y-3">
      <div className={themed('text-text-muted', dk)}>
        {versions.length} {versions.length === 1 ? 're-run' : 're-runs'}
        {unversioned.length > 0 && ` · ${unversioned.length} unversioned`}
        {' · '}
        {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} total
      </div>

      {/* Vertical timeline. The left border is the spine; each node hangs off it. */}
      <div className={themed('border-l-2 border-border-light pl-4 space-y-3', dk)}>
        {versions.map((v) => (
          <div key={v.usage_id} className="relative">
            {/* node dot, centered on the spine */}
            <span className={`absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full border-2 ${dk ? 'bg-brand-purple-pop border-panel' : 'bg-brand-purple border-white'}`} />
            <div className={themed('border border-border-light rounded bg-white p-3', dk)}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded text-white text-[10px] font-semibold shrink-0 ${dk ? 'bg-brand-purple-pop' : 'bg-brand-purple'}`}>
                    v{v.version_number}
                  </span>
                  <span className={themed('text-text-primary', dk)}>{formatDateTime(v.created_at)}</span>
                  <span className={themed('text-text-muted', dk)}>
                    · added {v.task_count} {v.task_count === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <span className={themed('text-text-faint text-[10px]', dk)}>
                  {v.model} · ${v.cost_usd} · {v.input_tokens} in · {v.output_tokens} out
                </span>
              </div>
              {v.tasks.length > 0 ? (
                <TaskLines dk={dk} tasks={v.tasks} />
              ) : (
                <div className={themed('mt-2 text-text-muted italic', dk)}>
                  (this re-run&apos;s tasks were since deleted)
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Honest unversioned bucket — visually distinct (gray dot, not purple). */}
        {unversioned.length > 0 && (
          <div className="relative">
            <span className={themed('absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white', dk)} />
            <div className={themed('border border-border-light rounded bg-bg-row p-3', dk)}>
              <div className="flex items-center gap-2">
                <span className={themed('px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-semibold', dk)}>
                  original
                </span>
                <span className={themed('text-text-muted', dk)}>
                  tasks created before versioning (no re-run on record)
                </span>
              </div>
              <TaskLines dk={dk} tasks={unversioned} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
