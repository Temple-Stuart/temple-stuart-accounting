'use client';

/**
 * DAY-01 STEP 2/3/4 — THE DAY, WHOLE. Clicking a day on /calendar opens this:
 * every event on that date in time order, with its time, what it should cost,
 * where it is, and its icon; a small map of the day's stored coordinates; and
 * the day's mission and tasks read from daily_plans.
 *
 * READ-ONLY. Nothing here writes. calendar_events belongs to Trips, Budget and
 * Agenda; daily_plans belongs to Tasks (its only writer is
 * src/app/api/ops/daily-plan/route.ts:168). This surface reads both and edits
 * neither.
 *
 * WHAT IT REFUSES TO DO. An event with no budget_amount shows BLANK and is
 * counted out of the day's total — the total always states its coverage, so a
 * number never pretends to be the whole day. An event with no coordinates is
 * LISTED under the map, never dropped. The two totals (events, tasks) are stated
 * separately and never added into one unlabelled figure. Actual cost is not
 * shown at all, because it cannot be joined — see src/lib/calendar/actuals.ts.
 */

import { useEffect, useState } from 'react';
import {
  buildDay, mapSplit, projectPins, readTasks,
  dayParts, partLine, dayTotalLine,
  type DayEventInput, type DayRow, type DayTask,
} from '@/lib/calendar/day';
import { ACTUALS_JOIN_SOUND, ACTUALS_NOT_JOINABLE_LINE } from '@/lib/calendar/actuals';
// EVENT-01: a hand-entered event is marked, and is the only kind editable here.
import { isManualEvent, MANUAL_EVENT_BADGE } from '@/lib/calendar/sources';
import type { EditableEvent } from '@/components/hub/AddEventForm';
import { SECTION_HEADER, STATE, chip } from '@/lib/ds';

export interface DayViewProps {
  /** The day being opened, 'YYYY-MM-DD'. */
  dateKey: string;
  /** Every event already merged onto the grid that falls on this day. */
  events: readonly DayEventInput[];
  /** The legend icon per source, so a row wears the layer it came from. */
  sourceIcon?: Record<string, string>;
  /**
   * EVENT-01 STEP 5: correct a hand-entered event. Absent means the day view is
   * read-only, which is what every other mount wants.
   */
  onCorrect?: (event: EditableEvent) => void;
  /** Called after a hand-entered event is deleted, so the calendar reloads. */
  onDeleted?: () => void;
  /**
   * DRILL-01: open the drill panel for this row. Every row on the day is
   * clickable — a row that did nothing was a promise the day view did not keep.
   * Absent means the day view is a plain read (the leaf's own tests mount it so).
   */
  onRowOpen?: (id: string) => void;
  onClose: () => void;
}

interface PlanResponse {
  plan: { mission: string | null; missionCompleted: boolean; tasks: unknown } | null;
  dayNumber?: number;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function clock(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function longDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * The day's map. NO PROVIDER, NO TILES, NO GEOCODING (FORBIDDEN) — an SVG plot
 * of the coordinates already stored on the events, joined in route order, which
 * is time order. It shows shape and sequence, and it says so rather than
 * pretending to be a street map.
 */
function DayMap({ pinned }: { pinned: readonly DayRow[] }) {
  const pins = pinned.map((r) => r.pin!).filter(Boolean);
  const pts = projectPins(pins);
  const W = 320, H = 160, PAD = 18;
  const at = (i: number) => ({ x: PAD + pts[i].x * (W - PAD * 2), y: PAD + pts[i].y * (H - PAD * 2) });
  const path = pts.map((_, i) => { const p = at(i); return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]" role="img" aria-label={`${pinned.length} located stop${pinned.length === 1 ? '' : 's'}, in time order`} data-day-map>
      <rect x="0" y="0" width={W} height={H} className="fill-bg-row" />
      {pts.length > 1 && <path d={path} className="stroke-brand-purple/50" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />}
      {pts.map((_, i) => {
        const p = at(i);
        return (
          <g key={pinned[i].id}>
            <circle cx={p.x} cy={p.y} r="6" className="fill-brand-purple" />
            <text x={p.x} y={p.y + 3} textAnchor="middle" className="fill-white text-[8px] font-mono">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DayView({ dateKey, events, sourceIcon = {}, onCorrect, onDeleted, onRowOpen, onClose }: DayViewProps) {
  const rows = buildDay(events, dateKey);
  const { pinned, unplaced } = mapSplit(rows);

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  // EVENT-01: the route's refusal, shown with its reason — a trip or budget row
  // is its owner path's record and says so rather than failing silently.
  const [deleteRefusal, setDeleteRefusal] = useState<string | null>(null);

  const byId = new Map(events.map((e) => [e.id, e]));

  const removeEvent = async (id: string) => {
    setDeleteRefusal(null);
    const res = await fetch(`/api/calendar/events?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setDeleteRefusal(data?.error ?? `The event was not deleted (HTTP ${res.status}).`); return; }
    onDeleted?.();
  };

  useEffect(() => {
    let live = true;
    setPlan(null);
    setPlanError(null);
    // A READ. Tasks owns the write; this surface never POSTs here.
    fetch(`/api/ops/daily-plan?date=${dateKey}`)
      .then(async (res) => {
        if (!live) return;
        if (!res.ok) { setPlanError(`The day's plan could not be read (HTTP ${res.status}).`); return; }
        setPlan(await res.json());
      })
      .catch((err) => { if (live) setPlanError(err instanceof Error ? err.message : "The day's plan could not be read."); });
    return () => { live = false; };
  }, [dateKey]);

  const tasks: DayTask[] = readTasks(plan?.plan?.tasks);
  // ROUTINE-01: the day's total, split into the parts it is actually made of.
  // ONE summation: dayParts sums each part once and adds the parts for the
  // grand total, so the sum and its parts cannot disagree.
  const totals = dayParts(rows, tasks);

  const pinIndex = new Map(pinned.map((r, i) => [r.id, i + 1]));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`The day — ${longDate(dateKey)}`}>
      <div className="w-full max-w-3xl rounded-lg border border-border bg-white shadow-lg" data-day-view>
        <div className={SECTION_HEADER}>
          <span data-day-title>{longDate(dateKey)}</span>
          <button type="button" onClick={onClose} className="rounded bg-bg-row px-2 py-0.5 text-[11px] text-text-muted hover:bg-border" aria-label="Close the day">Close</button>
        </div>

        {/* ── THE EVENTS ── */}
        <div className="px-4 py-3">
          {deleteRefusal && (
            <div className={`${STATE.errorCard} mb-2`} role="alert" data-delete-event-refusal>{deleteRefusal}</div>
          )}
          {rows.length === 0 ? (
            <div className={STATE.empty} data-day-empty>Nothing on this day.</div>
          ) : (
            <table className="w-full text-xs" data-day-events>
              <thead className="bg-bg-row">
                <tr>
                  {['', 'Time', 'What', 'Expected', 'Where', ''].map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-wider text-text-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => {
                  const first = r.untimed && i === 0;
                  const firstTimed = !r.untimed && (i === 0 || rows[i - 1].untimed);
                  return (
                    <>
                      {(first || firstTimed) && (
                        <tr key={`${r.id}-group`} className="bg-bg-row/60">
                          <td colSpan={6} className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-text-faint" data-day-group>
                            {first ? 'no time set' : 'the day'}
                          </td>
                        </tr>
                      )}
                      <tr
                        key={r.id}
                        data-day-row
                        data-source={r.source}
                        /* DRILL-01: the whole row opens the drill. The two action
                           buttons stop the event, so Correct and Delete still do
                           their own job. Keyboard reaches it the same way. */
                        {...(onRowOpen ? {
                          onClick: () => onRowOpen(r.id),
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowOpen(r.id); }
                          },
                          tabIndex: 0,
                          role: 'button',
                          'aria-label': `Open ${r.title}`,
                          'data-day-row-opens': '',
                          className: 'cursor-pointer hover:bg-bg-row',
                        } : {})}
                      >
                        <td className="px-2 py-1.5">{r.icon ?? sourceIcon[r.source] ?? ''}</td>
                        <td className="px-2 py-1.5 font-mono text-text-muted whitespace-nowrap" data-day-time>
                          {r.startTime
                            ? `${clock(r.startTime)}${r.endTime ? ` – ${clock(r.endTime)}` : ''}`
                            : r.span === 'ends'
                              ? <span data-day-span>until {clock(r.endTime) || 'today'}</span>
                              : r.span === 'continues'
                                ? <span className="text-text-faint" data-day-span>all day (continues)</span>
                                : <span className="text-text-faint">—</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{r.title}</span>
                          <span className={`${chip('accent')} ml-1.5`}>{r.source}</span>
                          {/* EVENT-01 STEP 5: marked the way TRADE-LOG-01 marks a
                              hand-entered trade. Display only — a hand-entered
                              event counts, totals and pins like any other. */}
                          {isManualEvent(r.source) && (
                            <span className={`${chip('neutral')} ml-1`} data-hand-entered>{MANUAL_EVENT_BADGE}</span>
                          )}
                        </td>
                        {/* NULL renders BLANK. A zero here would be a number the app does not have. */}
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums" data-day-expected>
                          {r.expected === null ? <span className="text-text-faint" data-no-amount>—</span> : money(r.expected)}
                        </td>
                        <td className="px-2 py-1.5 text-text-muted">
                          {r.location ?? <span className="text-text-faint">—</span>}
                          {pinIndex.has(r.id) && <span className="ml-1 font-mono text-[9px] text-brand-purple">📍{pinIndex.get(r.id)}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {/* ONLY a hand-entered event is the person's to change here.
                              A trip or budget row belongs to the path that wrote it. */}
                          {isManualEvent(r.source) && (
                            <>
                              {onCorrect && (
                                <button type="button" data-correct-event
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    const e = byId.get(r.id);
                                    setDeleteRefusal(null);
                                    onCorrect({
                                      id: r.id,
                                      title: r.title,
                                      date: (e?.startDate ?? dateKey).slice(0, 10),
                                      startTime: r.startTime,
                                      endTime: r.endTime,
                                      category: e?.category ?? '',
                                      cost: r.expected,
                                      location: r.location,
                                      coaCode: r.coaCode,
                                      latitude: r.pin?.lat ?? null,
                                      longitude: r.pin?.lon ?? null,
                                    });
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] bg-bg-row text-text-muted hover:bg-border">Correct</button>
                              )}
                              <button type="button" data-delete-event onClick={(ev) => { ev.stopPropagation(); removeEvent(r.id); }}
                                className="ml-1 px-1.5 py-0.5 text-[10px] bg-bg-row text-status-danger hover:bg-border">Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                {/* ROUTINE-01: every part is NAMED, each with the coverage that
                    earned it, and the day's sum says which parts it added. A
                    part with nothing in it is omitted, never shown as $0. */}
                {totals.parts.map((part) => (
                  <tr key={part.key} className="border-t border-border">
                    <td colSpan={3} className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-faint">{part.label}</td>
                    <td colSpan={3} className="px-2 py-1.5 text-right font-mono text-xs" data-day-total-part={part.key}>
                      {/* A total NEVER ships without its coverage — a build law. */}
                      {partLine(part)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-text-faint">The day</td>
                  <td colSpan={3} className="px-2 py-2 text-right font-mono text-xs font-semibold" data-day-total>
                    {dayTotalLine(totals)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── THE MAP ── */}
        {rows.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-faint">Where the day goes</div>
            {pinned.length > 0 ? (
              <>
                <DayMap pinned={pinned} />
                <div className="mt-1 font-mono text-[10px] text-text-faint">
                  {pinned.length} located stop{pinned.length === 1 ? '' : 's'}, numbered in time order. Plotted from the coordinates stored on the events — not a street map, and nothing is looked up.
                </div>
              </>
            ) : (
              <div className="font-mono text-[10px] text-text-faint" data-day-no-pins>No event on this day has coordinates stored.</div>
            )}
            {unplaced.length > 0 && (
              <div className="mt-2" data-day-unplaced>
                <div className="font-mono text-[10px] uppercase tracking-wider text-text-faint">No location set</div>
                <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                  {unplaced.map((r) => <li key={r.id}>{r.icon ?? ''} {r.title}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── THE PLAN AND ITS TASKS ── */}
        <div className="border-t border-border px-4 py-3" data-day-plan>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-faint">The day&rsquo;s plan</div>
          {planError ? (
            <div className={STATE.errorCard} role="alert" data-day-plan-error>{planError}</div>
          ) : plan === null ? (
            <div className="font-mono text-[10px] text-text-faint">Reading&hellip;</div>
          ) : plan.plan === null ? (
            <div className="font-mono text-[10px] text-text-faint" data-day-no-plan>No plan was written for this day.</div>
          ) : (
            <>
              <div className="text-sm" data-day-mission>
                {plan.plan.mission
                  ? <><span className={chip(plan.plan.missionCompleted ? 'success' : 'neutral')}>{plan.plan.missionCompleted ? 'done' : 'mission'}</span> <span className="ml-1.5">{plan.plan.mission}</span></>
                  : <span className="font-mono text-[10px] text-text-faint">No mission set.</span>}
              </div>
              {tasks.length > 0 ? (
                <>
                  <ul className="mt-2 space-y-1 text-xs" data-day-tasks>
                    {tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2" data-day-task>
                        <span className={t.completed ? 'text-status-success' : 'text-text-faint'}>{t.completed ? '☑' : '☐'}</span>
                        <span className={t.completed ? 'text-text-muted line-through' : ''}>{t.text}</span>
                        {t.cost !== null && <span className="ml-auto font-mono tabular-nums">{money(t.cost)}</span>}
                      </li>
                    ))}
                  </ul>
                  {/* ROUTINE-01: the tasks' figure is one of the day's NAMED
                      parts now, summed once in dayParts and shown in the footer
                      above beside Events and Routines. Repeating it here would
                      be a second summation, so this states where it is. */}
                  <div className="mt-2 font-mono text-[11px] text-text-muted" data-day-task-total>
                    {(() => {
                      const part = totals.parts.find((p) => p.key === 'tasks');
                      return part ? partLine(part) : 'Tasks: no task on this day carries a cost';
                    })()}
                  </div>
                </>
              ) : (
                <div className="mt-2 font-mono text-[10px] text-text-faint" data-day-no-tasks>No tasks on this day.</div>
              )}
            </>
          )}
        </div>

        {/* ── WHAT IT ACTUALLY COST ── */}
        <div className="border-t border-border px-4 py-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-faint">What it actually cost</div>
          {ACTUALS_JOIN_SOUND ? null : (
            <p className="text-[11px] leading-relaxed text-text-muted" data-day-actuals-finding>{ACTUALS_NOT_JOINABLE_LINE}</p>
          )}
        </div>
      </div>
    </div>
  );
}
