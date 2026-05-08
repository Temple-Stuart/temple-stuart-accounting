/**
 * DependencyList — renders incoming + outgoing dependency edges for a project.
 *
 * Self-fetches via GET /api/operations/projects/[projectId]/dependencies on
 * mount. ProjectRow renders <DependencyList projectId={...} onJumpTo={...} />
 * and never needs to know about dependency state.
 *
 * Primary view: `blocks` edges only (institutional Bridgewater framing —
 * blocks is the ordering constraint; informs/derived_from are advisory).
 * Future "show advisory edges" toggle can reveal informs/derived_from in a
 * faded sub-list.
 *
 * "+ add dependency" form: pick target project, pick type, optional rationale.
 * If the type is `blocks`, server runs DFS cycle detection and may 400.
 *
 * Click on a dependency target → onJumpTo(targetProjectId) bubbles to
 * SectionD_ProjectBacklog which scrolls + auto-expands the target row.
 */

'use client';

import { useEffect, useState } from 'react';
import type {
  Dependency,
  DependencyForm,
  DependencyType,
  HydratedDependency,
  InverseDependency,
  Project,
} from './types';
import { DEFAULT_DEPENDENCY_FORM, DEPENDENCY_TYPE_LABELS, DEPENDENCY_TYPE_DESCRIPTIONS } from './types';

interface Props {
  projectId: string;
  /** All user projects (for the target dropdown). Excludes the current project. */
  allProjects: Project[];
  /** Callback to scroll + auto-expand the target row in SectionD. */
  onJumpTo: (projectId: string) => void;
}

const DEPENDENCY_TYPES: DependencyType[] = ['blocks', 'informs', 'derived_from'];

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

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  // Filter to blocks-only by default; show advisory edges only when toggled.
  const outgoingBlocks = outgoing.filter((d) => d.dependency_type === 'blocks');
  const outgoingAdvisory = outgoing.filter((d) => d.dependency_type !== 'blocks');
  const incomingBlocks = incoming.filter((d) => d.dependency_type === 'blocks');
  const incomingAdvisory = incoming.filter((d) => d.dependency_type !== 'blocks');

  // Exclude self from target dropdown.
  const targetCandidates = allProjects.filter((p) => p.id !== projectId);

  const renderEdgeRow = (
    dep: HydratedDependency | InverseDependency,
    direction: 'outgoing' | 'incoming'
  ) => {
    const isOutgoing = direction === 'outgoing';
    const linkedTitle = isOutgoing
      ? (dep as HydratedDependency).depends_on_project_title
      : (dep as InverseDependency).project_title;
    const linkedStatus = isOutgoing
      ? (dep as HydratedDependency).depends_on_project_status
      : (dep as InverseDependency).project_status;
    const linkedId = isOutgoing
      ? dep.depends_on_project_id
      : dep.project_id;

    return (
      <div
        key={dep.id}
        className="flex items-center justify-between gap-2 py-1 px-2 hover:bg-bg-row rounded"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-text-faint">▸</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onJumpTo(linkedId); }}
            className="text-brand-purple hover:underline truncate text-left"
            title={`Jump to ${linkedTitle}`}
          >
            {linkedTitle}
          </button>
          <span className="text-text-muted text-xs">({linkedStatus.replace(/_/g, ' ')})</span>
          {dep.dependency_type !== 'blocks' && (
            <span className="text-text-faint italic text-xs">
              {DEPENDENCY_TYPE_LABELS[dep.dependency_type]}
            </span>
          )}
          {dep.rationale && (
            <span className="text-text-muted truncate" title={dep.rationale}>
              — {dep.rationale}
            </span>
          )}
        </div>
        {isOutgoing && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(dep.id); }}
            disabled={deletingId === dep.id}
            className="px-1.5 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs"
            title="Remove this dependency"
          >
            {deletingId === dep.id ? '…' : '×'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-text-muted">
          {outgoingBlocks.length + incomingBlocks.length} blocks edges
          {(outgoingAdvisory.length + incomingAdvisory.length > 0) && (
            <>, {outgoingAdvisory.length + incomingAdvisory.length} advisory</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(outgoingAdvisory.length > 0 || incomingAdvisory.length > 0) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAdvisory((x) => !x); }}
              className="px-2 py-1 border border-border rounded text-xs font-mono hover:bg-bg-row"
            >
              {showAdvisory ? 'hide advisory' : 'show advisory'}
            </button>
          )}
          {!showCreate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startCreate(); }}
              disabled={targetCandidates.length === 0}
              className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90 disabled:opacity-50"
            >
              + add dependency
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
          <div className="font-bold text-text-primary">new dependency</div>
          {createError && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {createError}
            </div>
          )}
          <div>
            <div className={labelClass}>target project</div>
            <select
              value={createForm.depends_on_project_id}
              onChange={(e) => setCreateForm({ ...createForm, depends_on_project_id: e.target.value })}
              className={inputClass}
            >
              <option value="">— select —</option>
              {targetCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={labelClass}>type</div>
            <select
              value={createForm.dependency_type}
              onChange={(e) =>
                setCreateForm({ ...createForm, dependency_type: e.target.value as DependencyType })
              }
              className={inputClass}
            >
              {DEPENDENCY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEPENDENCY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <div className="text-text-muted text-xs italic mt-1">
              {DEPENDENCY_TYPE_DESCRIPTIONS[createForm.dependency_type]}
            </div>
          </div>
          <div>
            <div className={labelClass}>rationale (optional)</div>
            <textarea
              value={createForm.rationale}
              onChange={(e) => setCreateForm({ ...createForm, rationale: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="why does this dependency exist?"
            />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {createSaving ? 'creating…' : 'add dependency'}
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
        <div className="text-xs font-mono text-text-muted">loading dependencies…</div>
      ) : outgoingBlocks.length === 0 && incomingBlocks.length === 0 && (!showAdvisory || (outgoingAdvisory.length === 0 && incomingAdvisory.length === 0)) ? (
        <div className="text-xs font-mono text-text-muted italic">
          no dependencies yet — click "+ add dependency" to link this project to others.
        </div>
      ) : (
        <>
          {(outgoingBlocks.length > 0 || (showAdvisory && outgoingAdvisory.length > 0)) && (
            <div>
              <div className={labelClass}>blocked by (this project depends on)</div>
              <div className="space-y-0.5">
                {outgoingBlocks.map((d) => renderEdgeRow(d, 'outgoing'))}
                {showAdvisory && outgoingAdvisory.map((d) => renderEdgeRow(d, 'outgoing'))}
              </div>
            </div>
          )}

          {(incomingBlocks.length > 0 || (showAdvisory && incomingAdvisory.length > 0)) && (
            <div>
              <div className={labelClass}>blocks (other projects depend on this)</div>
              <div className="space-y-0.5">
                {incomingBlocks.map((d) => renderEdgeRow(d, 'incoming'))}
                {showAdvisory && incomingAdvisory.map((d) => renderEdgeRow(d, 'incoming'))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
