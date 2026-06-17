/**
 * RoutineCreateForm — the REAL, server-backed routine create form, extracted
 * verbatim from RoutineList so it can be mounted both there and on the Content
 * tab's "0 · CREATE" section (one source of truth).
 *
 * Owns its own submit (POST /api/operations/routines) — unchanged from the
 * original inline form (the server compiles schedule_rrule from the structured
 * form via RRULEBuilder; the date/time fields are normalised to null when
 * empty). The parent supplies the entity list, the default entity, and an
 * onCreated callback (fired after a successful create so the parent can refetch)
 * plus onCancel (fired when the user cancels).
 *
 * Entity default wiring matches ProjectCreateForm: `defaultEntityId` seeds the
 * dropdown; while untouched it tracks the parent default; once the user picks an
 * entity their choice is preserved; an empty default leaves entity REQUIRED
 * before submit (never silently picked).
 */

'use client';

import { useEffect, useState } from 'react';
import RRULEBuilder from './RRULEBuilder';
import type { RoutineForm } from './types';
import CoaSelect from './CoaSelect';
import { DEFAULT_ROUTINE_FORM } from './types';

interface Entity {
  id: string;
  name: string;
}

interface Props {
  entities: Entity[];
  /** Entity to default the dropdown to ('' = none/All → entity required before submit). */
  defaultEntityId: string;
  /** Fired after a successful routine create (parent refetches its list). */
  onCreated: () => void;
  /** Fired when the user cancels (parent hides/collapses the form). */
  onCancel: () => void;
}

export default function RoutineCreateForm({ entities, defaultEntityId, onCreated, onCancel }: Props) {
  const [createForm, setCreateForm] = useState<RoutineForm>({
    ...DEFAULT_ROUTINE_FORM,
    entity_id: defaultEntityId,
  });
  const [entityTouched, setEntityTouched] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // While the entity field is untouched, track the parent's default. Once the
  // user picks an entity, never overwrite their choice.
  useEffect(() => {
    if (!entityTouched) {
      setCreateForm((f) =>
        f.entity_id === defaultEntityId ? f : { ...f, entity_id: defaultEntityId }
      );
    }
  }, [defaultEntityId, entityTouched]);

  const handleCreate = async () => {
    if (!createForm.entity_id) {
      setCreateError('Entity is required — select one above.');
      return;
    }
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
      onCreated();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'failed to create');
    } finally {
      setCreateSaving(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

  return (
    <div className="border border-border rounded p-3 bg-white text-xs space-y-3">
      <div className="text-sm font-semibold text-text-primary">new routine</div>
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
            onChange={(e) => {
              setEntityTouched(true);
              setCreateForm({ ...createForm, entity_id: e.target.value });
            }}
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
      </div>

      {/* HB-4b: per-occurrence budget + COA. Both optional — empty budget → null (never 0), no COA
          → null (no default account). The COA list is scoped to the selected entity. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>budget / occurrence (optional)</div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={createForm.budget_amount ?? ''}
            onChange={(e) => setCreateForm({ ...createForm, budget_amount: e.target.value })}
            className={inputClass}
            placeholder="e.g., 60"
          />
        </div>
        <div>
          <div className={labelClass}>COA (optional)</div>
          <CoaSelect
            entityId={createForm.entity_id}
            value={createForm.coa_code ?? ''}
            onChange={(code) => setCreateForm({ ...createForm, coa_code: code })}
            className={inputClass}
          />
        </div>
      </div>

      <RRULEBuilder form={createForm} setForm={setCreateForm} />

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
          onClick={onCancel}
          disabled={createSaving}
          className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
