/**
 * ContentPipeline — the Content tab as Alex's FOUR-SECTION pipeline (OPS-CE-8), one
 * flat page top to bottom, everything on the surface:
 *
 *   1 · INPUTS        — routines (click-to-select, ordered) + project tasks. Tasks are
 *                       SELECTABLE INPUTS: "add to day" assigns a task to the selected
 *                       date via the existing daily-plan item route. Cross-entity, labeled.
 *   2 · AI SCRIPT MAP — the inline multi-routine draft table (ScenifyDraft), with a
 *                       "cameras available" input + virality-tuned AI suggest.
 *   3 · ANSWER + RECORD — date picker at top; the answer timeline (DailyLog, with a
 *                       Narrative column + task blocks) over the DAY-TO-DAY RECORD grid.
 *                       CROSS-ENTITY: the day is ONE reel — scenes/answers/blocks span
 *                       entities for the date.
 *   4 · SCRIPT        — the CE-5 mount point, labeled with its inputs.
 *
 * 0-schema; the only writes are the existing scene-rows upsert (draft), grid cell/piece
 * routes (answer/record), and the daily-plan item route (add-to-day). No AI here beyond
 * the existing enrich call. Truthful header counts read the real grid tables.
 *
 * Entity selector: the day READS cross-entity; the selector governs which entity a NEW
 * day-piece is created under (DailyLog/PieceGrid creation), and is defaulted concrete.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import { CONTENT_DAY_PLAN_CHANGED_EVENT, CONTENT_SCENES_CHANGED_EVENT } from './ScenifyModal';
import ScenifyDraft from './ScenifyDraft';
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
  script?: never;
}
interface GridCell {
  script: string | null;
}

const STATUS_PILL: Record<string, string> = {
  open: 'border-border text-text-muted',
  in_progress: 'border-brand-purple text-brand-purple',
  blocked: 'border-amber-400 text-amber-700 bg-amber-50',
};

// Local YYYY-MM-DD (NOT toISOString — that flips to UTC and can show the wrong day).
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const sectionHeader = 'font-mono text-sm font-medium tracking-wide text-brand-purple';

export default function ContentPipeline() {
  const { entities, selectedEntityId, setSelectedEntityId } = useOperationsEntity();
  const [routines, setRoutines] = useState<RoutineLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [gridScenes, setGridScenes] = useState<GridScene[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  // Shared date — S1 (add-to-day) + S3 (the answer table) read the same day.
  const [date, setDate] = useState(todayLocal());
  // Tasks assigned to the day this session (+ tasks already on the day → 409).
  const [addedTaskIds, setAddedTaskIds] = useState<Set<string>>(new Set());
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const res = await fetch('/api/operations/content/grid', { credentials: 'include' });
    if (!res.ok) return;
    const body = await res.json();
    setGridScenes(body.scenes ?? []);
    setGridCells(body.cells ?? []);
  }, []);

  // Which tasks are ALREADY on the selected day — so "add to day" pre-marks them
  // (an unblocked daily-plan item still shows as "unscheduled", and re-adding hits
  // the @@unique([task_id, plan_date])). Read-only; no new write path.
  const loadDayItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/operations/daily-plan/items?from=${date}&to=${date}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const body = await res.json();
      const ids = new Set<string>();
      for (const it of body.items ?? []) if (it.task_id) ids.add(it.task_id as string);
      setAddedTaskIds(ids);
    } catch {
      /* leave prior state on a transient failure */
    }
  }, [date]);

  // CROSS-ENTITY sources + counts — Alex's day mixes personal routines with business
  // tasks, so the menus never hide his work. Loaded once, independent of the selector.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [routinesRes, tasksRes] = await Promise.all([
        fetch('/api/operations/routines', { credentials: 'include' }),
        fetch('/api/operations/tasks/unscheduled', { credentials: 'include' }),
      ]);
      if (!routinesRes.ok) throw new Error(`Failed to load routines (${routinesRes.status})`);
      const routinesBody = await routinesRes.json();
      setRoutines(routinesBody.routines ?? []);
      if (tasksRes.ok) setTasks((await tasksRes.json()).tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load content pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);
  useEffect(() => {
    void loadDayItems();
  }, [loadDayItems]);

  // Ensure a concrete entity is always selected (it scopes new-piece creation only).
  useEffect(() => {
    if (!selectedEntityId && entities.length > 0) {
      setSelectedEntityId((entities.find((e) => e.is_default) ?? entities[0]).id);
    }
  }, [selectedEntityId, entities, setSelectedEntityId]);

  // A scenify save → refresh counts (the grid refetches itself).
  useEffect(() => {
    const refresh = () => void loadCounts();
    window.addEventListener(CONTENT_SCENES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONTENT_SCENES_CHANGED_EVENT, refresh);
  }, [loadCounts]);

  const entityNameById = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities]
  );
  const sceneCount = gridScenes.length;
  const answeredCount = gridCells.filter((c) => (c.script ?? '').trim().length > 0).length;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectedRoutines = useMemo(
    () =>
      selected
        .map((id) => routines.find((r) => r.id === id))
        .filter((r): r is RoutineLite => !!r)
        .map((r) => ({ id: r.id, name: r.name })),
    [selected, routines]
  );

  // S1: assign a task to the selected date via the EXISTING daily-plan item route
  // (entity_id is derived server-side from the task). A 409 means it's already on the
  // day — treat as added (idempotent UX). Zero new write paths.
  const addTaskToDay = async (taskId: string) => {
    if (addingTaskId) return;
    setAddingTaskId(taskId);
    try {
      const res = await fetch('/api/operations/daily-plan/items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, plan_date: date }),
      });
      if (res.ok || res.status === 409) {
        setAddedTaskIds((prev) => new Set(prev).add(taskId));
        // Tell the day map (S2) + answer timeline (S3) to re-read the day's tasks.
        window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT));
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b?.message ?? b?.error ?? `failed to add task (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to add task to day');
    } finally {
      setAddingTaskId(null);
      // Resync from the source of truth (also catches the duplicate-500 case).
      void loadDayItems();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + truthful counts + the new-day entity selector. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-sm font-medium tracking-wide text-brand-purple">
          CONTENT PIPELINE
          <span className="ml-2 font-normal text-text-muted">inputs → script map → answer + record → script</span>
        </h1>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-0.5 rounded border border-border-light bg-bg-row text-text-primary">
            {sceneCount} scenes
          </span>
          <span className="px-2 py-0.5 rounded border border-border-light bg-bg-row text-text-primary">
            {answeredCount} answered
          </span>
          {entities.length > 0 && (
            <select
              value={selectedEntityId ?? ''}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="px-2 py-1 bg-white border border-brand-purple/40 rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              aria-label="New-day entity"
              title="Which entity a newly-created day is filed under (the day reads cross-entity)"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {/* 1 · INPUTS */}
      <section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
        <h2 className={sectionHeader}>
          1 · INPUTS
          <span className="ml-2 font-normal text-text-muted">pick routines to scenify · add tasks to the day</span>
        </h2>
        {loading ? (
          <p className="text-sm font-mono text-text-muted">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {/* Left: routines (selectable, order tracked) */}
            <div className="space-y-2">
              <h3 className="text-brand-purple font-medium uppercase tracking-wide">Routines</h3>
              {routines.length === 0 ? (
                <p className="text-text-muted">No routines — create one on the Routines tab.</p>
              ) : (
                <ul className="space-y-1">
                  {routines.map((r) => {
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
                              isSel ? 'bg-brand-purple text-white' : 'border border-border text-text-muted'
                            }`}
                            aria-hidden="true"
                          >
                            {isSel ? order + 1 : ''}
                          </span>
                          <span className="text-text-primary font-medium flex-1">{r.name}</span>
                          {entityNameById.get(r.entity_id) && (
                            <span className="text-text-muted break-words">{entityNameById.get(r.entity_id)}</span>
                          )}
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

            {/* Right: project tasks — SELECTABLE INPUTS (add to the selected day) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-brand-purple font-medium uppercase tracking-wide">Project tasks</h3>
                <span className="text-text-muted">add to {date}</span>
              </div>
              {tasks.length === 0 ? (
                <p className="text-text-muted">No unscheduled tasks.</p>
              ) : (
                <ul className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                  {tasks.map((t) => {
                    const added = addedTaskIds.has(t.id);
                    return (
                      <li
                        key={t.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded border border-border-light"
                      >
                        <span className="text-text-primary flex-1 break-words" title={t.title}>
                          {t.title}
                        </span>
                        {t.project && <span className="text-text-muted break-words max-w-[140px]">{t.project.title}</span>}
                        {t.project && entityNameById.get(t.project.entity_id) && (
                          <span className="text-text-muted break-words max-w-[110px]">
                            {entityNameById.get(t.project.entity_id)}
                          </span>
                        )}
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide ${
                            STATUS_PILL[t.status] ?? 'border-border text-text-muted'
                          }`}
                        >
                          {t.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => addTaskToDay(t.id)}
                          disabled={added || addingTaskId === t.id}
                          className={`shrink-0 px-2 py-0.5 rounded border text-[11px] ${
                            added
                              ? 'border-brand-purple text-brand-purple'
                              : 'border-brand-purple bg-brand-purple text-white hover:opacity-90'
                          } disabled:opacity-60`}
                        >
                          {added ? '✓ on day' : addingTaskId === t.id ? '…' : '+ add to day'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-text-muted">
                Adds the task to the day (commit times on the{' '}
                <a href="/operations" className="text-brand-purple hover:underline">Daily Plan</a> tab).
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 2 · AI SCRIPT MAP (renders inline when ≥1 routine selected) */}
      {selectedRoutines.length > 0 && (
        <ScenifyDraft routines={selectedRoutines} date={date} onSaved={loadCounts} />
      )}

      {/* 3 · ANSWER + RECORD — date at top, the answer timeline over the record grid. */}
      <section className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionHeader}>
            3 · ANSWER + RECORD
            <span className="ml-2 font-normal text-text-muted">answer the day → the evolution record</span>
          </h2>
          <label className="flex items-center gap-1.5 font-mono text-xs text-brand-purple font-medium">
            day
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 bg-white border border-brand-purple/40 rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              aria-label="Day"
            />
          </label>
        </div>
        <DailyLog date={date} />
        <PieceGrid />
      </section>

      {/* 4 · SCRIPT — the CE-5 mount point, labeled with its inputs. */}
      <section className="bg-white rounded border border-dashed border-brand-purple/40 p-5 text-center space-y-1">
        <div className={sectionHeader}>4 · SCRIPT</div>
        <div className="font-mono text-xs text-text-muted">
          generates from Scene + Narrative + B-Roll + Question + Answer + the day&rsquo;s task blocks — next (CE-5)
        </div>
      </section>
    </div>
  );
}
