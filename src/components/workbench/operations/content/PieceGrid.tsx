/**
 * PieceGrid — Alex's content grid, pivoted.
 *
 * Rows    = scenes  (operations_content_scenes): the stable shot — labeled
 *           by their routine_step (order + activity), with shot meta
 *           (angle, shot_type) shown inline.
 * Columns = pieces  (operations_content_pieces): days. A "+ day" affordance
 *           creates a new column. If a piece links a project/version, that
 *           is surfaced read-only in the column header (no linking UI here —
 *           that is a later PR).
 * Cells   = takes   (operations_content_takes): the per-day script. Click a
 *           cell to edit it in the reused ScriptDrawer; saving upserts via
 *           POST /api/operations/content/grid/cell (the @@unique grid key).
 *
 * This is a NEW view that REUSES the ScriptDrawer primitive — it does not
 * reshape ContentTable. It reads/writes only the authed user's own data
 * (every route is user-scoped); the grid never fabricates a cell.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import ScriptDrawer from './ScriptDrawer';

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
  routine_step_id: string;
  camera_needed: string | null;
  filming_angle: string | null;
  shot_type: string | null;
  routine_step: RoutineStepLite;
}

interface PieceCol {
  id: string;
  entity_id: string;
  piece_date: string;
  title: string | null;
  project_id: string | null;
  source_ai_usage_id: string | null;
}

interface Cell {
  id: string;
  scene_id: string;
  piece_id: string;
  script: string | null;
}

interface EntityLite {
  id: string;
  name: string;
}

const cellKey = (sceneId: string, pieceId: string) => `${sceneId}:${pieceId}`;
const fmtDate = (iso: string) => iso.slice(0, 10);

export default function PieceGrid() {
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [pieces, setPieces] = useState<PieceCol[] | null>(null);
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [entities, setEntities] = useState<EntityLite[] | null>(null);
  const [entityId, setEntityId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The cell currently open in the drawer.
  const [active, setActive] = useState<{ scene: SceneRow; piece: PieceCol } | null>(null);

  // "+ day" inline form.
  const [addingDay, setAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [addDayError, setAddDayError] = useState<string | null>(null);
  const [addDaySaving, setAddDaySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [gridRes, entitiesRes] = await Promise.all([
          fetch('/api/operations/content/grid', { credentials: 'include' }),
          fetch('/api/entities', { credentials: 'include' }),
        ]);
        const parse = async (res: Response, label: string) => {
          if (!res.ok) throw new Error(`${label} failed (${res.status}): ${await res.text()}`);
          return res.json();
        };
        const [grid, entitiesBody] = await Promise.all([
          parse(gridRes, 'grid'),
          parse(entitiesRes, 'entities'),
        ]);
        if (cancelled) return;
        setScenes(grid.scenes);
        setPieces(grid.pieces);
        setCells(grid.cells);
        setEntities(entitiesBody.entities);
        // Default the entity selector to the first entity that has scenes,
        // else the first entity — so "+ day" always has a concrete target.
        const withScenes = (grid.scenes as SceneRow[])[0]?.entity_id;
        setEntityId(withScenes ?? (entitiesBody.entities as EntityLite[])[0]?.id ?? '');
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'failed to load grid');
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cellByKey = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of cells ?? []) m.set(cellKey(c.scene_id, c.piece_id), c);
    return m;
  }, [cells]);

  const visibleScenes = useMemo(
    () => (scenes ?? []).filter((s) => !entityId || s.entity_id === entityId),
    [scenes, entityId]
  );
  const visiblePieces = useMemo(
    () => (pieces ?? []).filter((p) => !entityId || p.entity_id === entityId),
    [pieces, entityId]
  );

  // Upsert a cell and merge the result into local state.
  const upsertCell = async (sceneId: string, pieceId: string, script: string | null) => {
    const res = await fetch('/api/operations/content/grid/cell', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, piece_id: pieceId, script }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
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
      const next = [...(prev ?? [])];
      const i = next.findIndex((c) => c.scene_id === sceneId && c.piece_id === pieceId);
      if (i >= 0) next[i] = cell;
      else next.push(cell);
      return next;
    });
  };

  const handleCellSave = async (script: string | null) => {
    if (!active) return;
    await upsertCell(active.scene.id, active.piece.id, script);
    setActive(null);
  };

  const handleAddDay = async () => {
    if (addDaySaving) return;
    setAddDayError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDayDate)) {
      setAddDayError('Pick a date.');
      return;
    }
    if (!entityId) {
      setAddDayError('Select an entity first.');
      return;
    }
    setAddDaySaving(true);
    try {
      const res = await fetch('/api/operations/content/grid/piece', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piece_date: newDayDate, entity_id: entityId }),
      });
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const b = await res.json();
          msg = b.message || b.error || msg;
        } catch {
          /* non-JSON */
        }
        throw new Error(msg);
      }
      const { piece } = (await res.json()) as { piece: PieceCol };
      setPieces((prev) => {
        const next = [...(prev ?? []), piece];
        next.sort((a, b) => a.piece_date.localeCompare(b.piece_date));
        return next;
      });
      setAddingDay(false);
      setNewDayDate('');
    } catch (e) {
      setAddDayError(e instanceof Error ? e.message : 'failed to add day');
    } finally {
      setAddDaySaving(false);
    }
  };

  const entityOptions = useMemo(() => {
    const nameById = new Map((entities ?? []).map((e) => [e.id, e.name]));
    const ids = new Set<string>();
    for (const s of scenes ?? []) ids.add(s.entity_id);
    for (const p of pieces ?? []) ids.add(p.entity_id);
    for (const e of entities ?? []) ids.add(e.id);
    return Array.from(ids)
      .map((id) => ({ id, name: nameById.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities, scenes, pieces]);

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          G · PIECE GRID
          <span className="ml-2 font-normal text-text-faint">scenes × days</span>
        </h2>
        {!loading && !error && entityOptions.length > 0 && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple"
            aria-label="Filter grid by entity"
          >
            {entityOptions.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm font-mono text-text-faint">Loading grid…</p>
      ) : error ? (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      ) : visibleScenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 border border-border-light rounded bg-bg-row text-center">
          <div className="text-2xl mb-2" aria-hidden="true">🎬</div>
          <div className="text-sm font-mono font-semibold text-text-primary">No scenes yet</div>
          <div className="text-xs font-mono text-text-muted mt-1">
            Scenify a routine on the Content table above — its steps become the grid rows.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs font-mono">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-bg-row border border-border-light px-3 py-2 text-left text-text-primary font-semibold min-w-[220px]">
                  Scene
                </th>
                {visiblePieces.map((p) => (
                  <th
                    key={p.id}
                    className="border border-border-light px-3 py-2 text-left text-brand-purple font-semibold min-w-[180px] align-top"
                  >
                    <div>{fmtDate(p.piece_date)}</div>
                    {p.title && (
                      <div className="font-normal text-text-muted truncate max-w-[160px]">{p.title}</div>
                    )}
                    {(p.project_id || p.source_ai_usage_id) && (
                      <div
                        className="font-normal text-text-faint"
                        title={`project ${p.project_id ?? '—'} · version ${p.source_ai_usage_id ?? '—'}`}
                      >
                        🔗 linked
                      </div>
                    )}
                  </th>
                ))}
                <th className="border border-border-light px-2 py-2 align-top">
                  {addingDay ? (
                    <div className="flex flex-col gap-1 min-w-[150px]">
                      <input
                        type="date"
                        value={newDayDate}
                        onChange={(e) => setNewDayDate(e.target.value)}
                        disabled={addDaySaving}
                        className="px-1 py-0.5 border border-border rounded text-xs font-mono focus:outline-none focus:border-brand-purple"
                        aria-label="New day date"
                      />
                      {addDayError && <div className="text-red-700">{addDayError}</div>}
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={handleAddDay}
                          disabled={addDaySaving}
                          className="px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
                        >
                          {addDaySaving ? '…' : 'Add'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingDay(false);
                            setAddDayError(null);
                            setNewDayDate('');
                          }}
                          disabled={addDaySaving}
                          className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingDay(true)}
                      className="px-2 py-1 border border-border rounded text-text-primary hover:bg-bg-row whitespace-nowrap"
                    >
                      + day
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleScenes.map((s) => (
                <tr key={s.id}>
                  <th className="sticky left-0 z-10 bg-white border border-border-light px-3 py-2 text-left align-top min-w-[220px]">
                    <div className="text-text-primary font-semibold">
                      {s.routine_step.step_order}. {s.routine_step.activity}
                    </div>
                    <div className="font-normal text-text-muted">
                      {[s.filming_angle, s.shot_type].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </th>
                  {visiblePieces.map((p) => {
                    const cell = cellByKey.get(cellKey(s.id, p.id));
                    const script = cell?.script ?? null;
                    return (
                      <td
                        key={p.id}
                        className="border border-border-light p-0 align-top min-w-[180px]"
                      >
                        <button
                          type="button"
                          onClick={() => setActive({ scene: s, piece: p })}
                          className="w-full h-full text-left px-3 py-2 hover:bg-bg-row min-h-[44px]"
                          title="Edit script"
                        >
                          {script ? (
                            <span className="text-text-primary whitespace-pre-wrap line-clamp-3">{script}</span>
                          ) : (
                            <span className="text-text-faint">+ script</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border border-border-light bg-bg-row" />
                </tr>
              ))}
            </tbody>
          </table>

          {visiblePieces.length === 0 && (
            <p className="mt-3 text-xs font-mono text-text-muted">
              No days yet — use <span className="text-text-primary">+ day</span> to add the first column.
            </p>
          )}
        </div>
      )}

      {active && (
        <ScriptDrawer
          open
          scene={{
            id: cellKey(active.scene.id, active.piece.id),
            scene_number: active.scene.routine_step.step_order,
            scene_title: `${active.scene.routine_step.activity} · ${fmtDate(active.piece.piece_date)}`,
            script: cellByKey.get(cellKey(active.scene.id, active.piece.id))?.script ?? null,
          }}
          onSave={handleCellSave}
          onCancel={() => setActive(null)}
        />
      )}
    </section>
  );
}
