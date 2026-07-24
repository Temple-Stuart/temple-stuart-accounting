/**
 * Section G · Content.
 *
 * Shell for the Content production tab. Fetches the three data
 * pipelines the tab is built on — scenes, takes, routines — and
 * renders loading / error / empty / populated states.
 *
 * Populated state renders the spreadsheet-style ContentTable plus an
 * Available Routines list (routines not yet scenified). Loading,
 * error and empty states stay as plain text.
 *
 * "Scenified" status is derived client-side: GET /api/operations/
 * routines does not include the content_scene_group relation, so we join
 * on routine_id against the scenes list.
 */

'use client';

import { useEffect, useState } from 'react';
import ContentTable, { type Scene, type Take, type Routine } from './ContentTable';
import AvailableRoutinesList from './AvailableRoutinesList';
import ScriptDrawer from './ScriptDrawer';
import ContentTableSkeleton from './ContentTableSkeleton';
import { themed, type Surface } from '@/lib/ds';

interface EntityLite {
  id: string;
  name: string;
}

export default function SectionG_Content({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [entities, setEntities] = useState<EntityLite[] | null>(null);
  // OPS-CE-4-flat: truthful badge sources — the REAL grid tables. The legacy
  // /content/scenes (scene_groups) + /content/takes (scene_rows) feed the table
  // below but lie as headline counts. Badges read scene-ROWS + ANSWERED cells.
  const [gridSceneRows, setGridSceneRows] = useState<{ entity_id: string }[]>([]);
  const [gridCells, setGridCells] = useState<{ entity_id: string; script: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptDrawerScene, setScriptDrawerScene] = useState<Scene | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [scenesRes, takesRes, routinesRes, entitiesRes, gridRes] = await Promise.all([
          fetch('/api/operations/content/scenes', { credentials: 'include' }),
          fetch('/api/operations/content/takes', { credentials: 'include' }),
          fetch('/api/operations/routines', { credentials: 'include' }),
          fetch('/api/entities', { credentials: 'include' }),
          fetch('/api/operations/content/grid', { credentials: 'include' }),
        ]);

        const parse = async (res: Response, label: string) => {
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`${label} request failed (${res.status}): ${body}`);
          }
          return res.json();
        };

        const [scenesBody, takesBody, routinesBody, entitiesBody, gridBody] = await Promise.all([
          parse(scenesRes, 'scenes'),
          parse(takesRes, 'takes'),
          parse(routinesRes, 'routines'),
          parse(entitiesRes, 'entities'),
          parse(gridRes, 'grid'),
        ]);

        if (cancelled) return;
        setScenes(scenesBody.scenes);
        setTakes(takesBody.takes);
        setRoutines(routinesBody.routines);
        setEntities(entitiesBody.entities);
        setGridSceneRows(gridBody.scenes ?? []);
        setGridCells(gridBody.cells ?? []);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'failed to load content');
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistic update — a successful scenify POST adds the new scene to
  // the table and marks its routine scenified, without a refetch.
  const handleScenify = (newScene: Scene) => {
    setScenes((prev) => [...(prev ?? []), newScene]);
    setRoutines((prev) =>
      prev
        ? prev.map((r) =>
            r.id === newScene.routine_id
              ? { ...r, content_scene_group: { id: newScene.id } }
              : r
          )
        : prev
    );
  };

  // Inline cell edit handlers (PR-Ops-4.9.3e). Each captures the previous
  // row, updates state optimistically, fires PATCH, and rolls back +
  // throws on failure so EditableCell can surface the message inline.
  const handleSceneUpdate = async (
    sceneId: string,
    field: string,
    value: string | number | null
  ) => {
    const previous = scenes?.find((s) => s.id === sceneId);
    if (!previous) throw new Error('scene not found in local state');

    setScenes((prev) =>
      prev ? prev.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s)) : prev
    );

    const res = await fetch(`/api/operations/content/scenes/${sceneId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });

    if (!res.ok) {
      setScenes((prev) =>
        prev ? prev.map((s) => (s.id === sceneId ? previous : s)) : prev
      );
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        msg = body.message || body.error || msg;
      } catch {
        // non-JSON response — fall through to status-based message
      }
      throw new Error(msg);
    }
  };

  const handleTakeUpdate = async (
    takeId: string,
    field: string,
    value: string | number | null
  ) => {
    const previous = takes?.find((t) => t.id === takeId);
    if (!previous) throw new Error('take not found in local state');

    setTakes((prev) =>
      prev ? prev.map((t) => (t.id === takeId ? { ...t, [field]: value } : t)) : prev
    );

    const res = await fetch(`/api/operations/content/takes/${takeId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });

    if (!res.ok) {
      setTakes((prev) =>
        prev ? prev.map((t) => (t.id === takeId ? previous : t)) : prev
      );
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        msg = body.message || body.error || msg;
      } catch {
        // non-JSON response — fall through to status-based message
      }
      throw new Error(msg);
    }
  };

  // Script drawer plumbing (PR-Ops-4.9.3f). Open by clicking the
  // truncated script cell on SceneHeaderRow; reuses handleSceneUpdate
  // for the PATCH so the optimistic + rollback behavior matches the
  // other scene fields.
  const handleScriptClick = (scene: Scene) => {
    setScriptDrawerScene(scene);
  };

  const handleScriptCancel = () => {
    setScriptDrawerScene(null);
  };

  const handleScriptSave = async (newScript: string | null) => {
    if (!scriptDrawerScene) return;
    await handleSceneUpdate(scriptDrawerScene.id, 'script', newScript);
    setScriptDrawerScene(null);
  };

  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5 space-y-4', dk)}>
      <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
        G · CONTENT
      </h2>

      {loading ? (
        <ContentTableSkeleton surface={surface} />
      ) : error ? (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      ) : !scenes || !routines || !takes || !entities ? (
        <p className={themed('text-sm font-mono text-text-faint', dk)}>Data missing.</p>
      ) : (
        <ContentSummary dk={dk}
          scenes={scenes}
          takes={takes}
          routines={routines}
          entities={entities}
          gridSceneRows={gridSceneRows}
          gridCells={gridCells}
          entityFilter={entityFilter}
          onEntityFilterChange={setEntityFilter}
          onScenify={handleScenify}
          onSceneUpdate={handleSceneUpdate}
          onTakeUpdate={handleTakeUpdate}
          onScriptClick={handleScriptClick}
        />
      )}

      {scriptDrawerScene && (
        <ScriptDrawer surface={surface}
          scene={scriptDrawerScene}
          open
          onSave={handleScriptSave}
          onCancel={handleScriptCancel}
        />
      )}
    </section>
  );
}

function ContentSummary({ dk = false,
  scenes,
  takes,
  routines,
  entities,
  gridSceneRows,
  gridCells,
  entityFilter,
  onEntityFilterChange,
  onScenify,
  onSceneUpdate,
  onTakeUpdate,
  onScriptClick,
}: { dk?: boolean;
  scenes: Scene[];
  takes: Take[];
  routines: Routine[];
  entities: EntityLite[];
  gridSceneRows: { entity_id: string }[];
  gridCells: { entity_id: string; script: string | null }[];
  entityFilter: string;
  onEntityFilterChange: (next: string) => void;
  onScenify: (newScene: Scene) => void;
  onSceneUpdate: (
    sceneId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
  onTakeUpdate: (
    takeId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
  onScriptClick: (scene: Scene) => void;
}) {
  // Entity options = entities that actually appear in this user's content
  // data (union of scenes + routines entity_ids). Names come from the
  // /api/entities response; falls back to the id if the entity row was
  // deleted but content still references it.
  const entityNameById = new Map(entities.map((e) => [e.id, e.name]));
  const referencedIds = new Set<string>();
  for (const s of scenes) referencedIds.add(s.entity_id);
  for (const r of routines) referencedIds.add(r.entity_id);
  const entityOptions = Array.from(referencedIds)
    .map((id) => ({ id, name: entityNameById.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Apply filter to all three arrays in one place so child components stay
  // unaware of the filter.
  const filteredScenes =
    entityFilter === 'all' ? scenes : scenes.filter((s) => s.entity_id === entityFilter);
  const filteredTakes =
    entityFilter === 'all' ? takes : takes.filter((t) => t.entity_id === entityFilter);
  const filteredRoutines =
    entityFilter === 'all'
      ? routines
      : routines.filter((r) => r.entity_id === entityFilter);

  const badgeClass =
    themed('px-2 py-0.5 text-xs font-mono rounded border border-border-light bg-bg-row text-text-primary', dk);

  // OPS-CE-4-flat: truthful badges read the REAL grid tables, not the legacy
  // scene_groups/scene_rows the table below renders. scenes = scene-ROW count
  // (operations_content_scenes); takes = ANSWERED cell count
  // (operations_content_takes with a non-empty script). Filtered by entity to
  // match the selector.
  const sceneRowCount = gridSceneRows.filter(
    (s) => entityFilter === 'all' || s.entity_id === entityFilter
  ).length;
  const answeredCellCount = gridCells.filter(
    (c) => (entityFilter === 'all' || c.entity_id === entityFilter) && (c.script ?? '').trim().length > 0
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={badgeClass}>{sceneRowCount} scenes</span>
          <span className={badgeClass}>{answeredCellCount} takes</span>
          <span className={badgeClass}>{filteredRoutines.length} routines</span>
        </div>
        <select
          value={entityFilter}
          onChange={(e) => onEntityFilterChange(e.target.value)}
          className={themed('px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple', dk)}
          aria-label="Filter by entity"
        >
          <option value="all">All entities</option>
          {entityOptions.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {filteredScenes.length === 0 ? (
        <>
          <div className={themed('flex flex-col items-center justify-center py-8 px-4 border border-border-light rounded bg-bg-row text-center', dk)}>
            <div className="text-2xl mb-2" aria-hidden="true">🎬</div>
            <div className={themed('text-sm font-mono font-semibold text-text-primary', dk)}>
              No scenes yet
            </div>
            <div className={themed('text-xs font-mono text-text-muted mt-1', dk)}>
              Pick a routine below to start filming.
            </div>
          </div>
          <AvailableRoutinesList surface={dk ? 'dark' : 'light'} routines={filteredRoutines} onScenify={onScenify} />
        </>
      ) : (
        <>
          <ContentTable surface={dk ? 'dark' : 'light'}
            scenes={filteredScenes}
            takes={filteredTakes}
            routines={filteredRoutines}
            onSceneUpdate={onSceneUpdate}
            onTakeUpdate={onTakeUpdate}
            onScriptClick={onScriptClick}
          />
          <AvailableRoutinesList surface={dk ? 'dark' : 'light'} routines={filteredRoutines} onScenify={onScenify} />
        </>
      )}
    </div>
  );
}
