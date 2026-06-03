'use client';

// HOME-PR-10 / HOME-OPS-PR-1 / HOME-OPS-PR-2 / HOME-OPS-PR-3 / HOME-OPS-PR-4:
// Operations "showroom" on the public home page. Safe by construction — NO fetch on
// mount, NO server/paid call logged out. Every panel is now REAL and fetch-free:
//   - Panel 01 (Make a project) is the REAL 5-step input form + the REAL (empty) task
//     table, via ProjectCreateForm — extracted FETCH-FREE (HOME-OPS-PR-4). HARD LINE:
//     it is the only paid surface, and its AI buttons (generate plan / preview tasks)
//     call onRequireAuth and NEVER fetch — no paid AI call is reachable logged-out.
//   - Panel 02 (Make a routine) is the REAL routine input form + the REAL (empty)
//     output table, via RoutineCreateForm — extracted FETCH-FREE (HOME-OPS-PR-1).
//   - Panel 03 (Create content) is the REAL content table structure that exists today
//     (the genuine 14-column ContentTable rendered empty + the real badge/filter row
//     + empty state), via ContentPreview — extracted FETCH-FREE (HOME-OPS-PR-3). Only
//     what's built is shown; the unbuilt content workspace/piece grouping is not.
//   - Panel 04 (Evolution loop) is the REAL version-spine structure, via
//     EvolutionPreview — extracted FETCH-FREE, shown as a muted structural preview
//     (no fabricated version data presented as real) (HOME-OPS-PR-2).
//   - The ONLY action anywhere is opening the existing login modal via onRequireAuth
//     (the same trigger Travel/Trading gate to). A visitor cannot trigger a server
//     or paid call — no fetch code exists on any render or submit path here.
//
// Mirrors the real Operations surface's visual language (font-mono, status pills,
// brand-purple version chips, the EvolutionTimeline spine) so visitors SEE the real
// product, then log in to use it.

import ProjectCreateForm from '@/components/home/ProjectCreateForm';
import RoutineCreateForm from '@/components/home/RoutineCreateForm';
import ContentPreview from '@/components/home/ContentPreview';
import EvolutionPreview from '@/components/home/EvolutionPreview';

interface Props {
  /** Opens the existing home register/login modal (reused from ModuleLauncher —
   *  the same trigger Travel's gateGuestCreate + the paid stubs use). */
  onRequireAuth: () => void;
}

/** One showroom panel: a light inner header (NOT purple — one purple band per
 *  card lives on the module section) + a body + an optional gated action footer.
 *  When `action` is omitted (e.g. the real Routine panel, which carries its own
 *  gated "Create routine → log in" button), the footer button is not rendered. */
function Panel({
  step,
  title,
  children,
  action,
  onRequireAuth,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  action?: string;
  onRequireAuth: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200/70 bg-white overflow-hidden flex flex-col">
      <div className="bg-gray-50 border-b border-gray-200/70 px-3 py-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-mono">{step}</span>
        <span className="text-sm font-semibold text-text-primary">{title}</span>
      </div>
      <div className="p-3 text-xs font-mono flex-1">{children}</div>
      {action && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onRequireAuth}
            className="w-full px-3 py-1.5 border border-brand-purple text-brand-purple rounded text-xs font-mono font-semibold hover:bg-purple-50 transition-colors"
          >
            {action} <span aria-hidden>→</span> log in
          </button>
        </div>
      )}
    </div>
  );
}

export default function OperationsShowroom({ onRequireAuth }: Props) {
  return (
    <div>
      <p className="text-sm text-text-primary mb-1">
        This is the real dashboard, not a screenshot &mdash; look around.
      </p>
      <p className="text-xs text-text-muted mb-4">
        Creating anything asks you to log in. Nothing here calls the server.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1 · Make a project — the REAL fetch-free 5-step form + REAL empty task
            table (HOME-OPS-PR-4). No `action` prop: the form carries its own gated
            buttons. HARD LINE: the AI buttons (generate plan / preview tasks) call
            onRequireAuth and NEVER fetch — no paid call is reachable logged-out. */}
        <Panel step="01" title="Make a project" onRequireAuth={onRequireAuth}>
          <ProjectCreateForm onRequireAuth={onRequireAuth} />
        </Panel>

        {/* 2 · Make a routine — the REAL fetch-free input form + REAL empty output
            table (HOME-OPS-PR-1). No `action` prop: the form carries its own gated
            "Create routine → log in" button. */}
        <Panel step="02" title="Make a routine" onRequireAuth={onRequireAuth}>
          <RoutineCreateForm onRequireAuth={onRequireAuth} />
        </Panel>

        {/* 3 · Create content — the REAL content table structure that exists today,
            fetch-free + EMPTY (HOME-OPS-PR-3). The gated "Scenify a routine → log in"
            footer (Panel's action) calls onRequireAuth. The unbuilt content
            "workspace"/"piece" grouping is NOT shown — only what's built. */}
        <Panel step="03" title="Create content" action="Scenify a routine" onRequireAuth={onRequireAuth}>
          <ContentPreview />
        </Panel>

        {/* 4 · Evolution loop — the REAL version-spine structure, fetch-free
            (HOME-OPS-PR-2). The "Re-run AI → log in" footer (Panel's gated action)
            calls onRequireAuth. */}
        <Panel step="04" title="Evolution loop" action="Re-run AI" onRequireAuth={onRequireAuth}>
          <EvolutionPreview />
        </Panel>
      </div>
    </div>
  );
}
