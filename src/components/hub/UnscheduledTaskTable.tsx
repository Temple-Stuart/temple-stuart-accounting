/**
 * UnscheduledTaskTable — the Hub's pool of tasks not yet on the calendar,
 * grouped into one bounded queue card per project (stacked vertically). Tasks
 * arrive grouped + sorted by the endpoint (orderBy [project_id, display_order,
 * id]); the component groups by project.id preserving that order. Each queue
 * caps at ~6 visible rows then scrolls internally, so all project headers stay
 * scannable regardless of queue size. Queues are collapsible per-header and
 * start collapsed on load; the header (title + count) stays visible when folded.
 *
 * Each row exposes an inline "assign" form (day + start/end time + optional
 * category/cost) that POSTs to the atomic /api/operations/tasks/[id]/assign
 * endpoint. On success the parent refetches the calendar blocks (the task
 * renders) and the pool (the task leaves). On a 409 time conflict the user is
 * shown the conflict and an explicit "schedule anyway" choice — never a silent
 * placement. A single shared open-form state means one task is assigned at a
 * time across all queues.
 *
 * blocked tasks are returned by the pool endpoint but dimmed + chipped so
 * they're visible, never silently slotted or hidden.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

export interface UnscheduledTask {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'blocked';
  estimated_minutes: number | null;
  estimated_cost_usd: string | null;
  coa_code: string | null;
  deadline: string | null;
  display_order: number;
  project: { id: string; title: string; entity_id: string };
}

interface Props {
  tasks: UnscheduledTask[];
  onAssigned: () => void;
}

const STATUS_CHIP: Record<UnscheduledTask['status'], string> = {
  open: 'bg-bg-row text-text-muted border-border',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
  blocked: 'bg-amber-50 text-amber-800 border-amber-300',
};

function fmtCost(s: string | null): string {
  if (s == null) return '—';
  const n = Number(s);
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
}

function fmtMinutes(m: number | null): string {
  return m == null ? '—' : `${m}m`;
}

/** Combine a YYYY-MM-DD + HH:MM (local wall clock) into an ISO instant. */
function toIso(planDate: string, time: string): string | null {
  if (!planDate || !time) return null;
  const d = new Date(`${planDate}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface ProjectQueue {
  projectId: string;
  projectTitle: string;
  tasks: UnscheduledTask[];
}

export default function UnscheduledTaskTable({ tasks, onAssigned }: Props) {
  // Single shared open form across ALL queues — opening an assign form in one
  // queue closes any open form elsewhere. One task assigned at a time.
  const [openId, setOpenId] = useState<string | null>(null);

  // Group into per-project queues. Tasks arrive contiguous-per-project and
  // pre-sorted (server orderBy [project_id, display_order, id]); we build
  // groups by first-seen project.id and push in arrival order — preserving the
  // server order with NO client-side re-sort. Group on project.id (UUID),
  // never project.title.
  const queues = useMemo<ProjectQueue[]>(() => {
    const byId = new Map<string, ProjectQueue>();
    for (const t of tasks) {
      let q = byId.get(t.project.id);
      if (!q) {
        q = { projectId: t.project.id, projectTitle: t.project.title, tasks: [] };
        byId.set(t.project.id, q);
      }
      q.tasks.push(t);
    }
    return Array.from(byId.values());
  }, [tasks]);

  // Collapse is tracked as the set of EXPANDED project ids — the inverse of a
  // collapsed set. Empty = all collapsed, which is BOTH the load default AND
  // makes any newly-appearing project collapsed for free: an id the user never
  // expanded is simply absent, so it renders collapsed with no seeding, no
  // reset on `tasks` change, and no first-paint flash. A queue the user
  // expanded keeps its id across an assign-refetch (the id is stable
  // project.id), so it stays open. Ephemeral only — resets on reload, never
  // persisted. The effect below prunes ids for projects that have left the
  // pool (all their tasks scheduled) so a project that later reappears starts
  // collapsed again; it only removes dead ids and never alters a live
  // project's state.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleQueue = (projectId: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

  useEffect(() => {
    setExpandedIds((prev) => {
      const live = new Set(queues.map((q) => q.projectId));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [queues]);

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-mono font-bold text-text-primary">Unscheduled Tasks</h3>
        <span className="text-xs font-mono text-text-muted">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="border border-border rounded bg-white px-4 py-6 text-xs font-mono text-text-muted italic">
          nothing unscheduled — every actionable task is on the calendar.
        </div>
      ) : (
        queues.map((queue) => {
          const isExpanded = expandedIds.has(queue.projectId);
          return (
            <div key={queue.projectId} className="border border-border rounded bg-white">
              {/* Always-visible header doubles as the collapse toggle. Title +
                  count show in BOTH states — folding hides only the rows, never
                  the count. Chevron: ▾ expanded / ▸ collapsed. */}
              <button
                type="button"
                onClick={() => toggleQueue(queue.projectId)}
                aria-expanded={isExpanded}
                className="w-full px-4 py-2 border-b border-border flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-bg-row/50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-text-faint shrink-0" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                  <h4 className="text-xs font-mono font-bold text-text-primary truncate">{queue.projectTitle}</h4>
                </span>
                <span className="text-xs font-mono text-text-muted shrink-0">{queue.tasks.length}</span>
              </button>

              {isExpanded && (
                /* Capped to ~6 rows then scrolls internally, so every expanded
                   queue keeps an equal footprint. Rendered only when expanded —
                   a collapsed queue renders just the header bar above. */
                <div className="max-h-[300px] overflow-y-auto">
                  {/* Column legend (sticky now that the title header sits above
                      the scroller). Project is the queue — no per-row Project col. */}
                  <div className="hidden md:grid grid-cols-[2fr_auto_auto_auto_auto] gap-3 px-4 py-1.5 text-xs font-mono text-text-faint uppercase tracking-wide border-b border-border-light sticky top-0 bg-white z-10">
                    <div>Task</div>
                    <div>Est. time</div>
                    <div>Est. cost</div>
                    <div>COA</div>
                    <div className="text-right">&nbsp;</div>
                  </div>

                  <div className="divide-y divide-border-light">
                    {queue.tasks.map((t) => (
                      <div key={t.id} className={t.status === 'blocked' ? 'opacity-60' : ''}>
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_auto_auto_auto_auto] gap-3 px-4 py-2 items-center text-xs font-mono">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-text-primary truncate">{t.title}</span>
                            {t.status === 'blocked' && (
                              <span className={`px-1.5 py-0 border rounded shrink-0 ${STATUS_CHIP.blocked}`}>blocked</span>
                            )}
                            {t.status === 'in_progress' && (
                              <span className={`px-1.5 py-0 border rounded shrink-0 ${STATUS_CHIP.in_progress}`}>in process</span>
                            )}
                          </div>
                          <div className="text-text-muted">{fmtMinutes(t.estimated_minutes)}</div>
                          <div className="text-text-muted">{fmtCost(t.estimated_cost_usd)}</div>
                          <div className="text-text-muted">{t.coa_code ?? '—'}</div>
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={() => setOpenId(openId === t.id ? null : t.id)}
                              className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded hover:bg-purple-50"
                            >
                              {openId === t.id ? 'close' : 'assign'}
                            </button>
                          </div>
                        </div>

                        {openId === t.id && (
                          <AssignForm task={t} onDone={() => { setOpenId(null); onAssigned(); }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function AssignForm({ task, onDone }: { task: UnscheduledTask; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [planDate, setPlanDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [coaCode, setCoaCode] = useState(task.coa_code ?? '');
  const [estCost, setEstCost] = useState(task.estimated_cost_usd ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictIds, setConflictIds] = useState<string[] | null>(null);

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  const submit = async (allowConflicts: boolean) => {
    const scheduledStart = toIso(planDate, startTime);
    const scheduledEnd = toIso(planDate, endTime);
    if (!scheduledStart || !scheduledEnd) {
      setError('pick a valid date, start time, and end time');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_date: planDate,
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          allow_conflicts: allowConflicts,
          coa_code: coaCode.trim().length > 0 ? coaCode.trim() : undefined,
          estimated_cost_usd: estCost.trim().length > 0 ? estCost.trim() : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Explicit user choice — surface the conflict, do NOT auto-place.
        setConflictIds(Array.isArray(body.conflicting_block_ids) ? body.conflicting_block_ids : []);
        return;
      }
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to assign');
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to assign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pb-3 pt-1 bg-purple-50/30 border-t border-border-light space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className={labelClass}>day</div>
          <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <div className={labelClass}>start</div>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
        </div>
        <div>
          <div className={labelClass}>end</div>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={labelClass}>category (coa, optional)</div>
          <input type="text" value={coaCode} onChange={(e) => setCoaCode(e.target.value)} className={inputClass} placeholder="e.g. P-6210" />
        </div>
        <div>
          <div className={labelClass}>est. cost (optional)</div>
          <input type="text" value={estCost} onChange={(e) => setEstCost(e.target.value)} className={inputClass} placeholder="0.00" />
        </div>
      </div>

      {error && (
        <div className="px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">{error}</div>
      )}

      {conflictIds !== null ? (
        <div className="px-2 py-2 rounded border bg-amber-50 border-amber-300 text-amber-900 text-xs font-mono space-y-2">
          <div>
            Time conflict with {conflictIds.length} existing block{conflictIds.length === 1 ? '' : 's'}. Schedule anyway?
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={saving}
              className="px-2 py-0.5 border border-amber-500 bg-amber-500 text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'scheduling…' : 'schedule anyway'}
            </button>
            <button
              type="button"
              onClick={() => setConflictIds(null)}
              disabled={saving}
              className="px-2 py-0.5 border border-border rounded hover:bg-white disabled:opacity-50"
            >
              pick another time
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={saving}
            className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50 text-xs font-mono"
          >
            {saving ? 'assigning…' : 'assign to calendar'}
          </button>
        </div>
      )}
    </div>
  );
}
