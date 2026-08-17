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
import DayCalendar from './DayCalendar';
// CONTENT-PIPE: the ratified Pipe Frame — StageStrip REPLACES the CONTENT-V2
// 3-mode icon-tab toggler (control converted, never stacked; the lucide mode
// icons + ds.iconTab retire with it). The four canonical phases come from the
// shared config (landing/app lockstep by construction).
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import SectionHeader from '@/components/ui/SectionHeader';
import ProofStrip from '@/components/ui/ProofStrip';
import { PIPE_PHASES, type PipePhase } from '@/lib/pipePhases';

// Widened to the interface (the Travel precedent).
const [PIPE_INPUTS, PIPE_MAP, PIPE_ANSWER, PIPE_SCRIPT] =
  PIPE_PHASES.content as readonly PipePhase[];

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
// CONTENT-PIPE: the grid route's third array (grid/route.ts:78 returns
// { scenes, pieces, cells }) — read from the SAME existing fetch (loadCounts)
// for the 04 Script signal; a piece's `script` is the day's saved reel script.
interface GridPiece {
  piece_date: string;
  script: string | null;
}

const STATUS_PILL: Record<string, string> = {
  open: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-brand-purple/15 text-brand-purple',
  blocked: 'bg-amber-50 text-amber-700',
};

// Local YYYY-MM-DD (NOT toISOString — that flips to UTC and can show the wrong day).
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// CONTENT-V2: the stage header joins the SECTION_HEADER family on dark;
// the light /operations mount keeps its purple. Picked per-render (dk).

export default function ContentPipeline({ }: { } = {}) {
  const { entities, selectedEntityId, setSelectedEntityId } = useOperationsEntity();
  const [routines, setRoutines] = useState<RoutineLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [gridScenes, setGridScenes] = useState<GridScene[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [gridPieces, setGridPieces] = useState<GridPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  // Shared date — S1 (add-to-day) + S3 (the answer table) read the same day.
  const [date, setDate] = useState(todayLocal());
  // CONTENT-V2 → CONTENT-PIPE: one presentation useState — the PHASE control
  // (the StageStrip replaces the 3-mode icon-tab toggler). The shared `date`
  // stays HERE (the pipeline owns it, :80) so switching phases never loses
  // the day. Default 'answer' — the retired toggler defaulted 'calendar'
  // (the day view), and DayCalendar now rides the 03 Answer + Record surface
  // (same useDayFeed as the answer timeline — DailyLog.tsx:13): the tab's
  // first paint is preserved (the non-first-default precedent).
  const [phase, setPhase] = useState<'inputs' | 'map' | 'answer' | 'script'>('answer');
  const sectionHeader = 'text-sm font-medium tracking-wide text-brand-purple';
  // Tasks on the selected day: task_id → { itemId, committed }. The item id lets
  // INPUTS un-assign a planned piece via DELETE; `committed` (a calendar block
  // exists) guards that toggle so it never cascade-deletes committed time.
  const [dayByTaskId, setDayByTaskId] = useState<Map<string, { itemId: string; committed: boolean }>>(
    new Map()
  );
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const res = await fetch('/api/operations/content/grid', { credentials: 'include' });
    if (!res.ok) return;
    const body = await res.json();
    setGridScenes(body.scenes ?? []);
    setGridCells(body.cells ?? []);
    setGridPieces(body.pieces ?? []);
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

  const entityNameById = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities]
  );
  const sceneCount = gridScenes.length;
  const answeredCount = gridCells.filter((c) => (c.script ?? '').trim().length > 0).length;
  // CONTENT-PIPE: the 04 Script signal — a piece for the selected day with a
  // saved script (the ScriptGenerator canonical-piece idiom, its :86-89 date
  // match), derived from the SAME grid fetch as the counts above. Refreshes
  // when the existing event listeners refetch — a just-saved script registers
  // on the next grid refresh (the same live-ness the counts already have).
  const scriptForDay = useMemo(
    () => gridPieces.some((p) => p.piece_date.slice(0, 10) === date && (p.script ?? '').trim().length > 0),
    [gridPieces, date]
  );

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
        {/* CONTENT-V2: on dark the module band already titles the tab — the
            purple heading renders only on the light /operations mount. */}
                  <h1 className="text-lg font-bold text-brand-purple">
            Content
            <span className="ml-2 text-sm font-normal text-text-muted">inputs → script map → answer + record → script</span>
          </h1>

        <div className="flex items-center gap-2 text-xs">
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
        <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {/* CONTENT-PIPE: the phase strip — mode → phase: the 'log' mode's three
          sections graduate to their own surfaces (01 Inputs / 02 Script map /
          03 Answer + Record); 'script' → 04; the 'calendar' mode's DayCalendar
          rides 03 (it consumes the SAME useDayFeed as the answer timeline —
          DailyLog.tsx:13 — same day, same feed, can't drift). States are
          DERIVED INDICATORS, never locks.
          DRAFT-SURVIVAL (T3) preserved BY CONSTRUCTION: every surface stays
          MOUNTED and toggles via CSS show/hide — the house ToggleStrip pattern
          (ToggleStrip.tsx:145; ModuleLauncher tab sections) — so ScenifyDraft's
          local draft state (drafts/cameras, ScenifyDraft.tsx:138,:148) survives
          a phase switch exactly as it survived a stage switch; its own
          ≥1-routine conditional mount is preserved verbatim below. */}
      <StageStrip
        phases={([
          { key: 'inputs', num: PIPE_INPUTS.num, label: PIPE_INPUTS.name, subLabel: PIPE_INPUTS.subLabel,
            state: phase === 'inputs' ? 'active' : selected.length > 0 || dayByTaskId.size > 0 ? 'done' : 'pending' },
          { key: 'map', num: PIPE_MAP.num, label: PIPE_MAP.name, subLabel: PIPE_MAP.subLabel,
            state: phase === 'map' ? 'active' : sceneCount > 0 ? 'done' : 'pending' },
          { key: 'answer', num: PIPE_ANSWER.num, label: PIPE_ANSWER.name, subLabel: PIPE_ANSWER.subLabel,
            state: phase === 'answer' ? 'active' : answeredCount > 0 ? 'done' : 'pending' },
          { key: 'script', num: PIPE_SCRIPT.num, label: PIPE_SCRIPT.name, subLabel: PIPE_SCRIPT.subLabel,
            state: phase === 'script' ? 'active' : scriptForDay ? 'done' : 'pending' },
        ] as StagePhase[])}
        onSelect={(k) => setPhase(k as typeof phase)}
      />

      {/* ── 01 Inputs — §1 byte-moved onto its own surface. ── */}
      <div className={phase === 'inputs' ? 'block space-y-4' : 'hidden'}>
      <SectionHeader kicker={`${PIPE_INPUTS.num} / ${PIPE_INPUTS.name}`} right={`PHASE ${PIPE_INPUTS.num} OF 04`} />
      {/* 1 · INPUTS — projects/routines are CREATED in their own tabs; here you only
          SELECT existing ones (PR-Content-2 removed the redundant in-tab create step). */}
      <section className="bg-white rounded border border-border p-4 space-y-3">
        <h2 className={sectionHeader}>
          1 · INPUTS
          <span className="ml-2 font-normal text-text-muted">pick routines to scenify · add tasks to the day</span>
        </h2>
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 text-xs">
            {/* PR-Content-3: cues stack VERTICALLY (tasks above routines) with full data —
                project tasks first, routines below. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-brand-purple font-medium uppercase tracking-wide">Project tasks</h3>
                <span className="text-text-muted">add to {date}</span>
              </div>
              <div className="border border-border rounded p-3 bg-white text-xs space-y-3">
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
                          className="flex flex-col gap-1 px-2 py-1.5 rounded border border-border-light"
                        >
                          <span className="text-text-primary">{t.title}</span>
                          {t.project?.title && (
                            <span className="text-text-muted break-words">{t.project.title}</span>
                          )}
                          {t.project && entityNameById.get(t.project.entity_id) && (
                            <span className="text-text-muted break-words">
                              {entityNameById.get(t.project.entity_id)}
                            </span>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                                STATUS_PILL[t.status] ?? 'bg-gray-100 text-gray-600'
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
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="text-text-muted">
                  Adds the task to the day — commit a time inline on the task row.
                </p>
              </div>
            </div>

            {/* Right: routines (selectable, order tracked) */}
            <div className="space-y-2">
              <h3 className="text-brand-purple font-medium uppercase tracking-wide">Routines</h3>
              <div className="border border-border rounded p-3 bg-white text-xs space-y-3">
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
                                isSel ? ('bg-brand-purple text-white') : 'border border-border text-text-muted'
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
      </div>

      {/* ── 02 Script map — ScenifyDraft's ≥1-routine conditional preserved
            verbatim; the empty wording is §1's own sub-line fragment (:358),
            never invented. ── */}
      <div className={phase === 'map' ? 'block space-y-4' : 'hidden'}>
      <SectionHeader kicker={`${PIPE_MAP.num} / ${PIPE_MAP.name}`} right={`PHASE ${PIPE_MAP.num} OF 04`} />
      {selectedRoutines.length > 0 ? (
        <ScenifyDraft routines={selectedRoutines} date={date} onSaved={loadCounts} />
      ) : (
        <p className="text-sm text-text-muted">pick routines to scenify</p>
      )}
      </div>

      {/* ── 03 Answer + Record — DayCalendar rides this phase (same
            useDayFeed as the answer timeline); §3 byte-moved below it. ── */}
      <div className={phase === 'answer' ? 'block space-y-4' : 'hidden'}>
      <SectionHeader kicker={`${PIPE_ANSWER.num} / ${PIPE_ANSWER.name}`} right={`PHASE ${PIPE_ANSWER.num} OF 04`} />
      <DayCalendar date={date} onDateChange={setDate} />
      {/* 3 · ANSWER + RECORD — date at top, the answer timeline over the record grid. */}
      <section className="bg-white rounded border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionHeader}>
            3 · ANSWER + RECORD
            <span className="ml-2 font-normal text-text-muted">answer the day → the evolution record</span>
          </h2>
          <label className="flex items-center gap-1.5 text-xs text-brand-purple font-medium">
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
      </div>

      {/* ── 04 Script — the reel voiceover generator (CE-5), kept mounted. ── */}
      <div className={phase === 'script' ? 'block space-y-4' : 'hidden'}>
      <SectionHeader kicker={`${PIPE_SCRIPT.num} / ${PIPE_SCRIPT.name}`} right={`PHASE ${PIPE_SCRIPT.num} OF 04`} />
      <ScriptGenerator date={date} />
      </div>

      {/* CONTENT-PIPE: the receipts rail — the pipeline's own existing state
          (the header chips' sources :193-194 + the shared day :81 + the grid
          pieces): honest empties only ("no script yet" ⇐ ScriptGeneratorView's
          "null = no script generated/loaded yet", :35; "saved" ⇐ the
          container's PATCH save-script vocabulary, ScriptGenerator.tsx:6-7). */}
      <ProofStrip
        receipts={[
          { label: 'DAY', value: date },
          { label: 'SCENES', value: String(sceneCount) },
          { label: 'TAKES ANSWERED', value: String(answeredCount) },
          { label: 'REEL SCRIPT', value: scriptForDay ? 'saved' : undefined, emptyLabel: 'no script yet' },
        ]}
      />
    </div>
  );
}
