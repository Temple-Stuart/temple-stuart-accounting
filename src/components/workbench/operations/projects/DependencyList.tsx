/**
 * DependencyList — the LIVE, authed container for a project's dependency edges
 * (incoming + outgoing, inline add-form + per-edge delete).
 *
 * PR3 split: this file keeps the EXACT live behavior it had before (self-fetch
 * GET dependencies on mount, POST to create, DELETE to remove an edge) and now
 * renders the pure <DependencyListView/> with the live data + real handlers as
 * props. The public name + prop shape ({ projectId, allProjects, onJumpTo }) are
 * unchanged, so the existing call site (ProjectRow.tsx:534) is untouched and
 * /operations/projects behaves identically. NO new behavior, NO demo data.
 *
 * Backing model: operations_project_dependencies (dependencies/route.ts:61,80,155;
 * dependencies/[depId]/route.ts:45). If the type is `blocks`, the server runs DFS
 * cycle detection and may 400.
 */

'use client';

import { useEffect, useState } from 'react';
import DependencyListView from './DependencyListView';
import type {
  DependencyForm,
  HydratedDependency,
  InverseDependency,
  Project,
} from './types';
import { DEFAULT_DEPENDENCY_FORM } from './types';

interface Props {
  projectId: string;
  /** All user projects (for the target dropdown). Excludes the current project. */
  allProjects: Project[];
  /** Callback to scroll + auto-expand the target row in SectionD. */
  onJumpTo: (projectId: string) => void;
}

export default function DependencyList({ projectId, allProjects, onJumpTo }: Props) {
  const [outgoing, setOutgoing] = useState<HydratedDependency[]>([]);
  const [incoming, setIncoming] = useState<InverseDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvisory, setShowAdvisory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<DependencyForm>(DEFAULT_DEPENDENCY_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchDependencies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/dependencies`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load dependencies');
        setOutgoing([]);
        setIncoming([]);
        return;
      }
      setOutgoing(body.outgoing ?? []);
      setIncoming(body.incoming ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load dependencies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startCreate = () => {
    setCreateForm(DEFAULT_DEPENDENCY_FORM);
    setCreateError(null);
    setShowCreate(true);
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setCreateForm(DEFAULT_DEPENDENCY_FORM);
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/dependencies`, {
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
      fetchDependencies();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'failed to create');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleDelete = async (depId: string) => {
    if (!confirm('Remove this dependency edge?')) return;
    setDeletingId(depId);
    setError(null);
    try {
      const res = await fetch(
        `/api/operations/projects/${projectId}/dependencies/${depId}`,
        { method: 'DELETE' }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      fetchDependencies();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DependencyListView
      projectId={projectId}
      allProjects={allProjects}
      outgoing={outgoing}
      incoming={incoming}
      loading={loading}
      error={error}
      showAdvisory={showAdvisory}
      deletingId={deletingId}
      showCreate={showCreate}
      createForm={createForm}
      createSaving={createSaving}
      createError={createError}
      onJumpTo={onJumpTo}
      onToggleAdvisory={() => setShowAdvisory((x) => !x)}
      onStartCreate={startCreate}
      onCancelCreate={cancelCreate}
      onCreateFormChange={setCreateForm}
      onCreate={handleCreate}
      onDelete={handleDelete}
    />
  );
}
