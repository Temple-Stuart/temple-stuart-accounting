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
 *
 * PROJECTS-01 (2026-09-30): the list is ONE table (ProjectsTable) — every task
 * of every project on screen at once, a row per task under its project, the
 * project's detail one click away as a full-width row. The queue card that
 * opened one project at a time is gone. "show archived" is the one toggle: it
 * reads archived projects AND archived tasks.
 *
 * WORK-01 (Alex, 2026-10-24) — ruling E: the task rows left this table for THE
 * WORK (SectionE_Work, above this section on /tasks); a project is one row with
 * its tasks counted. "+ new project", "show archived", details and the brief
 * are unchanged, and so is THE LOG's read (GET /projects open_tasks).
 *
 * PROJECTS-02 (Alex, 2026-10-25) — PROJECTS IS THE BRIEF AS A TABLE. The list is
 * the shared DataTable (ProjectsTable over src/lib/operations/projectsTable.ts):
 * one row per project, the brief's fields as columns in Alex's order, filtered,
 * sorted and downloaded by the idiom's rules, with a VISIBLE "STATUS: open only"
 * chip dropping every status not in OPEN_PROJECT_STATUSES — archived too once
 * "show archived" has read them. This header keeps the count of projects loaded,
 * "show archived" (the read switch: include_archived on the projects GET, as
 * before) and "+ new project"; the capture form, "paste brief", the dependency
 * jump and the row's "details" (the brief, every control, the task list) stay.
 * The table stays mounted across a re-read, so its filters and sort hold; the
 * loading and nothing-yet lines ride inside it, between its controls and its rows.
 *
 * BACKLOG-01 (Alex, 2026-10-20) — ruling G: the list shows EVERY book. The
 * page's entity selector no longer filters the fetch (the ledger's rule:
 * "every book — the COA says which"); the project cell names its book. The
 * selector still seeds the capture form's default book (startCreate below),
 * exactly as before. The form is the CAPTURE form (ProjectCreateForm): title,
 * type, book, why, and the optional size, definition of done, links, notes
 * and target date; a captured project lands in the backlog.
 *
 * BACKLOG-02 (Alex, 2026-10-20) — THE DOORS FROM THE MORNING CARD. Two URL params, the contract in
 * src/lib/operations/morningLog.ts (the card's links send them; this list reads them, useSearchParams, inside the
 * page's Suspense boundary — src/app/tasks/page.tsx):
 *   · ?project=<id> — once the list has loaded, that project's row is the jump target (the dependency jump's own
 *     path: its details open, the row expands, scrolls into view and flashes). An id not in the list — not the user's,
 *     not a project, or archived while "show archived" is off — prints "project not found", never a silent no-op.
 *     A failed list load says its own error and leaves the param for a reload.
 *   · ?new=project — the capture form opens, through startCreate (the same book seeding as "+ new project"), once the
 *     books are read — said while they are not. Any other value of new is said, never ignored.
 * Each param is cleared from the URL once used (window.history.replaceState — Next keeps useSearchParams in step with
 * it; no server round trip, no history entry, no scroll), so a reload does not reopen it. FOUND in the browser
 * (2026-10-20): router.replace cleared it only after a server round trip — seconds on a cold dev server — so a quick
 * reload reopened the param; the native call is immediate. The capture form stays mounted here alone — its one home (TOOL-LAW-01).
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NEW_PROJECT_WAITS_WORDS, PROJECT_NOT_FOUND_WORDS, TASKS_NEW_PARAM, TASKS_NEW_PROJECT, TASKS_PROJECT_PARAM, newParamWords } from '@/lib/operations/morningLog';
import { useOperationsEntity } from './EntitySelector';
import ProjectsTable from './projects/ProjectsTable';
import ProjectCreateForm from './projects/ProjectCreateForm';
import type { Project } from './projects/types';


// COLUMNS-01 (Alex, 2026-10-25, ruling E): no props — the empty-object signature tripped @typescript-eslint/no-empty-object-type.
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
  // ProjectRow A is clicked, this is set to the target project's id; the
  // table opens B's details, and ProjectRow B's useEffect on isJumpTarget
  // triggers scroll + expand.
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  // BACKLOG-02: the doors from the morning card — ?project=<id> and ?new=project (the header above).
  const search = useSearchParams();
  const projectParam = search.get(TASKS_PROJECT_PARAM);
  const newParam = search.get(TASKS_NEW_PARAM);
  const [doorWords, setDoorWords] = useState<string | null>(null);
  /** Clear a used param from the URL, keeping every other — replaced in place, so a reload does not reopen it and Back does not either. */
  const dropParam = (name: string) => {
    const next = new URLSearchParams(window.location.search);
    next.delete(name);
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // BACKLOG-01 (Alex, 2026-10-20): no entity_id — every book is listed.
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
  }, [showArchived]);

  // BACKLOG-02 — ?project=<id>: once the list is in, that row is the jump target, or the words say it is not there.
  useEffect(() => {
    if (projectParam === null || loading || error !== null) return;
    if (projects.some((p) => p.id === projectParam)) {
      setTargetProjectId(projectParam);
      setDoorWords(null);
    } else {
      setDoorWords(PROJECT_NOT_FOUND_WORDS);
    }
    dropParam(TASKS_PROJECT_PARAM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectParam, loading, error, projects]);

  // BACKLOG-02 — ?new=project: the capture form opens through startCreate once the books are read (it seeds the book).
  useEffect(() => {
    if (newParam === null) return;
    if (newParam !== TASKS_NEW_PROJECT) {
      setDoorWords(newParamWords(newParam));
      dropParam(TASKS_NEW_PARAM);
      return;
    }
    if (entities.length === 0) return;
    startCreate();
    dropParam(TASKS_NEW_PARAM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam, entities]);

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
        {/* PROJECTS-V2: on dark the module band already titles the tab. */}
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
              className={`px-2 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
            >
              + new project
            </button>
          )}
        </div>
      </div>

      {newParam === TASKS_NEW_PROJECT && entities.length === 0 && (
        <div className="text-xs text-text-muted" data-projects-new-waits>{NEW_PROJECT_WAITS_WORDS}</div>
      )}

      {doorWords !== null && (
        <div className="text-xs mb-3 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-projects-door-words>
          {doorWords}
        </div>
      )}

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

      <ProjectsTable
        projects={projects}
        entities={entities}
        loaded={!loading}
        showArchived={showArchived}
        targetProjectId={targetProjectId}
        onJumpTo={setTargetProjectId}
        onClearTarget={() => setTargetProjectId(null)}
        onProjectsChanged={fetchProjects}
      >
        {loading && <div className="text-xs text-text-muted">loading projects…</div>}
        {!loading && projects.length === 0 && (
          <div className="text-xs text-text-muted">
            no projects yet — click &quot;+ new project&quot; to capture the first one.
          </div>
        )}
      </ProjectsTable>
    </section>
  );
}
