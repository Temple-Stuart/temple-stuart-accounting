'use client';

// ─── TripTimeline (Travel-PR-5) ──────────────────────────────────────────────
// The trip Itinerary rendered as consecutive · DAY time-block sections — the
// Operations day-timeline pattern (DayCalendar.tsx), applied to trip_itinerary.
// READ-ONLY view over existing data: no writes here except calling the SAME
// uncommit handler the agenda popover uses (handleUncommitItem). No schema, no
// transform — it reads the raw trip.itinerary rows directly so it can honor the
// new fields (recurrence / block_start_time / cost / vendor_name).
//
// Visual pattern reused VERBATIM from DayCalendar.tsx:
//   • section header "· … ▾ hide / ▸ show" — DayCalendar.tsx:257-273
//   • ROW_GRID + per-source FILL block rows — DayCalendar.tsx:45-48,196-225
//   • "no time set" unscheduled lane — DayCalendar.tsx:352-360
//   • fmtMinute/clock helpers — DayCalendar.tsx:56-63
// Ordering uses the SHARED helpers (exported): minuteOfDayFromTime +
// compareDayOrder from '@/lib/content/dayOrder' (the same the day feed uses).
//
// Daily items appear on EVERY covered day with an AMORTIZED per-day figure that
// is always labeled as derived ("$51/night · part of $1,427.10 total"). The
// STORED cost is the single real amount — never divided into the DB. Day subtotal
// is "est. day spend" (derived: once-costs + amortized shares); trip total is the
// SUM of stored costs (the real number).

import { useState } from 'react';
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
  itinerary: TripItineraryRow[];
  /** Trip startDate/endDate (ISO) — the day range. Falls back to the min/max
   *  itinerary date when absent (both are available on the trip page). */
  startDate: string | null;
  endDate: string | null;
  /** The SAME uncommit handler the agenda popover wires to (handleUncommitItem,
   *  page.tsx:381) — self-confirms + reloads. */
  onUncommit?: (vendorOptionId: string, vendorOptionType: string) => void;
}

// ── House classes lifted from DayCalendar.tsx (cited above) ──────────────────
const sectionHeader = 'font-mono text-sm font-medium tracking-wide text-brand-purple';
const TRAVEL_FILL = 'bg-cyan-500 text-white'; // trip cyan (CalendarGrid trip events)
const ROW_GRID =
  'grid items-start gap-x-3 px-2 py-1.5 rounded ' +
  'grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] ' +
  'lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,0.6fr)_5.5rem]';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateOnly = (iso: string): string => iso.slice(0, 10);
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
  // Guard against a pathological range; trips are finite.
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}
function fmtDayHeader(ymdStr: string): string {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]} · ${MON[m - 1]} ${d}`;
}
// Inclusive covered-day count for a daily row.
function coveredDays(homeIso: string, destIso: string): number {
  const a = new Date(dateOnly(homeIso) + 'T00:00:00');
  const b = new Date(dateOnly(destIso) + 'T00:00:00');
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

// One block as rendered on a given day.
interface DayBlock {
  row: TripItineraryRow;
  minute: number | null;
  timeText: string;
  name: string;
  // Amortization label when daily; null for once items (their cost is the day cost).
  amortLabel: string | null;
  // The amount this block contributes to the day's est. spend (share for daily,
  // full cost for once).
  daySpendShare: number;
}

function buildBlock(row: TripItineraryRow, isDaily: boolean): DayBlock {
  const total = Number(row.cost);
  const minute = minuteOfDayFromTime(row.block_start_time ?? null);
  const start = clockFromTimeIso(row.block_start_time);
  const end = clockFromTimeIso(row.block_end_time);
  const timeText = start ? `${start}${end ? `–${end}` : ''}` : '';
  const name = row.vendor_name || row.vendor;
  if (isDaily) {
    const days = coveredDays(row.homeDate, row.destDate);
    const share = total / days;
    const unit = row.vendorOptionType === 'lodging' ? 'night' : 'day';
    // Derivation ALWAYS visible — never a bare per-day number.
    const amortLabel = `$${Math.round(share)}/${unit} · part of ${money(total)} total`;
    return { row, minute, timeText, name, amortLabel, daySpendShare: share };
  }
  return { row, minute, timeText, name, amortLabel: null, daySpendShare: total };
}

export default function TripTimeline({ itinerary, startDate, endDate, onUncommit }: Props) {
  // Collapsed DAY sections (the one sanctioned collapse — ▾ hide). Default: open.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleDay = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Day range: trip start→end, else the itinerary's own min/max homeDate/destDate.
  const itinDates = itinerary.flatMap((r) => [dateOnly(r.homeDate), dateOnly(r.destDate)]).filter(Boolean);
  const rangeStart = startDate ? dateOnly(startDate) : itinDates.length ? itinDates.slice().sort()[0] : null;
  const rangeEnd = endDate ? dateOnly(endDate) : itinDates.length ? itinDates.slice().sort().at(-1)! : null;

  // Trip total = SUM of STORED costs (the real number — each row counted once).
  const tripTotal = itinerary.reduce((s, r) => s + Number(r.cost), 0);

  if (!rangeStart || !rangeEnd) {
    return <p className="text-sm font-mono text-text-muted">No itinerary dates yet.</p>;
  }

  const days = enumerateDays(rangeStart, rangeEnd);

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

      <div className="space-y-2">
        {days.map((dayKey) => {
          // Membership: daily rows where home ≤ day ≤ dest; once rows on their date.
          const onDay = itinerary.filter((r) => {
            const isDaily = r.recurrence === 'daily';
            if (isDaily) return dateOnly(r.homeDate) <= dayKey && dayKey <= dateOnly(r.destDate);
            return dateOnly(r.homeDate) === dayKey;
          });
          const blocks = onDay.map((r) => buildBlock(r, r.recurrence === 'daily'));
          const timed = blocks
            .filter((b) => b.minute != null)
            .sort((a, b) => compareDayOrder({ minute: a.minute, order: a.minute ?? 0 }, { minute: b.minute, order: b.minute ?? 0 }));
          const untimed = blocks.filter((b) => b.minute == null);
          // est. day spend = once-costs + amortized daily shares on this day (derived).
          const daySpend = blocks.reduce((s, b) => s + b.daySpendShare, 0);
          const isCollapsed = collapsed.has(dayKey);
          const empty = blocks.length === 0;

          return (
            <section key={dayKey} className="border border-border-light rounded">
              {/* · DAY header with ▾ hide — DayCalendar.tsx:257-273 pattern. */}
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-bg-row rounded-t">
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
                  {timed.map((b) => renderBlock(b, onUncommit))}
                  {untimed.length > 0 && (
                    <>
                      <li className="pt-2 mt-1 border-t border-border-light">
                        <span className="font-mono text-[11px] font-medium text-brand-purple uppercase tracking-wide">
                          no time set
                        </span>
                        <span className="ml-2 font-normal text-text-muted">· {untimed.length}</span>
                      </li>
                      {untimed.map((b) => renderBlock(b, onUncommit))}
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

// ONE shared block row (DayCalendar.tsx:196-225 grid + fill). Travel cyan fill.
function renderBlock(b: DayBlock, onUncommit?: Props['onUncommit']) {
  const { row } = b;
  return (
    <li key={`${row.id}-${b.minute ?? 'u'}`} className={`${ROW_GRID} ${TRAVEL_FILL}`}>
      <span className="text-white font-medium tabular-nums whitespace-nowrap">{b.timeText || '—'}</span>
      <span className="text-white font-medium break-words" title={b.name}>
        {b.name}
        {b.amortLabel && (
          <span className="block text-[11px] font-normal text-white/85">{b.amortLabel}</span>
        )}
      </span>
      <span className="hidden lg:block text-white/85 break-words" title={row.coa_code ?? ''}>
        {row.coa_code ?? ''}
      </span>
      <span className="justify-self-start">
        {row.vendorOptionId && onUncommit && (
          <button
            type="button"
            onClick={() => onUncommit(row.vendorOptionId as string, row.vendorOptionType || 'activity')}
            className="px-2 py-0.5 rounded border border-transparent bg-white text-cyan-700 text-[11px] font-mono hover:bg-cyan-50 whitespace-nowrap"
          >
            uncommit
          </button>
        )}
      </span>
    </li>
  );
}
