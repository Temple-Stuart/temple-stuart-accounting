/**
 * DailyPlanItemRow — one operations_daily_plan_items row on the Daily Plan page.
 *
 * Task-linked items render the linked task's title + status pill; ad-hoc items
 * render ad_hoc_title/description. calendar_blocks are listed read-only beneath
 * (block creation/editing is PR-Ops-4.5). Inline edit covers notes +
 * display_order for all items, plus ad_hoc_title/description for ad-hoc items
 * (task_id / entity_id / plan_date are immutable per the PR-Ops-4.1 endpoint).
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
