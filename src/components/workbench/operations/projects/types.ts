/**
 * Shared types for the Operations Projects surface (Section D).
 *
 * Project mirrors the operations_projects Prisma model 1:1. Bridgewater
 * 5-step scoping fields (goal/problem/diagnosis/design) are required at
 * the DB layer (NOT NULL), enforced server-side, and required in the
 * form-side type below.
 *
 * The 5th step (execute) is the project's tasks, lives in a child table
 * (operations_project_tasks), shipped in PR-Ops-3b.
 */

export type ProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'archived'
  // BACKLOG-01 (Alex, 2026-10-20): a captured project lands in the backlog, is
  // scoped on its row, is scheduled, or is dropped. The six above stay.
  | 'backlog'
  | 'scoped'
  | 'scheduled'
  | 'dropped';

/** BACKLOG-01: what kind of work — required at capture; null on a row captured before. */
export type ProjectType = 'engineering' | 'accounting' | 'content' | 'travel' | 'ops';
/** BACKLOG-01: how big — optional at capture; null is "not sized". */
export type ProjectSize = 'S' | 'M' | 'L';
export const PROJECT_TYPES: readonly ProjectType[] = ['engineering', 'accounting', 'content', 'travel', 'ops'];
export const PROJECT_SIZES: readonly ProjectSize[] = ['S', 'M', 'L'];

export interface Project {
  id: string;
  user_id: string;
  entity_id: string;
  title: string;
  goal: string | null;
  problem: string | null;
  diagnosis: string | null;
  design: string | null;
  goal_items: string[];
  problem_items: string[];
  diagnosis_items: string[];
  deep_research_input: string | null;
  claude_code_audit_input: string | null;
  status: ProjectStatus;
  // BACKLOG-01 (Alex, 2026-10-20): the capture's columns, 1:1 with the migration.
  // null is "not stated" (a row captured before reads "—"); links [] is "no links".
  // rank and the three dates are read here and written only by BACKLOG-02/03.
  type: ProjectType | null;
  size: ProjectSize | null;
  why: string | null;
  definition_of_done: string | null;
  links: string[];
  notes: string | null;
  // BACKLOG-01b (Alex, 2026-10-20): the brief's three — 4 ALREADY RULED, 5 WANT A
  // RECOMMENDATION ON, and the reason for the target date (6 BY WHEN, AND WHY).
  rulings: string | null;
  open_questions: string | null;
  deadline_reason: string | null;
  rank: number | null;
  promoted_at: string | null;
  scheduled_at: string | null;
  done_at: string | null;
  target_completion_date: string | null;
  estimated_total_minutes: number | null;
  estimated_total_cost_usd: string | null;
  priority_score: string | null;
  priority_inputs_hash: string | null;
  priority_computed_at: string | null;
  priority_rationale: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // PD-2: present on the queue list response (/api/operations/projects GET). Optional
  // because other fetches of a Project don't compute them.
  task_count?: number;
  run_count?: number;
  // PROJECTS-UX-2: REAL ledger money allocated to this project (the DIM
  // ledger_line_links rollup, computed server-side in /api/operations/projects
  // — read-only, user-scoped, D−C netted, coverage declared). Distinct from
  // the self-reported estimated/actual_cost_usd fields. An object when links
  // exist; null when none; ABSENT when the rollup read failed — the display
  // renders NOTHING in both non-object cases (absence is honest).
  ledger_allocated?: {
    cents: number;
    dollars: string;
    link_count: number;
    line_count: number;
  } | null;
}

/**
 * Form-side shape: writable fields only.
 *
 * status is excluded from the create-form (server defaults to 'not_started')
 * but writable on edit. The full ProjectForm includes status because the
 * editor handles both create and edit. status changes audit-discriminate
 * server-side via operations_project_status_changed (vs. plain _updated).
 *
 * BACKLOG-01 (Alex, 2026-10-20): the capture form sends type (required —
 * '' is unchosen, refused by name), why (required), size ('' is not sized),
 * definition_of_done, links (a list; the form types one per line) and notes;
 * the POST sets status 'backlog' itself and ignores the form's status. The
 * edit view sends the same fields on PATCH.
 *
 * BACKLOG-01b (Alex, 2026-10-20) — one fact, one home: problem (1 WHAT IS WRONG
 * TODAY), why (2 WHY IT MATTERS) and goal (3 THE ONE CORRECT OUTCOME) are the
 * capture's three required texts; rulings (4), open_questions (5) and
 * deadline_reason (6, required with a target date) join; diagnosis is THE AUDIT
 * and design THE PLAN, pasted back on the row. goalItems / problemItems /
 * diagnosisItems stay here for one release: no form writes them — the edit
 * form round-trips the row's own values untouched (CLEAN-03 rules on dropping).
 */
export interface ProjectForm {
  entity_id: string;
  title: string;
  design: string;
  goalItems: string[];
  problemItems: string[];
  diagnosisItems: string[];
  status: ProjectStatus;
  type: ProjectType | '';
  size: ProjectSize | '';
  problem: string;
  why: string;
  goal: string;
  diagnosis: string;
  rulings: string;
  open_questions: string;
  deadline_reason: string;
  definition_of_done: string;
  links: string[];
  notes: string;
  target_completion_date: string;          // ISO date (yyyy-mm-dd) or empty
  estimated_total_minutes: string;         // string for input binding; coerced server-side
  estimated_total_cost_usd: string;        // string for decimal fidelity
  claude_code_audit_input: string;         // pasted Claude Code audit; grounds plan/task generation
}

export const DEFAULT_PROJECT_FORM: ProjectForm = {
  entity_id: '',
  title: '',
  design: '',
  goalItems: [],
  problemItems: [],
  diagnosisItems: [],
  status: 'not_started',
  type: '',
  size: '',
  problem: '',
  why: '',
  goal: '',
  diagnosis: '',
  rulings: '',
  open_questions: '',
  deadline_reason: '',
  definition_of_done: '',
  links: [],
  notes: '',
  target_completion_date: '',
  estimated_total_minutes: '',
  estimated_total_cost_usd: '',
  claude_code_audit_input: '',
};

/**
 * Display-side metadata for the status pill.
 */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'not started',
  in_progress: 'in progress',
  blocked: 'blocked',
  completed: 'completed',
  cancelled: 'cancelled',
  archived: 'archived',
  // BACKLOG-01 (Alex, 2026-10-20): the four new words, lower-case like the six.
  backlog: 'backlog',
  scoped: 'scoped',
  scheduled: 'scheduled',
  dropped: 'dropped',
};

export const STATUS_PILL_CLASSES: Record<ProjectStatus, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-800',
  blocked: 'bg-amber-50 text-amber-800',
  completed: 'bg-green-50 text-green-800',
  cancelled: 'bg-gray-50 text-gray-500',
  archived: 'bg-gray-50 text-gray-400',
  // BACKLOG-01: backlog reads like not started (unscoped), scoped purple, scheduled blue like in progress, dropped like cancelled.
  backlog: 'bg-gray-100 text-gray-700',
  scoped: 'bg-purple-50 text-purple-800',
  scheduled: 'bg-blue-50 text-blue-800',
  dropped: 'bg-gray-50 text-gray-500',
};

/** BACKLOG-01: the type and size words on the project cell's pills and the two selects. */
export const TYPE_LABELS: Record<ProjectType, string> = {
  engineering: 'engineering',
  accounting: 'accounting',
  content: 'content',
  travel: 'travel',
  ops: 'ops',
};

export const SIZE_LABELS: Record<ProjectSize, string> = {
  S: 'small',
  M: 'medium',
  L: 'large',
};

/**
 * ============================================================================
 * Tasks (PR-Ops-3b) — Step 5 of Bridgewater scoping. Atomic execution units
 * inside a project. Each task lives in operations_project_tasks with FK CASCADE
 * to its parent project. entity_id is server-inherited from the parent project
 * (denormalized for index speed; never independently chosen).
 * ============================================================================
 */

export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'archived'
  | 'pending_review';

export interface Task {
  id: string;
  project_id: string;
  user_id: string;
  entity_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimated_minutes: number | null;
  estimated_cost_usd: string | null;
  deadline: string | null;
  priority_score: string | null;
  priority_inputs_hash: string | null;
  priority_computed_at: string | null;
  priority_rationale: string | null;
  unblocks_label: string | null;
  link_url: string | null;
  notes: string | null;
  coa_code: string | null;
  actual_cost_usd: string | null;
  actual_minutes: number | null;
  display_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Form-side shape for task editing. Excludes server-managed fields
 * (id, project_id, user_id, entity_id, timestamps, priority_*, completed_at,
 * created_by, display_order). entity_id is inherited server-side from the
 * parent project; the client never sets it.
 */
export interface TaskForm {
  title: string;
  description: string;
  status: TaskStatus;
  estimated_minutes: string;        // string for input binding
  estimated_cost_usd: string;       // string for decimal fidelity
  deadline: string;                 // ISO date (yyyy-mm-dd) or empty
  unblocks_label: string;
  link_url?: string;
  notes?: string;
  coa_code: string;                 // '' represents null
  actual_minutes: string;           // '' represents null; string for input binding
  actual_cost_usd: string;          // '' represents null; string for decimal fidelity
}

export const DEFAULT_TASK_FORM: TaskForm = {
  title: '',
  description: '',
  status: 'open',
  estimated_minutes: '',
  estimated_cost_usd: '',
  deadline: '',
  unblocks_label: '',
  coa_code: '',
  actual_minutes: '',
  actual_cost_usd: '',
};

/**
 * Minimal COA-account shape used by the task UI's category dropdown.
 * Sourced from GET /api/chart-of-accounts?entity_id=<eid>. The /api endpoint
 * filters out archived rows server-side, so consumers can trust the list.
 */
export interface CoaAccountSummary {
  code: string;
  name: string;
  account_type: string;
  entity_id: string;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'new',
  in_progress: 'in process',
  blocked: 'blocked',
  completed: 'done',
  cancelled: 'cancelled',
  archived: 'archived',
  // PHASE2-1: auto-fired tasks land here awaiting the user's accept (→ open).
  pending_review: 'pending review',
};

export const TASK_STATUS_PILL_CLASSES: Record<TaskStatus, string> = {
  open: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-800',
  blocked: 'bg-amber-50 text-amber-800',
  completed: 'bg-green-50 text-green-800',
  cancelled: 'bg-gray-50 text-gray-500',
  archived: 'bg-gray-50 text-gray-500',
  // PHASE2-1: amber-on-purple "awaiting your review" — distinct from open/in-process.
  pending_review: 'bg-purple-50 text-purple-800',
};

/**
 * ============================================================================
 * Dependencies (PR-Ops-3c) — Project-to-project edges. Three types:
 *   - blocks: source can't complete until target completes (acyclic constraint;
 *     cycle detection enforced server-side via DFS over blocks-only graph)
 *   - informs: source should reference target (advisory; mutual cycles allowed)
 *   - derived_from: source's design originated from target (advisory; cycles
 *     describe mislabeling, not a logic bug)
 * ============================================================================
 */

export type DependencyType = 'blocks' | 'informs' | 'derived_from';

export interface Dependency {
  id: string;
  project_id: string;
  depends_on_project_id: string;
  dependency_type: DependencyType;
  rationale: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Hydrated dependency for UI rendering — joins the target project's
 * title for display ("blocked by: Trading Pipeline and MVP").
 * Returned by GET endpoint, never written by client.
 */
export interface HydratedDependency extends Dependency {
  depends_on_project_title: string;
  depends_on_project_status: string;
}

/**
 * Inverse direction: when a project is the TARGET of someone else's
 * dependency edge, the UI shows it as "this project blocks: X".
 */
export interface InverseDependency extends Dependency {
  project_title: string;
  project_status: string;
}

/**
 * Form-side shape for creating a dependency.
 */
export interface DependencyForm {
  depends_on_project_id: string;
  dependency_type: DependencyType;
  rationale: string;
}

export const DEFAULT_DEPENDENCY_FORM: DependencyForm = {
  depends_on_project_id: '',
  dependency_type: 'blocks',
  rationale: '',
};

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  blocks: 'blocks',
  informs: 'informs',
  derived_from: 'derived from',
};

export const DEPENDENCY_TYPE_DESCRIPTIONS: Record<DependencyType, string> = {
  blocks: 'this project cannot complete until the target completes (hard ordering)',
  informs: 'this project should reference the target (advisory, mutual cycles allowed)',
  derived_from: "this project's design originated from the target (lineage)",
};

// PROJECTS-UX-2: display formatter for allocated ledger cents (server-rounded
// integer cents). Display only — locale formatting, sign rendered as a leading
// minus for net-credit projects. Callers render NOTHING for a missing rollup.
export function formatAllocatedCents(cents: number): string {
  const abs = (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? '−' : ''}$${abs}`;
}
