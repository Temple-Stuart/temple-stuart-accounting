/**
 * src/components/workbench/operations/SectionD_ProjectBacklog.tsx
 *
 * Section D · Project Backlog — entity-scoped list of operations_projects
 * with full Bridgewater 5-step scoping (goal/problem/diagnosis/design)
 * required on create. Step 5 (execute) = tasks, ships in PR-Ops-3b.
 *
 * Reads selectedEntityId from useOperationsEntity() context. Filters the
 * project list fetch by ?entity_id when an entity is selected; passes
 * nothing when "All" is selected (returns user's full backlog across all
 * entities).
 *
 * "+ new project" affordance at the top right toggles an inline create
 * form ABOVE the list (matches COA management table's add pattern).
 */

'use client';

import { useEffect, useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import ProjectRow from './projects/ProjectRow';
import ProjectQueueCard from './projects/ProjectQueueCard';
import ProjectCreateForm from './projects/ProjectCreateForm';
import type { Project } from './projects/types';

export default function SectionD_ProjectBacklog() {
  const { entities, selectedEntityId } = useOperationsEntity();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  // Entity to seed the create form with, captured when the form is opened so it
  // stays stable while open (the page-level filter changing must not retarget an
  // open form — identical to the pre-extraction behavior).
  const [createDefaultEntityId, setCreateDefaultEntityId] = useState('');
  // Archived projects are hidden by default; the toggle mirrors RoutineList's
  // "show inactive".
  const [showArchived, setShowArchived] = useState(false);

  // Lifted target state for cross-row navigation. When a dependency in
  // ProjectRow A is clicked, this is set to the target project's id;
  // ProjectRow B's useEffect on isJumpTarget triggers scroll + expand.
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedEntityId) params.set('entity_id', selectedEntityId);
      if (showArchived) params.set('include_archived', 'true');
      const qs = params.toString();
      const url = qs ? `/api/operations/projects?${qs}` : '/api/operations/projects';
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load projects');
        setProjects([]);
        return;
      }
      setProjects(body.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, showArchived]);

  const startCreate = () => {
    // Default the new project's entity to the currently-selected one, or the
    // first available entity if "All" is selected. Captured once here so the
    // open form's entity stays stable if the page-level filter changes.
    const initialEntity =
      selectedEntityId ?? entities.find((e) => e.is_default)?.id ?? entities[0]?.id ?? '';
    setCreateDefaultEntityId(initialEntity);
    setShowCreate(true);
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">
          Projects
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-text-muted">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span className="text-text-muted">show archived</span>
          </label>
          {!showCreate && (
            <button
              type="button"
              onClick={startCreate}
              disabled={entities.length === 0}
              className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              + new project
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs mb-3 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <ProjectCreateForm
          entities={entities}
          defaultEntityId={createDefaultEntityId}
          onCreated={() => {
            setShowCreate(false);
            fetchProjects();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="text-xs text-text-muted">loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="text-xs text-text-muted">
          {selectedEntityId
            ? 'no projects for this entity yet — click "+ new project" to scope your first one.'
            : 'no projects yet — click "+ new project" to scope your first one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            // PD-2: the queue is separated clean cards. The card opens the existing
            // ProjectRow detail (defaultExpanded) — click→detail navigation preserved.
            <ProjectQueueCard
              key={p.id}
              project={p}
              taskCount={p.task_count ?? 0}
              runCount={p.run_count ?? 0}
              forceOpen={targetProjectId === p.id}
            >
              <ProjectRow
                project={p}
                entities={entities}
                allProjects={projects}
                onUpdate={fetchProjects}
                onDelete={fetchProjects}
                isJumpTarget={targetProjectId === p.id}
                onClearTarget={() => setTargetProjectId(null)}
                onJumpTo={setTargetProjectId}
                defaultExpanded
              />
            </ProjectQueueCard>
          ))}
        </div>
      )}
    </section>
  );
}
