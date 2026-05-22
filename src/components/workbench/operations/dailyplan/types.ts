import type { OperationsTaskStatus, CalendarBlockStatus } from '@prisma/client';

export type CalendarBlockSummary = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: CalendarBlockStatus;
  notes: string | null;
};

export type LinkedTaskSummary = {
  id: string;
  title: string;
  status: OperationsTaskStatus;
  /**
   * project_id — needed by the Hub event card to reach the task PATCH
   * endpoint (/api/operations/projects/[id]/tasks/[taskId]) for in-card
   * reconcile of actual cost/minutes (PR-Ops-Hub-1).
   */
  project_id: string;
  /**
   * Universal triple (date/time/cost/category) plumbing — surfaced
   * on the linked task summary so the Hub (and any other calendar
   * surface) can render cost/category badges on Operations blocks
   * without a second fetch. Selected in /api/operations/daily-plan/
   * items GET as of PR-Ops-5.3.
   */
  coa_code: string | null;
  estimated_cost_usd: string | null;  // Prisma Decimal serialized as string
  actual_cost_usd: string | null;
  actual_minutes: number | null;
};

export type DailyPlanItem = {
  id: string;
  user_id: string;
  entity_id: string;
  plan_date: string; // ISO datetime
  task_id: string | null;
  ad_hoc_title: string | null;
  ad_hoc_description: string | null;
  display_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  task: LinkedTaskSummary | null;
  calendar_blocks: CalendarBlockSummary[];
};
