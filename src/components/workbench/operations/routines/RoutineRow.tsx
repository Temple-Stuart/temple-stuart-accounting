/**
 * RoutineRow — single routine in the cadence-grouped list.
 *
 * Three modes (mirrors ProjectRow's pattern at routine scale):
 *   1. Compact: name + cadence-group pill + streaks + next-due
 *   2. Expanded: + description + ideal time + last completed + delete
 *   3. Edit: full RRULEBuilder + name/description fields
 *
 * Click row body → toggle expand. "edit" → swap to edit mode. "deactivate"/
 * "reactivate" pill toggles is_active via PATCH. Audit trail shows the
 * discrimination (deactivated as its own action_type; reactivated as
 * generic _updated with metadata.activation_toggle='reactivated').
 */

'use client';

import { useState } from 'react';
import type { Routine, RoutineForm } from './types';
import { DEFAULT_ROUTINE_FORM } from './types';
import RRULEBuilder from './RRULEBuilder';
import { RoutineStepList } from './RoutineStepList';
import ScenifyButton from '../content/ScenifyButton';
import type { Scene, Take } from '../content/ContentTable';

interface Entity {
  id: string;
  name: string;
}

interface Props {
  routine: Routine;
  entities: Entity[];
  onUpdate: () => void;
  onDelete: () => void;
  onScenify: (newScene: Scene) => void;
  onTakeify: (newTake: Take) => void;
}

function routineToForm(r: Routine): RoutineForm {
  // Form fields derived from Routine: we don't reverse-compile RRULE on edit;
  // user is shown the live cadence_mode as 'custom' with the existing rrule
  // pre-populated. They can switch to a structured mode if desired (which
  // overrides the rrule on save).
  return {
    ...DEFAULT_ROUTINE_FORM,
    name: r.name,
    description: r.description ?? '',
    entity_id: r.entity_id,
    timezone: r.timezone,
    ideal_time_label: r.ideal_time_label ?? '',
    fail_threshold_minutes: String(r.fail_threshold_minutes),
    start_date: r.start_date ? r.start_date.slice(0, 10) : '',
    end_date: r.end_date ? r.end_date.slice(0, 10) : '',
    start_time: r.start_time ? r.start_time.slice(11, 16) : '',
    end_time: r.end_time ? r.end_time.slice(11, 16) : '',
    is_active: r.is_active,
    cadence_mode: 'custom',
    custom_rrule: r.schedule_rrule,
  };
}

function formatDateTime(iso: string | null, tz: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RoutineRow({ routine, entities, onUpdate, onDelete, onScenify, onTakeify }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RoutineForm>(() => routineToForm(routine));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterEdit = () => {
    setForm(routineToForm(routine));
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setForm(routineToForm(routine));
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to save');
        return;
      }
      setEditing(false);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !routine.is_active }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to toggle');
        return;
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete routine "${routine.name}"? All completion history will also be deleted.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  return (
    <div
      className={
        'border rounded bg-white ' +
        (routine.is_active ? 'border-border' : 'border-border-light opacity-60')
      }
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-row text-xs font-mono"
        onClick={() => !editing && setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-text-faint">{expanded ? '▾' : '▸'}</span>
          <span className="font-bold text-text-primary truncate">{routine.name}</span>
          {!routine.is_active && (
            <span className="px-2 py-0.5 border rounded text-xs bg-gray-100 text-gray-600 border-gray-300">
              inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-text-muted shrink-0">
          <span title="completion streak / miss streak">
            🔥 {routine.consecutive_completion_streak} ✓ / {routine.consecutive_miss_streak} ✗
          </span>
          <span title="next scheduled occurrence">
            next: {formatDateTime(routine.next_due_at, routine.timezone)}
          </span>
          {(routine.start_date || routine.end_date) && (
            <span className="text-xs font-mono text-text-muted" title="active date window">
              {(() => {
                const startStr = routine.start_date ? routine.start_date.slice(0, 10) : null;
                const endStr = routine.end_date ? routine.end_date.slice(0, 10) : null;
                if (startStr && endStr) return `active ${startStr}–${endStr}`;
                if (startStr) return `active from ${startStr}`;
                if (endStr) return `active until ${endStr}`;
                return '';
              })()}
            </span>
          )}
          {(routine.start_time || routine.end_time) && (
            <span className="text-xs font-mono text-text-muted" title="intent time window">
              {(() => {
                const startStr = routine.start_time ? routine.start_time.slice(11, 16) : null;
                const endStr = routine.end_time ? routine.end_time.slice(11, 16) : null;
                if (startStr && endStr) return `${startStr}–${endStr}`;
                if (startStr) return `from ${startStr}`;
                if (endStr) return `until ${endStr}`;
                return '';
              })()}
            </span>
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs font-mono space-y-3">
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}
          {routine.description ? (
            <div>
              <div className={labelClass}>description</div>
              <div className="text-text-primary whitespace-pre-wrap">{routine.description}</div>
            </div>
          ) : (
            <div className="text-text-muted italic">no description</div>
          )}

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-light">
            <div>
              <div className={labelClass}>schedule (rrule)</div>
              <div className="text-text-primary font-mono break-all">{routine.schedule_rrule}</div>
            </div>
            <div>
              <div className={labelClass}>timezone</div>
              <div className="text-text-primary">{routine.timezone}</div>
            </div>
            <div>
              <div className={labelClass}>fail threshold</div>
              <div className="text-text-primary">{routine.fail_threshold_minutes} min</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-light">
            <div>
              <div className={labelClass}>last completed</div>
              <div className="text-text-primary">{formatDateTime(routine.last_completed_at, routine.timezone)}</div>
            </div>
            <div>
              <div className={labelClass}>last evaluated</div>
              <div className="text-text-primary">{formatDateTime(routine.last_evaluated_at, routine.timezone)}</div>
            </div>
            <div>
              <div className={labelClass}>ideal time</div>
              <div className="text-text-primary">{routine.ideal_time_label ?? '—'}</div>
            </div>
          </div>

          <RoutineStepList routine={routine} onUpdate={onUpdate} onTakeify={onTakeify} />

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); enterEdit(); }}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row"
            >
              edit
            </button>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={toggling}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              {toggling ? '…' : routine.is_active ? 'deactivate' : 'reactivate'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'deleting…' : 'delete'}
            </button>
            <ScenifyButton routine={routine} onScenify={onScenify} />
          </div>
        </div>
      )}

      {editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs font-mono space-y-3">
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className={labelClass}>name</div>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                maxLength={200}
              />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>description</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>entity</div>
              <select
                value={form.entity_id}
                onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                className={inputClass}
                disabled
                title="entity cannot be changed after creation"
              >
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <RRULEBuilder form={form} setForm={setForm} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>start date (optional)</div>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>end date (optional)</div>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>start time (optional)</div>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>end time (optional)</div>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
