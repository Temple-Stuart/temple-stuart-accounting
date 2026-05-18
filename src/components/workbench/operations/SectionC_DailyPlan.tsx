/**
 * src/components/workbench/operations/SectionC_DailyPlan.tsx
 *
 * Section C · Daily Plan — date-navigated list of operations_daily_plan_items.
 * Task-linked items show the linked task's title/status; ad-hoc items show
 * their own title. calendar_blocks render read-only beneath each item.
 *
 * Cross-entity by design: the day-plan is "everything I'm doing today" — the
 * GET items endpoint is user-scoped (no entity filter), so the operations
 * entity selector is intentionally ignored here. Ad-hoc creation still needs
 * an entity_id, so the create form carries its own entity selector.
 */

'use client';

import { useEffect, useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import DailyPlanItemRow from './dailyplan/DailyPlanItemRow';
import type { DailyPlanItem } from './dailyplan/types';

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function prevDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const EMPTY_CREATE_FORM = {
  ad_hoc_title: '',
  ad_hoc_description: '',
  notes: '',
  entity_id: '',
};

export default function SectionC_DailyPlan() {
  const { entities } = useOperationsEntity();

  const [currentDate, setCurrentDate] = useState<string>(todayIso());
  const [items, setItems] = useState<DailyPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/operations/daily-plan/items?from=${currentDate}&to=${currentDate}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load daily plan');
        setItems([]);
        return;
      }
      setItems(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load daily plan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const resetCreateForm = () => setCreateForm(EMPTY_CREATE_FORM);

  const handleCreate = async () => {
    if (!createForm.entity_id) {
      setCreateError('entity is required');
      return;
    }
    if (createForm.ad_hoc_title.trim().length === 0) {
      setCreateError('title is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/operations/daily-plan/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_date: currentDate,
          ad_hoc_title: createForm.ad_hoc_title,
          ad_hoc_description: createForm.ad_hoc_description,
          notes: createForm.notes,
          entity_id: createForm.entity_id,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(body?.message ?? body?.error ?? 'failed to create item');
        return;
      }
      resetCreateForm();
      setShowCreate(false);
      fetchItems();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'failed to create item');
    } finally {
      setCreating(false);
    }
  };

  const navBtnClass =
    'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-text-primary disabled:opacity-50';

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          C · DAILY PLAN
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-text-muted">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          {!showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90"
            >
              + add item
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs font-mono">
        <button type="button" onClick={() => setCurrentDate(prevDay(currentDate))} className={navBtnClass}>
          ← prev
        </button>
        <button type="button" onClick={() => setCurrentDate(todayIso())} className={navBtnClass}>
          today
        </button>
        <button type="button" onClick={() => setCurrentDate(nextDay(currentDate))} className={navBtnClass}>
          next →
        </button>
        <input
          type="date"
          value={currentDate}
          onChange={(e) => setCurrentDate(e.target.value || todayIso())}
          className="px-2 py-0.5 border border-border rounded text-text-primary"
        />
        <span className="text-text-muted ml-2">(showing all entities)</span>
      </div>

      {showCreate && (
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 space-y-2 mb-4">
          <div className="font-mono text-xs font-bold text-text-primary">
            new ad-hoc item · {currentDate}
          </div>
          <div>
            <label className="text-xs font-mono text-text-muted">entity</label>
            <select
              className={inputClass}
              value={createForm.entity_id}
              onChange={(e) => setCreateForm({ ...createForm, entity_id: e.target.value })}
            >
              <option value="">— select entity —</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-text-muted">title</label>
            <input
              type="text"
              className={inputClass}
              value={createForm.ad_hoc_title}
              onChange={(e) => setCreateForm({ ...createForm, ad_hoc_title: e.target.value })}
              maxLength={500}
              placeholder="what are you doing?"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-text-muted">description (optional)</label>
            <textarea
              className={inputClass}
              value={createForm.ad_hoc_description}
              onChange={(e) => setCreateForm({ ...createForm, ad_hoc_description: e.target.value })}
              rows={3}
              maxLength={1500}
            />
          </div>
          <div>
            <label className="text-xs font-mono text-text-muted">notes (optional)</label>
            <textarea
              className={inputClass}
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              rows={2}
              maxLength={1500}
            />
          </div>
          {createError && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
              {createError}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50 text-xs font-mono"
            >
              {creating ? 'creating…' : 'create item'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
                setCreateError(null);
              }}
              disabled={creating}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs font-mono"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-text-muted font-mono text-sm">loading daily plan…</div>
      ) : error ? (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-text-muted font-mono text-sm">
          nothing scheduled for {currentDate} — use &apos;+ add item&apos; or schedule a task from
          Projects.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <DailyPlanItemRow
              key={item.id}
              item={item}
              onUpdate={fetchItems}
              onDelete={fetchItems}
            />
          ))}
        </div>
      )}
    </section>
  );
}
