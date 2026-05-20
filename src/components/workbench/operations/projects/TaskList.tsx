/**
 * TaskList — renders the tasks for a single project.
 *
 * Self-fetches via GET /api/operations/projects/[projectId]/tasks on mount
 * and on any onUpdate/onDelete callback from a TaskRow. Self-contained:
 * the parent ProjectRow just renders <TaskList projectId={...} entity_id={...} />
 * and never needs to know about task state.
 *
 * "+ add task" affordance toggles an inline create form ABOVE the task list.
 * Bridgewater step-5 framing: this is the execute layer; the project's
 * scoping fields are read above this in the parent ProjectRow.
 */

'use client';

import { useEffect, useState } from 'react';
import TaskRow from './TaskRow';
import type { Task, TaskForm, CoaAccountSummary } from './types';
import { DEFAULT_TASK_FORM } from './types';

interface Props {
  projectId: string;
  entity_id: string;
}

export default function TaskList({ projectId, entity_id }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<TaskForm>(DEFAULT_TASK_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // COA accounts for the category dropdown — fetched once per entity_id.
  // entity_id is sourced from the project (via prop), not derived from the
  // first existing task, so brand-new projects with zero tasks can still
  // populate the dropdown on the very first task's create form.
  const [coaAccounts, setCoaAccounts] = useState<CoaAccountSummary[]>([]);
  const [coaFetchedForEntityId, setCoaFetchedForEntityId] = useState<string | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/tasks`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load tasks');
        setTasks([]);
        return;
      }
      setTasks(body.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Eager COA fetch — fires on mount as soon as entity_id is known, so
  // even brand-new projects with zero tasks have the dropdown populated
  // when the user opens the create form. Failure logs to console and
  // leaves coaAccounts empty; TaskRow/create-form both handle the empty
  // list gracefully (dropdown shows only "— None —"; expanded body falls
  // back to displaying the raw code).
  useEffect(() => {
    if (!entity_id) {
      // Defensive: should never happen — every project has an entity_id —
      // but if it does, skip the fetch rather than crash. Dropdown falls
      // back to "— None —" only, preserving the prior empty-list behavior.
      console.warn('[TaskList] missing entity_id prop; skipping COA fetch');
      return;
    }
    if (coaFetchedForEntityId === entity_id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chart-of-accounts?entity_id=${encodeURIComponent(entity_id)}`);
        if (!res.ok) {
          console.error('[TaskList] COA fetch failed:', res.status);
          if (!cancelled) {
            setCoaAccounts([]);
            setCoaFetchedForEntityId(entity_id);
          }
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        type CoaResponseRow = { code: string; name: string; accountType: string; entity_id: string };
        const list: CoaAccountSummary[] = (body.accounts ?? []).map((a: CoaResponseRow) => ({
          code: a.code,
          name: a.name,
          account_type: a.accountType,
          entity_id: a.entity_id,
        }));
        setCoaAccounts(list);
        setCoaFetchedForEntityId(entity_id);
      } catch (e) {
        console.error('[TaskList] COA fetch error:', e);
        if (!cancelled) {
          setCoaAccounts([]);
          setCoaFetchedForEntityId(entity_id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity_id, coaFetchedForEntityId]);

  const startCreate = () => {
    setCreateForm(DEFAULT_TASK_FORM);
    setCreateError(null);
    setShowCreate(true);
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setCreateForm(DEFAULT_TASK_FORM);
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(body?.message ?? body?.error ?? 'failed to create');
        return;
      }
      cancelCreate();
      fetchTasks();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'failed to create');
    } finally {
      setCreateSaving(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-text-muted">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startCreate(); }}
            className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90"
          >
            + add task
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
          <div className="font-bold text-text-primary">new task</div>
          {createError && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {createError}
            </div>
          )}
          <div>
            <div className={labelClass}>title</div>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className={inputClass}
              maxLength={500}
              placeholder="what is the atomic unit of work?"
            />
          </div>
          <div>
            <div className={labelClass}>description (optional)</div>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="more detail if the title isn't enough"
            />
          </div>
          <div>
            <div className={labelClass}>unblocks (optional — rationale for priority engine)</div>
            <textarea
              value={createForm.unblocks_label}
              onChange={(e) => setCreateForm({ ...createForm, unblocks_label: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="what does completing this unblock?"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className={labelClass}>deadline (optional)</div>
              <input
                type="date"
                value={createForm.deadline}
                onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. minutes (optional)</div>
              <input
                type="number"
                min={0}
                value={createForm.estimated_minutes}
                onChange={(e) => setCreateForm({ ...createForm, estimated_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. cost usd (optional)</div>
              <input
                type="text"
                value={createForm.estimated_cost_usd}
                onChange={(e) => setCreateForm({ ...createForm, estimated_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {createSaving ? 'creating…' : 'create task'}
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="text-xs font-mono text-text-muted italic">
          no tasks yet — click "+ add task" to break this project down into atomic execution units.
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              projectId={projectId}
              index={i + 1}
              coaAccounts={coaAccounts}
              onUpdate={fetchTasks}
              onDelete={fetchTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
