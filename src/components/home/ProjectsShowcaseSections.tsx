'use client';

/**
 * PROJECTS-CONTENT-SHOWCASE: the logged-out PROJECTS deck — Bloomberg slides on
 * the proven Trade/Books/Tax template, grounded in
 * PROJECTS-CONTENT-FULL-INVENTORY (audit-reports/…, f7324067).
 *
 * v1 BASELINE: clean articulation of the REAL flow — every slide a discrete,
 * editable panel. It supersedes OperationsPipelineShowroom's Projects usage
 * (ModuleLauncher renders this instead for logged-out; the showroom file is
 * untouched and has no other consumer).
 *
 * TRUTH GUARDS (inventory):
 *  • The pipe is shown as its REAL FIVE stages — research → fire audit → wait
 *    for the real audit → fusion → tasks land pending_review
 *    (operations-pipe-run.ts:104-248) — NOT the run-pipe banner's two-stage
 *    "research → fusion" under-description (TruthMachineView.tsx:321). The
 *    live mount keeps pipeQueued=false so that banner never renders here.
 *  • NO in-tab PR-link claim: pr_url/exec_status are never rendered by any
 *    component (inventory §A6.1). The deck says exactly what the tab shows —
 *    "building… PR incoming" — and that the PR itself lands on GitHub.
 *  • The caps are the real verified defaults: pipe 20/day (pipeBudget.ts:15),
 *    Routine 10/day (routineFireBudget.ts:18), exec 5/day
 *    (execFireBudget.ts:16) — each env-tunable.
 *  • CTA truth: there is NO tab:projects entitlement (categoryKeys.ts:23-28)
 *    and no isTabLocked check on this tab — a FREE account gets the real
 *    Projects tab (ModuleLauncher.tsx:470-475). The CTA is therefore the
 *    free-account signup (the old showroom's own honest CTA), NOT a
 *    "Subscribe to unlock" card that would advertise a paywall that doesn't
 *    exist.
 *
 * SLIDES-1 (Alex's ruling, overrides the Jul-16 faithful-mirror design): the
 * deck is SLIDES ONLY. The former live section (the real TruthMachineView /
 * TaskListView / TaskRowView / EvolutionTimelineView / InspectionDrawer
 * mounted on the example project) is REMOVED — no deck mounts real app
 * components anymore. What remains is the narrative: hero terminal + the
 * seven slide panels + the free-account CTA.
 *
 * SHOW discipline: ZERO fetches in this file; zero paid-call paths; every
 * panel example-tagged.
 */

import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}


// The real verified daily caps (pipeBudget.ts:15; routineFireBudget.ts:18;
// execFireBudget.ts:16 — env-tunable defaults).
const CAPS_LINE = 'pipe 20/day · Routine 10/day · exec 5/day';

// ── dark slide shell (panel token family, same look as the other decks) ──────

function DarkSlide({ title, tag = 'Example project', children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        <ExampleTag text={tag} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────

function ProjectsHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Projects · the pipe</span>
        <ExampleTag text="Example project" />
      </div>
      {/* The REAL five stages (operations-pipe-run.ts:104-248) — never the
          two-stage banner version. */}
      <div className="mt-2 space-y-0.5 text-white/70">
        <p><span className="text-white/40">1</span> research <span className="text-white/40">— web-grounded, paid</span></p>
        <p><span className="text-white/40">2</span> fire audit <span className="text-white/40">— a read-only Claude Code Routine on the repo</span></p>
        <p><span className="text-white/40">3</span> wait for the real audit <span className="text-white/40">— up to 30 min; no audit, no tasks</span></p>
        <p><span className="text-white/40">4</span> fusion <span className="text-white/40">— goals + research + audit → tasks</span></p>
        <p><span className="text-white/40">5</span> tasks land <span className="text-brand-amber">pending review</span> <span className="text-white/40">— you accept or reject each</span></p>
      </div>
      <p className="mt-2 border-t border-panel-border pt-2 text-white/50">
        hard daily caps: <span className="text-white/80">{CAPS_LINE}</span>
      </p>
    </div>
  );
}

// ── THE 7 SLIDE PANELS (the inventory's causal order) ────────────────────────

/** 1. CREATE WITH GOALS — mirrors ProjectCreateForm: title + entity + optional
 *  date + the goal ListManager with the "I WANT to " verb prefix; badge
 *  "title + goals" (ProjectCreateForm.tsx:121-178). */
function CreatePanel() {
  return (
    <DarkSlide title="Create — title + goals, nothing else">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">title</span> <span className="text-white">Fix the food-truck site&rsquo;s online order form</span></p>
        <p><span className="text-white/40">entity</span> Maria&rsquo;s Food Truck <span className="text-white/40">· target date optional</span></p>
        <p className="mt-1 text-white/40">goal — what success looks like</p>
        <p>· <span className="text-brand-amber">I WANT to</span> <span className="text-white">have customers finish an order without errors</span></p>
        <p>· <span className="text-brand-amber">I WANT to</span> <span className="text-white">stop losing mobile orders</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          No problem statement, no diagnosis, no design required — a project is valid as
          <span className="text-white/80"> title + goals</span>. The machine does the rest.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 2. THE TRUTH MACHINE VIEW — mirrors TruthMachineView's five stage cards and
 *  the PromptBox contract: template black, YOUR inputs red, verified to rebuild
 *  the exact fired string (TruthMachineView.tsx:5-11,:183-246,:471-473). */
function TruthMachinePanel() {
  return (
    <DarkSlide title="The Truth Machine — every prompt visible">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">1 · inputs</span> your goals, verbatim</p>
        <p><span className="text-white/40">2 · research</span> <span className="rounded border border-brand-green/40 bg-brand-green/10 px-1 text-[9px] uppercase text-brand-green">auto</span> web-grounded findings → an editable output box</p>
        <p><span className="text-white/40">3 · audit</span> <span className="rounded border border-blue-400/40 bg-blue-400/10 px-1 text-[9px] uppercase text-blue-300">paste</span> a read-only Claude Code audit of the repo</p>
        <p><span className="text-white/40">4 · fusion</span> <span className="rounded border border-brand-green/40 bg-brand-green/10 px-1 text-[9px] uppercase text-brand-green">auto</span> goals + research + audit → proposed tasks</p>
        <p><span className="text-white/40">5 · plan</span> the live task list</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">prompt — <span className="text-brand-red font-bold">your inputs in red</span></p>
        <p className="text-white/80">PROJECT: <span className="text-brand-red">Fix the food-truck site&rsquo;s online order form</span></p>
        <p className="text-white/80">GOALS: <span className="text-brand-red">I WANT customers to finish an order without errors…</span></p>
        <p className="text-white/50">The red spans are server-declared segments, verified to rebuild the exact string that fires — never a guess.</p>
        <p className="text-brand-amber">&ldquo;Nothing is saved until you accept.&rdquo;</p>
      </div>
    </DarkSlide>
  );
}

/** 3. THE PIPE RUNS — the real five stages incl. fire-audit + waitForEvent +
 *  the token-guarded ingest (operations-pipe-run.ts:104-248;
 *  audit-ingest/route.ts:40-111). The truth guard: NOT the banner's two. */
function PipePanel() {
  return (
    <DarkSlide title="⚡ run pipe — five real stages, no shortcuts">
      <div className="space-y-1 text-white/70">
        <p><span className="text-brand-green">✓</span> research <span className="float-right text-white/40">paid call 1 · findings saved</span></p>
        <p><span className="text-brand-green">✓</span> fire audit <span className="float-right text-white/40">Routine fired · correlation id stored</span></p>
        <p><span className="text-brand-amber">…</span> wait for the real audit <span className="float-right text-white/40">up to 30 min · costs nothing while waiting</span></p>
        <p className="pl-4 text-white/50">the audit posts back through a token-guarded door: bearer secret first, and the correlation id must match the stored fire — else rejected</p>
        <p><span className="text-brand-green">✓</span> fusion <span className="float-right text-white/40">paid call 2 · reads the REAL audit</span></p>
        <p><span className="text-brand-green">✓</span> 3 tasks land <span className="text-brand-amber">pending review</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          The audit is mandatory: if it never lands, the pipe <span className="text-brand-red">fails loud</span> —
          it never proceeds on an empty audit and never invents tasks.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 4. TASKS LAND PENDING_REVIEW — mirrors the task list's pending rows
 *  (purple "pending review" pill sorted first, projects/[id]/tasks/route.ts:27;
 *  ✓ accept / ✕ reject, TaskRowView.tsx:185-206; per-task audit rows,
 *  operations-pipe-run.ts:226-246). */
function PendingPanel() {
  return (
    <DarkSlide title="Tasks land as pending review — the checkpoint">
      <div className="space-y-1 text-white/70">
        {[
          ['Fix the mobile submit dead-zone', 'audit: order-form.tsx:214'],
          ['Widen the phone validation', 'audit: checkout.ts:88'],
          ['Add an order-received screen', 'audit: routes/order.ts:41'],
        ].map(([title, cite]) => (
          <p key={title}>
            <span className="rounded bg-purple-400/20 px-1 text-[9px] uppercase text-purple-300">pending review</span>{' '}
            <span className="text-white">{title}</span>
            <span className="float-right"><span className="text-purple-300">✓ accept</span> · <span className="text-white/50">✕ reject</span></span>
            <br /><span className="pl-4 text-white/50">{cite}</span>
          </p>
        ))}
        <p className="border-t border-panel-border pt-1 text-white/50">
          Every task cites the finding it came from, and every landed task writes a hash-chained
          audit row. Auto-fired work never becomes live work without your ✓.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 5. ACCEPT = BUILD — the accept transition fires the execution Routine
 *  (tasks/[taskId]/route.ts:403-427). TRUTH GUARD: the tab shows only
 *  "building… PR incoming" (TaskRow.tsx:341) — the PR lands on GitHub, not in
 *  the tab (pr_url is never rendered, inventory §A6.1). */
function AcceptPanel() {
  return (
    <DarkSlide title="✓ accept = build">
      <div className="space-y-1 text-white/70">
        <p><span className="text-purple-300">✓ accept</span> → the task flips to <span className="text-white">open</span> — and fires a build Routine for it</p>
        <p className="text-brand-green">building… PR incoming</p>
        <p className="text-white/50">One task, one pull request — it lands on GitHub for review, and a human merges it. The tab tells you the build started; the PR itself lives in the repo.</p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/50">over the cap? </span><span className="text-brand-red">&ldquo;could not start execution — daily execution limit reached&rdquo;</span></p>
        <p className="text-white/50">Execution is capped at <span className="text-white/80">5 fires/day</span> — a runaway loop cannot spend the night building.</p>
      </div>
    </DarkSlide>
  );
}

/** 6. SCHEDULE + EVOLVE — the ↗ schedule seam (TaskRow.tsx:207-232) and the
 *  ↻ evolve loop (TruthMachineView.tsx:488-557) + the evolution timeline. */
function EvolvePanel() {
  return (
    <DarkSlide title="Schedule it · evolve it">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/80">↗ schedule</span> <span className="text-white/50">→</span> <span className="text-brand-green">&ldquo;scheduled for 2026-07-16&rdquo;</span> <span className="text-white/50">— the task lands on your daily plan</span></p>
        <p className="mt-1 border-t border-panel-border pt-1"><span className="text-white/80">↻ evolve — new goals, loop again</span></p>
        <p className="text-white/50">Edit your goals and re-run the whole pipe. Append-only: prior tasks stay in the timeline; nothing is deleted.</p>
        <p className="mt-1 text-white/40">EVOLUTION</p>
        <p>v1 <span className="text-white/50">claude-sonnet-4-6 · $0.0119 · 1,420 in · 510 out · 1 task</span></p>
        <p>v2 <span className="text-white/50">claude-sonnet-4-6 · $0.0148 · 1,730 in · 640 out · 3 tasks</span></p>
      </div>
    </DarkSlide>
  );
}

/** 7. THE RECEIPTS — mirrors InspectionDrawer (ai/InspectionDrawer.tsx:74-166)
 *  + the real price table (client.ts:44,48) + the verbatim cap messages. */
function ReceiptsPanel() {
  return (
    <DarkSlide title="🔍 inspect this inference — the receipts">
      <div className="space-y-1 text-white/70">
        <p className="text-white/80">claude-sonnet-4-6 · $0.0148 · 1,730 in · 640 out</p>
        <p className="text-white/50">model · temperature 0.3 · max tokens 16,000</p>
        <p className="text-white/50">system prompt · user message · raw response — verbatim, no truncation</p>
        <p><span className="text-white/40">operations_ai_usage row id</span> <span className="text-white/80">demo-usage-fusion-v2</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">pricing: <span className="text-white/80">$3/M in · $15/M out</span> · every paid call writes an immutable usage row</p>
        <p className="text-white/50">and the caps fail loud, verbatim: <span className="text-brand-red">&ldquo;AI pipe daily limit reached — 20/20 calls used today&rdquo;</span></p>
      </div>
    </DarkSlide>
  );
}


// ── CTA — the HONEST unlock: a free account (no tab:projects entitlement
//    exists; ModuleLauncher gates this tab by auth only — header comment). ──

function FreeAccountCta({ onRequireAuth, label, valueLine }: Props & { label: string; valueLine: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-8 text-center">
      <div className="space-y-1">
        <p className="text-base font-bold text-text-primary">{label} — built and running</p>
        <p className="text-sm text-text-muted">{valueLine}</p>
      </div>
      <button
        type="button"
        onClick={onRequireAuth}
        className="rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
      >
        Make my free account
      </button>
    </div>
  );
}

// ── THE DECK ─────────────────────────────────────────────────────────────────

export default function ProjectsShowcase({ onRequireAuth }: Props) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Projects — the Truth Machine',
        headline: 'Goals in. Audited tasks out.',
        subcopy:
          'Type your goals in plain words. The pipe researches them on the live web, fires a real read-only code audit, waits for the findings, and fuses all of it into tasks — which land as pending review, never as silent work. You accept each one; accepting fires the build. Every prompt is visible, every inference has a receipt, and every paid call counts against a hard daily cap.',
        cta: (
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
          >
            Make my free account
          </button>
        ),
        panel: <ProjectsHeroTerminal />,
      }}
      editorialTitle="Go further with the Projects tab"
      editorialRows={[
        {
          title: 'A project starts as goals in your own words.',
          copy:
            'Title, entity, and what you want — "I WANT to…" — one line each. No problem statement, no plan, no jargon required. The machine builds the rest from reality, not from a form you had to fill perfectly.',
          panel: <CreatePanel />,
          panelSide: 'left',
        },
        {
          title: 'The Truth Machine shows you everything it fires.',
          copy:
            'Five stages on one screen: your inputs, the research, the code audit, the fusion, the plan. Every prompt renders exactly as it fires — template text in black, your injected words in red, verified to rebuild the precise string. And nothing is saved until you accept.',
          panel: <TruthMachinePanel />,
          panelSide: 'right',
        },
        {
          title: 'One button runs the whole pipe — all five real stages.',
          copy:
            'Research is paid and web-grounded. The audit is a real read-only Claude Code Routine on the repository, and the pipe suspends — up to thirty minutes, costing nothing — until the findings come back through a token-guarded door that checks a stored correlation id. No audit, no tasks: it fails loud rather than proceed on emptiness.',
          panel: <PipePanel />,
          panelSide: 'left',
        },
        {
          title: 'Auto-generated work waits for your ✓.',
          copy:
            'Fused tasks land as pending review — sorted to the top, each citing the file and line of the finding it came from, each writing a hash-chained audit row. Accept makes it real work; reject cancels it with history preserved. The machine proposes; you decide.',
          panel: <PendingPanel />,
          panelSide: 'right',
        },
        {
          title: 'Accepting a task starts the build.',
          copy:
            'The moment you accept, an execution Routine fires for that one task — one task, one pull request, reviewed and merged by a human on GitHub. The tab tells you the build started; execution is capped at five fires a day, and over the cap it refuses loudly.',
          panel: <AcceptPanel />,
          panelSide: 'left',
        },
        {
          title: 'Schedule it. Then evolve it.',
          copy:
            'Accepted tasks jump to your daily plan with one click. When a round is done, edit your goals and loop the pipe again — append-only, with every prior version kept in the evolution timeline, model and cost included.',
          panel: <EvolvePanel />,
          panelSide: 'right',
        },
        {
          title: 'Every inference has a receipt.',
          copy:
            'Model, temperature, max tokens, both prompts, the raw response, exact token counts, the cost, and the immutable usage-row id — one click away, verbatim, untruncated. And the spend is capped by construction: twenty pipe calls, ten Routine fires, five builds a day.',
          panel: <ReceiptsPanel />,
          panelSide: 'left',
        },
      ]}
      // SLIDES-1: slides only — no live section, no preSteps/sample. The
      // server pipe is described in the slides, never simulated or mounted.
      cta={
        <FreeAccountCta
          onRequireAuth={onRequireAuth}
          label="Projects"
          valueLine="Free with your account — scope real projects, run the pipe on your own goals, and keep every receipt."
        />
      }
    />
  );
}
