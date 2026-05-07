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
  goal: string;
  problem: string;
  diagnosis: string;
  design: string;
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
  goal: string;
  problem: string;
  diagnosis: string;
  design: string;
  status: ProjectStatus;
  target_completion_date: string;          // ISO date (yyyy-mm-dd) or empty
  estimated_total_minutes: string;         // string for input binding; coerced server-side
  estimated_total_cost_usd: string;        // string for decimal fidelity
}

export const DEFAULT_PROJECT_FORM: ProjectForm = {
  entity_id: '',
  title: '',
  goal: '',
  problem: '',
  diagnosis: '',
  design: '',
  status: 'not_started',
  target_completion_date: '',
  estimated_total_minutes: '',
  estimated_total_cost_usd: '',
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
  not_started: 'bg-gray-100 text-gray-700 border-gray-300',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-300',
  blocked: 'bg-amber-50 text-amber-800 border-amber-300',
  completed: 'bg-green-50 text-green-800 border-green-300',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  archived: 'bg-gray-50 text-gray-400 border-gray-200',
};
