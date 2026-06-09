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
 * The read + interleave (fetches, merge, DAY_START order) now live in the shared
 * useDayFeed(date) hook (so the day calendar consumes the SAME feed and can't drift).
 * DailyLog owns only the answer-write UI (per-scene drafts, save, start-day) — those
 * mutate the hook's cells/pieces via the exposed setters. Zero behavior change.
 *
 * Zero new write paths: writes only via the existing /content/grid/cell (answer) +
 * /content/grid/piece (start day). No AI (CE-5). Storage unchanged: answer = take.script.
 */

'use client';

import { useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import TaskBand from './TaskBand';
import {
  useDayFeed,
  type SceneRow,
  type Cell,
  type DayTaskBlock,
  type DayTravelBlock,
} from './useDayFeed';

type RowState = 'idle' | 'saving' | 'saved' | 'error';

// "1970-01-01T07:30:00Z" (Prisma @db.Time) → "07:30" for DISPLAY. Sort minutes come
// from the shared dayOrder helper (in useDayFeed) so S3 and the record grid can't drift.
const fmtTimeOfDay = (t: string | null): string => {
  if (!t) return '';
  const m = t.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
};

const headerCellClass =
  'bg-bg-row border border-border-light px-2 py-1.5 text-left text-brand-purple font-semibold uppercase tracking-wide whitespace-nowrap';

export default function DailyLog({ date }: { date: string }) {
  // selectedEntityId is used ONLY to create the day's canonical piece. Reading is
  // CROSS-ENTITY (OPS-CE-8): the day is ONE reel — scenes/answers/blocks span entities.
  const { selectedEntityId } = useOperationsEntity();

  // The shared day feed: cross-entity scenes/answers + the day's committed blocks,
  // merged + DAY_START-ordered. setCells/setPieces/setError back the write UI below.
  const {
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
  } = useDayFeed(date);

  const [starting, setStarting] = useState(false);

  // Per-row local answer drafts + save state (scene rows only).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const draftFor = (sceneId: string) =>
    drafts[sceneId] !== undefined ? drafts[sceneId] : cellByScene.get(sceneId)?.script ?? '';

  const startDay = async () => {
    if (starting) return;
    if (!selectedEntityId) {
      setError('Pick an entity in the pipeline header to start a log.');
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
    const question = s.assigned_question_text?.trim() || null;
    const narrative = s.narrative_purpose?.trim() || null;
    const saved = (cellByScene.get(s.id)?.script ?? '').trim().length > 0;
    const state = rowState[s.id] ?? 'idle';
    return (
      <tr key={`scene-${s.id}`}>
        <td className="border border-border-light px-2 py-1 align-top text-center">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
              saved ? 'bg-brand-purple text-white' : 'border border-border text-text-muted'
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
        <td className="border border-border-light px-2 py-1 align-top min-w-[180px]">
          {narrative ? (
            <span className="text-text-muted">{narrative}</span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </td>
        <td className="border border-border-light px-2 py-1 align-top min-w-[200px]">
          {question ? (
            <span className="text-text-primary">{question}</span>
          ) : (
            <span className="text-text-muted">none — set in the script map</span>
          )}
        </td>
        <td className="border border-border-light px-2 py-1 align-top min-w-[150px] text-text-muted">
          {s.b_roll?.trim() ? (
            <span>
              <span aria-hidden="true">🎥</span> {s.b_roll}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
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

  // Read-only execution band — fully legible, labeled, wrapped (shared TaskBand).
  const renderTaskRow = (b: DayTaskBlock) => (
    <tr key={`task-${b.id}`}>
      <td colSpan={6} className="border border-border-light border-l-4 border-l-amber-400 bg-amber-50/50 px-3 py-2 align-top">
        <TaskBand
          date={date}
          planned={b.planned}
          itemId={b.itemId}
          blockId={b.blockId}
          taskId={b.taskId}
          projectId={b.projectId}
          title={b.title}
          projectName={b.projectName}
          status={b.status}
          scheduledStart={b.scheduledStart}
          scheduledEnd={b.scheduledEnd}
          timeLabel={b.label}
        />
      </td>
    </tr>
  );

  // Read-only travel band — cyan left edge (house trip color), time · vendor · cost.
  // Minimal sibling of renderTaskRow; no TaskBand (that's task-specific).
  const renderTravelRow = (t: DayTravelBlock) => (
    <tr key={`travel-${t.id}`}>
      <td colSpan={6} className="border border-border-light border-l-4 border-l-cyan-500 bg-cyan-50/50 px-3 py-2 align-top">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs">
          <span className="tabular-nums text-text-muted">{t.label}</span>
          <span className="font-medium text-text-primary break-words">{t.title}</span>
          {t.coaCode && <span className="text-text-faint">· {t.coaCode}</span>}
          {t.recurrence === 'daily' && <span className="text-cyan-700">· daily</span>}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-mono text-sm font-medium tracking-wide text-brand-purple">
          ANSWER
          <span className="ml-2 font-normal text-text-muted">the day, top to bottom — mindset + execution</span>
        </h3>
        {piece && dayScenes.length > 0 && (
          <span className="font-mono text-xs text-text-muted">
            {answeredCount} of {dayScenes.length} answered
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-mono text-text-muted">Loading…</p>
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
                <th className={headerCellClass}>Narrative</th>
                <th className={headerCellClass}>Question</th>
                <th className={headerCellClass}>B-Roll</th>
                <th className={headerCellClass}>Answer</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) =>
                row.kind === 'scene' ? renderSceneRow(row.scene)
                : row.kind === 'travel' ? renderTravelRow(row.travel)
                : renderTaskRow(row.block)
              )}
              {!timeline.some((row) => row.kind === 'task') && (
                <tr>
                  <td colSpan={6} className="border border-border-light px-3 py-1.5 text-text-muted">
                    no task blocks committed — assign tasks in section 1 or on the Daily Plan tab
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
