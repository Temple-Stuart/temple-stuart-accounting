'use client';

// HOME-OPS-PR-2: the REAL evolution-timeline visual structure (the version spine),
// extracted FETCH-FREE for the public home page — same pattern as RoutineCreateForm
// (HOME-OPS-PR-1). Safe by construction:
//   - NO fetch on mount, NO fetch anywhere (unlike the real EvolutionTimeline, which
//     self-fetches GET /api/operations/projects/[id]/evolution on mount at
//     EvolutionTimeline.tsx:103-109).
//   - Renders the real spine anatomy (border-l-2 spine, v{n} purple node off the
//     spine, "date · added N tasks", the faint model/cost line) as a STRUCTURAL
//     PREVIEW: the nodes are visibly muted placeholders (dashed border, reduced
//     opacity, em-dash values), NOT fabricated version data presented as real.
//   - No action here: panel 04's own "Re-run AI → log in" footer (Panel's gated
//     button) calls onRequireAuth. This component is read-only structure.
//
// Logged-out, a visitor sees the genuine version-spine structure with no data and
// fires zero server calls — there is no fetch code here to fire one.

// Two structural placeholder nodes — they convey the spine anatomy (v1, v2) without
// asserting any real date or task count (values render as em-dashes).
const PLACEHOLDER_NODES = [1, 2];

export default function EvolutionPreview() {
  return (
    <div className="text-xs font-mono space-y-3">
      {/* Mechanism line (the real component shows "N re-runs · T tasks total"; here we
          state the mechanism, not a fabricated count). */}
      <div className="text-text-muted">
        Each AI re-run is an immutable version &mdash; the task list grows, never resets.
      </div>

      {/* The REAL spine (EvolutionTimeline.tsx:161): left border = spine, nodes hang off it. */}
      <div className="border-l-2 border-border-light pl-4 space-y-3">
        {PLACEHOLDER_NODES.map((n) => (
          <div key={n} className="relative">
            {/* node dot, centered on the spine — muted (bg-brand-purple/40) to signal
                placeholder vs the real component's solid bg-brand-purple. */}
            <span className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-brand-purple/40 border-2 border-white" />
            <div className="border border-border-light border-dashed rounded bg-white p-3 opacity-70">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-brand-purple/60 text-white text-[10px] font-semibold shrink-0">
                    v{n}
                  </span>
                  <span className="text-text-faint">&mdash;</span>
                  <span className="text-text-faint">· added &mdash; tasks</span>
                </div>
                <span className="text-text-faint text-[10px]">
                  model · $&mdash; · &mdash; in · &mdash; out
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-text-muted italic">
        Your real versions populate this spine after you log in and re-run the AI.
      </div>
    </div>
  );
}
