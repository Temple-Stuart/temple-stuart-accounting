'use client';

/**
 * EventDetailPanel — the master calendar's click→detail panel (PR-HCR3).
 *
 * Renders ONE clicked calendar event. It is TYPE-AWARE:
 *   • trade  → a markets layout (Position / Signal / P&L / Expiry).
 *   • trip / project / routine → the 12-column hub_scheduled_items scaffold
 *     (Start/End Date+Time, Entity, Cadence, Category, Project/Routine, Task/Step,
 *     Billable, Budget $, Actual $).
 *
 * It is the SCAFFOLD the 12-column wiring fills later: it shows the real values the
 * event already carries (dates, times, budget, name) and labels everything not yet
 * wired as "not set yet" — honest placeholders, never fake values.
 *
 * ZERO FETCH: it renders the passed `event` object only. Nothing here calls a route,
 * so it is safe on the logged-out demo (no personal data, no leak).
 *
 * Chrome is a centered modal box matching the booking popup (CheckoutPanel.tsx:249,256):
 * a dimmed full-screen backdrop, a centered max-w-lg / max-h-[90vh] scroll box,
 * click-outside + Escape to close, × button, brand-purple header.
 */

import { useEffect, useRef } from 'react';
import type { CalendarEvent as GridEvent } from '@/components/shared/CalendarGrid';
import { themed, type Surface } from '@/lib/ds';

interface Props {
  event: GridEvent;
  onClose: () => void;
  /** CAL-DS-THEME: light default (byte-identical); HubCalendar passes 'dark'. */
  surface?: Surface;
}

// Source label + legend dot color — the SAME hues as the calendar legend
// (HubCalendar SOURCE_CONFIG: trip=cyan, project=indigo, routines=teal, trade=amber).
const SOURCE_BADGE: Record<string, { label: string; dot: string }> = {
  trip: { label: 'Trip', dot: 'bg-cyan-400' },
  project: { label: 'Project', dot: 'bg-indigo-400' },
  routines: { label: 'Routine', dot: 'bg-teal-400' },
  trade: { label: 'Trade', dot: 'bg-amber-400' },
};

const NOT_SET = 'not set yet';

const labelClass = 'text-text-faint uppercase tracking-wide text-xs font-mono';

/** YYYY-MM-DD → a friendly local date (parsed at midnight to avoid tz drift). */
function formatDate(ymd?: string | null): string {
  if (!ymd) return NOT_SET;
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatUsd(n?: number): string {
  if (n == null || !Number.isFinite(n)) return NOT_SET;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** One label/value row. A "not set yet" value reads as a muted, italic placeholder. */
function Row({ label, value, dk }: { label: string; value: string; dk: boolean }) {
  const isPlaceholder = value === NOT_SET;
  return (
    <div className={themed('flex items-start justify-between gap-3 border-b border-border py-2 last:border-0', dk)}>
      <span className={themed(labelClass, dk)}>{label}</span>
      <span className={themed(`text-right text-sm ${isPlaceholder ? 'italic text-text-faint' : 'text-text-primary'}`, dk)}>
        {value}
      </span>
    </div>
  );
}

export default function EventDetailPanel({ event, onClose, surface = 'light' }: Props) {
  const dk = surface === 'dark';
  const panelRef = useRef<HTMLDivElement>(null);
  const cfg = SOURCE_BADGE[event.source] ?? { label: event.source, dot: 'bg-border' };
  const isTrade = event.source === 'trade';

  // Click-outside to close (delayed bind so the opening click doesn't close it).
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Escape to close.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── Build the rows for the active branch. `val(x)` falls back to "not set yet". ──
  const val = (s?: string | null) => (s && s.length > 0 ? s : NOT_SET);

  const tradeRows: { label: string; value: string }[] = [
    { label: 'Date', value: formatDate(event.startDate) },
    { label: 'Time', value: val(event.startTime) },
    { label: 'Position', value: val(event.title) },
    { label: 'Signal', value: NOT_SET },   // scanner wiring comes later
    { label: 'P&L', value: NOT_SET },
    { label: 'Expiry', value: NOT_SET },
  ];

  const scheduledRows: { label: string; value: string }[] = [
    { label: 'Start Date', value: formatDate(event.startDate) },
    { label: 'Start Time', value: val(event.startTime) },
    { label: 'End Date', value: event.endDate ? formatDate(event.endDate) : NOT_SET },
    { label: 'End Time', value: val(event.endTime) },
    { label: 'Entity', value: NOT_SET },
    { label: 'Cadence', value: event.isRecurring ? 'Repeats' : NOT_SET },
    { label: 'Category (COA)', value: val(event.coaCode) },
    { label: cfg.label, value: val(event.title) },
    ...(event.location ? [{ label: 'Location', value: event.location }] : []),
    { label: 'Task / Step', value: NOT_SET },
    { label: 'Billable', value: NOT_SET },
    { label: 'Budget $', value: event.budgetAmount != null ? formatUsd(event.budgetAmount) : NOT_SET },
    { label: 'Actual $', value: NOT_SET },
  ];

  const rows = isTrade ? tradeRows : scheduledRows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      {/* Centered modal box — matches the booking popup (CheckoutPanel.tsx:249,256). */}
      <div
        ref={panelRef}
        className={themed('flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-sm', dk)}
      >
        {/* Header */}
        <div className="flex items-start justify-between bg-brand-purple px-5 py-4 text-white">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="break-words text-sm font-semibold">{event.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
              <span className={themed(`h-2 w-2 rounded-sm ${cfg.dot}`, dk)} />
              {cfg.label} · {formatDate(event.startDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0 p-1 text-white/70 transition-colors hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className={themed('rounded-lg border border-border p-3', dk)}>
            {rows.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} dk={dk} />
            ))}
          </div>

          {/* The event's own detail lines (project cost line, trade notes), if any. */}
          {event.details && event.details.length > 0 && (
            <div className="mt-4">
              <p className={themed(labelClass, dk)}>Notes</p>
              <ul className="mt-1 space-y-0.5">
                {event.details.map((line, i) => (
                  <li key={i} className={themed('text-sm text-text-secondary', dk)}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <p className={themed('mt-4 text-xs text-text-faint', dk)}>
            {isTrade
              ? 'The trade details fill in once this is wired to your trading account.'
              : 'The blank fields fill in once this is wired to your account.'}
          </p>
        </div>
      </div>
    </div>
  );
}
