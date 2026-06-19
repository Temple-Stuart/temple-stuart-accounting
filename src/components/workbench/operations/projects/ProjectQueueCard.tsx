/**
 * ProjectQueueCard (PD-2) — a single project in the QUEUE, as a clean white card with a
 * colored left-stripe (matching the merged pipe look). Shows title, real task/request
 * counts, and status; clicking opens the project's detail (the existing <ProjectRow/>,
 * passed as children and mounted only when open — lazy, so collapsed cards never fetch).
 *
 * Presentation only: it owns NO data/fetch. The counts arrive as props (computed by the
 * list API's Prisma _count + distinct run-marker groupBy). The detail behavior is entirely
 * the existing ProjectRow — PD-3 reworks what that detail shows. Mobile-first single column.
 */

'use client';

import { useEffect, useState } from 'react';
import type { Project, ProjectStatus } from './types';
import { STATUS_LABELS, STATUS_PILL_CLASSES } from './types';

// Left-stripe color by status — a quick visual scan of the backlog.
const STRIPE: Record<ProjectStatus, string> = {
  not_started: '#9CA3AF', // gray
  in_progress: '#6B46C1', // purple
  blocked: '#D97706',     // amber
  completed: '#059669',   // emerald
  cancelled: '#9CA3AF',   // gray
  archived: '#9CA3AF',    // gray
};

interface Props {
  project: Project;
  taskCount: number;
  runCount: number;
  /** When this project is a cross-project jump target, open it automatically. */
  forceOpen?: boolean;
  /** The live detail (an existing <ProjectRow defaultExpanded/>), mounted only when open. */
  children: React.ReactNode;
}

export default function ProjectQueueCard({ project, taskCount, runCount, forceOpen, children }: Props) {
  const [open, setOpen] = useState(false);

  // A dependency jump → open the target card so the row inside can scroll/flash.
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const stripe = STRIPE[project.status] ?? '#9CA3AF';

  if (open) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-gray-500 hover:text-gray-800 hover:underline"
        >
          ‹ back to projects
        </button>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full text-left rounded-md border border-gray-200 border-l-4 bg-white p-3 sm:p-4 shadow-sm hover:shadow transition-shadow flex items-center justify-between gap-3"
      style={{ borderLeftColor: stripe }}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{project.title}</div>
        <div className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'} · {runCount} {runCount === 1 ? 'request' : 'requests'}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL_CLASSES[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
        <span className="text-gray-300 text-sm" aria-hidden="true">›</span>
      </div>
    </button>
  );
}
