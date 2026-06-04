/**
 * DailyLog — the unified DAY TIMELINE (OPS-CE-6), flat and fully on the surface.
 *
 * One flat table for the picked day, two row kinds interleaved by time:
 *   • SCENE rows (mindset): # · activity(+time) · question · b-roll · inline ANSWER
 *     — answerable (unchanged from CE-4-flat).
 *   • TASK rows (execution proof): a visually distinct band spanning the row —
 *     time (actual if logged, else scheduled, labeled) · task · project · status.
 *     READ-ONLY here; the proof is committed on the Daily Plan tab (daily_plan_items
 *     → calendar_blocks). This is the execution record CE-5 will script from.
 *
 * Ordering: timed rows (blocks: actual??scheduled; scenes: step time_of_day) sort by
 * minute-of-day; untimed scenes fall to the end by step_order (no fabricated times).
 *
 * Zero new write paths: reads /content/grid (scenes/pieces/cells),
 * /daily-plan/items?from=&to= (committed blocks), /operations/projects (names);
 * writes only via the existing /content/grid/cell (answer) + /content/grid/piece
 * (start day). No AI (CE-5). Storage unchanged: the answer is take.script.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';

interface RoutineStepLite {
  id: string;
  step_order: number;
  activity: string;
  time_of_day: string | null;
  routine_id: string;
}
interface SceneRow {
  id: string;
  entity_id: string;
  assigned_question_text: string | null;
  narrative_purpose: string | null;
  b_roll: string | null;
  routine_step: RoutineStepLite;
}
interface PieceCol {
  id: string;
  entity_id: string;
  piece_date: string;
}
interface Cell {
  id: string;
  scene_id: string;
  piece_id: string;
  script: string | null;
}
interface CalendarBlock {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
}
interface PlanItem {
  id: string;
  entity_id: string;
  ad_hoc_title: string | null;
  task: { id: string; title: string; project_id: string; status: string } | null;
  calendar_blocks: CalendarBlock[];
}

type RowState = 'idle' | 'saving' | 'saved' | 'error';

// Local YYYY-MM-DD (NOT toISOString — that flips to UTC and can show "tomorrow"
// or "yesterday" depending on the user's offset). OPS-CE-6 default-day fix.
const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const dayOf = (iso: string) => iso.slice(0, 10);

// "1970-01-01T07:30:00Z" (Prisma @db.Time) → "07:30"; minutes-of-day for sorting.
const fmtTimeOfDay = (t: string | null): string => {
  if (!t) return '';
  const m = t.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
};
const minuteOfTimeOfDay = (t: string | null): number | null => {
  const hhmm = fmtTimeOfDay(t);
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
// Timestamptz instant → local wall-clock "HH:MM" + minutes-of-day.
const fmtClock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const minuteOfInstant = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const headerCellClass =
  'bg-bg-row border border-border-light px-2 py-1.5 text-left text-brand-purple font-semibold uppercase tracking-wide whitespace-nowrap';

export default function DailyLog() {
  const { selectedEntityId } = useOperationsEntity();
  const [date, setDate] = useState(todayLocal());
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [pieces, setPieces] = useState<PieceCol[] | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [projectNameById, setProjectNameById] = useState<Record<string, string>>({});
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Per-row local answer drafts + save state (scene rows only).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // Grid (scenes/pieces/cells) + project names — entity-scoped, not date-scoped.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedEntityId ? `?entity_id=${encodeURIComponent(selectedEntityId)}` : '';
      const [gridRes, projRes] = await Promise.all([
        fetch(`/api/operations/content/grid${qs}`, { credentials: 'include' }),
        fetch(`/api/operations/projects${qs}`, { credentials: 'include' }),
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
  }, [selectedEntityId]);

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

  const dayScenes = useMemo(
    () =>
      (scenes ?? [])
        .filter((s) => !selectedEntityId || s.entity_id === selectedEntityId)
        .sort((a, b) => a.routine_step.step_order - b.routine_step.step_order),
    [scenes, selectedEntityId]
  );

  const piece = useMemo(
    () =>
      (pieces ?? []).find(
        (p) => dayOf(p.piece_date) === date && (!selectedEntityId || p.entity_id === selectedEntityId)
      ) ?? null,
    [pieces, date, selectedEntityId]
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

  // Flatten committed blocks (entity-scoped) into read-only task rows.
  const taskBlocks = useMemo(() => {
    const rows: {
      id: string;
      title: string;
      projectName: string | null;
      status: string;
      label: string;
      minute: number;
    }[] = [];
    for (const item of planItems) {
      if (selectedEntityId && item.entity_id !== selectedEntityId) continue;
      for (const b of item.calendar_blocks) {
        const useActual = !!b.actual_start;
        const start = useActual ? (b.actual_start as string) : b.scheduled_start;
        const end = useActual ? b.actual_end : b.scheduled_end;
        const label = `${fmtClock(start)}–${end ? fmtClock(end) : '…'} ${useActual ? '(actual)' : '(scheduled)'}`;
        rows.push({
          id: b.id,
          title: item.task?.title ?? item.ad_hoc_title ?? 'Untitled',
          projectName: item.task?.project_id ? projectNameById[item.task.project_id] ?? null : null,
          status: b.status,
          label,
          minute: minuteOfInstant(start),
        });
      }
    }
    return rows;
  }, [planItems, selectedEntityId, projectNameById]);

  // Merge-sort scenes + task blocks into one timeline. Timed rows by minute-of-day;
  // untimed scenes (no step time) sink to the end by step_order (no fabricated time).
  type TimelineRow =
    | { kind: 'scene'; minute: number | null; order: number; scene: SceneRow }
    | { kind: 'task'; minute: number; order: number; block: (typeof taskBlocks)[number] };
  const timeline = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = [
      ...dayScenes.map((s) => ({
        kind: 'scene' as const,
        minute: minuteOfTimeOfDay(s.routine_step.time_of_day),
        order: s.routine_step.step_order,
        scene: s,
      })),
      ...taskBlocks.map((b) => ({ kind: 'task' as const, minute: b.minute, order: b.minute, block: b })),
    ];
    rows.sort((a, b) => {
      if (a.minute == null && b.minute == null) return a.order - b.order;
      if (a.minute == null) return 1;
      if (b.minute == null) return -1;
      if (a.minute !== b.minute) return a.minute - b.minute;
      if (a.kind !== b.kind) return a.kind === 'scene' ? -1 : 1; // scene before task on a tie
      return a.order - b.order;
    });
    return rows;
  }, [dayScenes, taskBlocks]);

  const draftFor = (sceneId: string) =>
    drafts[sceneId] !== undefined ? drafts[sceneId] : cellByScene.get(sceneId)?.script ?? '';

  const startDay = async () => {
    if (starting) return;
    if (!selectedEntityId) {
      setError('Select an entity (top of the Operations tab) to start a log.');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/content/grid/piece', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piece_date: date, entity_id: selectedEntityId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `failed (${res.status})`);
      setPieces((prev) => [...(prev ?? []), body.piece]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to start the day');
    } finally {
      setStarting(false);
    }
  };

  const saveRow = async (sceneId: string) => {
    if (!piece) return;
    if (rowState[sceneId] === 'saving') return;
    const trimmed = draftFor(sceneId).trim();
    const next: string | null = trimmed === '' ? null : trimmed;
    setRowState((p) => ({ ...p, [sceneId]: 'saving' }));
    setRowError((p) => ({ ...p, [sceneId]: '' }));
    try {
      const res = await fetch('/api/operations/content/grid/cell', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_id: sceneId, piece_id: piece.id, script: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `failed (${res.status})`);
      const cell = body.cell as Cell;
      setCells((prev) => {
        const arr = [...prev];
        const i = arr.findIndex((c) => c.scene_id === cell.scene_id && c.piece_id === cell.piece_id);
        if (i >= 0) arr[i] = cell;
        else arr.push(cell);
        return arr;
      });
      setRowState((p) => ({ ...p, [sceneId]: 'saved' }));
    } catch (e) {
      setRowState((p) => ({ ...p, [sceneId]: 'error' }));
      setRowError((p) => ({ ...p, [sceneId]: e instanceof Error ? e.message : 'failed' }));
    }
  };

  const renderSceneRow = (s: SceneRow) => {
    const time = fmtTimeOfDay(s.routine_step.time_of_day);
    const question = s.assigned_question_text?.trim() || s.narrative_purpose?.trim() || null;
    const saved = (cellByScene.get(s.id)?.script ?? '').trim().length > 0;
    const state = rowState[s.id] ?? 'idle';
    return (
      <tr key={`scene-${s.id}`}>
        <td className="border border-border-light px-2 py-1 align-top text-center">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
              saved ? 'bg-brand-purple text-white' : 'border border-border text-text-faint'
            }`}
            aria-hidden="true"
          >
            {saved ? '✓' : s.routine_step.step_order}
          </span>
        </td>
        <td className="border border-border-light px-2 py-1 align-top min-w-[150px]">
          <div className="text-text-primary font-medium">{s.routine_step.activity}</div>
          {time && <div className="text-text-muted">{time}</div>}
        </td>
        <td className="border border-border-light px-2 py-1 align-top min-w-[200px]">
          {question ? (
            <span className="text-text-primary">{question}</span>
          ) : (
            <span className="text-text-faint">none — set in Scenify</span>
          )}
        </td>
        <td className="border border-border-light px-2 py-1 align-top min-w-[150px] text-text-muted">
          {s.b_roll?.trim() ? (
            <span>
              <span aria-hidden="true">🎥</span> {s.b_roll}
            </span>
          ) : (
            <span className="text-text-faint">—</span>
          )}
        </td>
        <td className="border border-border-light px-2 py-1 align-top min-w-[260px]">
          <textarea
            value={draftFor(s.id)}
            onChange={(e) => {
              const v = e.target.value;
              setDrafts((p) => ({ ...p, [s.id]: v }));
              setRowState((p) => ({ ...p, [s.id]: 'idle' }));
            }}
            rows={3}
            placeholder="answer the question in your own words…"
            className="w-full resize-y border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-brand-purple"
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => saveRow(s.id)}
              disabled={state === 'saving'}
              className="px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {state === 'saving' ? 'Saving…' : 'Save answer'}
            </button>
            {state === 'saved' && <span className="text-brand-purple">✓ saved</span>}
            {state === 'error' && <span className="text-red-700">{rowError[s.id] || 'failed'}</span>}
          </div>
        </td>
      </tr>
    );
  };

  // Read-only execution band — a task block, visually distinct (gold left accent).
  const renderTaskRow = (b: (typeof taskBlocks)[number]) => (
    <tr key={`task-${b.id}`}>
      <td colSpan={5} className="border border-border-light border-l-4 border-l-amber-400 bg-amber-50/50 px-3 py-1.5 align-top">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-amber-700" aria-hidden="true">▦</span>
          <span className="text-text-primary font-semibold tabular-nums">{b.label}</span>
          <span className="text-text-primary">{b.title}</span>
          {b.projectName && <span className="text-text-muted">· {b.projectName}</span>}
          <span className="ml-auto px-1.5 py-0.5 rounded border border-amber-300 bg-white text-amber-700 text-[10px] uppercase tracking-wide">
            {b.status}
          </span>
        </div>
      </td>
    </tr>
  );

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          DAILY LOG
          <span className="ml-2 font-normal text-text-faint">the day, top to bottom — mindset + execution</span>
        </h2>
        <div className="flex items-center gap-2">
          {piece && dayScenes.length > 0 && (
            <span className="font-mono text-xs text-text-muted">
              {answeredCount} of {dayScenes.length} answered
            </span>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple"
            aria-label="Log date"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-mono text-text-faint">Loading…</p>
      ) : dayScenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 border border-border-light rounded bg-bg-row text-center">
          <div className="text-2xl mb-2" aria-hidden="true">🎬</div>
          <div className="text-sm font-mono font-semibold text-text-primary">No scenes yet</div>
          <div className="text-xs font-mono text-text-muted mt-1">
            Scenify a routine first — its steps become the scenes you answer here.
          </div>
        </div>
      ) : !piece ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 border border-border-light rounded bg-bg-row text-center gap-3">
          <div className="text-xs font-mono text-text-muted">
            No log started for <span className="text-text-primary font-semibold">{date}</span> yet.
          </div>
          <button
            type="button"
            onClick={startDay}
            disabled={starting}
            className="px-3 py-1.5 font-mono text-xs border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {starting ? 'Starting…' : `Start ${date} log`}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs font-mono w-full">
            <thead>
              <tr>
                <th className={`${headerCellClass} text-center`}>#</th>
                <th className={headerCellClass}>Activity</th>
                <th className={headerCellClass}>Question</th>
                <th className={headerCellClass}>B-Roll</th>
                <th className={headerCellClass}>Answer</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) =>
                row.kind === 'scene' ? renderSceneRow(row.scene) : renderTaskRow(row.block)
              )}
              {taskBlocks.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-border-light px-3 py-1.5 text-text-faint">
                    no task blocks committed — assign tasks on the Daily Plan tab
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
