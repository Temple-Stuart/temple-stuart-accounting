'use client';

// HOME-OPS-PR-3: the REAL content surface that EXISTS today, extracted FETCH-FREE
// for the public home page — same pattern as RoutineCreateForm (HOME-OPS-PR-1) and
// EvolutionPreview (HOME-OPS-PR-2). Safe by construction:
//   - NO fetch on mount, NO fetch anywhere (unlike the real SectionG_Content, which
//     self-fetches 4 endpoints on mount: SectionG_Content.tsx:45-50 — content/scenes,
//     content/takes, routines, entities).
//   - Reuses the REAL <ContentTable> (the genuine 14-column scene/take spreadsheet,
//     ContentTable.tsx:113-128) rendered with EMPTY arrays — real columns, zero rows.
//     ContentTable is itself fetch-free (props only), so this is the actual built
//     output structure, not a re-fabrication.
//   - Reproduces the real badge row + entity filter (SectionG_Content.tsx:288-309)
//     and the real "No scenes yet" empty state (SectionG_Content.tsx:311-321), neutral.
//   - Shows ONLY what is built today (ContentTable / scenes-takes). The not-yet-built
//     content "workspace"/"piece" grouping is NOT invented here.
//   - No action of its own: panel 03's gated footer ("Scenify a routine → log in")
//     calls onRequireAuth. This component is read-only structure.
//
// Logged-out, a visitor sees the genuine content table structure with no data and
// fires zero server calls — there is no fetch code here to fire one.

import ContentTable from '@/components/workbench/operations/content/ContentTable';

// No-op handlers for the read-only empty preview (ContentTable never invokes them
// with zero scenes — no rows render — but the prop contract requires them).
const noopUpdate = async () => {};
const noopScriptClick = () => {};

export default function ContentPreview() {
  // The exact badge style from SectionG_Content.tsx:285-286.
  const badgeClass =
    'px-2 py-0.5 text-xs font-mono rounded border border-border-light bg-bg-row text-text-primary';
  // HOME-STYLE-PR-1: label → dark brand-purple, weight 500 (scannable, not ghost-gray).
  const labelClass = 'text-brand-purple font-medium uppercase tracking-wide text-[10px] font-mono';

  return (
    <div className="space-y-3">
      {/* Real badge row + entity filter (SectionG_Content.tsx:288-309), zeroed/neutral. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={badgeClass}>0 scenes</span>
          <span className={badgeClass}>0 takes</span>
          <span className={badgeClass}>0 routines</span>
        </div>
        {/* Entity filter is real; logged-out it has no entity list (no /api/entities
            fetch here), so it shows the neutral "All entities" and is disabled. */}
        <select
          value="all"
          disabled
          aria-label="Filter by entity"
          className="px-2 py-1 bg-white border border-brand-purple/40 rounded text-xs font-mono text-text-primary"
        >
          <option value="all">All entities</option>
        </select>
      </div>

      {/* Real empty state (SectionG_Content.tsx:311-321). */}
      <div className="flex flex-col items-center justify-center py-6 px-4 border border-border-light rounded bg-bg-row text-center">
        <div className="text-2xl mb-2" aria-hidden="true">🎬</div>
        <div className="text-sm font-mono font-semibold text-text-primary">No scenes yet</div>
        <div className="text-xs font-mono text-text-muted mt-1">
          Scenify a routine to start filming &mdash; after you log in.
        </div>
      </div>

      {/* The REAL 14-column ContentTable, rendered EMPTY (real headers, zero rows). */}
      <div>
        <div className={`${labelClass} mb-1`}>content table</div>
        <ContentTable
          scenes={[]}
          takes={[]}
          routines={[]}
          onSceneUpdate={noopUpdate}
          onTakeUpdate={noopUpdate}
          onScriptClick={noopScriptClick}
        />
        <div className="text-text-muted italic text-xs font-mono mt-1">
          Your scenes &amp; takes populate this table once you scenify a routine.
        </div>
      </div>
    </div>
  );
}
