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
import ScriptGenerator from './ScriptGenerator';
import PieceGrid from './PieceGrid';
import DailyLog from './DailyLog';
import ProjectCreateForm from '../projects/ProjectCreateForm';
import RoutineCreateForm from '../routines/RoutineCreateForm';

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
  // Tasks on the selected day: task_id → { itemId, committed }. The item id lets
  // INPUTS un-assign a planned piece via DELETE; `committed` (a calendar block
  // exists) guards that toggle so it never cascade-deletes committed time.
  const [dayByTaskId, setDayByTaskId] = useState<Map<string, { itemId: string; committed: boolean }>>(
    new Map()
  );
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);
  // Section 0 · CREATE — collapsed by default on every load (no persistence).
  const [createOpen, setCreateOpen] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const res = await fetch('/api/operations/content/grid', { credentials: 'include' });
    if (!res.ok) return;
    const body = await res.json();
    setGridScenes(body.scenes ?? []);
    setGridCells(body.cells ?? []);
  }, []);

  // Which tasks are ALREADY on the selected day — so "add to day" pre-marks them
  // (an unblocked daily-plan item still shows as "unscheduled", and re-adding hits
  // the @@unique([task_id, plan_date])). Read-only; no new write path. Each item
  // carries its id (for un-assign) and calendar_blocks (committed?) — see the GET
  // include at daily-plan/items/route.ts:90-107. This is the authoritative hydration
  // source for the task→item map, so it survives reloads.
  const loadDayItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/operations/daily-plan/items?from=${date}&to=${date}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const body = await res.json();
      const map = new Map<string, { itemId: string; committed: boolean }>();
      for (const it of body.items ?? []) {
        if (it.task_id) {
          map.set(it.task_id as string, {
            itemId: it.id as string,
            committed: Array.isArray(it.calendar_blocks) && it.calendar_blocks.length > 0,
          });
        }
      }
      setDayByTaskId(map);
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

  // A day-plan change (add / commit / uncommit / done) → refresh the S1 to-do pool
  // (/tasks/unscheduled drops committed + completed tasks) + the day pre-marks + counts.
  useEffect(() => {
    const refresh = () => {
      void load();
      void loadDayItems();
      void loadCounts();
    };
    window.addEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
  }, [load, loadDayItems, loadCounts]);

  // Auto-clear the create success banner after a few seconds (mirrors the
  // SectionB North Star success affordance).
  useEffect(() => {
    if (!createMsg) return;
    const t = setTimeout(() => setCreateMsg(null), 3000);
    return () => clearTimeout(t);
  }, [createMsg]);

  // After a successful create, collapse section 0 and re-run load() so the new
  // project's tasks / new routine surface in the INPUTS queues without a reload.
  const handleProjectCreated = useCallback(() => {
    setCreateOpen(false);
    setCreateMsg('project created');
    void load();
  }, [load]);
  const handleRoutineCreated = useCallback(() => {
    setCreateOpen(false);
    setCreateMsg('routine created');
    void load();
  }, [load]);

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
    if (addingTaskId || removingTaskId) return;
    setAddingTaskId(taskId);
    try {
      const res = await fetch('/api/operations/daily-plan/items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, plan_date: date }),
      });
      if (res.ok) {
        // 201 returns { item, isCreate } — capture the new item id so the row can
        // be un-assigned immediately (a fresh item has no block → not committed).
        const body = await res.json().catch(() => null);
        const newItemId = body?.item?.id;
        if (newItemId) {
          setDayByTaskId((prev) =>
            new Map(prev).set(taskId, { itemId: newItemId as string, committed: false })
          );
        }
        window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT));
      } else if (res.status === 409) {
        // Already on the day — the loadDayItems resync below maps it authoritatively.
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

  // Un-assign a task from the day (undo "✓ on day") via the EXISTING item DELETE
  // route. GUARD: if the task's piece has been time-committed (a calendar block
  // exists), refuse — never cascade-delete committed time from this toggle; the
  // user must uncommit on the day section below first.
  const removeTaskFromDay = async (taskId: string) => {
    if (addingTaskId || removingTaskId) return;
    const entry = dayByTaskId.get(taskId);
    if (!entry) return;
    if (entry.committed) {
      setError('This task has committed time on the day — uncommit it in the day section below before removing.');
      return;
    }
    setRemovingTaskId(taskId);
    try {
      const res = await fetch(`/api/operations/daily-plan/items/${entry.itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setDayByTaskId((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
        window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT));
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b?.message ?? b?.error ?? `failed to remove task (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to remove task from day');
    } finally {
      setRemovingTaskId(null);
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

      {/* 0 · CREATE — collapsed by default; make a project · make a routine, mirroring
          the homepage live-demo two-up layout. The forms are the SAME extracted
          components the Projects/Routines tabs use (one source of truth each). */}
      <section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
        <button
          type="button"
          onClick={() => setCreateOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={createOpen}
        >
          <h2 className={sectionHeader}>
            0 · CREATE
            <span className="ml-2 font-normal text-text-muted">make a project · make a routine</span>
          </h2>
          <span className="font-mono text-xs text-brand-purple" aria-hidden="true">
            {createOpen ? '▾ hide' : '▸ show'}
          </span>
        </button>

        {createMsg && (
          <div className="text-xs font-mono px-3 py-2 rounded border bg-green-50 border-green-200 text-green-800">
            {createMsg}
          </div>
        )}

        {createOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-brand-purple">
                Make a project
              </h3>
              <ProjectCreateForm
                entities={entities}
                defaultEntityId={selectedEntityId ?? ''}
                onCreated={handleProjectCreated}
                onCancel={() => setCreateOpen(false)}
              />
            </div>
            <div className="space-y-2">
              <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-brand-purple">
                Make a routine
              </h3>
              <RoutineCreateForm
                entities={entities}
                defaultEntityId={selectedEntityId ?? ''}
                onCreated={handleRoutineCreated}
                onCancel={() => setCreateOpen(false)}
              />
            </div>
          </div>
        )}
      </section>

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
            {/* Left: project tasks — SELECTABLE INPUTS (add to the selected day).
                Column order mirrors section 0 (project left / routine right). */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-brand-purple font-medium uppercase tracking-wide">Project tasks</h3>
                <span className="text-text-muted">add to {date}</span>
              </div>
              <div className="border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-text-muted">No unscheduled tasks.</p>
                ) : (
                  <ul className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                    {tasks.map((t) => {
                      const entry = dayByTaskId.get(t.id);
                      const added = !!entry;
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
                            onClick={() => (added ? removeTaskFromDay(t.id) : addTaskToDay(t.id))}
                            disabled={addingTaskId === t.id || removingTaskId === t.id}
                            title={
                              added
                                ? entry?.committed
                                  ? 'committed time — uncommit in the day section below to remove'
                                  : 'click to remove from day'
                                : 'add to the day'
                            }
                            className={`shrink-0 px-2 py-0.5 rounded border text-[11px] ${
                              added
                                ? 'border-brand-purple text-brand-purple hover:bg-purple-50'
                                : 'border-brand-purple bg-brand-purple text-white hover:opacity-90'
                            } disabled:opacity-60`}
                          >
                            {added
                              ? removingTaskId === t.id
                                ? 'removing…'
                                : '✓ on day'
                              : addingTaskId === t.id
                                ? '…'
                                : '+ add to day'}
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

            {/* Right: routines (selectable, order tracked) */}
            <div className="space-y-2">
              <h3 className="text-brand-purple font-medium uppercase tracking-wide">Routines</h3>
              <div className="border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
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

      {/* 4 · SCRIPT — the reel voiceover generator (CE-5). */}
      <ScriptGenerator date={date} />
    </div>
  );
}
