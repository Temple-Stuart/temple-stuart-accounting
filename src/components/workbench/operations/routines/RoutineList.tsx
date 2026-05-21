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
import RRULEBuilder from './RRULEBuilder';
import type { CadenceGroup, Routine, RoutineForm } from './types';
import { CADENCE_GROUP_LABELS, CADENCE_GROUP_ORDER, DEFAULT_ROUTINE_FORM } from './types';
import type { Scene, Take } from '../content/ContentTable';
import type { CoaAccountSummary } from '../projects/types';

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
  const [createForm, setCreateForm] = useState<RoutineForm>(DEFAULT_ROUTINE_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // COA accounts for the category dropdown — fetched per createForm.entity_id.
  // Mirrors TaskList.tsx:40-41,73-116 but keyed on the form's chosen entity
  // (the user selects entity inside the create form here, vs. TaskList which
  // gets entity_id as a prop). Empty list = no entity selected yet or fetch
  // failed; dropdown shows only "— None —" in that case.
  const [coaAccounts, setCoaAccounts] = useState<CoaAccountSummary[]>([]);
  const [coaFetchedForEntityId, setCoaFetchedForEntityId] = useState<string | null>(null);

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

  // Fetch COA accounts whenever the create-form's entity changes. Pattern
  // copied from TaskList.tsx:73-116. Skipping when entity is unset (initial
  // state); coaFetchedForEntityId is the per-entity cache key.
  useEffect(() => {
    const entityId = createForm.entity_id;
    if (!entityId) return;
    if (coaFetchedForEntityId === entityId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chart-of-accounts?entity_id=${encodeURIComponent(entityId)}`);
        if (!res.ok) {
          console.error('[RoutineList] COA fetch failed:', res.status);
          if (!cancelled) {
            setCoaAccounts([]);
            setCoaFetchedForEntityId(entityId);
          }
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        type CoaResponseRow = { code: string; name: string; accountType: string; entity_id: string };
        const list: CoaAccountSummary[] = (body.accounts ?? []).map((a: CoaResponseRow) => ({
          code: a.code,
          name: a.name,
          account_type: a.accountType,
          entity_id: a.entity_id,
        }));
        setCoaAccounts(list);
        setCoaFetchedForEntityId(entityId);
      } catch (e) {
        console.error('[RoutineList] COA fetch error:', e);
        if (!cancelled) {
          setCoaAccounts([]);
          setCoaFetchedForEntityId(entityId);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createForm.entity_id, coaFetchedForEntityId]);

  const refresh = () => {
    fetchRoutines();
    onCommitted?.();
  };

  // Optimistic update — a successful scenify POST adds the content_scene
  // relation to the routine so the 🎬 badge appears without a refetch.
  const handleScenify = (newScene: Scene) => {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === newScene.routine_id
          ? { ...r, content_scene: { id: newScene.id } }
          : r
      )
    );
  };

  // Optimistic update — a successful take-ify POST adds the content_take
  // relation to the matching step so its 🎬 badge appears without a refetch.
  const handleTakeify = (newTake: Take) => {
    setRoutines((prev) =>
      prev.map((r) => ({
        ...r,
        steps: r.steps.map((s) =>
          s.id === newTake.routine_step_id
            ? { ...s, content_take: { id: newTake.id } }
            : s
        ),
      }))
    );
  };

  const startCreate = () => {
    const initialEntity = entities[0]?.id ?? '';
    setCreateForm({ ...DEFAULT_ROUTINE_FORM, entity_id: initialEntity });
    setCreateError(null);
    setShowCreate(true);
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setCreateForm(DEFAULT_ROUTINE_FORM);
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/operations/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          start_date: createForm.start_date || null,
          end_date: createForm.end_date || null,
          start_time: createForm.start_time || null,
          end_time: createForm.end_time || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(body?.message ?? body?.error ?? 'failed to create');
        return;
      }
      cancelCreate();
      refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'failed to create');
    } finally {
      setCreateSaving(false);
    }
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

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

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
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
          <div className="font-bold text-text-primary">new routine</div>
          {createError && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className={labelClass}>name</div>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className={inputClass}
                maxLength={200}
                placeholder="e.g., Morning reflection"
              />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>description (optional)</div>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="what does this routine accomplish?"
              />
            </div>
            <div>
              <div className={labelClass}>entity</div>
              <select
                value={createForm.entity_id}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    entity_id: e.target.value,
                    // Reset coa_code on entity change — COA is entity-scoped.
                    // No silent carry-over; user picks again for the new entity.
                    coa_code: '',
                  })
                }
                className={inputClass}
              >
                <option value="">— select —</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelClass}>category (optional)</div>
              <select
                value={createForm.coa_code}
                onChange={(e) => setCreateForm({ ...createForm, coa_code: e.target.value })}
                className={inputClass}
                disabled={!createForm.entity_id}
              >
                <option value="">— None —</option>
                {coaAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <RRULEBuilder form={createForm} setForm={setCreateForm} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>est. cost usd (optional)</div>
              <input
                type="text"
                value={createForm.estimated_cost_usd}
                onChange={(e) => setCreateForm({ ...createForm, estimated_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>start date (optional)</div>
              <input
                type="date"
                value={createForm.start_date}
                onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>end date (optional)</div>
              <input
                type="date"
                value={createForm.end_date}
                onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>start time (optional)</div>
              <input
                type="time"
                value={createForm.start_time}
                onChange={(e) => setCreateForm({ ...createForm, start_time: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>end time (optional)</div>
              <input
                type="time"
                value={createForm.end_time}
                onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {createSaving ? 'creating…' : 'create routine'}
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
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
