/**
 * RoutineList — cadence-grouped list of routines + inline create form.
 *
 * Self-fetches via GET /api/operations/routines on mount. Filters to
 * is_active=true by default with a "show inactive" toggle.
 *
 * Renders rows grouped by classifyCadence(schedule_rrule):
 *   Daily / Weekly / Monthly / Quarterly / Yearly / Custom
 *
 * "+ new routine" button opens an inline create form using the same
 * RRULEBuilder as the edit form.
 */

'use client';

import { useEffect, useState } from 'react';
import RoutineRow from './RoutineRow';
import RoutineCreateForm from './RoutineCreateForm';
import type { CadenceGroup, Routine } from './types';
import { CADENCE_GROUP_LABELS, CADENCE_GROUP_ORDER } from './types';
import type { Scene, Take } from '../content/ContentTable';

interface Entity {
  id: string;
  name: string;
}

interface Props {
  entities: Entity[];
  onCommitted?: () => void;
}

export default function RoutineList({ entities, onCommitted }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  // Entity to seed the create form with, captured when the form is opened so it
  // stays stable while open (identical to the pre-extraction behavior).
  const [createDefaultEntityId, setCreateDefaultEntityId] = useState('');

  const fetchRoutines = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = showInactive
        ? '/api/operations/routines'
        : '/api/operations/routines?is_active=true';
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load routines');
        setRoutines([]);
        return;
      }
      setRoutines(body.routines ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load routines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const refresh = () => {
    fetchRoutines();
    onCommitted?.();
  };

  // Optimistic update — a successful scenify POST adds the content_scene_group
  // relation to the routine so the 🎬 badge appears without a refetch.
  const handleScenify = (newScene: Scene) => {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === newScene.routine_id
          ? { ...r, content_scene_group: { id: newScene.id } }
          : r
      )
    );
  };

  // Optimistic update — a successful take-ify POST adds the content_scene
  // relation to the matching step so its 🎬 badge appears without a refetch.
  const handleTakeify = (newTake: Take) => {
    setRoutines((prev) =>
      prev.map((r) => ({
        ...r,
        steps: r.steps.map((s) =>
          s.id === newTake.routine_step_id
            ? { ...s, content_scene: { id: newTake.id } }
            : s
        ),
      }))
    );
  };

  const startCreate = () => {
    const initialEntity = entities[0]?.id ?? '';
    setCreateDefaultEntityId(initialEntity);
    setShowCreate(true);
  };

  // Group routines by classifyCadence-equivalent client-side bucketing.
  // We approximate by inspecting RRULE prefix; server's classifyCadence is
  // authoritative but not exposed by API in v0. For UI purposes the
  // approximation is sufficient.
  const groupOf = (rrule: string): CadenceGroup => {
    const upper = rrule.toUpperCase();
    if (upper.includes('FREQ=DAILY')) return 'daily';
    if (upper.includes('FREQ=WEEKLY')) return 'weekly';
    if (upper.includes('FREQ=YEARLY')) {
      const m = upper.match(/BYMONTH=([\d,]+)/);
      if (m) {
        const months = m[1].split(',').map(Number);
        if (months.length === 4 && months.every((x) => x % 3 === 0)) return 'quarterly';
      }
      return 'yearly';
    }
    if (upper.includes('FREQ=MONTHLY')) return 'monthly';
    return 'custom';
  };

  const grouped = new Map<CadenceGroup, Routine[]>();
  for (const r of routines) {
    const g = groupOf(r.schedule_rrule);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(r);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-text-muted">
            {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
          </span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span className="text-text-muted">show inactive</span>
          </label>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={startCreate}
            disabled={entities.length === 0}
            className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90 disabled:opacity-50"
          >
            + new routine
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <RoutineCreateForm
          entities={entities}
          defaultEntityId={createDefaultEntityId}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading routines…</div>
      ) : routines.length === 0 ? (
        <div className="text-xs font-mono text-text-muted italic">
          no routines yet — click "+ new routine" to create your first one. Bridgewater's Principles operationalize through cadence; this is where you set yours.
        </div>
      ) : (
        <div className="space-y-3">
          {CADENCE_GROUP_ORDER.map((g) => {
            const items = grouped.get(g);
            if (!items || items.length === 0) return null;
            return (
              <div key={g}>
                <div className="text-xs font-mono text-text-muted uppercase tracking-wide mb-1">
                  {CADENCE_GROUP_LABELS[g]} ({items.length})
                </div>
                <div className="space-y-1.5">
                  {items.map((r) => (
                    <RoutineRow
                      key={r.id}
                      routine={r}
                      entities={entities}
                      onUpdate={refresh}
                      onDelete={refresh}
                      onScenify={handleScenify}
                      onTakeify={handleTakeify}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
