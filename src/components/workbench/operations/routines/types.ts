/**
 * Shared types for the Operations Routines surface (Section E).
 *
 * Routine mirrors the operations_routines Prisma model 1:1.
 *
 * Bridgewater framing: routines are the cadence-driven execution layer.
 * Daily reflection, weekly review, quarterly planning — these are the
 * Principles operationalized as recurring evidentiary events. Each
 * scheduled occurrence becomes either:
 *   - A row in operations_routine_completions (success projection), AND
 *     an audit_log row with action_type='operations_routine_completed'
 *   - An audit_log row with action_type='operations_routine_missed'
 *     (no completion row; the absence of a row at expected_at IS the miss)
 *
 * The schema's `routine_completions` table is success-only by design —
 * `completed_at` is NOT NULL. Misses live exclusively in audit_log. This
 * is intentional: completions are the positive-event projection; the
 * audit log is the total evidentiary truth.
 *
 * RRULE expansion is server-side. Per-row `timezone` requires it. The
 * UI never expands RRULE itself; it reads server-computed `next_due_at`
 * and calls /api/operations/routines/[id]/upcoming for forward windows.
 */

export interface Routine {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  description: string | null;
  schedule_rrule: string;
  timezone: string;
  next_due_at: string | null;
  last_evaluated_at: string | null;
  last_completed_at: string | null;
  consecutive_completion_streak: number;
  consecutive_miss_streak: number;
  ideal_time_label: string | null;
  fail_threshold_minutes: number;
  start_date: string | null;
  end_date: string | null;
  /**
   * Intent-window start (HH:MM, interpreted in routine.timezone).
   * Prisma maps @db.Time to a JS Date; this field arrives JSON-serialized as
   * '1970-01-01THH:MM:SS.000Z'. Frontend MUST extract HH:MM via .slice(11, 16)
   * before display or binding to <input type="time">.
   */
  start_time: string | null;
  /**
   * Intent-window end (HH:MM, interpreted in routine.timezone).
   * Same ISO-serialization gotcha as start_time — extract HH:MM via .slice(11, 16).
   */
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  steps: RoutineStep[];
}

/**
 * One ordered sub-step of a routine. Matches operations_routine_steps row 1:1.
 */
export interface RoutineStep {
  id: string;
  routine_id: string;
  user_id: string;
  entity_id: string;
  step_order: number;
  /**
   * Time-of-day (HH:MM, interpreted in parent routine.timezone).
   * Prisma maps @db.Time to a JS Date; this field arrives JSON-serialized as
   * '1970-01-01THH:MM:SS.000Z'. Frontend MUST extract HH:MM via .slice(11, 16)
   * before display or binding to <input type="time">.
   */
  time_of_day: string | null;
  activity: string;
  sub_activity: string | null;
  location: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface RoutineCompletion {
  id: string;
  routine_id: string;
  user_id: string;
  expected_at: string;
  completed_at: string;
  delta_minutes: number;
  notes: string | null;
  created_at: string;
}

/**
 * Hydrated routine for "today's strip" rendering. Joins the next expected
 * occurrence with whether it's been completed or missed already today.
 *
 * status semantics:
 *   - 'pending'   : next_due_at is today and no completion row exists yet
 *   - 'completed' : a completion row exists for today's expected_at
 *   - 'missed'    : an audit_log row with action_type='operations_routine_missed'
 *                   exists for today's expected_at (cron has already evaluated)
 *   - 'upcoming'  : next_due_at is in the future relative to now
 */
export type TodayStatus = 'pending' | 'completed' | 'missed' | 'upcoming';

export interface TodayRoutineEntry {
  routine: Routine;
  expected_at: string;          // today's expected occurrence
  status: TodayStatus;
  completion: RoutineCompletion | null;  // populated if status === 'completed'
}

/**
 * RRULE form-side shape. The UI compiles structured selections into an
 * RFC 5545 RRULE string under the hood. Users do not write RRULE strings
 * directly (except via the "custom" escape hatch).
 */
export type CadenceMode = 'daily' | 'weekly' | 'monthly_day_of_month' | 'monthly_nth_weekday' | 'custom';

export type WeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface RoutineForm {
  name: string;
  description: string;
  entity_id: string;
  cadence_mode: CadenceMode;
  weekly_byday: WeekDay[];           // for weekly mode
  monthly_day_of_month: string;       // for monthly_day_of_month (e.g., "15")
  monthly_nth: string;                // for monthly_nth_weekday (e.g., "1" = first, "-1" = last)
  monthly_weekday: WeekDay;           // for monthly_nth_weekday (e.g., "MO" = Monday)
  custom_rrule: string;               // for custom escape hatch
  byhour: string;                     // "08" — hour-of-day in routine's timezone
  byminute: string;                   // "00" — minute-of-hour
  timezone: string;                   // default 'America/Los_Angeles'
  ideal_time_label: string;           // free-text "morning", "before lunch"
  fail_threshold_minutes: string;     // grace period in minutes before "miss"
  start_date: string;                 // YYYY-MM-DD window start; '' = unset (active from creation)
  end_date: string;                   // YYYY-MM-DD window end; '' = unset (never expires)
  start_time: string;                 // HH:MM intent-window start; '' = unset
  end_time: string;                   // HH:MM intent-window end; '' = unset
  is_active: boolean;
}

export const DEFAULT_ROUTINE_FORM: RoutineForm = {
  name: '',
  description: '',
  entity_id: '',
  cadence_mode: 'daily',
  weekly_byday: ['MO', 'TU', 'WE', 'TH', 'FR'],
  monthly_day_of_month: '1',
  monthly_nth: '1',
  monthly_weekday: 'MO',
  custom_rrule: '',
  byhour: '08',
  byminute: '00',
  timezone: 'America/Los_Angeles',
  ideal_time_label: '',
  fail_threshold_minutes: '30',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  is_active: true,
};

export const WEEKDAY_LABELS: Record<WeekDay, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

export const WEEKDAY_ORDER: WeekDay[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export const CADENCE_MODE_LABELS: Record<CadenceMode, string> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly_day_of_month: 'monthly (day of month)',
  monthly_nth_weekday: 'monthly (Nth weekday)',
  custom: 'custom (raw RRULE)',
};

/**
 * Cadence group buckets for cadence-grouped list rendering.
 * Derived from the RRULE's FREQ component server-side.
 */
export type CadenceGroup = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export const CADENCE_GROUP_LABELS: Record<CadenceGroup, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export const CADENCE_GROUP_ORDER: CadenceGroup[] = [
  'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom',
];
