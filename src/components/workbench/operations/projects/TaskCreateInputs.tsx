/**
 * TaskCreateInputs — a new task's inputs, as ONE part (PROJECTS-01, 2026-09-30).
 *
 * Moved verbatim out of TaskListView.tsx (its create form) so the view and the projects table
 * render the same markup — one form, never two copies. PURE: props only — no
 * fetch, no effect, no context, no API path. The showroom renders it through
 * the view, so the showroom fetch-free law lists this file.
 */

'use client';

import type { TaskForm, CoaAccountSummary } from './types';

export interface TaskCreateInputsProps {
  createForm: TaskForm;
  createSaving: boolean;
  createError: string | null;
  coaAccounts: CoaAccountSummary[];
  onCreateFormChange: (form: TaskForm) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
}

export default function TaskCreateInputs({
  createForm,
  createSaving,
  createError,
  coaAccounts,
  onCreateFormChange,
  onCreate,
  onCancelCreate,
}: TaskCreateInputsProps) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

  return (
    <div className="border border-border rounded p-3 bg-white text-xs space-y-3">
      <div className="font-bold text-text-primary">new task</div>
      {createError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {createError}
        </div>
      )}
      <div>
        <div className={labelClass}>title</div>
        <input
          type="text"
          value={createForm.title}
          onChange={(e) => onCreateFormChange({ ...createForm, title: e.target.value })}
          className={inputClass}
          maxLength={500}
          placeholder="what is the atomic unit of work?"
        />
      </div>
      <div>
        <div className={labelClass}>description (optional)</div>
        <textarea
          value={createForm.description}
          onChange={(e) => onCreateFormChange({ ...createForm, description: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="more detail if the title isn't enough"
        />
      </div>
      <div>
        <div className={labelClass}>unblocks (optional — rationale for priority engine)</div>
        <textarea
          value={createForm.unblocks_label}
          onChange={(e) => onCreateFormChange({ ...createForm, unblocks_label: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="what does completing this unblock?"
        />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <div className={labelClass}>deadline (optional)</div>
          <input
            type="date"
            value={createForm.deadline}
            onChange={(e) => onCreateFormChange({ ...createForm, deadline: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>est. minutes (optional)</div>
          <input
            type="number"
            min={0}
            value={createForm.estimated_minutes}
            onChange={(e) => onCreateFormChange({ ...createForm, estimated_minutes: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>est. cost usd (optional)</div>
          <input
            type="text"
            value={createForm.estimated_cost_usd}
            onChange={(e) => onCreateFormChange({ ...createForm, estimated_cost_usd: e.target.value })}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div>
          <div className={labelClass}>category (optional)</div>
          <select
            value={createForm.coa_code}
            onChange={(e) => onCreateFormChange({ ...createForm, coa_code: e.target.value })}
            className={inputClass}
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
      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={onCreate}
          disabled={createSaving}
          className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
        >
          {createSaving ? 'creating…' : 'create task'}
        </button>
        <button
          type="button"
          onClick={onCancelCreate}
          disabled={createSaving}
          className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
