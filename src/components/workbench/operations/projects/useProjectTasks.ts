/**
 * useProjectTasks — one project's tasks, read and created in one home
 * (PROJECTS-01, 2026-09-30).
 *
 * Moved verbatim out of TaskList.tsx (read :58-82, the category list :95-138,
 * create :140-173) so the task list and the projects table read the SAME GET
 * (/api/operations/projects/[id]/tasks) and post the SAME create — never a
 * copied fetch. Whether archived tasks are read is the CALLER's (`showArchived`):
 * the list has its own toggle; the table has the section's one.
 */

'use client';

import { useEffect, useState } from 'react';
import type { Task, TaskForm, CoaAccountSummary } from './types';
import { DEFAULT_TASK_FORM } from './types';


export interface ProjectTasksInput {
  projectId: string;
  entity_id: string;
  /** Read archived tasks too (the tasks GET's include_archived). */
  showArchived: boolean;
  /** Bumping this re-reads the tasks. */
  refreshKey?: number;
  onTotals?: (t: { pendingReview: number; planTasks: number }) => void;
}

export function useProjectTasks({ projectId, entity_id, showArchived, refreshKey, onTotals }: ProjectTasksInput) {
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
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks${showArchived ? '?include_archived=true' : ''}`
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load tasks');
        setTasks([]);
        return;
      }
      const rows = body.tasks ?? [];
      setTasks(rows);
      onTotals?.({
        pendingReview: rows.filter((t: { status: string }) => t.status === 'pending_review').length,
        planTasks: rows.filter((t: { status: string }) => ['open', 'in_progress', 'blocked', 'completed'].includes(t.status)).length,
      });
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

  return {
    tasks, loading, error, fetchTasks,
    coaAccounts,
    showCreate, createForm, setCreateForm, createSaving, createError,
    startCreate, cancelCreate, handleCreate,
  };
}

export type ProjectTasks = ReturnType<typeof useProjectTasks>;
