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
 * MOUNTABILITY (inventory §A5 — the showroom precedent proves the seams):
 *  • MOUNTED LIVE (zero-fetch pure views, every callback → one inert lock →
 *    signup): TruthMachineView (props seam :45-95) with the REAL TaskListView/
 *    TaskRowView as its plan slot (incl. pending_review ✓ accept / ✕ reject,
 *    TaskRowView.tsx:185-206), EvolutionTimelineView, InspectionDrawer.
 *  • AITaskPreview is NOT mounted (tasksPreview=null): its "accept all"
 *    self-POSTs bulk-create (inventory action-fetch caveat).
 *  • Everything self-fetching (SectionD, ProjectRow, the containers) is
 *    described in slides, never mounted.
 *
 * EXAMPLE DATA — one project's story end-to-end (declared, example-tagged):
 * Maria's food-truck WEBSITE order-form fix — a small software project, so the
 * Claude Code audit stage is truthful (the audit Routine audits a repo).
 * Costs are COMPUTED from the real price table (client.ts:44,48 — $3/M in,
 * $15/M out): v1 1,420 in + 510 out → $0.0119; v2 1,730 in + 640 out →
 * $0.0148. The inference receipt IS v2's fusion run (same numbers).
 * PromptPreview segments satisfy the real no-drift contract: copyText is
 * BUILT by joining the segments, so join(segments) === the copyable string
 * (TruthMachineView.tsx:5-11).
 *
 * SHOW discipline: ZERO fetches in this file; zero paid-call paths; every
 * panel example-tagged.
 */

import TruthMachineView, { type PromptPreview, type PromptSegmentDTO } from '@/components/workbench/operations/projects/TruthMachineView';
import TaskListView from '@/components/workbench/operations/projects/TaskListView';
import TaskRowView from '@/components/workbench/operations/projects/TaskRowView';
import EvolutionTimelineView, { type EvolutionResponse } from '@/components/workbench/operations/projects/EvolutionTimelineView';
import InspectionDrawer, { type InspectionData } from '@/components/workbench/operations/ai/InspectionDrawer';
import { DEFAULT_TASK_FORM, type Project, type Task, type CoaAccountSummary } from '@/components/workbench/operations/projects/types';
import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}

// ── the example project (one story end-to-end through every slide) ──────────

const DEMO_USER = 'demo-user';
const DEMO_ENTITY = 'demo-entity-truck';
const PROJECT_ID = 'demo-project-orderform';

const EX_PROJECT: Project = {
  id: PROJECT_ID,
  user_id: DEMO_USER,
  entity_id: DEMO_ENTITY,
  title: "Fix the food-truck site's online order form",
  goal: null,
  problem: null,
  diagnosis: null,
  design: null,
  goal_items: [
    'I WANT customers to finish an order without errors',
    'I WANT to stop losing mobile orders',
  ],
  problem_items: [],
  diagnosis_items: [],
  // The two reality inputs, POPULATED — the machine mid-flight (the old
  // showroom's seed left these null; the deck shows the real pipe with fuel).
  deep_research_input:
    'Mobile checkout drop-off clusters on forms with touch-unfriendly submit ' +
    'targets and strict phone validation (ground truth: your order logs show ' +
    '19% mobile submit failures). Confirmation screens measurably cut ' +
    'abandoned orders (estimate).',
  claude_code_audit_input:
    'order-form.tsx:214 — submit handler bound to onMouseDown only; touch ' +
    'events never fire on mobile.\n' +
    'checkout.ts:88 — the phone regex rejects dashes; valid numbers fail ' +
    'validation.\n' +
    'routes/order.ts:41 — no confirmation screen; the route returns raw JSON.',
  status: 'in_progress',
  target_completion_date: '2026-08-01',
  estimated_total_minutes: 150,
  estimated_total_cost_usd: '0.00',
  priority_score: null,
  priority_inputs_hash: null,
  priority_computed_at: null,
  priority_rationale: null,
  created_at: '2026-06-20T09:00:00.000Z',
  updated_at: '2026-07-10T10:30:00.000Z',
  created_by: DEMO_USER,
};

// The plan: one accepted-and-done task (the v1 round) + the three v2 tasks
// sitting at the pending_review checkpoint, each description citing the
// audit's file:line finding it came from (that is what fusion-from-audit
// tasks look like; the checkpoint is operations-pipe-run.ts:219).
const EX_TASKS: Task[] = [
  {
    id: 'demo-task-repro',
    project_id: PROJECT_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY,
    title: 'Reproduce the mobile order failure',
    description: 'Confirm the submit dead-zone on a real phone and capture the failing request.',
    status: 'completed',
    estimated_minutes: 30,
    estimated_cost_usd: null,
    deadline: '2026-07-01',
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'proves where orders are lost',
    link_url: null,
    notes: null,
    coa_code: null,
    actual_cost_usd: null,
    actual_minutes: 25,
    display_order: 1,
    completed_at: '2026-07-02T15:00:00.000Z',
    created_at: '2026-06-20T09:10:00.000Z',
    updated_at: '2026-07-02T15:00:00.000Z',
    created_by: DEMO_USER,
  },
  {
    id: 'demo-task-touch',
    project_id: PROJECT_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY,
    title: 'Fix the mobile submit dead-zone',
    description: 'audit: order-form.tsx:214 — the handler is bound to onMouseDown only; bind click so touch fires.',
    status: 'pending_review',
    estimated_minutes: 45,
    estimated_cost_usd: null,
    deadline: null,
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'mobile orders can complete',
    link_url: null,
    notes: null,
    coa_code: null,
    actual_cost_usd: null,
    actual_minutes: null,
    display_order: 2,
    completed_at: null,
    created_at: '2026-07-10T10:30:00.000Z',
    updated_at: '2026-07-10T10:30:00.000Z',
    created_by: DEMO_USER,
  },
  {
    id: 'demo-task-phone',
    project_id: PROJECT_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY,
    title: 'Widen the phone validation',
    description: 'audit: checkout.ts:88 — the regex rejects dashes; widen the pattern and add a test.',
    status: 'pending_review',
    estimated_minutes: 30,
    estimated_cost_usd: null,
    deadline: null,
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'real numbers pass checkout',
    link_url: null,
    notes: null,
    coa_code: null,
    actual_cost_usd: null,
    actual_minutes: null,
    display_order: 3,
    completed_at: null,
    created_at: '2026-07-10T10:30:00.000Z',
    updated_at: '2026-07-10T10:30:00.000Z',
    created_by: DEMO_USER,
  },
  {
    id: 'demo-task-confirm',
    project_id: PROJECT_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY,
    title: 'Add an order-received screen',
    description: 'audit: routes/order.ts:41 — the route returns raw JSON; research: explicit confirmation cuts abandonment.',
    status: 'pending_review',
    estimated_minutes: 60,
    estimated_cost_usd: null,
    deadline: null,
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'customers know the order landed',
    link_url: null,
    notes: null,
    coa_code: null,
    actual_cost_usd: null,
    actual_minutes: null,
    display_order: 4,
    completed_at: null,
    created_at: '2026-07-10T10:30:00.000Z',
    updated_at: '2026-07-10T10:30:00.000Z',
    created_by: DEMO_USER,
  },
];

const EX_COA: CoaAccountSummary[] = [
  { code: '5000', name: 'Food and Supplies', account_type: 'expense', entity_id: DEMO_ENTITY },
  { code: '6100', name: 'Website & Software', account_type: 'expense', entity_id: DEMO_ENTITY },
];

// Evolution: v1 (one task, completed) → v2 (the three pending tasks). Costs
// computed from the real table (client.ts:44,48): v1 = 1,420/1e6·$3 +
// 510/1e6·$15 = $0.0119; v2 = 1,730/1e6·$3 + 640/1e6·$15 = $0.0148.
const EX_EVOLUTION: EvolutionResponse = {
  project_id: PROJECT_ID,
  versions: [
    {
      version_number: 1,
      usage_id: 'demo-usage-fusion-v1',
      created_at: '2026-06-20T09:10:00.000Z',
      model: 'claude-sonnet-4-6',
      purpose: 'generate-tasks',
      input_tokens: 1420,
      output_tokens: 510,
      cost_usd: '0.0119',
      task_count: 1,
      tasks: [
        { id: 'demo-task-repro', title: 'Reproduce the mobile order failure', status: 'completed' },
      ],
    },
    {
      version_number: 2,
      usage_id: 'demo-usage-fusion-v2',
      created_at: '2026-07-10T10:30:00.000Z',
      model: 'claude-sonnet-4-6',
      purpose: 'generate-tasks',
      input_tokens: 1730,
      output_tokens: 640,
      cost_usd: '0.0148',
      task_count: 3,
      tasks: [
        { id: 'demo-task-touch', title: 'Fix the mobile submit dead-zone', status: 'pending_review' },
        { id: 'demo-task-phone', title: 'Widen the phone validation', status: 'pending_review' },
        { id: 'demo-task-confirm', title: 'Add an order-received screen', status: 'pending_review' },
      ],
    },
  ],
  unversioned: [],
  unversioned_count: 0,
};

// The receipt IS v2's fusion run — model/temp/maxTokens are the REAL fusion
// engine parameters (generateProjectTasks.ts:230-261: sonnet-4-6, 16000, 0.3).
const EX_INSPECTION: InspectionData = {
  model: 'claude-sonnet-4-6',
  temperature: 0.3,
  maxTokens: 16000,
  systemPrompt:
    'You are the fusion engine. Fuse the goals, the research, and the code audit into atomic, verifiable tasks. Never invent findings — every task must trace to an input.',
  userMessage:
    "PROJECT: Fix the food-truck site's online order form\nGOALS:\n- I WANT customers to finish an order without errors\n- I WANT to stop losing mobile orders\nRESEARCH: (as saved)\nAUDIT: order-form.tsx:214 …; checkout.ts:88 …; routes/order.ts:41 …",
  rawResponse:
    '{"tasks":[{"title":"Fix the mobile submit dead-zone","description":"audit: order-form.tsx:214 — …"},{"title":"Widen the phone validation","description":"audit: checkout.ts:88 — …"},{"title":"Add an order-received screen","description":"audit: routes/order.ts:41 — …"}]}',
  inputTokens: 1730,
  outputTokens: 640,
  costUsd: '0.0148',
  usageId: 'demo-usage-fusion-v2',
};

// PromptPreview — copyText BUILT from the segments so join(segments) equals
// the copyable string (the real no-drift contract, TruthMachineView.tsx:5-11).
const joinSegs = (segs: PromptSegmentDTO[]) => segs.map((s) => s.text).join('');

const RESEARCH_SEGS: PromptSegmentDTO[] = [
  { kind: 'template', text: 'PROJECT: ' },
  { kind: 'input', text: "Fix the food-truck site's online order form" },
  { kind: 'template', text: '\nGOALS:\n- ' },
  { kind: 'input', text: 'I WANT customers to finish an order without errors' },
  { kind: 'template', text: '\n- ' },
  { kind: 'input', text: 'I WANT to stop losing mobile orders' },
  { kind: 'template', text: '\n\nResearch the goals above. Web-search, then write findings as plain prose. Label model/estimate vs ground truth.' },
];
const AUDIT_SEGS: PromptSegmentDTO[] = [
  { kind: 'template', text: 'Read-only audit of the repository behind: ' },
  { kind: 'input', text: "Fix the food-truck site's online order form" },
  { kind: 'template', text: '\nCite file:line for every finding. Change nothing.' },
];
const FUSION_SEGS: PromptSegmentDTO[] = [
  { kind: 'template', text: 'Fuse goals + research + audit into atomic tasks for: ' },
  { kind: 'input', text: "Fix the food-truck site's online order form" },
  { kind: 'template', text: '\nRESEARCH:\n' },
  { kind: 'input', text: 'Mobile checkout drop-off clusters on touch-unfriendly submit targets…' },
  { kind: 'template', text: '\nAUDIT:\n' },
  { kind: 'input', text: 'order-form.tsx:214 — submit bound to onMouseDown only…' },
];

const EX_PROMPTS: PromptPreview = {
  research: {
    systemPrompt: 'You are the research agent. Ground every claim; label estimates.',
    userMessage: joinSegs(RESEARCH_SEGS),
    segments: RESEARCH_SEGS,
  },
  audit: { text: joinSegs(AUDIT_SEGS), segments: AUDIT_SEGS },
  fusion: {
    systemPrompt: 'You are the fusion engine. Every task must trace to an input.',
    userMessage: joinSegs(FUSION_SEGS),
    segments: FUSION_SEGS,
  },
};

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

// ── THE LIVE SECTION — real zero-fetch views mounted on the example project ──

function StageTruthStrip({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-row/60 px-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green">Real component — mounted live</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <ExampleTag text="Example project" />
    </div>
  );
}

function LiveProjectsSection({ onRequireAuth }: Props) {
  // ONE inert handler for every callback across all mounted views (the
  // showroom-proven pattern): only the signup modal, never a fetch.
  const lock = () => onRequireAuth();
  const lockAsync = async () => onRequireAuth();
  void lockAsync;

  // The plan slot — the REAL TaskListView with REAL TaskRowView rows, incl.
  // the pending_review checkpoint (✓ accept / ✕ reject render because both
  // handlers are supplied, TaskRowView.tsx:185-206) — all locked.
  const taskSection = (
    <TaskListView
      tasks={EX_TASKS}
      loading={false}
      error={null}
      coaAccounts={EX_COA}
      showArchived={false}
      showCreate={false}
      createForm={DEFAULT_TASK_FORM}
      createSaving={false}
      createError={null}
      onShowArchivedChange={lock}
      onStartCreate={lock}
      onCancelCreate={lock}
      onCreateFormChange={lock}
      onCreate={lock}
      renderTaskRow={(task, index) => (
        <TaskRowView
          task={task}
          index={index}
          coaAccounts={EX_COA}
          expanded={false}
          editing={false}
          notesOpen={false}
          scheduleMenuOpen={false}
          form={DEFAULT_TASK_FORM}
          scheduleDate=""
          saving={false}
          completing={false}
          deleting={false}
          archiving={false}
          scheduling={false}
          error={null}
          scheduleSuccess={null}
          showHistory={false}
          history={null}
          historyLoading={false}
          historyError={null}
          onToggleExpanded={lock}
          onToggleNotes={lock}
          onEnterEdit={lock}
          onCancelEdit={lock}
          onFormChange={lock}
          onToggleScheduleMenu={lock}
          onCloseScheduleMenu={lock}
          onScheduleDateChange={lock}
          onSave={lock}
          onQuickComplete={lock}
          onToggleHistory={lock}
          onUncomplete={lock}
          onSchedule={lock}
          onDelete={lock}
          onArchive={lock}
          onUnarchive={lock}
          reviewing={false}
          reviewNotice={null}
          onAcceptPending={lock}
          onRejectPending={lock}
        />
      )}
    />
  );

  return (
    <div className="space-y-4">
      {/* THE TRUTH MACHINE — the real view, live (props seam :45-95). Both
          reality inputs populated; tasksPreview=null keeps AITaskPreview (its
          "accept all" self-POSTs) unmounted; pipeQueued=false keeps the
          two-stage banner unrendered (truth guard). Every button → signup. */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <StageTruthStrip label="The Truth Machine — the pipeline, end to end" />
        <div className="p-3">
          <TruthMachineView
            project={EX_PROJECT}
            onExit={lock}
            onRunPipe={lock}
            runningPipe={false}
            pipeQueued={false}
            pipeError={null}
            evolving={false}
            evolveGoalsText=""
            evolveSaving={false}
            evolveError={null}
            onEvolveStart={lock}
            onEvolveGoalsChange={lock}
            onEvolveConfirm={lock}
            onEvolveCancel={lock}
            prompts={EX_PROMPTS}
            promptsLoading={false}
            researchInput={EX_PROJECT.deep_research_input ?? ''}
            onResearchInputChange={lock}
            runningResearch={false}
            researchError={null}
            onRunResearch={lock}
            auditInput={EX_PROJECT.claude_code_audit_input ?? ''}
            onAuditInputChange={lock}
            savingInputs={false}
            inputsSaved={false}
            onSaveInputs={lock}
            generatingTasks={false}
            tasksGenError={null}
            tasksPreview={null}
            onGenerateTasks={lock}
            onTasksAccepted={lock}
            onTasksDiscarded={lock}
            taskSection={taskSection}
          />
        </div>
      </div>

      {/* THE EVOLUTION TIMELINE — the real read-only view (zero fetch,
          EvolutionTimelineView.tsx:42-46) on the two declared versions. */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <StageTruthStrip label="Evolution — every version kept" />
        <div className="p-3">
          <EvolutionTimelineView loading={false} error={null} data={EX_EVOLUTION} />
        </div>
      </div>

      {/* THE RECEIPT — the real InspectionDrawer (pure display,
          InspectionDrawer.tsx:44-52) on v2's fusion run. */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <StageTruthStrip label="The inference receipt" />
        <div className="p-3">
          <InspectionDrawer data={EX_INSPECTION} />
        </div>
      </div>

      <p className="text-xs text-text-muted">
        The Truth Machine view above — with the real task list and its pending-review checkpoint
        inside it — the evolution timeline, and the inference receipt are the real components,
        mounted live on one declared example project. They fetch nothing; every button routes to
        sign-up. The pipe&rsquo;s server side (the paid research call, the audit Routine, the
        30-minute wait, the token-guarded ingest) runs only for signed-in projects — the slides
        describe it; this page does not simulate it.
      </p>
    </div>
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
      // The connective line — claim = composition exactly (3 real mounted
      // blocks; the server pipe described, not simulated; zero fetches).
      preSteps={
        <p className="text-center text-sm text-text-secondary">
          Below is the real product on a declared example project. The Truth Machine view — with
          the real task list and its pending-review checkpoint inside it — the evolution timeline,
          and the inference receipt are the real components mounted live; they fetch nothing, and
          every button routes to sign-up. The pipe&rsquo;s server side (the paid research call, the
          audit Routine, the 30-minute wait, the token-guarded ingest) is described in the slides,
          not simulated here. Nothing on this page fetches.
        </p>
      }
      sample={<LiveProjectsSection onRequireAuth={onRequireAuth} />}
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
