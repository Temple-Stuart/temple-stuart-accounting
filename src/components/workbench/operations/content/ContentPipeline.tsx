/**
 * ContentPipeline — the Content tab as Alex's 4-step pipeline (OPS-CE-7), one flat
 * page top to bottom, everything on the surface:
 *
 *   1 · SOURCES   — routines (left, selectable in order) + project tasks (right,
 *                   read-only reference; committing blocks stays on the Daily Plan tab)
 *   ( question library — compact, it feeds the draft's question assignment )
 *   2 · SCENIFY DRAFT — selecting ≥1 routine renders ONE inline editable scene-map
 *                   table (ScenifyDraft) under the sources, multiple routines combined
 *                   in selection order
 *   3 · CONFIRMED — the PieceGrid (scenes × days) + the Daily Log (day timeline)
 *   4 · SCRIPT OUTPUT — next (CE-5): a quiet structural mount point
 *
 * Replaces the retired legacy SectionG_Content surface on this page. Truthful header
 * counts read the REAL grid tables (scene-rows + answered cells). 0-schema; the only
 * writes are the existing scene-rows upsert (via ScenifyDraft) + the grid cell/piece
 * routes (via PieceGrid/DailyLog). No script generation here.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import { CONTENT_SCENES_CHANGED_EVENT } from './ScenifyModal';
import ScenifyDraft from './ScenifyDraft';
import QuestionLibrary from './QuestionLibrary';
import PieceGrid from './PieceGrid';
import DailyLog from './DailyLog';

interface RoutineLite {
  id: string;
  name: string;
  entity_id: string;
  steps: { id: string }[];
}
interface TaskLite {
  id: string;
  title: string;
  status: string;
  project: { id: string; title: string; entity_id: string } | null;
}
interface GridScene {
  entity_id: string;
}
interface GridCell {
  entity_id: string;
  script: string | null;
}

const STATUS_PILL: Record<string, string> = {
  open: 'border-border text-text-muted',
  in_progress: 'border-brand-purple text-brand-purple',
  blocked: 'border-amber-400 text-amber-700 bg-amber-50',
};

export default function ContentPipeline() {
  const { selectedEntityId } = useOperationsEntity();
  const [routines, setRoutines] = useState<RoutineLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [gridScenes, setGridScenes] = useState<GridScene[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Selected routine ids, in selection order (drives the draft).
  const [selected, setSelected] = useState<string[]>([]);

  const entityScope = (eid: string) => !selectedEntityId || eid === selectedEntityId;

  const loadCounts = useCallback(async () => {
    const qs = selectedEntityId ? `?entity_id=${encodeURIComponent(selectedEntityId)}` : '';
    const res = await fetch(`/api/operations/content/grid${qs}`, { credentials: 'include' });
    if (!res.ok) return;
    const body = await res.json();
    setGridScenes(body.scenes ?? []);
    setGridCells(body.cells ?? []);
  }, [selectedEntityId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedEntityId ? `?entity_id=${encodeURIComponent(selectedEntityId)}` : '';
      const [routinesRes, tasksRes] = await Promise.all([
        fetch(`/api/operations/routines${qs}`, { credentials: 'include' }),
        fetch('/api/operations/tasks/unscheduled', { credentials: 'include' }),
      ]);
      if (!routinesRes.ok) throw new Error(`Failed to load routines (${routinesRes.status})`);
      const routinesBody = await routinesRes.json();
      setRoutines(routinesBody.routines ?? []);
      if (tasksRes.ok) {
        const tasksBody = await tasksRes.json();
        setTasks(tasksBody.tasks ?? []);
      }
      await loadCounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load content pipeline');
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, loadCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  // When a scenify save lands, refresh the truthful counts (the grid refetches itself).
  useEffect(() => {
    const refresh = () => void loadCounts();
    window.addEventListener(CONTENT_SCENES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONTENT_SCENES_CHANGED_EVENT, refresh);
  }, [loadCounts]);

  const visibleRoutines = useMemo(
    () => routines.filter((r) => entityScope(r.entity_id)),
    [routines, selectedEntityId] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visibleTasks = useMemo(
    () => tasks.filter((t) => !t.project || entityScope(t.project.entity_id)),
    [tasks, selectedEntityId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const sceneCount = useMemo(
    () => gridScenes.filter((s) => entityScope(s.entity_id)).length,
    [gridScenes, selectedEntityId] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const answeredCount = useMemo(
    () => gridCells.filter((c) => entityScope(c.entity_id) && (c.script ?? '').trim().length > 0).length,
    [gridCells, selectedEntityId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Selected routines as {id,name} in selection order, for the draft.
  const selectedRoutines = useMemo(
    () =>
      selected
        .map((id) => routines.find((r) => r.id === id))
        .filter((r): r is RoutineLite => !!r)
        .map((r) => ({ id: r.id, name: r.name })),
    [selected, routines]
  );

  return (
    <div className="space-y-4">
      {/* Header + truthful counts (real grid tables). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          CONTENT PIPELINE
          <span className="ml-2 font-normal text-text-faint">sources → draft → confirmed → script</span>
        </h1>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-0.5 rounded border border-border-light bg-bg-row text-text-primary">
            {sceneCount} scenes
          </span>
          <span className="px-2 py-0.5 rounded border border-border-light bg-bg-row text-text-primary">
            {answeredCount} answered
          </span>
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {/* 1 · SOURCES */}
      <section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          1 · SOURCES
          <span className="ml-2 font-normal text-text-faint">pick routines to scenify · tasks for reference</span>
        </h2>
        {loading ? (
          <p className="text-sm font-mono text-text-faint">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {/* Left: routines (selectable, order tracked) */}
            <div className="space-y-2">
              <h3 className="text-text-faint uppercase tracking-wide">Routines</h3>
              {visibleRoutines.length === 0 ? (
                <p className="text-text-muted">No routines — create one on the Routines tab.</p>
              ) : (
                <ul className="space-y-1">
                  {visibleRoutines.map((r) => {
                    const order = selected.indexOf(r.id);
                    const isSel = order >= 0;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded border ${
                            isSel ? 'border-brand-purple bg-purple-50/50' : 'border-border-light hover:bg-bg-row'
                          }`}
                        >
                          <span
                            className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                              isSel ? 'bg-brand-purple text-white' : 'border border-border text-text-faint'
                            }`}
                            aria-hidden="true"
                          >
                            {isSel ? order + 1 : ''}
                          </span>
                          <span className="text-text-primary font-medium flex-1">{r.name}</span>
                          <span className="text-text-muted">
                            {r.steps.length} step{r.steps.length === 1 ? '' : 's'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Right: project tasks (read-only reference) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-text-faint uppercase tracking-wide">Project tasks</h3>
                <a href="/operations" className="text-brand-purple hover:underline">
                  commit on Daily Plan →
                </a>
              </div>
              {visibleTasks.length === 0 ? (
                <p className="text-text-muted">No unscheduled tasks.</p>
              ) : (
                <ul className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                  {visibleTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded border border-border-light"
                    >
                      <span className="text-text-primary flex-1 truncate" title={t.title}>
                        {t.title}
                      </span>
                      {t.project && <span className="text-text-muted truncate max-w-[120px]">{t.project.title}</span>}
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide ${
                          STATUS_PILL[t.status] ?? 'border-border text-text-muted'
                        }`}
                      >
                        {t.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Question library — compact; feeds the draft's question assignment. */}
      <QuestionLibrary />

      {/* 2 · SCENIFY DRAFT (only when ≥1 routine selected) */}
      {selectedRoutines.length > 0 && (
        <ScenifyDraft routines={selectedRoutines} onSaved={loadCounts} />
      )}

      {/* 3 · CONFIRMED */}
      <PieceGrid />
      <DailyLog />

      {/* 4 · SCRIPT OUTPUT — next (CE-5). Quiet structural mount point. */}
      <section className="bg-white rounded border border-dashed border-border-light p-5 text-center">
        <div className="font-mono text-sm font-bold tracking-wide text-text-faint">4 · SCRIPT OUTPUT</div>
        <div className="font-mono text-xs text-text-faint mt-1">
          the day&rsquo;s answers → voiceover script — next (CE-5)
        </div>
      </section>
    </div>
  );
}
