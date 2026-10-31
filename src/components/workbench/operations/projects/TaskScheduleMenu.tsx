/**
 * TaskScheduleMenu — the "↗ schedule" date menu, as ONE part (PROJECTS-01, 2026-09-30).
 *
 * Moved verbatim out of TaskRowView.tsx (its schedule date menu) so the view and the projects table
 * render the same markup — one form, never two copies. PURE: props only — no
 * fetch, no effect, no context, no API path. The showroom renders it through
 * the view, so the showroom fetch-free law lists this file.
 */

'use client';


export interface TaskScheduleMenuProps {
  scheduleDate: string;
  scheduling: boolean;
  onScheduleDateChange: (date: string) => void;
  onSchedule: (targetDate: string) => void;
  onCloseScheduleMenu: () => void;
}

export default function TaskScheduleMenu({
  scheduleDate,
  scheduling,
  onScheduleDateChange,
  onSchedule,
  onCloseScheduleMenu,
}: TaskScheduleMenuProps) {
  return (
    <div
      className="mx-6 mt-2 mb-2 p-2 border border-border-light rounded bg-bg-row text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-text-muted">schedule for:</span>
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => onScheduleDateChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-0.5 border border-border rounded text-text-primary"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSchedule(scheduleDate); }}
          disabled={scheduling || !scheduleDate}
          className="px-2 py-0.5 border border-border text-text-primary rounded hover:bg-white disabled:opacity-50"
        >
          schedule
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCloseScheduleMenu(); }}
          className="px-2 py-0.5 text-text-muted hover:bg-bg-row rounded"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
