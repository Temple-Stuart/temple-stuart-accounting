/**
 * useDayFeed — the ONE shared "content day" read+merge, extracted verbatim from
 * DailyLog (OPS-CE-8B) so the answer timeline (DailyLog) and the day calendar
 * (DayCalendar) consume the same interleaved routine-scenes + task-blocks feed and
 * can never drift. Pure presentation: the three EXISTING reads + the shared
 * dayOrder comparator (DAY_START=04:00 wrap). No new endpoint, no schema change.
 *
 * Reads (cross-entity, exactly as DailyLog did):
 *   - GET /content/grid           → scenes / pieces / cells (fetched once)
 *   - GET /operations/projects    → project-name map (fetched once)
 *   - GET /daily-plan/items?from&to → committed blocks for `date` (re-read on date
 *     change AND on CONTENT_DAY_PLAN_CHANGED_EVENT, same as before)
 *
 * Enrichments added during extraction (fields already fetched but dropped by the
 * old inline merge): task rows now carry entity_id + raw actual_start/actual_end as
 * first-class values (the label string is untouched), and scene rows carry the
 * step's duration_minutes (start + duration → an honest end; null stays null).
 *
 * Write state (cells/pieces) is owned here so DailyLog's optimistic saveRow/startDay
 * keep working unchanged via the exposed setters. The calendar ignores those.
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { CONTENT_DAY_PLAN_CHANGED_EVENT } from './ScenifyModal';
import {
  compareDayOrder,
  minuteOfDayFromInstant,
  minuteOfDayFromTime,
} from '@/lib/content/dayOrder';

export interface RoutineStepLite {
  id: string;
  step_order: number;
  activity: string;
  time_of_day: string | null;
  routine_id: string;
  // OPS-CE: optional step duration → lets a scene have an end (start + duration).
  // Null stays null — no imputed end.
  duration_minutes: number | null;
}
export interface SceneRow {
  id: string;
  entity_id: string;
  assigned_question_text: string | null;
  narrative_purpose: string | null;
  b_roll: string | null;
  routine_step: RoutineStepLite;
}
export interface PieceCol {
  id: string;
  entity_id: string;
  piece_date: string;
}
export interface Cell {
  id: string;
  scene_id: string;
  piece_id: string;
  script: string | null;
}
export interface CalendarBlock {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
}
export interface PlanItem {
  id: string;
  entity_id: string;
  ad_hoc_title: string | null;
  task: { id: string; title: string; project_id: string; status: string } | null;
  calendar_blocks: CalendarBlock[];
}

/** One flattened task row in the day feed. Carries the old fields verbatim PLUS the
 *  extraction enrichments (entity_id, actualStart, actualEnd). */
export interface DayTaskBlock {
  id: string;
  itemId: string;
  blockId: string | null;
  taskId: string | null;
  projectId: string | null;
  title: string;
  projectName: string | null;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  label: string;
  minute: number | null;
  order: number;
  planned: boolean;
  // Enrichments (audit: fetched-but-dropped → now first-class for the calendar).
  entity_id: string;
  actualStart: string | null;
  actualEnd: string | null;
}

export type TimelineRow =
  | { kind: 'scene'; minute: number | null; order: number; scene: SceneRow }
  | { kind: 'task'; minute: number | null; order: number; block: DayTaskBlock };

export interface UseDayFeed {
  timeline: TimelineRow[];
  dayScenes: SceneRow[];
  piece: PieceCol | null;
  cellByScene: Map<string, Cell>;
  answeredCount: number;
  loading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  // Exposed so DailyLog's optimistic answer/start-day writes update the shared state.
  setCells: Dispatch<SetStateAction<Cell[]>>;
  setPieces: Dispatch<SetStateAction<PieceCol[] | null>>;
}

const dayOf = (iso: string) => iso.slice(0, 10);

// Timestamptz instant → local wall-clock "HH:MM" for the task label DISPLAY.
const fmtClock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Untimed task rows sink after the untimed scenes; ordered among themselves by plan order.
const UNTIMED_TASK_ORDER_BASE = 100000;

export function useDayFeed(date: string): UseDayFeed {
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [pieces, setPieces] = useState<PieceCol[] | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [projectNameById, setProjectNameById] = useState<Record<string, string>>({});
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grid (scenes/pieces/cells) + project names — CROSS-ENTITY (no entity filter):
  // the day's reel reads every entity's scenes/answers. Fetched once.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gridRes, projRes] = await Promise.all([
        fetch('/api/operations/content/grid', { credentials: 'include' }),
        fetch('/api/operations/projects', { credentials: 'include' }),
      ]);
      if (!gridRes.ok) throw new Error(`Failed to load (${gridRes.status})`);
      const body = await gridRes.json();
      setScenes(body.scenes ?? []);
      setPieces(body.pieces ?? []);
      setCells(body.cells ?? []);
      if (projRes.ok) {
        const pb = await projRes.json();
        const map: Record<string, string> = {};
        for (const p of pb.projects ?? []) map[p.id] = p.title;
        setProjectNameById(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load daily log');
    } finally {
      setLoading(false);
    }
  }, []);

  // Committed task blocks for the selected day (read-only execution record).
  const loadBlocks = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/operations/daily-plan/items?from=${date}&to=${date}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const body = await res.json();
      setPlanItems(body.items ?? []);
    } catch {
      /* leave prior blocks on a transient failure */
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);
  // OPS-CE-8D: re-read the day's tasks when one is added on the day (S1 add-to-day).
  useEffect(() => {
    const refresh = () => void loadBlocks();
    window.addEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
  }, [loadBlocks]);

  // CROSS-ENTITY: every active scene for the day, regardless of entity.
  const dayScenes = useMemo(
    () =>
      (scenes ?? [])
        .slice()
        .sort((a, b) => a.routine_step.step_order - b.routine_step.step_order),
    [scenes]
  );

  // The day's CANONICAL piece: ONE piece per date = ONE reel. Resolve the first
  // piece for the date across ALL entities so cross-entity answers attach to a
  // single day column.
  const piece = useMemo(
    () => (pieces ?? []).find((p) => dayOf(p.piece_date) === date) ?? null,
    [pieces, date]
  );

  const cellByScene = useMemo(() => {
    const m = new Map<string, Cell>();
    if (piece) for (const c of cells) if (c.piece_id === piece.id) m.set(c.scene_id, c);
    return m;
  }, [cells, piece]);

  const answeredCount = useMemo(
    () => dayScenes.filter((s) => (cellByScene.get(s.id)?.script ?? '').trim().length > 0).length,
    [dayScenes, cellByScene]
  );

  // Flatten plan items into read-only task rows: one TIMED row per calendar block,
  // plus one UNTIMED "planned" row for any item with NO block yet.
  const taskBlocks = useMemo<DayTaskBlock[]>(() => {
    const rows: DayTaskBlock[] = [];
    let plannedIndex = 0;
    for (const item of planItems) {
      // CROSS-ENTITY: all items for the date (personal + business).
      const title = item.task?.title ?? item.ad_hoc_title ?? 'Untitled';
      const projectName = item.task?.project_id ? projectNameById[item.task.project_id] ?? null : null;
      const taskId = item.task?.id ?? null;
      const projectId = item.task?.project_id ?? null;
      if (item.calendar_blocks.length === 0) {
        // Assigned to the day but no time committed yet — visible immediately.
        rows.push({
          id: `item-${item.id}`,
          itemId: item.id,
          blockId: null,
          taskId,
          projectId,
          title,
          projectName,
          status: 'planned',
          scheduledStart: null,
          scheduledEnd: null,
          label: '',
          minute: null,
          order: UNTIMED_TASK_ORDER_BASE + plannedIndex++,
          planned: true,
          entity_id: item.entity_id,
          actualStart: null,
          actualEnd: null,
        });
        continue;
      }
      for (const b of item.calendar_blocks) {
        const useActual = !!b.actual_start;
        const start = useActual ? (b.actual_start as string) : b.scheduled_start;
        const end = useActual ? b.actual_end : b.scheduled_end;
        const label = `${fmtClock(start)}–${end ? fmtClock(end) : '…'} ${useActual ? '(actual)' : '(scheduled)'}`;
        const minute = minuteOfDayFromInstant(start);
        rows.push({
          id: b.id,
          itemId: item.id,
          blockId: b.id,
          taskId,
          projectId,
          title,
          projectName,
          status: b.status,
          scheduledStart: b.scheduled_start,
          scheduledEnd: b.scheduled_end,
          label,
          minute,
          order: minute,
          planned: false,
          entity_id: item.entity_id,
          actualStart: b.actual_start,
          actualEnd: b.actual_end,
        });
      }
    }
    return rows;
  }, [planItems, projectNameById]);

  // Merge-sort scenes + task blocks into one timeline via the ONE shared
  // day-anchored order (midnight wraps to day-end).
  const timeline = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = [
      ...dayScenes.map((s) => ({
        kind: 'scene' as const,
        minute: minuteOfDayFromTime(s.routine_step.time_of_day),
        order: s.routine_step.step_order,
        scene: s,
      })),
      ...taskBlocks.map((b) => ({ kind: 'task' as const, minute: b.minute, order: b.order, block: b })),
    ];
    rows.sort(compareDayOrder);
    return rows;
  }, [dayScenes, taskBlocks]);

  return {
    timeline,
    dayScenes,
    piece,
    cellByScene,
    answeredCount,
    loading,
    error,
    setError,
    setCells,
    setPieces,
  };
}
