/**
 * RoutineStepList — a routine's lines, as rows of the routines table.
 *
 * ROUTINES-01: every line is a row of RoutineList's one table — Where ·
 * Activity · When · Minutes · Amount · Account, then its controls (edit ·
 * delete · ↑ ↓). The routine's own cell (RoutineRow) is the first cell of the
 * first row and spans every row drawn here. A routine with no lines is one row:
 * its own place, "no lines", its own amount and account. Every code is drawn
 * through the one account helper (src/lib/coa/accountCell.ts). Editing is in
 * place: a line's edit turns its row into the line inputs, and "+ line" (in the
 * routine's cell) opens the same inputs as a row at the end. A refusal shows the
 * route's own message on the row it refused.
 *
 * Mutates via the PR-Ops-4.8.6b CRUD endpoints and calls onUpdate() to trigger
 * a parent refetch after every mutation.
 *
 * time_of_day arrives JSON-serialized from Prisma @db.Time as
 * '1970-01-01THH:MM:SS.000Z' — every read extracts HH:MM via .slice(11, 16).
 */

'use client';

import { useState, type ReactNode } from 'react';
import type { Routine, RoutineStep } from './types';
import CoaSelect from './CoaSelect';
import { formatBudgetPerOccurrence } from './types';
import { accountCell, type AccountCell, type AccountCellBook } from '@/lib/coa/accountCell';


/** The table's columns: Routine · Where · Activity · When · Minutes · Amount · Account, and the controls. */
export const ROUTINE_TABLE_COLUMNS = 8;

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';
const cellClass = 'px-2 py-1.5 align-top border-t border-border-light';

/** An account cell as the helper states it: nothing when blank, else its words. */
export function AccountText({ cell }: { cell: AccountCell }) {
  if (cell.state === 'blank') return null;
  const tone =
    cell.state === 'account' ? 'font-mono text-text-primary'
      : cell.state === 'not-recognised' ? 'font-mono text-amber-800'
        : 'italic text-text-muted';
  return <span className={tone} data-account-state={cell.state}>{cell.text}</span>;
}

interface StepForm {
  activity: string;
  time_of_day: string;
  location: string;
  sub_activity: string;
  duration_minutes: string;
  notes: string;
  // LINES-01: the line's own cost and category. '' is blank — never 0.
  budget_amount: string;
  coa_code: string;
}

const EMPTY_FORM: StepForm = {
  activity: '',
  time_of_day: '',
  location: '',
  sub_activity: '',
  duration_minutes: '',
  notes: '',
  budget_amount: '',
  coa_code: '',
};

function stepToForm(s: RoutineStep): StepForm {
  return {
    activity: s.activity,
    time_of_day: s.time_of_day ? s.time_of_day.slice(11, 16) : '',
    location: s.location ?? '',
    sub_activity: s.sub_activity ?? '',
    duration_minutes: s.duration_minutes !== null ? String(s.duration_minutes) : '',
    notes: s.notes ?? '',
    budget_amount: s.budget_amount ?? '',
    coa_code: s.coa_code ?? '',
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
    // '' → null on the wire: a blank line has NO amount and NO account.
    budget_amount: f.budget_amount.trim() !== '' ? f.budget_amount.trim() : null,
    coa_code: f.coa_code || null,
  };
}

/** The row a refusal belongs to: a line's id, or the new line's row. */
const NEW_LINE_ROW = 'new-line';

interface Props {
  routine: Routine;
  /** The tab's entity list (useOperationsEntity) — each code is drawn against its book. */
  entities: readonly AccountCellBook[];
  onUpdate: () => void;
  /**
   * The routine's own cell, spanning `rowSpan` rows. `addLine` opens the new
   * line's row at the end; null while that row is open.
   */
  routineCell: (rowSpan: number, addLine: (() => void) | null) => ReactNode;
}

export function RoutineStepList({ routine, entities, onUpdate, routineCell }: Props & { }) {
  const steps = [...routine.steps].sort((a, b) => a.step_order - b.step_order);

  const [error, setError] = useState<{ row: string; message: string } | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [addForm, setAddForm] = useState<StepForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StepForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  // ROUTINES-01: a new line starts blank — its time is typed, never derived.
  const startAdd = () => {
    setAddForm(EMPTY_FORM);
    setError(null);
    setOpenAdd(true);
  };

  const handleCreate = async () => {
    if (addForm.activity.trim().length === 0) {
      setError({ row: NEW_LINE_ROW, message: 'activity is required' });
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
        setError({ row: NEW_LINE_ROW, message: body?.message ?? body?.error ?? 'failed to create step' });
        return;
      }
      setOpenAdd(false);
      setAddForm(EMPTY_FORM);
      onUpdate();
    } catch (e) {
      setError({ row: NEW_LINE_ROW, message: e instanceof Error ? e.message : 'failed to create step' });
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
      setError({ row: stepId, message: 'activity is required' });
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
        setError({ row: stepId, message: body?.message ?? body?.error ?? 'failed to save step' });
        return;
      }
      setEditingId(null);
      onUpdate();
    } catch (e) {
      setError({ row: stepId, message: e instanceof Error ? e.message : 'failed to save step' });
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
        setError({ row: step.id, message: body?.message ?? body?.error ?? 'failed to delete step' });
        return;
      }
      onUpdate();
    } catch (e) {
      setError({ row: step.id, message: e instanceof Error ? e.message : 'failed to delete step' });
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
        setError({ row: target.id, message: 'failed to reorder steps' });
        return;
      }
      onUpdate();
    } catch (e) {
      setError({ row: target.id, message: e instanceof Error ? e.message : 'failed to reorder steps' });
    } finally {
      setBusy(false);
    }
  };

  const arrowClass =
    'px-1.5 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-30 text-xs';
  const actionClass =
    'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs';

  const refusalOn = (row: string) =>
    error && error.row === row ? (
      <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs" data-line-error>
        {error.message}
      </div>
    ) : null;

  // The line inputs, one per column — the same fields a line has always had.
  const inputCells = (
    form: StepForm,
    setForm: (f: StepForm) => void,
    row: string,
    save: { label: string; pending: boolean; pendingLabel: string; onSave: () => void; onCancel: () => void },
    activityPlaceholder?: string,
  ) => (
    <>
      <td className={cellClass}>
        <div className={labelClass}>location</div>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className={inputClass}
          maxLength={200}
        />
      </td>
      <td className={cellClass}>
        <div className={labelClass}>activity</div>
        <input
          type="text"
          value={form.activity}
          onChange={(e) => setForm({ ...form, activity: e.target.value })}
          className={inputClass}
          maxLength={200}
          placeholder={activityPlaceholder}
        />
        <div className={`${labelClass} mt-1`}>sub-activity</div>
        <input
          type="text"
          value={form.sub_activity}
          onChange={(e) => setForm({ ...form, sub_activity: e.target.value })}
          className={inputClass}
          maxLength={200}
        />
        <div className={`${labelClass} mt-1`}>notes</div>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className={inputClass}
        />
        {refusalOn(row)}
      </td>
      <td className={cellClass}>
        <div className={labelClass}>time of day</div>
        <input
          type="time"
          value={form.time_of_day}
          onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
          className={inputClass}
          data-line-time
        />
      </td>
      <td className={cellClass}>
        <div className={labelClass}>duration (min)</div>
        <input
          type="number"
          min={0}
          value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
          className={inputClass}
        />
      </td>
      <td className={cellClass}>
        <div className={labelClass}>amount (optional)</div>
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.budget_amount}
          onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
          className={`${inputClass} font-mono tabular-nums`}
          placeholder="blank = no amount"
          data-step-amount
        />
      </td>
      <td className={cellClass}>
        <div className={labelClass}>COA (optional)</div>
        <CoaSelect
          entityId={routine.entity_id}
          value={form.coa_code}
          onChange={(code) => setForm({ ...form, coa_code: code })}
          className={inputClass}
        />
      </td>
      <td className={cellClass}>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={save.onSave}
            disabled={save.pending}
            className={`px-2 py-0.5 border text-white rounded hover:opacity-90 disabled:opacity-50 text-xs ${'border-brand-purple bg-brand-purple'}`}
          >
            {save.pending ? save.pendingLabel : save.label}
          </button>
          <button
            type="button"
            onClick={save.onCancel}
            disabled={save.pending}
            className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs"
          >
            cancel
          </button>
        </div>
      </td>
    </>
  );

  const rowSpan = Math.max(steps.length, 1) + (openAdd ? 1 : 0);
  const cell = routineCell(rowSpan, openAdd ? null : startAdd);

  return (
    <>
      {steps.length === 0 && (
        <tr data-routine-no-lines>
          {cell}
          <td className={cellClass} data-line-where>{routine.location}</td>
          <td className={`${cellClass} italic text-text-muted`}>no lines</td>
          <td className={cellClass} />
          <td className={cellClass} />
          <td className={`${cellClass} font-mono tabular-nums font-bold text-text-primary`} data-routine-own-amount>
            {routine.budget_amount != null && formatBudgetPerOccurrence(routine.budget_amount)}
          </td>
          <td className={cellClass} data-routine-own-account>
            <AccountText cell={accountCell(entities, routine.entity_id, routine.coa_code)} />
          </td>
          <td className={cellClass} />
        </tr>
      )}

      {steps.map((step, index) => (
        <tr key={step.id} data-routine-line={step.id}>
          {index === 0 && cell}
          {editingId === step.id ? (
            inputCells(editForm, setEditForm, step.id, {
              label: 'save',
              pending: saving,
              pendingLabel: 'saving…',
              onSave: () => handleSave(step.id),
              onCancel: () => setEditingId(null),
            })
          ) : (
            <>
              <td className={`${cellClass} text-text-muted`} data-line-where>{step.location}</td>
              <td className={cellClass} data-line-activity>
                <span className="text-text-primary">{step.activity}</span>
                {step.sub_activity && <span className="text-text-muted"> · {step.sub_activity}</span>}
                {step.notes && (
                  <div className="text-text-muted italic whitespace-pre-wrap">{step.notes}</div>
                )}
                {refusalOn(step.id)}
              </td>
              <td className={`${cellClass} font-mono tabular-nums text-text-muted`} data-line-when>
                {step.time_of_day && step.time_of_day.slice(11, 16)}
              </td>
              <td className={`${cellClass} tabular-nums text-text-muted`} data-line-minutes>
                {step.duration_minutes !== null && step.duration_minutes}
              </td>
              {/* LINES-01: the line's own money and account. Blank → nothing renders. */}
              <td className={`${cellClass} font-mono tabular-nums font-bold text-text-primary`} data-step-planned>
                {step.budget_amount != null && formatBudgetPerOccurrence(step.budget_amount)}
              </td>
              <td className={cellClass} data-step-coa>
                <AccountText cell={accountCell(entities, routine.entity_id, step.coa_code)} />
              </td>
              <td className={cellClass}>
                <div className="flex flex-wrap items-center gap-1">
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
                    className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs"
                  >
                    delete
                  </button>
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
              </td>
            </>
          )}
        </tr>
      ))}

      {openAdd && (
        <tr className="bg-purple-50/30" data-line-new>
          {inputCells(addForm, setAddForm, NEW_LINE_ROW, {
            label: 'create step',
            pending: creating,
            pendingLabel: 'creating…',
            onSave: handleCreate,
            onCancel: () => {
              setOpenAdd(false);
              setAddForm(EMPTY_FORM);
              setError(null);
            },
          }, 'e.g., Shower')}
        </tr>
      )}
    </>
  );
}
