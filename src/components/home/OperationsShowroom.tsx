'use client';

// HOME-PR-10 / HOME-OPS-PR-1: Operations "showroom" on the public home page.
// Safe by construction — NO fetch on mount, NO server/paid call when logged out:
//   - Panel 02 (Make a routine) is now the REAL routine input form + the REAL
//     (empty) routines output table, via RoutineCreateForm — extracted FETCH-FREE
//     (no /api/ anywhere; the "Create routine" submit gates to onRequireAuth before
//     any network call, mirroring Travel/Trading). This is the first panel to go
//     real; the other 3 stay sample-data until their own PRs.
//   - Panels 01/03/04 (project/content/evolution) remain hardcoded sample data
//     (no fetch) — replaced with real fetch-free forms in later HOME-OPS PRs.
//   - The ONLY action anywhere is opening the existing login modal via onRequireAuth
//     (the same trigger Travel/Trading gate to). A visitor cannot trigger a server
//     or paid call — no fetch code exists on any render or submit path here.
//
// Mirrors the real Operations surface's visual language (font-mono, status pills,
// brand-purple version chips, the EvolutionTimeline spine) so visitors SEE the real
// product, then log in to use it.

import RoutineCreateForm from '@/components/home/RoutineCreateForm';

interface Props {
  /** Opens the existing home register/login modal (reused from ModuleLauncher —
   *  the same trigger Travel's gateGuestCreate + the paid stubs use). */
  onRequireAuth: () => void;
}

// ── Hardcoded sample data (no fetch) ────────────────────────────────────────
const SAMPLE_TASKS: { title: string; status: 'done' | 'in process' | 'new' }[] = [
  { title: 'Create FSA ID + verify identity', status: 'done' },
  { title: 'Gather 2025 tax transcripts', status: 'in process' },
  { title: 'Draft SBA Form 1919', status: 'new' },
];

const SAMPLE_VERSIONS: { v: number; date: string; added: number }[] = [
  { v: 1, date: 'Jun 1', added: 4 },
  { v: 2, date: 'Jun 2', added: 3 },
];

const PILL: Record<string, string> = {
  done: 'bg-green-50 text-green-800 border-green-300',
  'in process': 'bg-blue-50 text-blue-800 border-blue-300',
  new: 'bg-gray-100 text-gray-700 border-gray-300',
};

function SamplePill({ status }: { status: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 border rounded text-[10px] font-mono shrink-0 ${PILL[status] ?? PILL.new}`}>
      {status}
    </span>
  );
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
        <span className="text-[10px] uppercase tracking-wider text-text-faint font-mono">{step}</span>
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
  const labelClass = 'text-text-faint uppercase tracking-wide text-[10px] font-mono';

  return (
    <div>
      <p className="text-sm text-text-primary mb-1">
        This is the real dashboard, not a screenshot &mdash; look around.
      </p>
      <p className="text-xs text-text-muted mb-4">
        Creating anything asks you to log in. Nothing here calls the server.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1 · Make a project — the 5-step glimpse */}
        <Panel step="01" title="Make a project" action="Generate tasks" onRequireAuth={onRequireAuth}>
          <div className="font-bold text-text-primary mb-2">Apply for SBA microloan</div>
          <div className="space-y-1.5">
            <div><span className={labelClass}>1 · goal</span> <span className="text-text-primary">secure $25k working capital</span></div>
            <div><span className={labelClass}>2 · problem</span> <span className="text-text-primary">no business credit history yet</span></div>
            <div><span className={labelClass}>3 · diagnosis</span> <span className="text-text-primary">never registered the EIN to a bank</span></div>
            <div><span className={labelClass}>4 · design</span> <span className="text-text-primary">lender-ready packet in 3 steps</span></div>
          </div>
          <div className={`${labelClass} mt-3 mb-1`}>5 · execute</div>
          <ul className="space-y-1">
            {SAMPLE_TASKS.map((t) => (
              <li key={t.title} className="flex items-center gap-2 min-w-0">
                <span
                  className={
                    t.status === 'done'
                      ? 'text-text-muted line-through truncate'
                      : 'text-text-primary truncate'
                  }
                >
                  {t.title}
                </span>
                <SamplePill status={t.status} />
              </li>
            ))}
          </ul>
        </Panel>

        {/* 2 · Make a routine — the REAL fetch-free input form + REAL empty output
            table (HOME-OPS-PR-1). No `action` prop: the form carries its own gated
            "Create routine → log in" button. */}
        <Panel step="02" title="Make a routine" onRequireAuth={onRequireAuth}>
          <RoutineCreateForm onRequireAuth={onRequireAuth} />
        </Panel>

        {/* 3 · Create content — piece glimpse */}
        <Panel step="03" title="Create content" action="Assemble piece" onRequireAuth={onRequireAuth}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-text-primary">Day 2 reel</span>
            <span className="px-1.5 py-0.5 border border-gray-300 bg-gray-100 text-gray-700 rounded text-[10px]">draft</span>
          </div>
          <div className="text-text-muted mb-3">8 routines · 2 projects grouped for this day</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-text-faint">scene</span>
              <span className="text-text-primary">Morning filming → hook on the SBA win</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-faint">b-roll</span>
              <span className="text-text-primary">desk close-ups · approval email</span>
            </div>
          </div>
          <div className="mt-3 p-2 rounded bg-bg-row text-text-muted italic">
            find the story: &ldquo;Day 2 — the loan packet came together&rdquo;
          </div>
        </Panel>

        {/* 4 · Evolution loop — version timeline glimpse */}
        <Panel step="04" title="Evolution loop" action="Re-run AI" onRequireAuth={onRequireAuth}>
          <div className="text-text-muted mb-3">
            {SAMPLE_VERSIONS.length} re-runs · the task list grows, never resets
          </div>
          <div className="border-l-2 border-border-light pl-4 space-y-3">
            {SAMPLE_VERSIONS.map((ver) => (
              <div key={ver.v} className="relative">
                <span className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-brand-purple border-2 border-white" />
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-brand-purple text-white text-[10px] font-semibold">
                    v{ver.v}
                  </span>
                  <span className="text-text-primary">{ver.date}</span>
                  <span className="text-text-muted">· added {ver.added} tasks</span>
                </div>
              </div>
            ))}
          </div>
          <div className={`${labelClass} mt-3`}>each re-run is an immutable version on record</div>
        </Panel>
      </div>
    </div>
  );
}
