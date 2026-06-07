/**
 * DayCalendar — the day's blocks as a dense, ONE-LINE stacked list in clock order
 * (NOT an hour-grid). Pure presentation over the shared useDayFeed(date) feed; rows
 * are already DAY_START-ordered by the hook's compareDayOrder. Collapsed by default.
 *
 * One shared CSS grid for every row (scene AND task) so columns align vertically —
 * house style adopted from hub/UnscheduledTaskTable.tsx:171,183 (grid-cols-[…] +
 * items-center + text-xs font-mono, dominant fr for the reading column). Columns:
 *   [ time | name | project | entity | status ]
 * Source is shown by the LEFT EDGE (amber = task, purple = scene) — the redundant
 * marker-text column is dropped for density (the edge is the echo). Name is the
 * dominant track and WRAPS — no truncation; readability beats uniform row height.
 *
 *   • GAPS — between two consecutive timed rows with BOTH bounds known, a muted
 *     divider names the open span (≥15m). No end → no gap claim (never guess).
 *   • COLLISIONS — timed rows whose [start,end) overlap get the red warning tint
 *     (both rows). No end → can't collide, skipped honestly.
 *   • UNSCHEDULED LANE — a real sub-header ("unscheduled — no time set" + count).
 *   • NAV — ‹ prev · today · next › drive the SHARED date (via onDateChange), the
 *     same setter behind section 3 (nav button treatment echoes ItineraryAgenda).
 *
 * No useDayFeed change, no new fetch, no hour-grid, no fallback for missing times.
 */

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import { useDayFeed, type TimelineRow } from './useDayFeed';
import { dayAnchoredMinute, minuteOfDayFromInstant, minuteOfDayFromTime } from '@/lib/content/dayOrder';

const sectionHeader = 'font-mono text-sm font-medium tracking-wide text-brand-purple';

// House calendar block colors — adopted from the shared CalendarGrid's filled blocks
// (CalendarGrid.tsx:516 renders `${calendarColor} text-white`), with the per-source
// tokens defined at hub/page.tsx:69-70: routines → bg-teal-400, operations → bg-indigo-400.
// Scene/routine rows take the teal (aqua) fill; task rows take the indigo (purple) fill.
const SCENE_FILL = 'bg-teal-400 text-white';
const TASK_FILL = 'bg-indigo-400 text-white';
// Travel rows take the house trip cyan (CalendarGrid trip events render cyan).
const TRAVEL_FILL = 'bg-cyan-500 text-white';

// Shared row grid: columns aligned across scene + task rows. Mobile shows
// [time|name|status]; lg+ adds [project|entity]. Name is the dominant flexible track.
// items-start so wrapped (non-truncated) rows read top-aligned. No border/edge — the
// fill carries the source; rounded block per the house calendar.
const ROW_GRID =
  'grid items-start gap-x-3 px-2 py-1.5 rounded ' +
  'grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] ' +
  'lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,0.6fr)_5rem_5.5rem]';

const chipBase = 'px-2 py-0.5 rounded border text-[11px] font-mono';
const chipOn = 'border-brand-purple bg-brand-purple text-white';
const chipOff = 'border-border-light text-text-muted hover:bg-bg-row';
const navBtn =
  'w-7 h-7 flex items-center justify-center rounded text-text-muted hover:bg-bg-row';

const fmtMinute = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const fmtClock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
};

// @db.Time ISO ("1970-01-01T22:00:00.000Z") → "22:00" (the wall-clock as set).
const clockFromTimeIso = (iso: string | null): string =>
  iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? '';

const rowEntityId = (row: TimelineRow): string =>
  row.kind === 'scene' ? row.scene.entity_id
  : row.kind === 'travel' ? row.travel.entity_id
  : row.block.entity_id;
const rowKey = (row: TimelineRow): string =>
  row.kind === 'scene' ? `scene-${row.scene.id}`
  : row.kind === 'travel' ? `travel-${row.travel.id}`
  : `task-${row.block.id}`;

// Compact time text + actual flag. Tasks show "act" instead of the verbose "(actual)".
function deriveTime(row: TimelineRow): { timeText: string; isActual: boolean } {
  if (row.kind === 'scene') {
    if (row.minute == null) return { timeText: '', isActual: false };
    const dur = row.scene.routine_step.duration_minutes;
    const start = fmtMinute(row.minute);
    return { timeText: dur != null ? `${start}–${fmtMinute(row.minute + dur)}` : start, isActual: false };
  }
  if (row.kind === 'travel') {
    if (row.minute == null) return { timeText: '', isActual: false }; // untimed (NULL block_start_time)
    const start = clockFromTimeIso(row.travel.blockStartTime) || fmtMinute(row.minute);
    const end = clockFromTimeIso(row.travel.blockEndTime);
    return { timeText: `${start}${end ? `–${end}` : ''}`, isActual: false };
  }
  const b = row.block;
  if (row.minute == null) return { timeText: '', isActual: false }; // planned / untimed
  const useActual = !!b.actualStart;
  const startIso = useActual ? b.actualStart : b.scheduledStart;
  const endIso = useActual ? b.actualEnd : b.scheduledEnd;
  const start = startIso ? fmtClock(startIso) : fmtMinute(row.minute);
  return { timeText: `${start}–${endIso ? fmtClock(endIso) : '…'}`, isActual: useActual };
}

// Day-anchored [start, end) for a TIMED row; end null when unknown (never guessed).
function bounds(row: TimelineRow): { startA: number; endA: number | null } {
  const startA = dayAnchoredMinute(row.minute as number);
  if (row.kind === 'scene') {
    const dur = row.scene.routine_step.duration_minutes;
    return { startA, endA: dur != null ? startA + dur : null };
  }
  if (row.kind === 'travel') {
    // End from block_end_time; an overnight window (e.g. 22:00→07:00) wraps past
    // midnight, so add a day when the anchored end precedes the start.
    const endMin = minuteOfDayFromTime(row.travel.blockEndTime);
    if (endMin == null) return { startA, endA: null };
    let endA = dayAnchoredMinute(endMin);
    if (endA < startA) endA += 1440;
    return { startA, endA };
  }
  const b = row.block;
  const endIso = b.actualStart ? b.actualEnd : b.scheduledEnd;
  if (!endIso) return { startA, endA: null };
  let endA = dayAnchoredMinute(minuteOfDayFromInstant(endIso));
  if (endA < startA) endA += 1440;
  return { startA, endA };
}

export default function DayCalendar({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { timeline, loading, error } = useDayFeed(date);
  const { entities } = useOperationsEntity();

  const entityNameById = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities]
  );

  // Filters — empty set = no filter (all). OR within group, AND across groups.
  const [activeEntities, setActiveEntities] = useState<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<Set<'scene' | 'task' | 'travel'>>(new Set());

  const presentEntityIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of timeline) s.add(rowEntityId(r));
    return [...s].sort((a, b) =>
      (entityNameById.get(a) ?? a).localeCompare(entityNameById.get(b) ?? b)
    );
  }, [timeline, entityNameById]);
  const hasScenes = useMemo(() => timeline.some((r) => r.kind === 'scene'), [timeline]);
  const hasTasks = useMemo(() => timeline.some((r) => r.kind === 'task'), [timeline]);
  const hasTravel = useMemo(() => timeline.some((r) => r.kind === 'travel'), [timeline]);

  const visible = useMemo(() => {
    const eOn = activeEntities.size > 0;
    const sOn = activeSources.size > 0;
    return timeline.filter(
      (r) =>
        (!eOn || activeEntities.has(rowEntityId(r))) &&
        (!sOn || activeSources.has(r.kind))
    );
  }, [timeline, activeEntities, activeSources]);

  const timed = useMemo(() => visible.filter((r) => r.minute != null), [visible]);
  const untimed = useMemo(() => visible.filter((r) => r.minute == null), [visible]);

  // Collisions: timed rows with known ends whose intervals overlap.
  const collidingKeys = useMemo(() => {
    const wb = timed.map((r) => ({ key: rowKey(r), ...bounds(r) }));
    const set = new Set<string>();
    for (let i = 0; i < wb.length; i++) {
      const a = wb[i];
      if (a.endA == null) continue;
      for (let j = i + 1; j < wb.length; j++) {
        const b = wb[j];
        if (b.endA == null) continue;
        if (a.startA < b.endA && b.startA < a.endA) {
          set.add(a.key);
          set.add(b.key);
        }
      }
    }
    return set;
  }, [timed]);

  const toggleEntity = (id: string) =>
    setActiveEntities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSource = (k: 'scene' | 'task' | 'travel') =>
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // ONE shared grid row for scenes + tasks. Source = left edge (amber task / purple
  // scene); collision = red warning tint (both rows) — palette reused from the error
  // banners (bg-red-50/border-red) + TaskBand.tsx confirm (border-red-300 text-red-700).
  const renderRow = (row: TimelineRow, colliding: boolean): ReactNode => {
    const entityName = entityNameById.get(rowEntityId(row)) ?? rowEntityId(row);
    const { timeText, isActual } = deriveTime(row);
    // Per-kind name / secondary column / fill / right-edge pill.
    let name: string;
    let project: string | null;
    let fill: string;
    let rightPill: ReactNode = null;
    if (row.kind === 'scene') {
      name = row.scene.routine_step.activity;
      project = null;
      fill = SCENE_FILL;
    } else if (row.kind === 'travel') {
      name = row.travel.title;
      project = row.travel.coaCode; // the COA shows in the project column for travel
      fill = TRAVEL_FILL;
      rightPill = (
        <span className="px-2 py-0.5 rounded border border-transparent bg-white text-cyan-700 text-[11px] font-mono whitespace-nowrap">
          ${Math.round(row.travel.cost).toLocaleString()}
        </span>
      );
    } else {
      name = row.block.title;
      project = row.block.projectName;
      fill = TASK_FILL;
      rightPill = (
        <span className="px-2 py-0.5 rounded border border-transparent bg-white text-indigo-700 text-[11px] font-mono uppercase tracking-wide whitespace-nowrap">
          {row.block.status}
        </span>
      );
    }
    // Source = the FILL (teal scene / cyan travel / indigo task). Collision keeps the
    // fill but adds a bold red inset ring (reads over any fill) + a ⚠ marker.
    const collide = colliding ? ' ring-2 ring-inset ring-red-500' : '';
    return (
      <li
        key={rowKey(row)}
        className={`${ROW_GRID} ${fill}${collide}`}
        title={colliding ? 'overlaps another block on this day' : undefined}
      >
        <span className="text-white font-medium tabular-nums whitespace-nowrap">
          {colliding && <span className="mr-1" aria-hidden="true">⚠</span>}
          {timeText}
          {isActual && <span className="ml-1 text-[10px] text-white/70">act</span>}
        </span>
        <span className="text-white font-medium break-words" title={name}>{name}</span>
        <span className="hidden lg:block text-white/85 break-words" title={project ?? ''}>
          {project ?? ''}
        </span>
        <span className="hidden lg:block text-white/85 break-words" title={entityName}>
          {entityName}
        </span>
        <span className="justify-self-start">
          {/* White pill stays legible on the colored fill: task → status, travel → cost. */}
          {rightPill}
        </span>
      </li>
    );
  };

  // Interleave gap dividers between adjacent timed rows with both bounds known (≥15m).
  const timedElements = useMemo<ReactNode[]>(() => {
    const els: ReactNode[] = [];
    let prevEndA: number | null = null;
    for (const r of timed) {
      const { startA, endA } = bounds(r);
      if (prevEndA != null) {
        const gap = startA - prevEndA;
        if (gap >= 15) {
          els.push(
            <li
              key={`gap-${rowKey(r)}`}
              className="flex items-center gap-2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-text-muted"
            >
              <span className="flex-1 border-t border-dashed border-border-light" aria-hidden="true" />
              {fmtDuration(gap)} open
              <span className="flex-1 border-t border-dashed border-border-light" aria-hidden="true" />
            </li>
          );
        }
      }
      els.push(renderRow(r, collidingKeys.has(rowKey(r))));
      prevEndA = endA;
    }
    return els;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, collidingKeys, entityNameById]);

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left min-w-0"
          aria-expanded={open}
        >
          <h2 className={sectionHeader}>
            · DAY
            <span className="ml-2 font-normal text-text-muted">time blocks</span>
          </h2>
          <span className="font-mono text-xs text-brand-purple" aria-hidden="true">
            {open ? '▾ hide' : '▸ show'}
          </span>
        </button>
        {/* Day nav — drives the SHARED date (same setter as section 3). Button
            treatment echoes trips/ItineraryAgenda.tsx:151-155. */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <button type="button" onClick={() => onDateChange(shiftDay(date, -1))} className={navBtn} aria-label="Previous day">
            ‹
          </button>
          <button
            type="button"
            onClick={() => onDateChange(todayLocal())}
            className="px-2 h-7 rounded border border-border-light text-text-muted hover:bg-bg-row"
          >
            today
          </button>
          <span className="px-1 text-text-muted tabular-nums">{date}</span>
          <button type="button" onClick={() => onDateChange(shiftDay(date, 1))} className={navBtn} aria-label="Next day">
            ›
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3">
          {(presentEntityIds.length > 0 || hasScenes || hasTasks) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {presentEntityIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">entity</span>
                  {presentEntityIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleEntity(id)}
                      className={`${chipBase} ${activeEntities.has(id) ? chipOn : chipOff}`}
                    >
                      {entityNameById.get(id) ?? id}
                    </button>
                  ))}
                </div>
              )}
              {(hasScenes || hasTasks || hasTravel) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">source</span>
                  {hasScenes && (
                    <button
                      type="button"
                      onClick={() => toggleSource('scene')}
                      className={`${chipBase} ${activeSources.has('scene') ? chipOn : chipOff}`}
                    >
                      scenes
                    </button>
                  )}
                  {hasTravel && (
                    <button
                      type="button"
                      onClick={() => toggleSource('travel')}
                      className={`${chipBase} ${activeSources.has('travel') ? chipOn : chipOff}`}
                    >
                      travel
                    </button>
                  )}
                  {hasTasks && (
                    <button
                      type="button"
                      onClick={() => toggleSource('task')}
                      className={`${chipBase} ${activeSources.has('task') ? chipOn : chipOff}`}
                    >
                      tasks
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm font-mono text-text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-xs font-mono text-text-muted">No time blocks for {date}.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {timedElements}
              {untimed.length > 0 && (
                <li className="pt-3 mt-2 border-t border-border-light">
                  <span className="font-mono text-xs font-medium text-brand-purple uppercase tracking-wide">
                    unscheduled
                  </span>
                  <span className="ml-2 font-normal text-text-muted">no time set · {untimed.length}</span>
                </li>
              )}
              {untimed.map((r) => renderRow(r, false))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// Local YYYY-MM-DD (NOT toISOString — UTC would flip the day), mirroring ContentPipeline.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDay(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
