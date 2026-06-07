'use client';

// ─── TripTimeline (Travel-PR-5/6) ────────────────────────────────────────────
// The trip Itinerary rendered as consecutive · DAY time-block sections — the
// Operations day-timeline pattern (DayCalendar.tsx), applied to trip_itinerary.
// READ view + inline TIME edits only (existing columns: block_start_time/end via
// PATCH /api/trips/[id]/itinerary/[itineraryId]). No schema, no transform — it
// reads the raw trip.itinerary rows directly to honor recurrence / block times /
// cost / vendor_name.
//
// Visual pattern reused VERBATIM from DayCalendar.tsx:
//   • section header "· … ▾ hide / ▸ show" — DayCalendar.tsx:257-273
//   • ROW_GRID + per-source FILL block rows — DayCalendar.tsx:47-50,196-225
//   • "no time set" lane — DayCalendar.tsx:352-360
// Inline time editor mirrors the Operations inline-commit pattern
// (TaskTimeCommit.tsx: two <input type=time> + save/cancel, no modal).
// Ordering uses the SHARED exported helpers: minuteOfDayFromTime + compareDayOrder.
//
// PR 6 adds: inline click-to-edit time cell, a month filter (chips), and a fixed-
// height scroll viewport with sticky day headers. The header TRIP TOTAL is the
// whole-trip real committed figure (never month-filtered); "month est." is a
// separate DERIVED subtotal beside the filter.

import { useMemo, useState } from 'react';
import { minuteOfDayFromTime, compareDayOrder } from '@/lib/content/dayOrder';

// Raw trip_itinerary row (Prisma → JSON: Decimal→string, DateTime/@db.Time→ISO).
export interface TripItineraryRow {
  id: string;
  day: number;
  homeDate: string;
  destDate: string;
  category: string;
  vendor: string;
  vendor_name?: string | null;
  cost: number | string;
  recurrence?: string | null;
  block_start_time?: string | null;
  block_end_time?: string | null;
  coa_code?: string | null;
  location?: string | null;
  vendorOptionId?: string | null;
  vendorOptionType?: string | null;
  note?: string | null;
}

interface Props {
  tripId: string;
  itinerary: TripItineraryRow[];
  /** Trip startDate/endDate (ISO) — the day range. Falls back to the min/max
   *  itinerary date when absent. */
  startDate: string | null;
  endDate: string | null;
  /** The SAME uncommit handler the agenda popover wired to (page.tsx
   *  handleUncommitItem) — self-confirms + reloads. */
  onUncommit?: (vendorOptionId: string, vendorOptionType: string) => void;
  /** Refresh after an inline edit — wired to loadTrip (the itinerary reload
   *  handleUncommitItem also calls). */
  onChanged?: () => void;
}

// ── House classes lifted from DayCalendar.tsx (cited above) ──────────────────
const sectionHeader = 'font-mono text-sm font-medium tracking-wide text-brand-purple';
const TRAVEL_FILL = 'bg-cyan-500 text-white'; // trip cyan (CalendarGrid trip events)
const ROW_GRID =
  'grid items-start gap-x-3 px-2 py-1.5 rounded ' +
  'grid-cols-[8.5rem_minmax(0,1fr)_5.5rem] ' +
  'lg:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,0.6fr)_5.5rem]';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateOnly = (iso: string): string => iso.slice(0, 10);
const monthKey = (ymdStr: string): string => ymdStr.slice(0, 7);
// @db.Time ISO ("1970-01-01T22:00:00.000Z") → "22:00" (wall-clock as set).
const clockFromTimeIso = (iso: string | null | undefined): string =>
  iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? '';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function enumerateDays(startYmd: string, endYmd: string): string[] {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const out: string[] = [];
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}
function monthsInRange(startYmd: string, endYmd: string): string[] {
  let y = Number(startYmd.slice(0, 4));
  let m = Number(startYmd.slice(5, 7));
  const ey = Number(endYmd.slice(0, 4));
  const em = Number(endYmd.slice(5, 7));
  const out: string[] = [];
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 60) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
    guard++;
  }
  return out;
}
const fmtMonth = (mk: string): string => `${MON[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`;
function fmtDayHeader(ymdStr: string): string {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]} · ${MON[m - 1]} ${d}`;
}
function coveredDays(homeIso: string, destIso: string): number {
  const a = new Date(dateOnly(homeIso) + 'T00:00:00');
  const b = new Date(dateOnly(destIso) + 'T00:00:00');
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

interface DayBlock {
  row: TripItineraryRow;
  isDaily: boolean;
  minute: number | null;
  startHHMM: string;
  endHHMM: string;
  timeText: string;
  name: string;
  amortLabel: string | null;
  daySpendShare: number;
}

function buildBlock(row: TripItineraryRow): DayBlock {
  const isDaily = row.recurrence === 'daily';
  const total = Number(row.cost);
  const minute = minuteOfDayFromTime(row.block_start_time ?? null);
  const startHHMM = clockFromTimeIso(row.block_start_time);
  const endHHMM = clockFromTimeIso(row.block_end_time);
  const timeText = startHHMM ? `${startHHMM}${endHHMM ? `–${endHHMM}` : ''}` : '';
  const name = row.vendor_name || row.vendor;
  if (isDaily) {
    const days = coveredDays(row.homeDate, row.destDate);
    const share = total / days;
    const unit = row.vendorOptionType === 'lodging' ? 'night' : 'day';
    const amortLabel = `$${Math.round(share)}/${unit} · part of ${money(total)} total`;
    return { row, isDaily, minute, startHHMM, endHHMM, timeText, name, amortLabel, daySpendShare: share };
  }
  return { row, isDaily, minute, startHHMM, endHHMM, timeText, name, amortLabel: null, daySpendShare: total };
}

export default function TripTimeline({ tripId, itinerary, startDate, endDate, onUncommit, onChanged }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleDay = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const itinDates = itinerary.flatMap((r) => [dateOnly(r.homeDate), dateOnly(r.destDate)]).filter(Boolean);
  const rangeStart = startDate ? dateOnly(startDate) : itinDates.length ? itinDates.slice().sort()[0] : null;
  const rangeEnd = endDate ? dateOnly(endDate) : itinDates.length ? itinDates.slice().sort().at(-1)! : null;

  // Trip total = SUM of STORED costs (the real number — each row once). Never
  // month-filtered (the audited figure).
  const tripTotal = itinerary.reduce((s, r) => s + Number(r.cost), 0);

  // Months the trip covers, and the default selection (current month if today is
  // inside the range, else the first month).
  const months = useMemo(
    () => (rangeStart && rangeEnd ? monthsInRange(rangeStart, rangeEnd) : []),
    [rangeStart, rangeEnd]
  );
  const todayMonth = monthKey(ymd(new Date()));
  const defaultMonth = months.includes(todayMonth) ? todayMonth : months[0] ?? '';
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  // Keep selection valid if the data range shifts under us.
  const activeMonth = months.includes(selectedMonth) ? selectedMonth : defaultMonth;

  // Per-day data for the WHOLE range (used by both the month subtotal + render).
  const dayData = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [] as { dayKey: string; blocks: DayBlock[]; daySpend: number }[];
    return enumerateDays(rangeStart, rangeEnd).map((dayKey) => {
      const onDay = itinerary.filter((r) => {
        const isDaily = r.recurrence === 'daily';
        if (isDaily) return dateOnly(r.homeDate) <= dayKey && dayKey <= dateOnly(r.destDate);
        return dateOnly(r.homeDate) === dayKey;
      });
      const blocks = onDay.map(buildBlock);
      const daySpend = blocks.reduce((s, b) => s + b.daySpendShare, 0);
      return { dayKey, blocks, daySpend };
    });
  }, [itinerary, rangeStart, rangeEnd]);

  if (!rangeStart || !rangeEnd) {
    return <p className="text-sm font-mono text-text-muted">No itinerary dates yet.</p>;
  }

  const monthDays = dayData.filter((d) => monthKey(d.dayKey) === activeMonth);
  const monthEst = monthDays.reduce((s, d) => s + d.daySpend, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={sectionHeader}>
          · ITINERARY
          <span className="ml-2 font-normal text-text-muted">day timeline</span>
        </h3>
        <span className="font-mono text-xs text-text-muted">
          trip total <span className="text-text-primary font-semibold tabular-nums">{money(tripTotal)}</span>
          <span className="ml-1 text-text-faint">(real committed)</span>
        </span>
      </div>

      {/* Month filter (VIEW control) + the DERIVED month subtotal. */}
      {months.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">month</span>
            {months.map((mk) => (
              <button
                key={mk}
                type="button"
                onClick={() => setSelectedMonth(mk)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono ${
                  activeMonth === mk ? 'border-brand-purple bg-brand-purple text-white' : 'border-border-light text-text-muted hover:bg-bg-row'
                }`}
              >
                {fmtMonth(mk)}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">
            month est. <span className="text-text-primary tabular-nums">{money(monthEst)}</span>
            <span className="ml-1 text-text-faint">(derived)</span>
          </span>
        </div>
      )}

      {/* Scroll viewport (~7 day sections). DayCalendar renders a SINGLE day with
          no viewport, so there is no Operations precedent for a multi-day height —
          72vh chosen so ~7 day sections are visible while the rest scroll. */}
      <div className="max-h-[72vh] overflow-y-auto rounded border border-border-light divide-y divide-border-light">
        {monthDays.map(({ dayKey, blocks, daySpend }) => {
          const timed = blocks
            .filter((b) => b.minute != null)
            .sort((a, b) => compareDayOrder({ minute: a.minute, order: a.minute ?? 0 }, { minute: b.minute, order: b.minute ?? 0 }));
          const untimed = blocks.filter((b) => b.minute == null);
          const isCollapsed = collapsed.has(dayKey);
          const empty = blocks.length === 0;

          return (
            <section key={dayKey}>
              {/* Sticky · DAY header — DayCalendar.tsx:257-273 pattern. */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-1.5 bg-bg-row border-b border-border-light">
                <button
                  type="button"
                  onClick={() => !empty && toggleDay(dayKey)}
                  className="flex items-center gap-2 text-left min-w-0"
                  aria-expanded={!isCollapsed}
                  disabled={empty}
                >
                  <span className="font-mono text-sm font-medium text-brand-purple">· {fmtDayHeader(dayKey)}</span>
                  {!empty && (
                    <span className="font-mono text-xs text-brand-purple" aria-hidden="true">
                      {isCollapsed ? '▸ show' : '▾ hide'}
                    </span>
                  )}
                </button>
                {!empty && (
                  <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">
                    est. day spend <span className="text-text-primary tabular-nums">{money(daySpend)}</span>
                  </span>
                )}
              </div>

              {empty ? (
                <div className="px-3 py-1.5 font-mono text-[11px] text-text-faint">no blocks</div>
              ) : isCollapsed ? null : (
                <ul className="p-2 space-y-1 font-mono text-xs">
                  {timed.map((b) => (
                    <BlockRow key={`${b.row.id}-t`} block={b} tripId={tripId} dayKey={dayKey} onUncommit={onUncommit} onChanged={onChanged} />
                  ))}
                  {untimed.length > 0 && (
                    <>
                      <li className="pt-2 mt-1 border-t border-border-light">
                        <span className="font-mono text-[11px] font-medium text-brand-purple uppercase tracking-wide">no time set</span>
                        <span className="ml-2 font-normal text-text-muted">· {untimed.length}</span>
                      </li>
                      {untimed.map((b) => (
                        <BlockRow key={`${b.row.id}-u`} block={b} tripId={tripId} dayKey={dayKey} onUncommit={onUncommit} onChanged={onChanged} />
                      ))}
                    </>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ── ONE shared block row (DayCalendar.tsx grid + cyan fill) with an inline,
//    click-to-edit TIME cell (TaskTimeCommit pattern) ─────────────────────────
function BlockRow({
  block,
  tripId,
  dayKey,
  onUncommit,
  onChanged,
}: {
  block: DayBlock;
  tripId: string;
  dayKey: string;
  onUncommit?: Props['onUncommit'];
  onChanged?: Props['onChanged'];
}) {
  const { row } = block;
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(block.startHHMM);
  const [end, setEnd] = useState(block.endHHMM);
  const [dateVal, setDateVal] = useState(dateOnly(row.homeDate)); // ONCE-row date move
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    'px-1 py-0.5 bg-white text-text-primary border border-white/60 rounded text-[11px] focus:outline-none';

  const patch = async (bodyObj: Record<string, unknown>) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || d.error || `Save failed (${res.status})`);
      }
      setEditing(false);
      onChanged?.(); // refresh — same itinerary reload uncommit triggers
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  // Overnight windows are valid — NO end>start check.
  const save = () => {
    const body: Record<string, unknown> = {
      blockStartTime: start || null,
      blockEndTime: end || null,
    };
    if (!block.isDaily && dateVal && dateVal !== dateOnly(row.homeDate)) body.date = dateVal;
    void patch(body);
  };
  const clear = () => void patch({ blockStartTime: null, blockEndTime: null });

  return (
    <li className={`${ROW_GRID} ${TRAVEL_FILL}`}>
      <span className="text-white font-medium tabular-nums">
        {editing ? (
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1">
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} aria-label="Start time" />
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} aria-label="End time" />
            </span>
            {!block.isDaily && (
              <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} className={inputCls} aria-label="Date" />
            )}
            <span className="flex items-center gap-1">
              <button type="button" onClick={save} disabled={saving}
                className="px-1.5 py-0.5 bg-white text-cyan-700 rounded text-[11px] hover:bg-cyan-50 disabled:opacity-50">
                {saving ? '…' : 'save'}
              </button>
              <button type="button" onClick={clear} disabled={saving}
                className="px-1.5 py-0.5 border border-white/60 text-white rounded text-[11px] hover:bg-white/10">
                clear
              </button>
              <button type="button" onClick={() => { setEditing(false); setError(null); }}
                className="px-1.5 py-0.5 text-white/80 text-[11px] hover:text-white">
                ✕
              </button>
            </span>
            {error && <span className="text-[10px] text-red-100 bg-red-600/40 rounded px-1">{error}</span>}
          </span>
        ) : (
          <button type="button" onClick={() => setEditing(true)} title="Edit time"
            className="text-white hover:underline decoration-dotted whitespace-nowrap">
            {block.timeText || '— set time'}
          </button>
        )}
      </span>
      <span className="text-white font-medium break-words" title={block.name}>
        {block.name}
        {block.amortLabel && <span className="block text-[11px] font-normal text-white/85">{block.amortLabel}</span>}
      </span>
      <span className="hidden lg:block text-white/85 break-words" title={row.coa_code ?? ''}>{row.coa_code ?? ''}</span>
      <span className="justify-self-start">
        {row.vendorOptionId && onUncommit && (
          <button type="button"
            onClick={() => onUncommit(row.vendorOptionId as string, row.vendorOptionType || 'activity')}
            className="px-2 py-0.5 rounded border border-transparent bg-white text-cyan-700 text-[11px] font-mono hover:bg-cyan-50 whitespace-nowrap">
            uncommit
          </button>
        )}
      </span>
    </li>
  );
}
