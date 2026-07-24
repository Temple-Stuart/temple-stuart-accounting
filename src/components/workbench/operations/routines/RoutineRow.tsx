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
import CoaSelect from './CoaSelect';
import { RoutineStepList } from './RoutineStepList';
import ScenifyButton from '../content/ScenifyButton';
import type { Scene, Take } from '../content/ContentTable';
import { themed, type Surface } from '@/lib/ds';

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
    // HB-4b: pre-fill budget + COA on edit (null → '' empty input/no selection).
    budget_amount: r.budget_amount != null ? String(r.budget_amount) : '',
    coa_code: r.coa_code ?? '',
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

// HB-4e-style-2: humanize the "active" window's date (display only — same @db.Date value, rendered
// "Jun 1, 2026" not raw ISO "2026-06-01"). Build the Date from the Y-M-D parts so a UTC-midnight
// @db.Date never drifts a day under a negative-offset locale.
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso.slice(0, 10);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// HB-4e-style-2: humanize the intent-time window (display only — "00:00" → "12:00 AM").
function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export default function RoutineRow({ surface = 'light', routine, entities, onUpdate, onDelete, onScenify, onTakeify }: Props & { surface?: Surface }) {
  const dk = surface === 'dark';
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
    themed('w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple', dk);
  const labelClass = themed('text-text-faint uppercase tracking-wide mb-1 text-xs', dk);

  return (
    <div
      className={
        themed('border rounded bg-white ', dk) +
        (routine.is_active ? themed('border-border', dk) : themed('border-border-light opacity-60', dk))
      }
    >
      <div
        className={themed('flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-row text-xs', dk)}
        onClick={() => !editing && setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={themed('text-text-faint', dk)}>{expanded ? '▾' : '▸'}</span>
          <span className={themed('font-bold text-text-primary truncate', dk)}>{routine.name}</span>
          {!routine.is_active && (
            <span className={themed('px-2 py-0.5 border rounded text-xs bg-gray-100 text-gray-600 border-gray-300', dk)}>
              inactive
            </span>
          )}
        </div>
        <div className={themed('flex items-center gap-3 text-text-muted shrink-0', dk)}>
          <span title="completion streak / miss streak">
            🔥 {routine.consecutive_completion_streak} ✓ / {routine.consecutive_miss_streak} ✗
          </span>
          <span title="next scheduled occurrence">
            next: {formatDateTime(routine.next_due_at, routine.timezone)}
          </span>
          {(routine.start_date || routine.end_date) && (
            <span className={themed('text-xs text-text-muted', dk)} title="active date window">
              {(() => {
                const startStr = routine.start_date ? formatDate(routine.start_date) : null;
                const endStr = routine.end_date ? formatDate(routine.end_date) : null;
                if (startStr && endStr) return `active ${startStr} – ${endStr}`;
                if (startStr) return `active from ${startStr}`;
                if (endStr) return `active until ${endStr}`;
                return '';
              })()}
            </span>
          )}
          {(routine.start_time || routine.end_time) && (
            <span className={themed('text-xs text-text-muted', dk)} title="intent time window">
              {(() => {
                const startStr = routine.start_time ? formatTime12h(routine.start_time.slice(11, 16)) : null;
                const endStr = routine.end_time ? formatTime12h(routine.end_time.slice(11, 16)) : null;
                if (startStr && endStr) return `${startStr} – ${endStr}`;
                if (startStr) return `from ${startStr}`;
                if (endStr) return `until ${endStr}`;
                return '';
              })()}
            </span>
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className={themed('px-4 py-3 border-t border-border-light text-xs space-y-3', dk)}>
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}
          {routine.description ? (
            <div>
              <div className={labelClass}>description</div>
              <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{routine.description}</div>
            </div>
          ) : (
            <div className={themed('text-text-muted italic', dk)}>no description</div>
          )}

          <div className={themed('grid grid-cols-3 gap-3 pt-2 border-t border-border-light', dk)}>
            <div>
              <div className={labelClass}>schedule (rrule)</div>
              <div className={themed('text-text-primary font-mono break-all', dk)}>{routine.schedule_rrule}</div>
            </div>
            <div>
              <div className={labelClass}>timezone</div>
              <div className={themed('text-text-primary', dk)}>{routine.timezone}</div>
            </div>
            <div>
              <div className={labelClass}>fail threshold</div>
              <div className={themed('text-text-primary', dk)}>{routine.fail_threshold_minutes} min</div>
            </div>
          </div>

          <div className={themed('grid grid-cols-3 gap-3 pt-2 border-t border-border-light', dk)}>
            <div>
              <div className={labelClass}>last completed</div>
              <div className={themed('text-text-primary', dk)}>{formatDateTime(routine.last_completed_at, routine.timezone)}</div>
            </div>
            <div>
              <div className={labelClass}>last evaluated</div>
              <div className={themed('text-text-primary', dk)}>{formatDateTime(routine.last_evaluated_at, routine.timezone)}</div>
            </div>
            <div>
              <div className={labelClass}>ideal time</div>
              <div className={themed('text-text-primary', dk)}>{routine.ideal_time_label ?? '—'}</div>
            </div>
          </div>

          <RoutineStepList surface={surface} routine={routine} onUpdate={onUpdate} onTakeify={onTakeify} />

          <div className={themed('flex flex-wrap items-center gap-2 pt-2 border-t border-border-light', dk)}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); enterEdit(); }}
              className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row', dk)}
            >
              edit
            </button>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={toggling}
              className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
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
            <ScenifyButton surface={surface} routine={routine} onScenify={onScenify} />
          </div>
        </div>
      )}

      {editing && (
        <div className={themed('px-4 py-3 border-t border-border-light text-xs space-y-3', dk)}>
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

          {/* HB-4b: per-occurrence budget + COA (pre-filled from the routine; empty → null on save).
              COA scoped to the routine's entity (entity is fixed after creation). */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>budget / occurrence (optional)</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budget_amount ?? ''}
                onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
                className={inputClass}
                placeholder="e.g., 60"
              />
            </div>
            <div>
              <div className={labelClass}>COA (optional)</div>
              <CoaSelect
                entityId={form.entity_id}
                value={form.coa_code ?? ''}
                onChange={(code) => setForm({ ...form, coa_code: code })}
                className={inputClass}
              />
            </div>
          </div>

          <RRULEBuilder surface={surface} form={form} setForm={setForm} />

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

          <div className={themed('flex items-center gap-2 pt-2 border-t border-border-light', dk)}>
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
              className={themed('px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
