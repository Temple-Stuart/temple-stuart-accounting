/**
 * DayCalendar — the day's blocks as a STACKED LIST in clock order (NOT an hour-grid).
 * Pure presentation over the shared useDayFeed(date) feed; rows are already
 * DAY_START-ordered by the hook's compareDayOrder. Collapsed by default.
 *
 * This PR finishes it:
 *   • GAPS — between two consecutive timed rows whose bounds are BOTH known
 *     (prev end → next start), a muted divider names the open duration. Only when
 *     both bounds exist (a row with no end makes no gap claim); ≥15m to cut noise.
 *   • COLLISIONS — timed rows whose [start,end) overlap get a red warning tint (both
 *     rows). Rows with no end can't collide — skipped honestly.
 *   • UNSCHEDULED LANE — a real sub-header ("unscheduled — no time set") + count.
 *   • NAV — ‹ prev · today · next › in the header, driving the SHARED date state
 *     (lifted via onDateChange, same setter that drives section 3).
 *
 * No useDayFeed change, no new fetch, no hour-grid, no fallback for missing times.
 */

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import { useDayFeed, type TimelineRow } from './useDayFeed';
import { dayAnchoredMinute, minuteOfDayFromInstant } from '@/lib/content/dayOrder';

const sectionHeader = 'font-mono text-sm font-medium tracking-wide text-brand-purple';

// Status chip styling reused from the Content pipeline (ContentPipeline.tsx:55-59),
// including its muted fallback for statuses outside the map (ContentPipeline.tsx:442).
const STATUS_PILL: Record<string, string> = {
  open: 'border-border text-text-muted',
  in_progress: 'border-brand-purple text-brand-purple',
  blocked: 'border-amber-400 text-amber-700 bg-amber-50',
};
const statusPillClass = (status: string) =>
  STATUS_PILL[status] ?? 'border-border text-text-muted';

// minute-of-day (0–1439, wrap-safe) → "HH:MM".
const fmtMinute = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// open-duration label: "1h 30m" / "45m" / "2h".
const fmtDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
};

const rowEntityId = (row: TimelineRow): string =>
  row.kind === 'scene' ? row.scene.entity_id : row.block.entity_id;

const rowKey = (row: TimelineRow): string =>
  row.kind === 'scene' ? `scene-${row.scene.id}` : `task-${row.block.id}`;

/**
 * Day-anchored [start, end) for a TIMED row, end null when unknown (no guessing).
 * Scene end = anchored start + duration (only when duration_minutes != null).
 * Task end = the end that pairs with the start shown (actual vs scheduled), anchored;
 * wrapped past start if it crosses the 04:00 boundary.
 */
function bounds(row: TimelineRow): { startA: number; endA: number | null } {
  const startA = dayAnchoredMinute(row.minute as number);
  if (row.kind === 'scene') {
    const dur = row.scene.routine_step.duration_minutes;
    return { startA, endA: dur != null ? startA + dur : null };
  }
  const b = row.block;
  const endIso = b.actualStart ? b.actualEnd : b.scheduledEnd;
  if (!endIso) return { startA, endA: null };
  let endA = dayAnchoredMinute(minuteOfDayFromInstant(endIso));
  if (endA < startA) endA += 1440; // block crosses the content-day boundary
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
  const [activeSources, setActiveSources] = useState<Set<'scene' | 'task'>>(new Set());

  // Chips derive ONLY from what the rows actually contain (no hardcoding).
  const presentEntityIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of timeline) s.add(rowEntityId(r));
    return [...s].sort((a, b) =>
      (entityNameById.get(a) ?? a).localeCompare(entityNameById.get(b) ?? b)
    );
  }, [timeline, entityNameById]);
  const hasScenes = useMemo(() => timeline.some((r) => r.kind === 'scene'), [timeline]);
  const hasTasks = useMemo(() => timeline.some((r) => r.kind === 'task'), [timeline]);

  const visible = useMemo(() => {
    const eOn = activeEntities.size > 0;
    const sOn = activeSources.size > 0;
    return timeline.filter(
      (r) =>
        (!eOn || activeEntities.has(rowEntityId(r))) &&
        (!sOn || activeSources.has(r.kind))
    );
  }, [timeline, activeEntities, activeSources]);

  // Timed rows keep the hook's clock order; untimed (no start) sink below the lane.
  const timed = useMemo(() => visible.filter((r) => r.minute != null), [visible]);
  const untimed = useMemo(() => visible.filter((r) => r.minute == null), [visible]);

  // Collisions: any two timed rows with known ends whose intervals overlap.
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
  const toggleSource = (k: 'scene' | 'task') =>
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const chipBase = 'px-2 py-0.5 rounded border text-[11px] font-mono';
  const chipOn = 'border-brand-purple bg-brand-purple text-white';
  const chipOff = 'border-border-light text-text-muted hover:bg-bg-row';
  const navBtn = 'px-1.5 py-0.5 rounded border border-border-light text-text-muted hover:bg-bg-row';

  // Collision tint reuses the warning-red palette (error banners bg-red-50/border-red;
  // TaskBand.tsx confirm uses border-red-300 text-red-700).
  const renderRow = (row: TimelineRow, colliding: boolean) => {
    const entityName = entityNameById.get(rowEntityId(row)) ?? rowEntityId(row);
    const collideClass = colliding ? ' border-red-300 bg-red-50' : '';
    if (row.kind === 'scene') {
      const s = row.scene;
      const start = row.minute != null ? fmtMinute(row.minute) : '';
      const dur = s.routine_step.duration_minutes;
      const timeText =
        row.minute != null
          ? dur != null
            ? `${start}–${fmtMinute(row.minute + dur)}`
            : start
          : '';
      return (
        <li
          key={`scene-${s.id}`}
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 rounded border border-border-light${collideClass}`}
        >
          {timeText && (
            <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">{timeText}</span>
          )}
          <span className="text-text-primary flex-1 min-w-[120px] break-words">{s.routine_step.activity}</span>
          {colliding && <span className={`${chipBase} border-red-300 text-red-700`}>⚠ overlap</span>}
          <span className={`${chipBase} border-brand-purple/40 text-brand-purple uppercase tracking-wide`}>scene</span>
          <span className="text-text-muted break-words">{entityName}</span>
        </li>
      );
    }
    const b = row.block;
    return (
      <li
        key={`task-${b.id}`}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 rounded border border-border-light border-l-4 border-l-amber-400 bg-amber-50/30${collideClass}`}
      >
        {b.label && (
          <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">{b.label}</span>
        )}
        <span className="text-text-primary flex-1 min-w-[120px] break-words">{b.title}</span>
        {colliding && <span className={`${chipBase} border-red-300 text-red-700`}>⚠ overlap</span>}
        <span className={`${chipBase} border-amber-400 text-amber-700 uppercase tracking-wide`}>task</span>
        {b.projectName && <span className="text-text-muted break-words">{b.projectName}</span>}
        <span className="text-text-muted break-words">{entityName}</span>
        <span className={`${chipBase} uppercase tracking-wide ${statusPillClass(b.status)}`}>{b.status}</span>
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
    // renderRow/entityNameById are stable enough for this presentational list.
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
        {/* Day nav — drives the SHARED date (same setter as section 3). */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <button type="button" onClick={() => onDateChange(shiftDay(date, -1))} className={navBtn} aria-label="Previous day">
            ‹ prev
          </button>
          <button type="button" onClick={() => onDateChange(todayLocal())} className={navBtn}>
            today
          </button>
          <span className="px-1 text-text-muted tabular-nums">{date}</span>
          <button type="button" onClick={() => onDateChange(shiftDay(date, 1))} className={navBtn} aria-label="Next day">
            next ›
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3">
          {/* Filter chips — entity (derived) + source (scenes / tasks). */}
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
              {(hasScenes || hasTasks) && (
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
// Shift a YYYY-MM-DD by whole days in LOCAL time.
function shiftDay(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
