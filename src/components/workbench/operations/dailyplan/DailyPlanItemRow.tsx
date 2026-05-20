/**
 * DailyPlanItemRow — one operations_daily_plan_items row on the Daily Plan page.
 *
 * Task-linked items render the linked task's title + status pill; ad-hoc items
 * render ad_hoc_title/description. calendar_blocks are listed read-only beneath,
 * with an inline "+ schedule block" affordance (PR-Ops-5.2) that POSTs to
 * /api/operations/daily-plan/items/[itemId]/blocks. Server-side conflict
 * detection returns 409 with conflicting_block_ids; the form stays open,
 * surfaces the conflict inline, and offers a "schedule anyway" toggle that
 * resubmits with allow_conflicts:true.
 *
 * Inline edit covers notes + display_order for all items, plus ad_hoc_title/
 * description for ad-hoc items (task_id / entity_id / plan_date are immutable
 * per the PR-Ops-4.1 endpoint).
 */

'use client';

import { useState } from 'react';
import type { DailyPlanItem } from './types';

interface Props {
  item: DailyPlanItem;
  onUpdate: () => void;
  onDelete: () => void;
}

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Convert a Date to the value format expected by <input type="datetime-local">:
 * "YYYY-MM-DDTHH:mm" in the user's LOCAL timezone (no Z suffix).
 */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Default block window for a new "+ schedule block" form:
 *   - start = the latest existing block's scheduled_end if any, else plan_date at 09:00 local
 *   - end   = start + 60 minutes (no estimated_minutes available on the linked task summary;
 *             a per-task default would need a new fetch — out of scope per PR-Ops-5.2)
 */
function defaultBlockWindow(item: DailyPlanItem): { start: Date; end: Date } {
  let start: Date;
  if (item.calendar_blocks.length > 0) {
    const lastEnd = item.calendar_blocks[item.calendar_blocks.length - 1].scheduled_end;
    start = new Date(lastEnd);
  } else {
    const datePart = item.plan_date.slice(0, 10); // YYYY-MM-DD
    start = new Date(`${datePart}T09:00`);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

export default function DailyPlanItemRow({ item, onUpdate, onDelete }: Props) {
  const isAdHoc = !item.task;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ad_hoc_title: item.ad_hoc_title ?? '',
    ad_hoc_description: item.ad_hoc_description ?? '',
    notes: item.notes ?? '',
    display_order: String(item.display_order),
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "+ schedule block" inline form state (PR-Ops-5.2). Separate from the
  // item-level error/saving state so block-form errors never bleed into
  // item-level errors and vice versa.
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockAllowConflicts, setBlockAllowConflicts] = useState(false);
  const [blockConflictDetected, setBlockConflictDetected] = useState(false);

  const openBlockForm = () => {
    const { start, end } = defaultBlockWindow(item);
    setBlockStart(toDatetimeLocal(start));
    setBlockEnd(toDatetimeLocal(end));
    setBlockNotes('');
    setBlockError(null);
    setBlockAllowConflicts(false);
    setBlockConflictDetected(false);
    setShowBlockForm(true);
  };

  const closeBlockForm = () => {
    setShowBlockForm(false);
    setBlockStart('');
    setBlockEnd('');
    setBlockNotes('');
    setBlockError(null);
    setBlockAllowConflicts(false);
    setBlockConflictDetected(false);
  };

  const handleScheduleBlock = async () => {
    if (blockSaving) return;

    // Client-side guards — the server validates authoritatively regardless,
    // but these prevent obviously-invalid POSTs from firing.
    if (!blockStart || !blockEnd) {
      setBlockError('Start and end are both required');
      return;
    }
    const startDate = new Date(blockStart);
    const endDate = new Date(blockEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setBlockError('Invalid date/time');
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      setBlockError('End must be after start');
      return;
    }

    setBlockSaving(true);
    setBlockError(null);
    try {
      const notesTrimmed = blockNotes.trim();
      const body: Record<string, unknown> = {
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
      };
      if (notesTrimmed.length > 0) body.notes = notesTrimmed;
      if (blockAllowConflicts) body.allow_conflicts = true;

      const res = await fetch(`/api/operations/daily-plan/items/${item.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        // Conflict — keep the form open, surface the conflict inline, reveal
        // the "schedule anyway" toggle so the user can override deliberately.
        setBlockConflictDetected(true);
        setBlockError('This overlaps an existing block. Adjust the time, or schedule anyway.');
        return;
      }

      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBlockError(resBody?.message ?? resBody?.error ?? `failed to schedule block (${res.status})`);
        return;
      }

      // 201 — block created. Refresh the items list so the new block shows
      // up in the read-only display via the server's nested include.
      closeBlockForm();
      onUpdate();
    } catch (e) {
      setBlockError(e instanceof Error ? e.message : 'failed to schedule block');
    } finally {
      setBlockSaving(false);
    }
  };

  const enterEdit = () => {
    setForm({
      ad_hoc_title: item.ad_hoc_title ?? '',
      ad_hoc_description: item.ad_hoc_description ?? '',
      notes: item.notes ?? '',
      display_order: String(item.display_order),
    });
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        notes: form.notes,
        display_order: Number(form.display_order),
      };
      if (isAdHoc) {
        body.ad_hoc_title = form.ad_hoc_title;
        body.ad_hoc_description = form.ad_hoc_description;
      }
      const res = await fetch(`/api/operations/daily-plan/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(resBody?.message ?? resBody?.error ?? 'failed to save');
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

  const handleDelete = async () => {
    if (!window.confirm('Delete this item from the daily plan?')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/daily-plan/items/${item.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        setError(resBody?.message ?? resBody?.error ?? 'failed to delete');
        return;
      }
      onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {item.task ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-text-muted">[task]</span>
              <span className="font-mono text-sm text-text-primary">{item.task.title}</span>
              <span className="px-1.5 py-0 border border-border rounded text-xs font-mono text-text-muted">
                {item.task.status}
              </span>
            </div>
          ) : (
            <div className="font-mono text-sm text-text-primary">{item.ad_hoc_title}</div>
          )}

          {isAdHoc && item.ad_hoc_description && (
            <div className="text-xs font-mono text-text-muted mt-1 whitespace-pre-wrap">
              {item.ad_hoc_description}
            </div>
          )}

          {item.notes && (
            <div className="text-xs font-mono text-text-muted mt-1 italic whitespace-pre-wrap">
              {item.notes}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!editing && (
            <button
              type="button"
              onClick={enterEdit}
              className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs font-mono"
            >
              edit
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs font-mono"
          >
            {deleting ? 'deleting…' : 'delete'}
          </button>
        </div>
      </div>

      {item.calendar_blocks.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-2 border-l-2 border-border-light">
          {item.calendar_blocks.map((b) => (
            <div key={b.id} className="text-xs font-mono text-text-muted">
              {formatTime(b.scheduled_start)}–{formatTime(b.scheduled_end)} · {b.status}
            </div>
          ))}
        </div>
      )}

      {!showBlockForm && !editing && (
        <button
          type="button"
          onClick={openBlockForm}
          className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs font-mono"
        >
          + schedule block
        </button>
      )}

      {showBlockForm && (
        <div
          className="mt-1 p-2 border border-border-light rounded bg-bg-row text-xs font-mono space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1">
              <span className="text-text-muted">start</span>
              <input
                type="datetime-local"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                disabled={blockSaving}
                className="px-2 py-0.5 border border-border rounded text-text-primary disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-text-muted">end</span>
              <input
                type="datetime-local"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                disabled={blockSaving}
                className="px-2 py-0.5 border border-border rounded text-text-primary disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-1 flex-1 min-w-[160px]">
              <span className="text-text-muted">notes</span>
              <input
                type="text"
                value={blockNotes}
                onChange={(e) => setBlockNotes(e.target.value)}
                disabled={blockSaving}
                placeholder="(optional)"
                className="flex-1 px-2 py-0.5 border border-border rounded text-text-primary disabled:opacity-50"
              />
            </label>
          </div>

          {blockConflictDetected && (
            <label className="flex items-center gap-2 text-text-muted">
              <input
                type="checkbox"
                checked={blockAllowConflicts}
                onChange={(e) => setBlockAllowConflicts(e.target.checked)}
                disabled={blockSaving}
              />
              <span>schedule anyway (overlaps an existing block)</span>
            </label>
          )}

          {blockError && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {blockError}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-border-light">
            <button
              type="button"
              onClick={handleScheduleBlock}
              disabled={blockSaving || !blockStart || !blockEnd}
              className="px-3 py-0.5 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {blockSaving ? 'scheduling…' : 'schedule'}
            </button>
            <button
              type="button"
              onClick={closeBlockForm}
              disabled={blockSaving}
              className="px-3 py-0.5 border border-border text-text-muted rounded hover:bg-white disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 space-y-2">
          {isAdHoc && (
            <div>
              <label className="text-xs font-mono text-text-muted">title</label>
              <input
                type="text"
                className={inputClass}
                value={form.ad_hoc_title}
                onChange={(e) => setForm({ ...form, ad_hoc_title: e.target.value })}
                maxLength={500}
              />
            </div>
          )}
          {isAdHoc && (
            <div>
              <label className="text-xs font-mono text-text-muted">description</label>
              <textarea
                className={inputClass}
                value={form.ad_hoc_description}
                onChange={(e) => setForm({ ...form, ad_hoc_description: e.target.value })}
                rows={3}
                maxLength={1500}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-mono text-text-muted">notes</label>
            <textarea
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              maxLength={1500}
            />
          </div>
          <div>
            <label className="text-xs font-mono text-text-muted">display order</label>
            <input
              type="number"
              className={inputClass}
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50 text-xs font-mono"
            >
              {saving ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs font-mono"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
          {error}
        </div>
      )}
    </div>
  );
}
