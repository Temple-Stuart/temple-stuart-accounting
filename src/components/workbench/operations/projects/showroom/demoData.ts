/**
 * Showroom demo seed — ONE rich, fully-populated project that fills the whole
 * Operations Projects pipeline so every pure view renders something real.
 *
 * PURE STATIC DATA. This module is a constant the Showroom (a later PR) always
 * renders. It is NOT a fallback and is never wired into a "try live then demo"
 * path — no live code imports it, the authed surface is untouched. No I/O here:
 * no fetch, no effect, no server import — just typed literals.
 *
 * Voice: plain, simple, 5th-grade. The project is a real-feeling small project
 * a normal person would recognize (getting a food-truck's books ready for tax
 * time), with a believable mix of task statuses, two project-to-project edges,
 * and a short two-version history.
 *
 * Every literal is typed against the SAME types the pure views import (Project,
 * Task, CoaAccountSummary, HydratedDependency, InverseDependency from ./types;
 * EvolutionResponse from ./EvolutionTimelineView). Shapes are never redefined
 * here. The `_check` block at the bottom proves each export is assignable to the
 * matching pure-view prop contract.
 */

import type {
  Project,
  Task,
  CoaAccountSummary,
  HydratedDependency,
  InverseDependency,
} from '../types';
import type { EvolutionResponse } from '../EvolutionTimelineView';
import type { ProjectRowViewProps, Entity } from '../ProjectRowView';
import type { TaskListViewProps } from '../TaskListView';
import type { TaskRowViewProps } from '../TaskRowView';
import type { DependencyListViewProps } from '../DependencyListView';
import type { EvolutionTimelineViewProps } from '../EvolutionTimelineView';

// Stable demo identifiers. Prefixed so they read clearly as showroom seed rows
// and never collide with real database ids.
const DEMO_USER = 'demo-user';
const DEMO_ENTITY_ID = 'demo-entity-truck';

const PROJECT_BOOKS_ID = 'demo-project-books';
const PROJECT_BANK_ID = 'demo-project-bank';
const PROJECT_BUDGET_ID = 'demo-project-budget';

// ── Entity ──────────────────────────────────────────────────────────────────
export const demoEntities: Entity[] = [
  { id: DEMO_ENTITY_ID, name: "Maria's Food Truck" },
];

// ── The featured project ────────────────────────────────────────────────────
// Status is "in progress": some steps are done, some are still going.
export const demoProject: Project = {
  id: PROJECT_BOOKS_ID,
  user_id: DEMO_USER,
  entity_id: DEMO_ENTITY_ID,
  title: 'Get the food truck books ready for tax time',
  // Legacy paragraph fields are null; the structured *_items below are used.
  goal: null,
  problem: null,
  diagnosis: null,
  design:
    'The plan is simple. First, keep every receipt in one folder so nothing ' +
    'gets lost. Next, pick one easy app to track money coming in and money ' +
    'going out. Then enter the sales and costs every week instead of waiting ' +
    'until the end of the year. Keep the truck money in its own bank account ' +
    'so it never mixes with home money. By tax time the numbers are already ' +
    'sorted and the real profit is clear.',
  goal_items: [
    'I want to file my taxes on time without stress',
    'I want to know how much money the truck really makes',
  ],
  problem_items: [
    'I have not kept my receipts in one place',
    'I keep mixing my home money with the truck money',
  ],
  diagnosis_items: [
    'Because I never opened a separate bank account for the truck',
    'The root cause is I only touch the books once a year',
  ],
  deep_research_input: null,
  claude_code_audit_input: null,
  status: 'in_progress',
  target_completion_date: '2026-07-15',
  estimated_total_minutes: 225,
  estimated_total_cost_usd: '0.00',
  priority_score: null,
  priority_inputs_hash: null,
  priority_computed_at: null,
  priority_rationale: null,
  created_at: '2026-05-10T14:00:00.000Z',
  updated_at: '2026-06-05T09:30:00.000Z',
  created_by: DEMO_USER,
};

// A second project the featured one depends on (it is already done), and a
// third project that leans on the featured one. Both round out the dropdown
// and the dependency edges below.
const demoProjectBankAccount: Project = {
  id: PROJECT_BANK_ID,
  user_id: DEMO_USER,
  entity_id: DEMO_ENTITY_ID,
  title: 'Open a business bank account for the truck',
  goal: null,
  problem: null,
  diagnosis: null,
  design:
    'Go to the bank with the business papers and open one account just for ' +
    'the truck. Move all truck money into it so it stays separate from home ' +
    'money.',
  goal_items: ['I want the truck to have its own bank account'],
  problem_items: ['I have been using my personal account for the truck'],
  diagnosis_items: ['Because opening a business account felt like a big chore'],
  deep_research_input: null,
  claude_code_audit_input: null,
  status: 'completed',
  target_completion_date: '2026-05-01',
  estimated_total_minutes: 90,
  estimated_total_cost_usd: '0.00',
  priority_score: null,
  priority_inputs_hash: null,
  priority_computed_at: null,
  priority_rationale: null,
  created_at: '2026-04-01T16:00:00.000Z',
  updated_at: '2026-04-28T11:00:00.000Z',
  created_by: DEMO_USER,
};

const demoProjectBudget: Project = {
  id: PROJECT_BUDGET_ID,
  user_id: DEMO_USER,
  entity_id: DEMO_ENTITY_ID,
  title: 'Make a simple monthly budget for the truck',
  goal: null,
  problem: null,
  diagnosis: null,
  design:
    'Once the books are sorted, use the real numbers to set a small budget ' +
    'for food, gas, and supplies each month so spending stays under control.',
  goal_items: ['I want a clear budget for each month'],
  problem_items: ['I have been guessing how much I can spend'],
  diagnosis_items: ['The root cause is I do not have clean numbers yet'],
  deep_research_input: null,
  claude_code_audit_input: null,
  status: 'not_started',
  target_completion_date: '2026-08-01',
  estimated_total_minutes: 120,
  estimated_total_cost_usd: '0.00',
  priority_score: null,
  priority_inputs_hash: null,
  priority_computed_at: null,
  priority_rationale: null,
  created_at: '2026-05-20T13:00:00.000Z',
  updated_at: '2026-05-20T13:00:00.000Z',
  created_by: DEMO_USER,
};

// All projects for the row's dependency dropdown (the featured one plus the two
// related ones).
export const demoAllProjects: Project[] = [
  demoProject,
  demoProjectBankAccount,
  demoProjectBudget,
];

/** The featured project's id — threaded to the task list + dependency views. */
export const demoProjectId: string = PROJECT_BOOKS_ID;

// ── Tasks (the project's 5th step: execute) ─────────────────────────────────
// A believable mix: one done, one in process, two still new.
export const demoTasks: Task[] = [
  {
    id: 'demo-task-receipts',
    project_id: PROJECT_BOOKS_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY_ID,
    title: 'Put every receipt in one folder',
    description:
      'Gather all the paper and email receipts for the truck and keep them in one place.',
    status: 'completed',
    estimated_minutes: 30,
    estimated_cost_usd: null,
    deadline: '2026-06-01',
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'lets me add up the real costs',
    link_url: null,
    notes: null,
    coa_code: null,
    actual_cost_usd: null,
    actual_minutes: 25,
    display_order: 1,
    completed_at: '2026-06-02T15:00:00.000Z',
    created_at: '2026-05-10T14:05:00.000Z',
    updated_at: '2026-06-02T15:00:00.000Z',
    created_by: DEMO_USER,
  },
  {
    id: 'demo-task-app',
    project_id: PROJECT_BOOKS_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY_ID,
    title: 'Pick an easy bookkeeping app',
    description:
      'Try two or three simple apps and choose the one that is easiest to use.',
    status: 'in_progress',
    estimated_minutes: 60,
    estimated_cost_usd: '0.00',
    deadline: '2026-06-20',
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'lets me track money each week',
    link_url: null,
    notes: null,
    coa_code: '5000',
    actual_cost_usd: null,
    actual_minutes: null,
    display_order: 2,
    completed_at: null,
    created_at: '2026-05-12T10:00:00.000Z',
    updated_at: '2026-06-04T09:00:00.000Z',
    created_by: DEMO_USER,
  },
  {
    id: 'demo-task-sales',
    project_id: PROJECT_BOOKS_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY_ID,
    title: "Type last month's sales into the app",
    description:
      'Enter each day of sales from last month so the app shows the total money coming in.',
    status: 'open',
    estimated_minutes: 90,
    estimated_cost_usd: null,
    deadline: '2026-06-30',
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'shows the real money coming in',
    link_url: null,
    notes: null,
    coa_code: '4000',
    actual_cost_usd: null,
    actual_minutes: null,
    display_order: 3,
    completed_at: null,
    created_at: '2026-05-15T10:00:00.000Z',
    updated_at: '2026-05-15T10:00:00.000Z',
    created_by: DEMO_USER,
  },
  {
    id: 'demo-task-costs',
    project_id: PROJECT_BOOKS_ID,
    user_id: DEMO_USER,
    entity_id: DEMO_ENTITY_ID,
    title: 'Add up what I spent on food and gas',
    description:
      'Go through the receipts and total up the money spent on food and gas for the truck.',
    status: 'open',
    estimated_minutes: 45,
    estimated_cost_usd: null,
    deadline: '2026-07-05',
    priority_score: null,
    priority_inputs_hash: null,
    priority_computed_at: null,
    priority_rationale: null,
    unblocks_label: 'shows the real money going out',
    link_url: null,
    notes: null,
    coa_code: '5000',
    actual_cost_usd: null,
    actual_minutes: null,
    display_order: 4,
    completed_at: null,
    created_at: '2026-05-15T10:05:00.000Z',
    updated_at: '2026-05-15T10:05:00.000Z',
    created_by: DEMO_USER,
  },
];

// ── COA accounts for the task category dropdown ─────────────────────────────
export const demoCoaAccounts: CoaAccountSummary[] = [
  { code: '4000', name: 'Sales', account_type: 'revenue', entity_id: DEMO_ENTITY_ID },
  { code: '5000', name: 'Food and Supplies', account_type: 'expense', entity_id: DEMO_ENTITY_ID },
];

// ── Dependency edges (project-to-project) ───────────────────────────────────
// Outgoing: the books project is blocked by the bank-account project (already
// done) — you cannot finish the books until the truck has its own account.
export const demoOutgoingDependencies: HydratedDependency[] = [
  {
    id: 'demo-dep-blocks',
    project_id: PROJECT_BOOKS_ID,
    depends_on_project_id: PROJECT_BANK_ID,
    dependency_type: 'blocks',
    rationale:
      'I cannot finish the books until the truck has its own bank account.',
    created_at: '2026-05-11T09:00:00.000Z',
    created_by: DEMO_USER,
    depends_on_project_title: demoProjectBankAccount.title,
    depends_on_project_status: demoProjectBankAccount.status,
  },
];

// Incoming: the monthly-budget project leans on the books project — its budget
// uses the numbers the books produce.
export const demoIncomingDependencies: InverseDependency[] = [
  {
    id: 'demo-dep-informs',
    project_id: PROJECT_BUDGET_ID,
    depends_on_project_id: PROJECT_BOOKS_ID,
    dependency_type: 'informs',
    rationale: 'My monthly budget uses the numbers from the truck books.',
    created_at: '2026-05-21T09:00:00.000Z',
    created_by: DEMO_USER,
    project_title: demoProjectBudget.title,
    project_status: demoProjectBudget.status,
  },
];

// ── Evolution timeline (short two-version history) ──────────────────────────
export const demoEvolution: EvolutionResponse = {
  project_id: PROJECT_BOOKS_ID,
  versions: [
    {
      version_number: 1,
      usage_id: 'demo-usage-1',
      created_at: '2026-05-10T14:05:00.000Z',
      model: 'claude-sonnet-4-6',
      purpose: 'generate-tasks',
      input_tokens: 1200,
      output_tokens: 480,
      cost_usd: '0.0156',
      task_count: 2,
      tasks: [
        { id: 'demo-task-receipts', title: 'Put every receipt in one folder', status: 'completed' },
        { id: 'demo-task-app', title: 'Pick an easy bookkeeping app', status: 'in_progress' },
      ],
    },
    {
      version_number: 2,
      usage_id: 'demo-usage-2',
      created_at: '2026-05-15T10:00:00.000Z',
      model: 'claude-sonnet-4-6',
      purpose: 'generate-tasks',
      input_tokens: 1350,
      output_tokens: 520,
      cost_usd: '0.0171',
      task_count: 2,
      tasks: [
        { id: 'demo-task-sales', title: "Type last month's sales into the app", status: 'open' },
        { id: 'demo-task-costs', title: 'Add up what I spent on food and gas', status: 'open' },
      ],
    },
  ],
  unversioned: [],
  unversioned_count: 0,
};

/**
 * Type-conformance proofs. Each line below fails to compile if the matching
 * export drifts from the pure view's prop contract. They are not exported and
 * have no runtime cost (erased by the compiler).
 */
const _checkProject: ProjectRowViewProps['project'] = demoProject;
const _checkEntities: ProjectRowViewProps['entities'] = demoEntities;
// PR7a moved allProjects off ProjectRowView onto the dependency section, so the
// seed's project list is now consumed by DependencyListView's contract.
const _checkAllProjects: DependencyListViewProps['allProjects'] = demoAllProjects;
const _checkTasks: TaskListViewProps['tasks'] = demoTasks;
const _checkTaskRow: TaskRowViewProps['task'] = demoTasks[0];
const _checkCoa: TaskListViewProps['coaAccounts'] = demoCoaAccounts;
const _checkOutgoing: DependencyListViewProps['outgoing'] = demoOutgoingDependencies;
const _checkIncoming: DependencyListViewProps['incoming'] = demoIncomingDependencies;
const _checkEvolution: NonNullable<EvolutionTimelineViewProps['data']> = demoEvolution;
void [
  _checkProject,
  _checkEntities,
  _checkAllProjects,
  _checkTasks,
  _checkTaskRow,
  _checkCoa,
  _checkOutgoing,
  _checkIncoming,
  _checkEvolution,
];
