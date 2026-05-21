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

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type {
  DailyPlanItem,
  CalendarBlockSummary,
} from '@/components/workbench/operations/dailyplan/types';

interface Props {
  item: DailyPlanItem;
  block: CalendarBlockSummary;
  onClose: () => void;
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

const pillClass =
  'inline-block px-2 py-0.5 border border-border rounded text-xs font-mono text-text-muted';

const labelClass = 'text-text-faint uppercase tracking-wide text-xs font-mono';

export default function HubEventCard({ item, block, onClose }: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

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
        className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
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
            <div className="font-mono text-text-primary">
              {formatTime12h(block.scheduled_start)} – {formatTime12h(block.scheduled_end)}
            </div>
            <div>
              <span className={pillClass}>{block.status}</span>
            </div>
            {hasActualTimes && (
              <div className="text-xs font-mono text-text-muted">
                actually: {formatTime12h(block.actual_start as string)} – {formatTime12h(block.actual_end as string)}
              </div>
            )}
          </div>

          {/* Task (when not ad-hoc) */}
          {item.task && (
            <div className="space-y-1 pt-3 border-t border-border-light">
              <div className={labelClass}>task</div>
              <div className="text-text-primary">{item.task.title}</div>
              <div>
                <span className={pillClass}>{item.task.status}</span>
              </div>
            </div>
          )}

          {/* Ad-hoc description (when ad-hoc) */}
          {!item.task && item.ad_hoc_description && (
            <div className="space-y-1 pt-3 border-t border-border-light">
              <div className={labelClass}>description</div>
              <div className="text-text-primary whitespace-pre-wrap">{item.ad_hoc_description}</div>
            </div>
          )}

          {/* Category */}
          {item.task?.coa_code && (
            <div className="space-y-1 pt-3 border-t border-border-light">
              <div className={labelClass}>category</div>
              <div className="font-mono text-text-primary">{item.task.coa_code}</div>
            </div>
          )}

          {/* Cost — render only sides that are populated */}
          {(planned || actual) && (
            <div className="space-y-1 pt-3 border-t border-border-light">
              <div className={labelClass}>cost</div>
              <div className="font-mono text-text-primary space-y-0.5">
                {planned && (
                  <div>
                    <span className="text-text-muted">Planned:</span> {planned}
                  </div>
                )}
                {actual && (
                  <div>
                    <span className="text-text-muted">Actual:</span> {actual}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes — show both block + item when present, labeled by scope */}
          {hasAnyNote && (
            <div className="space-y-2 pt-3 border-t border-border-light">
              <div className={labelClass}>notes</div>
              {block.notes && (
                <div>
                  <div className="text-xs font-mono text-text-muted">Block note:</div>
                  <div className="text-text-primary whitespace-pre-wrap">{block.notes}</div>
                </div>
              )}
              {item.notes && (
                <div>
                  <div className="text-xs font-mono text-text-muted">Task note:</div>
                  <div className="text-text-primary whitespace-pre-wrap">{item.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — LIVE dimension links only */}
        <div className="border-t border-border bg-bg-row/50 px-5 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/operations/projects')}
            className="px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-white text-text-primary"
          >
            Open in Projects →
          </button>
          <button
            type="button"
            onClick={() => router.push('/operations')}
            className="px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-white text-text-primary"
          >
            Open Daily Plan →
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
