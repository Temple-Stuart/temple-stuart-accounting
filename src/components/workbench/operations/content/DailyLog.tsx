/**
 * DailyLog — Stage-2 answering surface (OPS-CE-4), FLAT and fully on the surface.
 *
 * A cell = Alex's ANSWER to the scene's question. This is a flat table — one ROW
 * per active scene, every column ALWAYS visible, nothing collapses or expands:
 *   # · ACTIVITY (+time) · QUESTION · B-ROLL · ANSWER (always-rendered textarea)
 * Type the answer inline, save per row with a visible per-row state. An
 * "n of m answered" line sits above the table. The whole day is one readable
 * surface (Alex's Excel model).
 *
 * Zero new write paths: POST /content/grid/piece (create the day, explicit
 * button) + POST /content/grid/cell (save an answer). Reads the shared grid GET.
 * Nothing generates here — the voiceover is CE-5. Storage unchanged: the answer
 * is operations_content_takes.script.
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

type RowState = 'idle' | 'saving' | 'saved' | 'error';

const todayISO = () => new Date().toISOString().slice(0, 10);
const dayOf = (iso: string) => iso.slice(0, 10);
const fmtTime = (t: string | null): string => {
  if (!t) return '';
  const m = t.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
};

const headerCellClass =
  'bg-bg-row border border-border-light px-2 py-1.5 text-left text-brand-purple font-semibold uppercase tracking-wide whitespace-nowrap';

export default function DailyLog() {
  const { selectedEntityId } = useOperationsEntity();
  const [date, setDate] = useState(todayISO());
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [pieces, setPieces] = useState<PieceCol[] | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Per-row local answer drafts + save state (keyed by scene id).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedEntityId ? `?entity_id=${encodeURIComponent(selectedEntityId)}` : '';
      const res = await fetch(`/api/operations/content/grid${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const body = await res.json();
      setScenes(body.scenes ?? []);
      setPieces(body.pieces ?? []);
      setCells(body.cells ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load daily log');
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          DAILY LOG
          <span className="ml-2 font-normal text-text-faint">answer the day, top to bottom</span>
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
              {dayScenes.map((s) => {
                const time = fmtTime(s.routine_step.time_of_day);
                const question =
                  s.assigned_question_text?.trim() || s.narrative_purpose?.trim() || null;
                const saved = (cellByScene.get(s.id)?.script ?? '').trim().length > 0;
                const state = rowState[s.id] ?? 'idle';
                return (
                  <tr key={s.id}>
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
                        {state === 'error' && (
                          <span className="text-red-700">{rowError[s.id] || 'failed'}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
