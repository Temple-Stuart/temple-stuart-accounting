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
