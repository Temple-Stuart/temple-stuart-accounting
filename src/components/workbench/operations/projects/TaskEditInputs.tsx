/**
 * TaskEditInputs — a task's edit inputs, as ONE part (PROJECTS-01, 2026-09-30).
 *
 * Moved verbatim out of TaskRowView.tsx (its edit block) so the view and the projects table
 * render the same markup — one form, never two copies. PURE: props only — no
 * fetch, no effect, no context, no API path. The showroom renders it through
 * the view, so the showroom fetch-free law lists this file.
 */

'use client';

import type { TaskForm, TaskStatus, CoaAccountSummary } from './types';
import { TASK_STATUS_LABELS } from './types';

const STATUS_OPTIONS: TaskStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
];

export interface TaskEditInputsProps {
  form: TaskForm;
  coaAccounts: CoaAccountSummary[];
  saving: boolean;
  error: string | null;
  onFormChange: (form: TaskForm) => void;
  onSave: () => void;
  onCancelEdit: () => void;
}

export default function TaskEditInputs({
  form,
  coaAccounts,
  saving,
  error,
  onFormChange,
  onSave,
  onCancelEdit,
}: TaskEditInputsProps) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

  return (
    <div className="px-4 py-3 border-t border-border-light text-xs space-y-3">
      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3">
          <div className={labelClass}>title</div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            className={inputClass}
            maxLength={500}
          />
        </div>
        <div>
          <div className={labelClass}>status</div>
          <select
            value={form.status}
            onChange={(e) => onFormChange({ ...form, status: e.target.value as TaskStatus })}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelClass}>deadline</div>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => onFormChange({ ...form, deadline: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>category</div>
          <select
            value={form.coa_code}
            onChange={(e) => onFormChange({ ...form, coa_code: e.target.value })}
            className={inputClass}
          >
            <option value="">— None —</option>
            {/* If the task's current code isn't in the dropdown options
                (e.g., archived or out-of-entity), still surface it so the
                user isn't silently re-categorized when they save. */}
            {form.coa_code !== '' && !coaAccounts.some((a) => a.code === form.coa_code) && (
              <option value={form.coa_code}>{form.coa_code} ⚠ (not in current COA)</option>
            )}
            {coaAccounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className={labelClass}>description</div>
        <textarea
          value={form.description}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          rows={3}
          className={inputClass}
          placeholder="what does this task entail?"
        />
      </div>

      <div>
        <div className={labelClass}>unblocks (rationale for priority engine)</div>
        <textarea
          value={form.unblocks_label}
          onChange={(e) => onFormChange({ ...form, unblocks_label: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="what does completing this unblock? — fed to the priority ranker (PR-Ops-4)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>est. minutes</div>
          <input
            type="number"
            min={0}
            value={form.estimated_minutes}
            onChange={(e) => onFormChange({ ...form, estimated_minutes: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>actual minutes</div>
          <input
            type="number"
            min={0}
            step={1}
            value={form.actual_minutes}
            onChange={(e) => onFormChange({ ...form, actual_minutes: e.target.value })}
            className={inputClass}
            placeholder="(empty)"
          />
        </div>
        <div>
          <div className={labelClass}>est. cost (usd)</div>
          <input
            type="text"
            value={form.estimated_cost_usd}
            onChange={(e) => onFormChange({ ...form, estimated_cost_usd: e.target.value })}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div>
          <div className={labelClass}>actual cost (usd)</div>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.actual_cost_usd}
            onChange={(e) => onFormChange({ ...form, actual_cost_usd: e.target.value })}
            className={inputClass}
            placeholder="(empty)"
          />
        </div>
      </div>

      <div>
        <div className={labelClass}>link url (vendor / portal)</div>
        <input
          type="url"
          value={form.link_url ?? ''}
          onChange={(e) => onFormChange({ ...form, link_url: e.target.value })}
          className={inputClass}
          maxLength={500}
          placeholder="https://..."
        />
      </div>

      <div>
        <div className={labelClass}>notes (institutional context)</div>
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
          rows={6}
          className={inputClass}
          maxLength={1500}
          placeholder="dependencies, timing anchors, decision points, gotchas..."
        />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
        >
          {saving ? 'saving…' : 'save'}
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={saving}
          className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
