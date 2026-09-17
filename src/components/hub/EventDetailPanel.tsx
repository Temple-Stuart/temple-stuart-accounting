'use client';

/**
 * EventDetailPanel — DRILL-01: click anything on the day, see its whole chain.
 *
 * ONE PANEL, EVERY KIND. A calendar_event (any admitted source), a routine
 * occurrence, a project block's task, a trade — each opens this, and each is
 * described by what THAT object actually knows. The per-kind census lives in
 * src/lib/calendar/chain.ts, not here; this file renders it.
 *
 * It states, for the clicked row: what it is and which tool owns it, when, where
 * (with its pin when both coordinates are stored), its planned amount, its
 * actual if the object itself carries one, and its COA.
 *
 * THE CHAIN, HONESTLY. Under the figures it shows one of three states and never
 * a fourth — PLANNED · PLANNED AND SETTLED · NOT LINKED — and where the actual
 * cannot be known it quotes DAY-01's verdict rather than guessing a match. An
 * amount is never rendered without saying where it came from. A row with no
 * amounts shows no chain and no figures: a blank, never $0.
 *
 * ZERO FETCH, ZERO WRITE. It renders the DrillRow it is handed. Nothing here
 * calls a route, so it is safe on the logged-out demo, and the door it carries
 * is a link — the founder acts in the owning tool, not in this panel.
 *
 * Chrome is unchanged from PR-HCR3: a dimmed backdrop, a centered max-w-lg box,
 * click-outside + Escape to close, × button, brand-purple header.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ACTUAL_SOURCE_LABEL, type DrillRow } from '@/lib/calendar/chain';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';

interface Props {
  row: DrillRow;
  onClose: () => void;
}

/** The legend hues, unchanged — the panel wears the layer the row came from. */
const KIND_DOT: Record<string, string> = {
  trip: 'bg-cyan-400',
  project: 'bg-indigo-400',
  operations: 'bg-indigo-400',
  routines: 'bg-teal-400',
  trade: 'bg-amber-400',
};

const NONE = '—';
const labelClass = 'text-text-faint uppercase tracking-wide text-xs font-mono';

/** The state's colour. NOT LINKED is not an error — it is an honest unknown. */
const STATE_CLASS: Record<string, string> = {
  PLANNED: 'border-brand-purple/40 bg-brand-purple/5 text-brand-purple',
  PLANNED_AND_SETTLED: 'border-emerald-400/40 bg-emerald-50 text-emerald-700',
  NOT_LINKED: 'border-border bg-bg-row text-text-muted',
};

function formatDate(ymd?: string | null): string {
  if (!ymd) return NONE;
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

/** Dollars. NULL RENDERS BLANK — a zero here would be a number the app does not have. */
function money(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return NONE;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clock(t: string | null): string {
  if (!t) return NONE;
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

function Row({ label, value, mono, testId }: { label: string; value: string; mono?: boolean; testId?: string }) {
  const blank = value === NONE;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className={labelClass}>{label}</span>
      <span
        data-drill-field={testId}
        className={`text-right text-sm ${mono ? 'font-mono tabular-nums' : ''} ${blank ? 'text-text-faint' : 'text-text-primary'}`}
      >
        {blank ? <span data-drill-blank>{NONE}</span> : value}
      </span>
    </div>
  );
}

export default function EventDetailPanel({ row, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dot = KIND_DOT[row.source] ?? 'bg-border';
  const ownerTool = navToolByName(row.owner, TOOL_GATE);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const when = row.startTime
    ? `${clock(row.startTime)}${row.endTime ? ` – ${clock(row.endTime)}` : ''}`
    : NONE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        ref={panelRef}
        data-drill-panel
        data-drill-kind={row.kind}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-sm"
      >
        <div className="flex items-start justify-between bg-brand-purple px-5 py-4 text-white">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="break-words text-sm font-semibold" data-drill-title>{row.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
              <span className={`h-2 w-2 rounded-sm ${dot}`} />
              <span data-drill-source>{row.source}</span> · owned by <span data-drill-owner>{row.owner}</span> · {formatDate(row.startDate)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 p-1 text-white/70 transition-colors hover:text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* WHAT IT IS, WHEN, WHERE — only what the object knows. */}
          <div className="rounded-lg border border-border p-3">
            <Row label="Date" value={formatDate(row.startDate)} testId="date" />
            {row.endDate && row.endDate !== row.startDate && <Row label="Through" value={formatDate(row.endDate)} testId="through" />}
            <Row label="Time" value={when} testId="time" />
            <Row label="Where" value={row.location ?? NONE} testId="where" />
            {row.pin && (
              <Row label="Pin" mono testId="pin"
                value={`${row.pin.lat.toFixed(5)}, ${row.pin.lon.toFixed(5)}`} />
            )}
            <Row label="Category (COA)" value={row.coaCode ?? NONE} mono testId="coa" />
          </div>

          {/* THE FIGURES. Each is blank when the object does not carry it. */}
          <div className="mt-4 rounded-lg border border-border p-3">
            <Row label="Planned" value={money(row.planned)} mono testId="planned" />
            <Row label="Actual" value={money(row.actual)} mono testId="actual" />
            {row.actual !== null && row.actualSource && (
              <p className="pt-2 text-xs text-text-muted" data-drill-actual-source>
                That actual is <span className="font-mono">{ACTUAL_SOURCE_LABEL[row.actualSource]}</span>.
              </p>
            )}
          </div>

          {/* THE CHAIN — one of three states, or nothing at all when there are no figures. */}
          {row.chain ? (
            <div className={`mt-4 rounded-lg border p-3 ${STATE_CLASS[row.chain.state] ?? 'border-border'}`}>
              <p className="font-mono text-[11px] uppercase tracking-wider" data-drill-chain-state={row.chain.state}>
                {row.chain.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed" data-drill-chain-line>{row.chain.line}</p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-text-faint" data-drill-no-chain>
              This row carries no amount, so there is no chain to show.
            </p>
          )}

          {/* THE DOOR — one link, to the tool that owns the object. */}
          {ownerTool?.href && (
            <Link href={ownerTool.href} data-drill-owner-link={row.owner}
              className="mt-4 inline-block rounded border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-row">
              Open in {row.owner} →
            </Link>
          )}

          <p className="mt-4 text-xs text-text-faint" data-drill-census>{row.facts.note}</p>
        </div>
      </div>
    </div>
  );
}
