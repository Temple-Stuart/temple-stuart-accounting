/**
 * TaskBand — the shared, fully-legible inner content of a task row's amber band
 * (OPS-CE-8F), used by BOTH the S2 day map (ScenifyDraft) and the S3 timeline
 * (DailyLog) so the two can't drift. Fields are clearly separated, labeled (small
 * purple uppercase labels mirroring the scene rows), and WRAPPED — nothing truncates:
 *
 *   TIME (actual/scheduled, labeled; or the inline commit form when planned) ·
 *   TASK (full title, wrapped, primary) · PROJECT (full name, wrapped) · STATUS
 *
 * Read-only except the inline TaskTimeCommit on planned (block-less) rows. The amber
 * band chrome lives on the parent <td>; this renders only the labeled fields.
 */

'use client';

import TaskTimeCommit from './TaskTimeCommit';

const fieldLabel = 'text-brand-purple uppercase tracking-wide text-[10px] font-medium';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className={fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

export default function TaskBand({
  timeLabel,
  planned,
  itemId,
  date,
  title,
  projectName,
  status,
}: {
  timeLabel: string;
  planned: boolean;
  itemId?: string;
  date: string;
  title: string;
  projectName: string | null;
  status: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
      <span className="text-amber-700 mt-4" aria-hidden="true">▦</span>

      <Field label="time">
        {planned && itemId ? (
          <TaskTimeCommit itemId={itemId} date={date} />
        ) : (
          <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">{timeLabel}</span>
        )}
      </Field>

      <Field label="task" className="min-w-[160px] flex-1">
        <span className="text-text-primary font-medium break-words">{title}</span>
      </Field>

      {projectName && (
        <Field label="project" className="min-w-[120px]">
          <span className="text-text-muted break-words">{projectName}</span>
        </Field>
      )}

      <Field label="status">
        <span className="px-1.5 py-0.5 rounded border border-amber-300 bg-white text-amber-700 text-[10px] uppercase tracking-wide whitespace-nowrap">
          {status}
        </span>
      </Field>
    </div>
  );
}
