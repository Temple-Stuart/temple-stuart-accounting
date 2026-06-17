/**
 * DependencyListView — the PURE, props-only render of a project's dependency
 * edges (incoming + outgoing, with the inline add-form + per-edge delete).
 *
 * Extracted from DependencyList (PR3). It owns NO data: no fetch, no /api/*
 * call, no data-loading useEffect, no context, no server import. It is FULLY
 * CONTROLLED — all data + create-form state arrive as props, and every mutating
 * action (create, delete, toggle-advisory, jump) is a callback prop, so the
 * parent (the DependencyList container) owns all behavior. The rendered markup
 * is byte-for-byte equivalent to the pre-extraction DependencyList output.
 */

'use client';

import type {
  DependencyForm,
  DependencyType,
  HydratedDependency,
  InverseDependency,
  Project,
} from './types';
import { DEPENDENCY_TYPE_LABELS, DEPENDENCY_TYPE_DESCRIPTIONS } from './types';

const DEPENDENCY_TYPES: DependencyType[] = ['blocks', 'informs', 'derived_from'];

export interface DependencyListViewProps {
  projectId: string;
  allProjects: Project[];
  // ── Data (loaded by the container) ──────────────────────────────────────────
  outgoing: HydratedDependency[];
  incoming: InverseDependency[];
  loading: boolean;
  error: string | null;
  showAdvisory: boolean;
  deletingId: string | null;
  // ── Create-form state (owned by the container; this view is controlled) ─────
  showCreate: boolean;
  createForm: DependencyForm;
  createSaving: boolean;
  createError: string | null;
  // ── Action callbacks (the container owns behavior) ──────────────────────────
  onJumpTo: (projectId: string) => void;
  onToggleAdvisory: () => void;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onCreateFormChange: (form: DependencyForm) => void;
  onCreate: () => void;
  onDelete: (depId: string) => void;
}

export default function DependencyListView({
  projectId,
  allProjects,
  outgoing,
  incoming,
  loading,
  error,
  showAdvisory,
  deletingId,
  showCreate,
  createForm,
  createSaving,
  createError,
  onJumpTo,
  onToggleAdvisory,
  onStartCreate,
  onCancelCreate,
  onCreateFormChange,
  onCreate,
  onDelete,
}: DependencyListViewProps) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

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
            onClick={(e) => { e.stopPropagation(); onDelete(dep.id); }}
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
        <div className="text-xs text-text-muted">
          {outgoingBlocks.length + incomingBlocks.length} blocks edges
          {(outgoingAdvisory.length + incomingAdvisory.length > 0) && (
            <>, {outgoingAdvisory.length + incomingAdvisory.length} advisory</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(outgoingAdvisory.length > 0 || incomingAdvisory.length > 0) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleAdvisory(); }}
              className="px-2 py-1 border border-border rounded text-xs hover:bg-bg-row"
            >
              {showAdvisory ? 'hide advisory' : 'show advisory'}
            </button>
          )}
          {!showCreate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStartCreate(); }}
              disabled={targetCandidates.length === 0}
              className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs hover:opacity-90 disabled:opacity-50"
            >
              + add dependency
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="border border-border rounded p-3 bg-white text-xs space-y-3">
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
              onChange={(e) => onCreateFormChange({ ...createForm, depends_on_project_id: e.target.value })}
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
                onCreateFormChange({ ...createForm, dependency_type: e.target.value as DependencyType })
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
              onChange={(e) => onCreateFormChange({ ...createForm, rationale: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="why does this dependency exist?"
            />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={onCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {createSaving ? 'creating…' : 'add dependency'}
            </button>
            <button
              type="button"
              onClick={onCancelCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-text-muted">loading dependencies…</div>
      ) : outgoingBlocks.length === 0 && incomingBlocks.length === 0 && (!showAdvisory || (outgoingAdvisory.length === 0 && incomingAdvisory.length === 0)) ? (
        <div className="text-xs text-text-muted italic">
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
