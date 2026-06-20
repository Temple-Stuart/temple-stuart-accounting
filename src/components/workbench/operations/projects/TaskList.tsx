/**
 * TaskList — the LIVE, authed container for a single project's task list.
 *
 * PR1 split: this file keeps the EXACT live behavior it had before (self-fetch
 * tasks + COA, own the create form + POST, refresh on row mutations) and now
 * renders the pure <TaskListView/> with the live data + real handlers as props.
 * The public name + prop shape ({ projectId, entity_id }) are unchanged, so the
 * existing call site (ProjectRow.tsx:517) is untouched and /operations/projects
 * behaves identically. NO new behavior, NO demo/fallback data here.
 *
 * Self-fetches via GET /api/operations/projects/[projectId]/tasks on mount and
 * on any onUpdate/onDelete from a TaskRow. COA accounts fetched once per
 * entity_id for the create-form category dropdown.
 */

'use client';

import { useEffect, useState } from 'react';
import TaskListView from './TaskListView';
import TaskRow from './TaskRow';
import type { Task, TaskForm, CoaAccountSummary } from './types';
import { DEFAULT_TASK_FORM } from './types';

interface Props {
  projectId: string;
  entity_id: string;
  // PHASE2-5: optional external refresh trigger. Bumping this re-fetches the task
  // list (the auto-pipe poll uses it to surface landed pending_review tasks live).
  // Absent → unchanged behavior (showroom + other callers omit it).
  refreshKey?: number;
}

export default function TaskList({ projectId, entity_id, refreshKey }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<TaskForm>(DEFAULT_TASK_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Archived tasks hidden by default; toggle mirrors RoutineList's "show inactive".
  const [showArchived, setShowArchived] = useState(false);

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
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks${showArchived ? '?include_archived=true' : ''}`
      );
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
  }, [projectId, showArchived, refreshKey]);

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

  return (
    <TaskListView
      tasks={tasks}
      loading={loading}
      error={error}
      coaAccounts={coaAccounts}
      showArchived={showArchived}
      showCreate={showCreate}
      createForm={createForm}
      createSaving={createSaving}
      createError={createError}
      onShowArchivedChange={setShowArchived}
      onStartCreate={startCreate}
      onCancelCreate={cancelCreate}
      onCreateFormChange={setCreateForm}
      onCreate={handleCreate}
      // PR7b row slot — the SAME live <TaskRow> container with the SAME props as
      // before (1-based index forwarded verbatim). TaskListView wraps each call
      // in a keyed Fragment, so per-row behavior is byte-for-byte identical.
      renderTaskRow={(task, index) => (
        <TaskRow
          task={task}
          projectId={projectId}
          index={index}
          coaAccounts={coaAccounts}
          onUpdate={fetchTasks}
          onDelete={fetchTasks}
        />
      )}
    />
  );
}
