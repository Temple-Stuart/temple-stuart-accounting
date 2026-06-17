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
  | 'archived';

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
}

/**
 * Form-side shape: writable fields only.
 *
 * status is excluded from the create-form (server defaults to 'not_started')
 * but writable on edit. The full ProjectForm includes status because the
 * editor handles both create and edit. status changes audit-discriminate
 * server-side via operations_project_status_changed (vs. plain _updated).
 */
export interface ProjectForm {
  entity_id: string;
  title: string;
  design: string;
  goalItems: string[];
  problemItems: string[];
  diagnosisItems: string[];
  status: ProjectStatus;
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
};

export const STATUS_PILL_CLASSES: Record<ProjectStatus, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-800',
  blocked: 'bg-amber-50 text-amber-800',
  completed: 'bg-green-50 text-green-800',
  cancelled: 'bg-gray-50 text-gray-500',
  archived: 'bg-gray-50 text-gray-400',
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
  | 'archived';

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
};

export const TASK_STATUS_PILL_CLASSES: Record<TaskStatus, string> = {
  open: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-800',
  blocked: 'bg-amber-50 text-amber-800',
  completed: 'bg-green-50 text-green-800',
  cancelled: 'bg-gray-50 text-gray-500',
  archived: 'bg-gray-50 text-gray-500',
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
