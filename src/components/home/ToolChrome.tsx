'use client';

/**
 * NAV-02: the chrome a tool wears wherever it is listed. The family menu
 * (FamilyNav) and the family page cards (FamilyPage) share it, so a status
 * reads the same in both places and the beats render as today's dots.
 */
import type { Beats, ToolStatus } from '@/lib/toolRegistry';

export const STATUS_LABEL: Record<ToolStatus, string> = { LIVE: 'LIVE', PARTIAL: 'PARTIAL', NOT_BUILT: 'NOT BUILT' };
const STATUS_CLASS: Record<ToolStatus, string> = {
  LIVE: 'border-brand-gold text-brand-gold',
  PARTIAL: 'border-brand-amber text-brand-amber',
  NOT_BUILT: 'border-border text-text-faint',
};
const BEATS: ReadonlyArray<[keyof Beats, string]> = [['discover', 'discover'], ['decide', 'decide'], ['commit', 'commit'], ['record', 'record']];

export function StatusChip({ status }: { status: ToolStatus }) {
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** The beats it has — a filled dot is a cited beat, a hollow one is "—". */
export function BeatDots({ name, beats }: { name: string; beats: Beats }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider" aria-label={`${name} beats`}>
      {BEATS.map(([key, label]) => (
        <li key={key} className={`flex items-center gap-1 ${beats[key] ? 'text-text-primary' : 'text-text-faint'}`}>
          <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full border ${beats[key] ? 'border-brand-purple bg-brand-purple' : 'border-border bg-transparent'}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
