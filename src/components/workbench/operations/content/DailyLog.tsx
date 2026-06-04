/**
 * DailyLog — Stage-2 answering surface (OPS-CE-4): answer a whole day top to bottom.
 *
 * Pick a day (default today). If no piece (day-column) exists yet, create it via
 * the EXISTING piece route. Then list the day's ACTIVE scenes in step order — each
 * showing # + activity + time, the QUESTION, the b-roll cue, and its answered
 * state. Tap a scene to expand the same compact AnswerEditor; saving upserts the
 * cell via the EXISTING cell route. A progress indicator shows n of m answered.
 *
 * Zero new write paths: reuses POST /content/grid/piece (create day) and
 * POST /content/grid/cell (save answer). Reads the shared grid GET. Nothing
 * generates here — the voiceover is CE-5.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import AnswerEditor from './AnswerEditor';

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

const todayISO = () => new Date().toISOString().slice(0, 10);
const dayOf = (iso: string) => iso.slice(0, 10);

const fmtTime = (t: string | null): string => {
  if (!t) return '';
  const m = t.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
};

export default function DailyLog() {
  const { selectedEntityId } = useOperationsEntity();
  const [date, setDate] = useState(todayISO());
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [pieces, setPieces] = useState<PieceCol[] | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSceneId, setOpenSceneId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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

  // Scenes for the selected entity, ordered by step. (Grid GET already returns
  // only ACTIVE scenes — archived steps are filtered server-side, CE-1.)
  const dayScenes = useMemo(
    () =>
      (scenes ?? [])
        .filter((s) => !selectedEntityId || s.entity_id === selectedEntityId)
        .sort((a, b) => a.routine_step.step_order - b.routine_step.step_order),
    [scenes, selectedEntityId]
  );

  // The piece (day-column) for the chosen date + entity, if it exists yet.
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

  const saveAnswer = async (sceneId: string, answer: string | null) => {
    if (!piece) return;
    const res = await fetch('/api/operations/content/grid/cell', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, piece_id: piece.id, script: answer }),
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const b = await res.json();
        msg = b.message || b.error || msg;
      } catch {
        /* non-JSON */
      }
      throw new Error(msg);
    }
    const { cell } = (await res.json()) as { cell: Cell };
    setCells((prev) => {
      const next = [...prev];
      const i = next.findIndex((c) => c.scene_id === cell.scene_id && c.piece_id === cell.piece_id);
      if (i >= 0) next[i] = cell;
      else next.push(cell);
      return next;
    });
    setOpenSceneId(null);
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
            onChange={(e) => {
              setDate(e.target.value);
              setOpenSceneId(null);
            }}
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
        <ul className="space-y-2">
          {dayScenes.map((s) => {
            const cell = cellByScene.get(s.id);
            const answer = cell?.script ?? null;
            const answered = (answer ?? '').trim().length > 0;
            const isOpen = openSceneId === s.id;
            const time = fmtTime(s.routine_step.time_of_day);
            const question = s.assigned_question_text?.trim() || s.narrative_purpose?.trim() || null;
            return (
              <li key={s.id} className="border border-border-light rounded font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setOpenSceneId(isOpen ? null : s.id)}
                  className="w-full text-left px-3 py-2 hover:bg-bg-row flex items-start gap-3"
                >
                  <span
                    className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                      answered ? 'bg-brand-purple text-white' : 'border border-border text-text-faint'
                    }`}
                    aria-hidden="true"
                  >
                    {answered ? '✓' : s.routine_step.step_order}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-text-primary font-semibold">
                      {s.routine_step.step_order}. {s.routine_step.activity}
                      {time && <span className="ml-2 font-normal text-text-muted">{time}</span>}
                    </span>
                    <span className="block text-text-primary mt-0.5">
                      {question ?? <span className="text-text-faint">no question assigned — set one in Scenify</span>}
                    </span>
                    {!isOpen && (
                      <span className="block mt-0.5 truncate">
                        {answered ? (
                          <span className="text-text-muted">{answer}</span>
                        ) : (
                          <span className="text-text-faint">tap to answer</span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-border-light">
                    <AnswerEditor
                      questionText={s.assigned_question_text}
                      narrativePurpose={s.narrative_purpose}
                      bRoll={s.b_roll}
                      activityLabel={`${s.routine_step.step_order}. ${s.routine_step.activity}`}
                      dateLabel={date}
                      initialAnswer={answer}
                      onSave={(a) => saveAnswer(s.id, a)}
                      onCancel={() => setOpenSceneId(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
