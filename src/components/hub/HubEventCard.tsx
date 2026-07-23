/**
 * HubEventCard — read-only info card for a single Operations calendar block.
 *
 * Triggered by clicking an Operations event on the Hub's CalendarGrid
 * (PR-Ops-5.5). Replaces the dead-link navigation from PR-Ops-5.3.
 *
 * Structural pattern mirrored from BudgetDrillDown.tsx:
 *   - right-side slide-in panel (max-w-lg)
 *   - bg-black/30 backdrop
 *   - click-outside to close
 *   - Escape to close
 *   - × close button
 *   - brand-purple header
 *
 * Renders only sections that have data — no empty rows, no placeholders.
 * Dimension links in the footer are LIVE only (Projects + Daily Plan);
 * category and bookkeeping deep-links are deferred until those routes
 * support filter-by-code (locked decision, PR-Ops-5.5 Phase 1).
 *
 * Reads all data from the parent's already-fetched DailyPlanItem +
 * CalendarBlockSummary — zero new fetches.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  DailyPlanItem,
  CalendarBlockSummary,
} from '@/components/workbench/operations/dailyplan/types';

interface Props {
  item: DailyPlanItem;
  block: CalendarBlockSummary;
  onClose: () => void;
  /** Fired after a successful reschedule/reconcile so the parent refetches. */
  onUpdated: () => void;
  /** CAL-DS-THEME: light default (byte-identical); HubCalendar passes 'dark'. */
  surface?: Surface;
}

// CAL-DS-THEME
import { themed, type Surface } from '@/lib/ds';

const BLOCK_STATUSES = ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO instant → local { date: YYYY-MM-DD, time: HH:MM } for form inputs. */
function isoToParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/** Combine local date + time into an ISO instant; null if either missing/invalid. */
function partsToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime12h(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCostUsd(s: string | null): string | null {
  if (s == null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const pillClassBase =
  'inline-block px-2 py-0.5 border border-border rounded text-xs font-mono text-text-muted';

const labelClassBase = 'text-text-faint uppercase tracking-wide text-xs font-mono';

const fieldClassBase =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';

export default function HubEventCard({ item, block, onClose, onUpdated, surface = 'light' }: Props) {
  const dk = surface === 'dark';
  const pillClass = themed(pillClassBase, dk);
  const labelClass = themed(labelClassBase, dk);
  const fieldClass = themed(fieldClassBase, dk);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Inline action panels (reschedule / reconcile). Lean by design — deep
  // task edits link out to /operations rather than duplicating the editor.
  const [mode, setMode] = useState<'reschedule' | 'reconcile' | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflictIds, setConflictIds] = useState<string[] | null>(null);

  const startParts = isoToParts(block.scheduled_start);
  const endParts = isoToParts(block.scheduled_end);
  const actualStartParts = isoToParts(block.actual_start);
  const actualEndParts = isoToParts(block.actual_end);

  // Reschedule form
  const [rDate, setRDate] = useState(startParts.date);
  const [rStart, setRStart] = useState(startParts.time);
  const [rEnd, setREnd] = useState(endParts.time);

  // Reconcile form
  const [acDate, setAcDate] = useState(actualStartParts.date || startParts.date);
  const [acStart, setAcStart] = useState(actualStartParts.time || startParts.time);
  const [acEnd, setAcEnd] = useState(actualEndParts.time || endParts.time);
  const [acStatus, setAcStatus] = useState<string>(block.status);
  const [acCost, setAcCost] = useState(item.task?.actual_cost_usd ?? '');
  const [acMinutes, setAcMinutes] = useState(
    item.task?.actual_minutes != null ? String(item.task.actual_minutes) : ''
  );

  const patchBlock = async (body: Record<string, unknown>): Promise<Response> =>
    fetch(`/api/operations/daily-plan/blocks/${block.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const submitReschedule = async (allowConflicts: boolean) => {
    const start = partsToIso(rDate, rStart);
    const end = partsToIso(rDate, rEnd);
    if (!start || !end) {
      setActionError('pick a valid date, start, and end time');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const res = await patchBlock({ scheduled_start: start, scheduled_end: end, allow_conflicts: allowConflicts });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setConflictIds(Array.isArray(body.conflicting_block_ids) ? body.conflicting_block_ids : []);
        return;
      }
      if (!res.ok) {
        setActionError(body?.message ?? body?.error ?? 'failed to reschedule');
        return;
      }
      onUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'failed to reschedule');
    } finally {
      setSaving(false);
    }
  };

  const submitReconcile = async () => {
    setSaving(true);
    setActionError(null);
    try {
      // Block actuals + status.
      const actualStart = acStart ? partsToIso(acDate, acStart) : null;
      const actualEnd = acEnd ? partsToIso(acDate, acEnd) : null;
      const blockRes = await patchBlock({
        actual_start: actualStart,
        actual_end: actualEnd,
        status: acStatus,
      });
      if (!blockRes.ok) {
        const b = await blockRes.json().catch(() => ({}));
        setActionError(b?.message ?? b?.error ?? 'failed to reconcile block');
        return;
      }
      // Task actuals (cost/minutes) — only when this is a task-linked item.
      if (item.task) {
        const taskBody: Record<string, unknown> = {};
        if (acCost.trim().length > 0) taskBody.actual_cost_usd = acCost.trim();
        if (acMinutes.trim().length > 0) taskBody.actual_minutes = Number(acMinutes.trim());
        if (Object.keys(taskBody).length > 0) {
          const taskRes = await fetch(
            `/api/operations/projects/${item.task.project_id}/tasks/${item.task.id}`,
            { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskBody) }
          );
          if (!taskRes.ok) {
            const t = await taskRes.json().catch(() => ({}));
            setActionError(t?.message ?? t?.error ?? 'block updated, but task actuals failed');
            return;
          }
        }
      }
      onUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'failed to reconcile');
    } finally {
      setSaving(false);
    }
  };

  // Click outside to close. Delay registration so the opening click
  // (which bubbled from the calendar tile) doesn't immediately close.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Escape to close.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const title = item.task?.title ?? item.ad_hoc_title ?? 'Untitled';
  const planned = formatCostUsd(item.task?.estimated_cost_usd ?? null);
  const actual = formatCostUsd(item.task?.actual_cost_usd ?? null);
  const hasActualTimes = block.actual_start != null && block.actual_end != null;
  const hasAnyNote = (block.notes && block.notes.length > 0) || (item.notes && item.notes.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={themed('relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200', dk)}
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="bg-brand-purple text-white px-5 py-4 flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="text-sm font-semibold break-words">{title}</h3>
            <p className="text-xs text-white/70 mt-0.5 font-mono">
              Operations · {formatDateLong(block.scheduled_start)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 -mr-1 -mt-1 shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {/* Time + status */}
          <div className="space-y-1">
            <div className={labelClass}>scheduled</div>
            <div className={themed('font-mono text-text-primary', dk)}>
              {formatTime12h(block.scheduled_start)} – {formatTime12h(block.scheduled_end)}
            </div>
            <div>
              <span className={pillClass}>{block.status}</span>
            </div>
            {hasActualTimes && (
              <div className={themed('text-xs font-mono text-text-muted', dk)}>
                actually: {formatTime12h(block.actual_start as string)} – {formatTime12h(block.actual_end as string)}
              </div>
            )}
          </div>

          {/* Task (when not ad-hoc) */}
          {item.task && (
            <div className={themed('space-y-1 pt-3 border-t border-border-light', dk)}>
              <div className={labelClass}>task</div>
              <div className={themed('text-text-primary', dk)}>{item.task.title}</div>
              <div>
                <span className={pillClass}>{item.task.status}</span>
              </div>
            </div>
          )}

          {/* Ad-hoc description (when ad-hoc) */}
          {!item.task && item.ad_hoc_description && (
            <div className={themed('space-y-1 pt-3 border-t border-border-light', dk)}>
              <div className={labelClass}>description</div>
              <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{item.ad_hoc_description}</div>
            </div>
          )}

          {/* Category */}
          {item.task?.coa_code && (
            <div className={themed('space-y-1 pt-3 border-t border-border-light', dk)}>
              <div className={labelClass}>category</div>
              <div className={themed('font-mono text-text-primary', dk)}>{item.task.coa_code}</div>
            </div>
          )}

          {/* Cost — render only sides that are populated */}
          {(planned || actual) && (
            <div className={themed('space-y-1 pt-3 border-t border-border-light', dk)}>
              <div className={labelClass}>cost</div>
              <div className={themed('font-mono text-text-primary space-y-0.5', dk)}>
                {planned && (
                  <div>
                    <span className={themed('text-text-muted', dk)}>Planned:</span> {planned}
                  </div>
                )}
                {actual && (
                  <div>
                    <span className={themed('text-text-muted', dk)}>Actual:</span> {actual}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes — show both block + item when present, labeled by scope */}
          {hasAnyNote && (
            <div className={themed('space-y-2 pt-3 border-t border-border-light', dk)}>
              <div className={labelClass}>notes</div>
              {block.notes && (
                <div>
                  <div className={themed('text-xs font-mono text-text-muted', dk)}>Block note:</div>
                  <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{block.notes}</div>
                </div>
              )}
              {item.notes && (
                <div>
                  <div className={themed('text-xs font-mono text-text-muted', dk)}>Task note:</div>
                  <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{item.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action panels (reschedule / reconcile) */}
        {mode && (
          <div className={themed('border-t border-border px-5 py-4 space-y-3 bg-purple-50/20 text-xs font-mono', dk)}>
            {actionError && (
              <div className="px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800">{actionError}</div>
            )}

            {mode === 'reschedule' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className={labelClass}>day</div>
                    <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <div className={labelClass}>start</div>
                    <input type="time" value={rStart} onChange={(e) => setRStart(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <div className={labelClass}>end</div>
                    <input type="time" value={rEnd} onChange={(e) => setREnd(e.target.value)} className={fieldClass} />
                  </div>
                </div>
                {conflictIds !== null ? (
                  <div className="px-2 py-2 rounded border bg-amber-50 border-amber-300 text-amber-900 space-y-2">
                    <div>Time conflict with {conflictIds.length} existing block{conflictIds.length === 1 ? '' : 's'}. Reschedule anyway?</div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => submitReschedule(true)} disabled={saving} className="px-2 py-0.5 border border-amber-500 bg-amber-500 text-white rounded hover:opacity-90 disabled:opacity-50">
                        {saving ? 'saving…' : 'reschedule anyway'}
                      </button>
                      <button type="button" onClick={() => setConflictIds(null)} disabled={saving} className={themed('px-2 py-0.5 border border-border rounded hover:bg-white disabled:opacity-50', dk)}>
                        pick another time
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => submitReschedule(false)} disabled={saving} className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50">
                    {saving ? 'saving…' : 'save new time'}
                  </button>
                )}
              </>
            )}

            {mode === 'reconcile' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className={labelClass}>actual day</div>
                    <input type="date" value={acDate} onChange={(e) => setAcDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <div className={labelClass}>actual start</div>
                    <input type="time" value={acStart} onChange={(e) => setAcStart(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <div className={labelClass}>actual end</div>
                    <input type="time" value={acEnd} onChange={(e) => setAcEnd(e.target.value)} className={fieldClass} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className={labelClass}>status</div>
                    <select value={acStatus} onChange={(e) => setAcStatus(e.target.value)} className={fieldClass}>
                      {BLOCK_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  {item.task && (
                    <>
                      <div>
                        <div className={labelClass}>actual cost</div>
                        <input type="text" value={acCost} onChange={(e) => setAcCost(e.target.value)} className={fieldClass} placeholder="0.00" />
                      </div>
                      <div>
                        <div className={labelClass}>actual minutes</div>
                        <input type="text" value={acMinutes} onChange={(e) => setAcMinutes(e.target.value)} className={fieldClass} placeholder="0" />
                      </div>
                    </>
                  )}
                </div>
                <button type="button" onClick={submitReconcile} disabled={saving} className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50">
                  {saving ? 'saving…' : 'save actuals'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Footer — actions + LIVE dimension link-outs */}
        <div className={themed('border-t border-border bg-bg-row/50 px-5 py-3 flex flex-wrap items-center gap-2', dk)}>
          <button
            type="button"
            onClick={() => { setMode(mode === 'reschedule' ? null : 'reschedule'); setActionError(null); setConflictIds(null); }}
            className={themed('px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-white text-text-primary', dk)}
          >
            {mode === 'reschedule' ? 'Cancel' : 'Reschedule'}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'reconcile' ? null : 'reconcile'); setActionError(null); }}
            className={themed('px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-white text-text-primary', dk)}
          >
            {mode === 'reconcile' ? 'Cancel' : 'Reconcile'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/operations/projects')}
            className={themed('px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-white text-text-primary', dk)}
          >
            Open in Projects →
          </button>
        </div>
      </div>

      {/* CSS animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
