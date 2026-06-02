/**
 * EvolutionTimeline — read-only project trajectory.
 *
 * Renders a project's evolution as a vertical timeline of AI re-runs
 * (versions), each node showing when the re-run happened and which tasks
 * it added (the append-only loop made visible). Tasks created before
 * versioning (NULL source_ai_usage_id) appear in an honest, clearly
 * labeled "original / pre-versioning" bucket — never folded into a
 * re-run, never hidden.
 *
 * Self-fetches GET /api/operations/projects/[projectId]/evolution when
 * mounted. READ-ONLY: no edit/delete/create affordances. Matches the
 * Projects-surface design language (font-mono, brand-purple accents,
 * border-border-light cards, the status pill tokens from ./types).
 */

'use client';

import { useEffect, useState } from 'react';
import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from './types';

interface EvolutionTask {
  id: string;
  title: string;
  status: string;
}

interface EvolutionVersion {
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

interface EvolutionResponse {
  project_id: string;
  versions: EvolutionVersion[];
  unversioned: EvolutionTask[];
  unversioned_count: number;
}

interface Props {
  projectId: string;
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
function StatusPill({ status }: { status: string }) {
  const cls =
    (TASK_STATUS_PILL_CLASSES as Record<string, string>)[status] ??
    'bg-gray-50 text-gray-500 border-gray-200';
  const label = (TASK_STATUS_LABELS as Record<string, string>)[status] ?? status;
  return (
    <span className={`inline-block px-1.5 py-0.5 border rounded text-[10px] font-mono shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function TaskLines({ tasks }: { tasks: EvolutionTask[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-2 min-w-0">
          <span className="text-text-faint shrink-0">+</span>
          <span
            className={
              t.status === 'completed' || t.status === 'cancelled' || t.status === 'superseded'
                ? 'text-text-muted line-through truncate'
                : 'text-text-primary truncate'
            }
          >
            {t.title}
          </span>
          <StatusPill status={t.status} />
        </li>
      ))}
    </ul>
  );
}

export default function EvolutionTimeline({ projectId }: Props) {
  const [data, setData] = useState<EvolutionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/operations/projects/${projectId}/evolution`);
        const body = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(body?.message ?? body?.error ?? 'failed to load evolution');
          return;
        }
        if (!cancelled) setData(body as EvolutionResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load evolution');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return <div className="text-xs font-mono text-text-muted">loading evolution…</div>;
  }
  if (error) {
    return (
      <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
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
      <div className="text-xs font-mono text-text-muted italic">
        no tasks yet — generate tasks to start this project&apos;s trajectory.
      </div>
    );
  }

  return (
    <div className="text-xs font-mono space-y-3">
      <div className="text-text-muted">
        {versions.length} {versions.length === 1 ? 're-run' : 're-runs'}
        {unversioned.length > 0 && ` · ${unversioned.length} unversioned`}
        {' · '}
        {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} total
      </div>

      {/* Vertical timeline. The left border is the spine; each node hangs off it. */}
      <div className="border-l-2 border-border-light pl-4 space-y-3">
        {versions.map((v) => (
          <div key={v.usage_id} className="relative">
            {/* node dot, centered on the spine */}
            <span className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-brand-purple border-2 border-white" />
            <div className="border border-border-light rounded bg-white p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-brand-purple text-white text-[10px] font-semibold shrink-0">
                    v{v.version_number}
                  </span>
                  <span className="text-text-primary">{formatDateTime(v.created_at)}</span>
                  <span className="text-text-muted">
                    · added {v.task_count} {v.task_count === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <span className="text-text-faint text-[10px]">
                  {v.model} · ${v.cost_usd} · {v.input_tokens} in · {v.output_tokens} out
                </span>
              </div>
              {v.tasks.length > 0 ? (
                <TaskLines tasks={v.tasks} />
              ) : (
                <div className="mt-2 text-text-muted italic">
                  (this re-run&apos;s tasks were since deleted)
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Honest unversioned bucket — visually distinct (gray dot, not purple). */}
        {unversioned.length > 0 && (
          <div className="relative">
            <span className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white" />
            <div className="border border-border-light rounded bg-bg-row p-3">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-semibold">
                  original
                </span>
                <span className="text-text-muted">
                  tasks created before versioning (no re-run on record)
                </span>
              </div>
              <TaskLines tasks={unversioned} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
