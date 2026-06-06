/**
 * DayCalendar — the day's blocks as a STACKED LIST in clock order (NOT an hour-grid:
 * no hour ruler, no empty-hour whitespace — a dense list). Pure presentation over the
 * shared useDayFeed(date) feed (PR A); the rows are already DAY_START-ordered by the
 * hook's compareDayOrder, so this only filters + renders. Collapsed by default.
 *
 * Each row, one line (wraps narrow): time range · name · source marker (scene/task) ·
 * project (tasks) · entity · status chip (tasks). A scene's end shows ONLY when its
 * step has a non-null duration_minutes (start + duration) — never imputed. Untimed
 * rows (no start) drop below an "unscheduled" divider (lane styling is PR C).
 *
 * Filters: entity (derived from the entities the rows actually contain) + source
 * (scenes / tasks). OR within a group, AND across groups. Local state only.
 *
 * No new fetch, no useDayFeed change, no hour-grid, no fallback for missing times.
 */

'use client';

import { useMemo, useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';
import { useDayFeed, type TimelineRow } from './useDayFeed';

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

const rowEntityId = (row: TimelineRow): string =>
  row.kind === 'scene' ? row.scene.entity_id : row.block.entity_id;

export default function DayCalendar({ date }: { date: string }) {
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

  // Timed rows keep the hook's clock order; untimed (no start) sink below a divider.
  const timed = useMemo(() => visible.filter((r) => r.minute != null), [visible]);
  const untimed = useMemo(() => visible.filter((r) => r.minute == null), [visible]);

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

  const renderRow = (row: TimelineRow) => {
    const entityName = entityNameById.get(rowEntityId(row)) ?? rowEntityId(row);
    if (row.kind === 'scene') {
      const s = row.scene;
      // Timed scenes carry a minute (start); end only when duration is non-null.
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
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 rounded border border-border-light"
        >
          {timeText && (
            <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">{timeText}</span>
          )}
          <span className="text-text-primary flex-1 min-w-[120px] break-words">{s.routine_step.activity}</span>
          <span className={`${chipBase} border-brand-purple/40 text-brand-purple uppercase tracking-wide`}>scene</span>
          <span className="text-text-muted break-words">{entityName}</span>
        </li>
      );
    }
    const b = row.block;
    return (
      <li
        key={`task-${b.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 rounded border border-border-light border-l-4 border-l-amber-400 bg-amber-50/30"
      >
        {b.label && (
          <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">{b.label}</span>
        )}
        <span className="text-text-primary flex-1 min-w-[120px] break-words">{b.title}</span>
        <span className={`${chipBase} border-amber-400 text-amber-700 uppercase tracking-wide`}>task</span>
        {b.projectName && <span className="text-text-muted break-words">{b.projectName}</span>}
        <span className="text-text-muted break-words">{entityName}</span>
        <span className={`${chipBase} uppercase tracking-wide ${statusPillClass(b.status)}`}>{b.status}</span>
      </li>
    );
  };

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
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
              {timed.map(renderRow)}
              {untimed.length > 0 && (
                <li className="pt-2 mt-1 border-t border-border-light text-[10px] uppercase tracking-wide text-text-muted">
                  unscheduled
                </li>
              )}
              {untimed.map(renderRow)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
