/**
 * RoutineStepList — ordered sub-step editor for a routine.
 *
 * Self-contained child of RoutineRow's expanded view (mirrors the TaskList
 * pattern under ProjectRow): reads routine.steps from props, mutates via the
 * PR-Ops-4.8.6b CRUD endpoints, and calls onUpdate() to trigger a parent
 * refetch after every mutation.
 *
 * time_of_day arrives JSON-serialized from Prisma @db.Time as
 * '1970-01-01THH:MM:SS.000Z' — every read extracts HH:MM via .slice(11, 16).
 */

'use client';

import { useState } from 'react';
import type { Routine, RoutineStep } from './types';
import type { Take } from '../content/ContentTable';
import TakeifyButton from '../content/TakeifyButton';

const STEP_DEFAULT_INTERVAL_MINUTES = 15;

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

interface StepForm {
  activity: string;
  time_of_day: string;
  location: string;
  sub_activity: string;
  duration_minutes: string;
  notes: string;
}

const EMPTY_FORM: StepForm = {
  activity: '',
  time_of_day: '',
  location: '',
  sub_activity: '',
  duration_minutes: '',
  notes: '',
};

function stepToForm(s: RoutineStep): StepForm {
  return {
    activity: s.activity,
    time_of_day: s.time_of_day ? s.time_of_day.slice(11, 16) : '',
    location: s.location ?? '',
    sub_activity: s.sub_activity ?? '',
    duration_minutes: s.duration_minutes !== null ? String(s.duration_minutes) : '',
    notes: s.notes ?? '',
  };
}

function formToBody(f: StepForm) {
  return {
    activity: f.activity,
    time_of_day: f.time_of_day || null,
    location: f.location || null,
    sub_activity: f.sub_activity || null,
    duration_minutes: f.duration_minutes !== '' ? Number(f.duration_minutes) : null,
    notes: f.notes || null,
  };
}

/**
 * Auto-fill a new step's time_of_day from the parent routine's start_time,
 * advancing STEP_DEFAULT_INTERVAL_MINUTES per existing step. '' if the parent
 * has no start_time.
 */
function getAutoFillTime(routine: Routine, currentSteps: RoutineStep[]): string {
  if (!routine.start_time) return '';
  const startHHMM = routine.start_time.slice(11, 16);
  const [hStr, mStr] = startHHMM.split(':');
  const startMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  const newStepOrder = currentSteps.length;
  const totalMinutes = startMinutes + newStepOrder * STEP_DEFAULT_INTERVAL_MINUTES;
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

interface Props {
  routine: Routine;
  onUpdate: () => void;
  onTakeify: (newTake: Take) => void;
}

export function RoutineStepList({ routine, onUpdate, onTakeify }: Props) {
  const steps = [...routine.steps].sort((a, b) => a.step_order - b.step_order);

  const [error, setError] = useState<string | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [addForm, setAddForm] = useState<StepForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StepForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const startAdd = () => {
    setAddForm({ ...EMPTY_FORM, time_of_day: getAutoFillTime(routine, steps) });
    setError(null);
    setOpenAdd(true);
  };

  const handleCreate = async () => {
    if (addForm.activity.trim().length === 0) {
      setError('activity is required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToBody(addForm)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to create step');
        return;
      }
      setOpenAdd(false);
      setAddForm(EMPTY_FORM);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to create step');
    } finally {
      setCreating(false);
    }
  };

  const enterEdit = (step: RoutineStep) => {
    setEditForm(stepToForm(step));
    setEditingId(step.id);
    setError(null);
  };

  const handleSave = async (stepId: string) => {
    if (editForm.activity.trim().length === 0) {
      setError('activity is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToBody(editForm)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to save step');
        return;
      }
      setEditingId(null);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save step');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (step: RoutineStep) => {
    if (!window.confirm(`Delete step "${step.activity}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/steps/${step.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? body?.error ?? 'failed to delete step');
        return;
      }
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete step');
    } finally {
      setBusy(false);
    }
  };

  // Swap step_order with the adjacent step. α-1 race-acceptance: concurrent
  // reorders on a single-user system may collide; resolvable by re-reordering.
  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = steps[index];
    const adjacent = steps[index + direction];
    if (!target || !adjacent) return;
    setBusy(true);
    setError(null);
    try {
      const patch = (id: string, step_order: number) =>
        fetch(`/api/operations/routines/steps/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step_order }),
        });
      const [r1, r2] = await Promise.all([
        patch(target.id, adjacent.step_order),
        patch(adjacent.id, target.step_order),
      ]);
      if (!r1.ok || !r2.ok) {
        setError('failed to reorder steps');
        return;
      }
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to reorder steps');
    } finally {
      setBusy(false);
    }
  };

  const arrowClass =
    'px-1.5 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-30 text-xs font-mono';
  const actionClass =
    'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs font-mono';

  return (
    <div className="pt-2 border-t border-border-light space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={labelClass}>steps</span>
          <span className="text-text-muted text-xs font-mono">
            {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </span>
        </div>
        {!openAdd && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startAdd(); }}
            className={actionClass}
          >
            + add step
          </button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
          {error}
        </div>
      )}

      {steps.length === 0 && !openAdd && (
        <div className="text-text-muted italic text-xs font-mono">no steps yet</div>
      )}

      {steps.map((step, index) => (
        <div
          key={step.id}
          className="border border-border-light rounded bg-white px-3 py-2 text-xs font-mono"
        >
          {editingId === step.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <div className={labelClass}>activity</div>
                  <input
                    type="text"
                    value={editForm.activity}
                    onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })}
                    className={inputClass}
                    maxLength={200}
                  />
                </div>
                <div>
                  <div className={labelClass}>time of day</div>
                  <input
                    type="time"
                    value={editForm.time_of_day}
                    onChange={(e) => setEditForm({ ...editForm, time_of_day: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className={labelClass}>duration (min)</div>
                  <input
                    type="number"
                    min={0}
                    value={editForm.duration_minutes}
                    onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className={labelClass}>location</div>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className={inputClass}
                    maxLength={200}
                  />
                </div>
                <div>
                  <div className={labelClass}>sub-activity</div>
                  <input
                    type="text"
                    value={editForm.sub_activity}
                    onChange={(e) => setEditForm({ ...editForm, sub_activity: e.target.value })}
                    className={inputClass}
                    maxLength={200}
                  />
                </div>
                <div className="col-span-2">
                  <div className={labelClass}>notes</div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(step.id)}
                  disabled={saving}
                  className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50 text-xs font-mono"
                >
                  {saving ? 'saving…' : 'save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                  className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs font-mono"
                >
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={busy || index === 0}
                      className={arrowClass}
                      title="move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={busy || index === steps.length - 1}
                      className={arrowClass}
                      title="move down"
                    >
                      ↓
                    </button>
                  </div>
                  {step.time_of_day && (
                    <span className="text-text-muted shrink-0">
                      {step.time_of_day.slice(11, 16)}
                    </span>
                  )}
                  <span className="text-text-primary truncate">{step.activity}</span>
                  {step.sub_activity && (
                    <span className="text-text-muted truncate">· {step.sub_activity}</span>
                  )}
                  {step.location && (
                    <span className="text-text-muted shrink-0">@ {step.location}</span>
                  )}
                  {step.duration_minutes !== null && (
                    <span className="text-text-muted shrink-0">{step.duration_minutes} min</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => enterEdit(step)}
                    disabled={busy}
                    className={actionClass}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(step)}
                    disabled={busy}
                    className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs font-mono"
                  >
                    delete
                  </button>
                  <TakeifyButton step={step} onTakeify={onTakeify} />
                </div>
              </div>
              {step.notes && (
                <div className="text-text-muted italic whitespace-pre-wrap pl-8">{step.notes}</div>
              )}
            </div>
          )}
        </div>
      ))}

      {openAdd && (
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 space-y-2">
          <div className="font-mono text-xs font-bold text-text-primary">new step</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <div className={labelClass}>activity</div>
              <input
                type="text"
                value={addForm.activity}
                onChange={(e) => setAddForm({ ...addForm, activity: e.target.value })}
                className={inputClass}
                maxLength={200}
                placeholder="e.g., Shower"
              />
            </div>
            <div>
              <div className={labelClass}>time of day</div>
              <input
                type="time"
                value={addForm.time_of_day}
                onChange={(e) => setAddForm({ ...addForm, time_of_day: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>duration (min)</div>
              <input
                type="number"
                min={0}
                value={addForm.duration_minutes}
                onChange={(e) => setAddForm({ ...addForm, duration_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>location</div>
              <input
                type="text"
                value={addForm.location}
                onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                className={inputClass}
                maxLength={200}
              />
            </div>
            <div>
              <div className={labelClass}>sub-activity</div>
              <input
                type="text"
                value={addForm.sub_activity}
                onChange={(e) => setAddForm({ ...addForm, sub_activity: e.target.value })}
                className={inputClass}
                maxLength={200}
              />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>notes</div>
              <textarea
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                rows={2}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50 text-xs font-mono"
            >
              {creating ? 'creating…' : 'create step'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenAdd(false);
                setAddForm(EMPTY_FORM);
                setError(null);
              }}
              disabled={creating}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs font-mono"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
