'use client';

/**
 * EventDetailPanel — DRILL-01 + LINK-01: click anything on the day, see its
 * whole chain — and CLOSE it by linking the posting that settled it.
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
 * LINK-01. An item in NOT LINKED offers a link: the panel lists this user's
 * postings near the item's date — date order, no score, nothing pre-selected —
 * and the founder picks one. NOTHING IS SUGGESTED AS PROBABLE. The actual then
 * becomes the SUM of what is linked, never an imputation, and unlinking returns
 * the item to NOT LINKED rather than to $0. A linked posting whose amount cannot
 * be read is named and excluded from the total — the EDGE-01 bug, inverted.
 *
 * LINES-01. A routine occurrence made of lines lists them — each line with its
 * time, activity, amount (or —) and account (or "no category") — then the total
 * with its coverage ("$280 across 2 of 3 lines"). The routine-level Category
 * row is REMOVED for a lined routine: one chip would be a lie about a routine
 * that has three. Each line carries its own Link / Unlink on kind 'routine_line'
 * keyed on (step, instant); a line's actual is the sum of its links, and the
 * occurrence's actual is the sum of its lines' actuals. Never both grains.
 *
 * IT READS its own links and writes only those links — no posting is altered,
 * no journal entry is touched, and no task's typed actual_cost_usd is ever
 * overwritten. In demo mode (`linkable={false}`) it reaches no route at all, so
 * the logged-out guest's zero-fetch guarantee is untouched. The door it carries
 * is a link — the founder acts in the owning tool, not in this panel.
 *
 * Chrome is unchanged from PR-HCR3: a dimmed backdrop, a centered max-w-lg box,
 * click-outside + Escape to close, × button, brand-purple header.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ACTUAL_SOURCE_LABEL, buildChain, type DrillRow } from '@/lib/calendar/chain';
import { FREE_TEXT_RULE, linkedSourceLine, sumLinks, typedVsLinked, variance, type LinkedPosting } from '@/lib/calendar/links';
import { useLineLinks } from '@/components/hub/useLineLinks';
import { parseRoutineTileId, type LinkableKind } from '@/lib/calendar/linkKeys';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';

interface Props {
  row: DrillRow;
  onClose: () => void;
  /**
   * LINK-01: false on the logged-out demo, where there is no account to link
   * against. The panel then reaches no route at all.
   */
  linkable?: boolean;
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

/** The (kind, id, instant) a link points at, or null when the row is not linkable. */
function targetOf(row: DrillRow): { kind: LinkableKind; id: string; instant: string | null } | null {
  if (!row.facts.linkable) return null;
  if (row.kind === 'routine') {
    // LINES-01: a LINED occurrence links at the LINE, never at the routine — the
    // coffee posting to the coffee line. The occurrence-level target is only for
    // a stepless routine, and the 'routine' kind is never repurposed.
    if (row.lines && row.lines.length > 0) return null;
    const parsed = parseRoutineTileId(row.id);
    // A routine tile whose id does not carry its instant cannot be addressed —
    // and is NOT silently linked on its date, which would match the wrong
    // occurrence. It offers no link and says nothing it cannot back up.
    return parsed ? { kind: 'routine', id: parsed.routineId, instant: parsed.instant } : null;
  }
  if (row.kind === 'project_task') return { kind: 'project_task', id: row.id, instant: null };
  return { kind: 'calendar_event', id: row.id, instant: null };
}

interface LinkRow extends LinkedPosting { linkedAt: string; linkedBy: string | null }

export default function EventDetailPanel({ row, onClose, linkable = true }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dot = KIND_DOT[row.source] ?? 'bg-border';
  const ownerTool = navToolByName(row.owner, TOOL_GATE);
  // Memoised so the loader's dependency is the TARGET itself, not three fields
  // of it — the row is a new object each render, its target is not.
  const target = useMemo(() => targetOf(row), [row]);

  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [candidates, setCandidates] = useState<LinkedPosting[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const load = useCallback(async (withCandidates: boolean) => {
    if (!target || !linkable) return;
    const q = new URLSearchParams({ kind: target.kind, id: target.id });
    if (target.instant) q.set('instant', target.instant);
    if (withCandidates) q.set('near', row.startDate.slice(0, 10));
    try {
      const res = await fetch(`/api/calendar/links?${q.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) { setRefusal(data?.error ?? `Links could not be read (HTTP ${res.status}).`); return; }
      setLinks(data.links ?? []);
      if (withCandidates) setCandidates(data.candidates ?? []);
    } catch { setRefusal('Links could not be read.'); }
  }, [linkable, row.startDate, target]);

  useEffect(() => { void load(false); }, [load]);

  const linkPosting = async (journalEntryId: string) => {
    if (!target) return;
    setBusy(true); setRefusal(null);
    try {
      const res = await fetch('/api/calendar/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: target.kind, id: target.id, instant: target.instant, journalEntryId }),
      });
      const data = await res.json().catch(() => null);
      // The server's own words, verbatim — it names the rule it refused on.
      if (!res.ok) { setRefusal(data?.error ?? `The link was not made (HTTP ${res.status}).`); return; }
      setPicking(false);
      await load(false);
    } finally { setBusy(false); }
  };

  const unlink = async (journalEntryId: string) => {
    setBusy(true); setRefusal(null);
    try {
      const res = await fetch(`/api/calendar/links?journalEntryId=${encodeURIComponent(journalEntryId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setRefusal(data?.error ?? `The link was not removed (HTTP ${res.status}).`); return; }
      await load(false);
    } finally { setBusy(false); }
  };

  // LINES-01: a lined occurrence's actual is the SUM OF ITS LINES' ACTUALS, each
  // line's being the sum of its own links. The hook reads every line's links
  // and never adds the routine grain in — there is no routine-grain target here.
  const instant = row.kind === 'routine' ? parseRoutineTileId(row.id)?.instant ?? null : null;
  const lineLinks = useLineLinks(linkable && row.lines ? row.lines.map((l) => l.stepId) : [], instant);

  // THE ACTUAL, FROM THE LINKS. Zero links → null, which reads NOT LINKED.
  const summed = row.lines && row.lines.length > 0 ? lineLinks.summed : sumLinks(links ?? []);
  const linkedActual = summed.actual;
  const typedActual = row.actual;                       // the object's own column
  const shownActual = linkedActual ?? typedActual;      // links win (STEP 0.4, proposed)
  const shownSource = linkedActual !== null ? 'linked' : row.actualSource;
  const conflict = typedVsLinked(typedActual, linkedActual);
  const varianceUsd = variance(row.planned, shownActual);
  const chain = linkedActual !== null
    ? buildChain({ kind: row.kind, planned: row.planned, actual: linkedActual, actualSource: 'linked', linkLine: linkedSourceLine(summed) })
    : row.chain;

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
    /* LINK-01: z-60, ABOVE the day view's own z-50 modal. The walk found the day
       view intercepting every click inside this panel — readable but inert —
       which did not matter while the panel was read-only and does the moment it
       carries Link and Unlink. The drill opens FROM the day, so it sits on top. */
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" data-drill-layer>
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
            {/* LINES-01: a lined routine has a category PER LINE, listed below —
                one routine-level chip would be a lie about a routine that has three. */}
            {!(row.lines && row.lines.length > 0) && (
              <Row label="Category (COA)" value={row.coaCode ?? NONE} mono testId="coa" />
            )}
          </div>

          {/* THE LINES — LINES-01. Each with its time, activity, amount (or —) and
              account (or "no category"), then the total with its coverage. */}
          {row.lines && row.lines.length > 0 && (
            <div className="mt-4 rounded-lg border border-border p-3" data-drill-lines>
              <p className={labelClass}>Lines</p>
              <ul className="mt-2 divide-y divide-border">
                {row.lines.map((l) => {
                  const own = lineLinks.byStep.get(l.stepId);
                  return (
                    <li key={l.stepId} className="py-1.5 text-xs" data-drill-line={l.stepId} data-drill-line-amount={l.amount === null ? '' : String(l.amount)}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-mono text-text-muted">{l.timeOfDay ?? '—'}</span> {l.activity}
                          <span className="ml-1.5 font-mono text-[10px] text-text-faint" data-drill-line-coa>
                            {l.coaCode ?? 'no category'}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums" data-drill-line-planned>{money(l.amount)}</span>
                        {own && own.summed.actual !== null && (
                          <span className="font-mono tabular-nums text-emerald-700" data-drill-line-actual>{money(own.summed.actual)}</span>
                        )}
                        {linkable && instant && (
                          <button type="button" data-drill-line-link-open={l.stepId} disabled={busy}
                            onClick={() => { void lineLinks.openPicker(l.stepId, row.startDate.slice(0, 10)); }}
                            className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-bg-row">Link</button>
                        )}
                      </div>
                      {own && own.links.length > 0 && (
                        <ul className="mt-1 space-y-0.5 pl-4">
                          {own.links.map((k) => (
                            <li key={k.journalEntryId} className="flex items-center justify-between gap-2 text-[11px]" data-drill-line-linked={k.journalEntryId}>
                              <span className="min-w-0 flex-1 truncate"><span className="font-mono text-text-muted">{k.date ?? '—'}</span> {k.description ?? ''}</span>
                              <span className="font-mono tabular-nums">{k.amountCents === null ? <span className="text-status-danger">no readable amount</span> : money(k.amountCents / 100)}</span>
                              <button type="button" data-drill-line-unlink={k.journalEntryId} disabled={busy}
                                onClick={() => { void lineLinks.unlink(l.stepId, k.journalEntryId); }}
                                className="shrink-0 px-1.5 py-0.5 text-[10px] text-status-danger hover:bg-bg-row">Unlink</button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {lineLinks.picking === l.stepId && (
                        <div className="mt-2 rounded border border-border p-2" data-drill-line-candidates={l.stepId}>
                          <p className="text-[11px] text-text-faint" data-drill-no-suggestion>
                            In date order. Nothing is selected for you and no match is suggested — pick the one that settled this line.
                          </p>
                          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                            {(lineLinks.candidates ?? []).map((c) => (
                              <li key={c.journalEntryId} className="flex items-center justify-between gap-2 text-[11px]" data-drill-line-candidate={c.journalEntryId}>
                                <span className="min-w-0 flex-1 truncate"><span className="font-mono text-text-muted">{c.date}</span> {c.description}</span>
                                <span className="font-mono tabular-nums">{c.amountCents === null ? 'no readable amount' : money(c.amountCents / 100)}</span>
                                <button type="button" data-drill-line-pick={c.journalEntryId} disabled={busy}
                                  onClick={() => { void lineLinks.link(l.stepId, c.journalEntryId); }}
                                  className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-bg-row">Link</button>
                              </li>
                            ))}
                            {lineLinks.candidates !== null && lineLinks.candidates.length === 0 && (
                              <li className="text-[11px] text-text-faint">No unlinked postings within the window.</li>
                            )}
                          </ul>
                          <button type="button" onClick={() => lineLinks.closePicker()} className="mt-1 text-[11px] text-text-faint hover:text-text-muted">Cancel</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 font-mono text-xs" data-drill-lines-total>
                {row.planned === null ? 'no amount on any line' : `${money(row.planned)} across ${row.lineCoverage?.counted ?? 0} of ${row.lineCoverage?.of ?? row.lines.length} lines`}
              </p>
              {row.ignoredRoutineLevel != null && (
                <p className="mt-1 text-[11px] text-amber-800" data-drill-routine-level-ignored>
                  The routine-level {money(row.ignoredRoutineLevel)} is set aside: this occurrence&rsquo;s figure is the sum of its lines.
                </p>
              )}
              {lineLinks.refusal && <p className="mt-2 text-xs text-status-danger" data-drill-refusal>{lineLinks.refusal}</p>}
            </div>
          )}

          {/* THE FIGURES. Each is blank when nothing knows it — never $0. */}
          <div className="mt-4 rounded-lg border border-border p-3">
            <Row label="Planned" value={money(row.planned)} mono testId="planned" />
            <Row label="Actual" value={money(shownActual)} mono testId="actual" />
            <Row label="Variance" value={money(varianceUsd)} mono testId="variance" />
            {shownActual !== null && shownSource && (
              <p className="pt-2 text-xs text-text-muted" data-drill-actual-source>
                That actual is <span className="font-mono">{ACTUAL_SOURCE_LABEL[shownSource]}</span>
                {linkedActual !== null && <> — {linkedSourceLine(summed)}</>}.
              </p>
            )}
            {/* STEP 0.4: the typed figure and the links disagree. Both are shown,
                the rule is named, and NOTHING is overwritten. */}
            {conflict && (
              <p className="mt-2 rounded border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-800" data-drill-conflict>
                This task also carries a typed actual of <span className="font-mono">{money(typedActual)}</span>, which
                does not match its links. {FREE_TEXT_RULE}
              </p>
            )}
          </div>

          {/* THE LINKED POSTINGS — each with its date and amount, each removable. */}
          {links && links.length > 0 && (
            <div className="mt-4 rounded-lg border border-border p-3" data-drill-links>
              <p className={labelClass}>Linked postings in Books</p>
              <ul className="mt-2 space-y-1">
                {links.map((l) => (
                  <li key={l.journalEntryId} className="flex items-center justify-between gap-2 text-xs" data-drill-link={l.journalEntryId}>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-text-muted">{l.date ?? '—'}</span> {l.description ?? ''}
                    </span>
                    <span className="font-mono tabular-nums">
                      {l.amountCents === null
                        ? <span className="text-status-danger" data-drill-link-unreadable>no readable amount</span>
                        : money(l.amountCents / 100)}
                    </span>
                    <button type="button" data-drill-unlink={l.journalEntryId} disabled={busy}
                      onClick={() => unlink(l.journalEntryId)}
                      className="shrink-0 px-1.5 py-0.5 text-[10px] text-status-danger hover:bg-bg-row">Unlink</button>
                  </li>
                ))}
              </ul>
              {summed.unreadable.length > 0 && (
                <p className="mt-2 text-xs text-status-danger" data-drill-unreadable-note>
                  {summed.unreadable.length} linked posting{summed.unreadable.length === 1 ? '' : 's'} carr
                  {summed.unreadable.length === 1 ? 'ies' : 'y'} no readable amount and {summed.unreadable.length === 1 ? 'is' : 'are'} NOT
                  in the total above. They are named here rather than counted as zero.
                </p>
              )}
            </div>
          )}

          {/* THE CHAIN — one of three states, or nothing at all when there are no figures. */}
          {chain ? (
            <div className={`mt-4 rounded-lg border p-3 ${STATE_CLASS[chain.state] ?? 'border-border'}`}>
              <p className="font-mono text-[11px] uppercase tracking-wider" data-drill-chain-state={chain.state}>
                {chain.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed" data-drill-chain-line>{chain.line}</p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-text-faint" data-drill-no-chain>
              This row carries no amount, so there is no chain to show.
            </p>
          )}

          {/* THE LINK. Offered on a linkable item; nothing is pre-selected and no
              candidate is ranked or scored — the list is a convenience, not a guess. */}
          {linkable && target && (
            <div className="mt-4">
              {!picking ? (
                <button type="button" data-drill-link-open disabled={busy}
                  onClick={() => { setPicking(true); void load(true); }}
                  className="rounded border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-row">
                  Link a posting from Books
                </button>
              ) : (
                <div className="rounded-lg border border-border p-3" data-drill-candidates>
                  <p className={labelClass}>Your postings near this date</p>
                  <p className="mt-1 text-[11px] text-text-faint" data-drill-no-suggestion>
                    In date order. Nothing is selected for you and no match is suggested — pick the one that settled this.
                  </p>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {(candidates ?? []).map((c) => (
                      <li key={c.journalEntryId} className="flex items-center justify-between gap-2 text-xs" data-drill-candidate={c.journalEntryId}>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-mono text-text-muted">{c.date}</span> {c.description}
                        </span>
                        <span className="font-mono tabular-nums">
                          {c.amountCents === null ? <span className="text-status-danger">no readable amount</span> : money(c.amountCents / 100)}
                        </span>
                        <button type="button" data-drill-pick={c.journalEntryId} disabled={busy}
                          onClick={() => linkPosting(c.journalEntryId)}
                          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-bg-row">Link</button>
                      </li>
                    ))}
                    {candidates !== null && candidates.length === 0 && (
                      <li className="text-xs text-text-faint" data-drill-no-candidates>
                        No unlinked postings within the window. A posting already linked to another item is not offered.
                      </li>
                    )}
                  </ul>
                  <button type="button" onClick={() => setPicking(false)}
                    className="mt-2 text-[11px] text-text-faint hover:text-text-muted">Cancel</button>
                </div>
              )}
              {refusal && <p className="mt-2 text-xs text-status-danger" data-drill-refusal>{refusal}</p>}
            </div>
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
