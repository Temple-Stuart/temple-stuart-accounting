/**
 * TaskHistoryList — a task's status history, as ONE part (PROJECTS-01, 2026-09-30).
 *
 * Moved verbatim out of TaskRowView.tsx (its history list) so the view and the projects table
 * render the same markup — one form, never two copies. PURE: props only — no
 * fetch, no effect, no context, no API path. The showroom renders it through
 * the view, so the showroom fetch-free law lists this file.
 */

'use client';

import type { TaskStatusHistoryRow } from './TaskRowView';

export interface TaskHistoryListProps {
  history: TaskStatusHistoryRow[] | null;
  historyLoading: boolean;
  historyError: string | null;
}

export default function TaskHistoryList({ history, historyLoading, historyError }: TaskHistoryListProps) {
  return (
    <div className="mx-6 mt-2 mb-2 p-2 border border-border-light rounded bg-bg-row text-xs">
      {historyLoading && <div className="text-text-muted">loading history…</div>}
      {historyError && <div className="text-red-700">{historyError}</div>}
      {!historyLoading && !historyError && history !== null && history.length === 0 && (
        <div className="text-text-muted italic">no status changes recorded yet</div>
      )}
      {!historyLoading && !historyError && history !== null && history.length > 0 && (
        <ul className="space-y-1">
          {history.map((h) => (
            <li key={h.id} className="flex flex-col">
              <div>
                <span className="text-text-muted">
                  {new Date(h.changed_at).toLocaleString()}
                </span>
                {' · '}
                <span className="text-text-primary">
                  {h.previous_status ?? '—'} → {h.new_status}
                </span>
                {h.changed_by && (
                  <span className="text-text-muted"> · {h.changed_by}</span>
                )}
              </div>
              {h.reason && (
                <div className="text-text-muted pl-2 italic">
                  &ldquo;{h.reason}&rdquo;
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
