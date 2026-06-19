/**
 * ProjectCreateForm — the REAL, server-backed project create form.
 *
 * PD-Strip: the create form is now PURE inputs — title + goals + entity + target-date.
 * It owns ONLY the create submit (POST /api/operations/projects). The design generation,
 * the reality-audit paste box, the est. minutes/cost inputs, and the create-time
 * "preview tasks" flow were removed — those belong to the project's pipe (the Truth
 * Machine generates research / audit / tasks downstream, and design generation lives on
 * the project's edit view). The DB columns (design, claude_code_audit_input,
 * estimated_total_*) are KEPT — the create POST still receives them (empty, via the
 * ProjectForm shape) and they are optional server-side; the edit view + pipe read/write
 * them later. No migration.
 *
 * The parent supplies the entity list, the default entity, an onCreated callback (fired
 * after a successful create so the parent can refetch) and onCancel.
 *
 * Entity default wiring: `defaultEntityId` seeds the entity dropdown. While the user has
 * NOT touched the entity field, a change to `defaultEntityId` (e.g. the page-level entity
 * filter changing) updates the default; once the user picks an entity, their choice is
 * preserved. An empty `defaultEntityId` ("All" / none) leaves it unselected and entity
 * becomes REQUIRED before submit — the form never silently picks one.
 */

'use client';

import { useEffect, useState } from 'react';
import ListManager from './ListManager';
import type { ProjectForm } from './types';
import { DEFAULT_PROJECT_FORM } from './types';

interface Entity {
  id: string;
  name: string;
}

interface Props {
  entities: Entity[];
  /** Entity to default the dropdown to ('' = none/All → entity required before submit). */
  defaultEntityId: string;
  /** Fired after a successful project create (parent refetches its list). */
  onCreated: () => void;
  /** Fired when the user cancels (parent hides/collapses the form). */
  onCancel: () => void;
}

export default function ProjectCreateForm({ entities, defaultEntityId, onCreated, onCancel }: Props) {
  const [createForm, setCreateForm] = useState<ProjectForm>({
    ...DEFAULT_PROJECT_FORM,
    entity_id: defaultEntityId,
  });
  const [entityTouched, setEntityTouched] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // While the entity field is untouched, track the parent's default (e.g. the
  // page-level entity filter changing). Once the user picks an entity, never
  // overwrite their choice.
  useEffect(() => {
    if (!entityTouched) {
      setCreateForm((f) =>
        f.entity_id === defaultEntityId ? f : { ...f, entity_id: defaultEntityId }
      );
    }
  }, [defaultEntityId, entityTouched]);

  // The create action. POSTs the full ProjectForm — design / claude_code_audit_input /
  // estimated_total_* ride along EMPTY (from DEFAULT_PROJECT_FORM) and are optional
  // server-side; the pipe + edit view fill them later. Auth + validation are the route's.
  const handleCreate = async () => {
    if (!createForm.entity_id) {
      setCreateError('Entity is required — select one above.');
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/operations/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
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
    'w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20';
  const labelClass = 'text-gray-400 uppercase tracking-wide mb-1 text-[10px] font-medium';

  return (
    <div
      className="mb-4 rounded-md border border-gray-200 border-l-4 bg-white p-3 sm:p-4 text-xs space-y-3 shadow-sm"
      style={{ borderLeftColor: '#6B46C1' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-bold text-gray-900">New project</div>
        <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#6B46C1' }}>title + goals</div>
      </div>

      {createError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {createError}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className={labelClass}>title</div>
          <input
            type="text"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            className={inputClass}
            maxLength={500}
            placeholder="short, distinctive, unique within your projects"
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
        <div>
          <div className={labelClass}>target date (optional)</div>
          <input
            type="date"
            value={createForm.target_completion_date}
            onChange={(e) => setCreateForm({ ...createForm, target_completion_date: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className={labelClass}>goal — what success looks like</div>
        <ListManager
          items={createForm.goalItems}
          onChange={(next) => setCreateForm({ ...createForm, goalItems: next })}
          verbPrefix="I WANT to "
          placeholder="get loans approved"
          disabled={createSaving}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={handleCreate}
          disabled={createSaving}
          className="px-3 py-1.5 text-xs font-medium border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {createSaving ? 'creating…' : 'create project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={createSaving}
          className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
