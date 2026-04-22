export interface Task {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  order: number;
}

export interface ScheduleBlock {
  id: string;
  time: string;
  activity: string;
  completed: boolean;
  skipped: boolean;
}

export interface Meal {
  id: string;
  name: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  description: string;
  calories: number;
  protein: number;
}

export interface DailyPlan {
  id: string;
  date: string;
  dayNumber: number;
  sprintStartDate: string;
  sprintTotalDays: number;
  mission: string | null;
  missionCompleted: boolean;
  tasks: Task[];
  schedule: ScheduleBlock[];
  budgetTarget: number | null;
  budgetActual: number | null;
  weightMorning: number | null;
  workoutPlanned: boolean;
  workoutCompleted: boolean;
  workoutType: string | null;
  workoutDuration: number | null;
  workoutNotes: string | null;
  hydrationTargetOz: number | null;
  hydrationActualOz: number | null;
  calorieTarget: number | null;
  calorieActual: number | null;
  proteinTargetG: number | null;
  proteinActualG: number | null;
  meals: Meal[];
  sleepHours: number | null;
  sleepQuality: string | null;
  steps: number | null;
  dayScore: number | null;
  reflection: string | null;
  wins: string | null;
  blockers: string | null;
}

export interface PreviousDay {
  weight: number | null;
  dayScore: number | null;
  taskCompletion: number | null;
}

export interface ApiResponse {
  plan: DailyPlan | null;
  dayNumber: number;
  isSprintDay: boolean;
  previousDay: PreviousDay | null;
}

export const SPRINT_START = '2026-04-22';
export const SPRINT_TOTAL_DAYS = 75;

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function calculateDayScore(plan: DailyPlan): number {
  let score = 0;

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  if (tasks.length > 0) {
    const completed = tasks.filter((t) => t.completed).length;
    score += (completed / tasks.length) * 40;
  }

  if (plan.workoutCompleted) score += 20;

  if (plan.hydrationActualOz && plan.hydrationTargetOz && plan.hydrationTargetOz > 0) {
    score += Math.min((plan.hydrationActualOz / plan.hydrationTargetOz) * 15, 15);
  }

  if (plan.calorieActual && plan.calorieTarget && plan.calorieTarget > 0) {
    const ratio = Math.abs(plan.calorieActual - plan.calorieTarget) / plan.calorieTarget;
    if (ratio <= 0.1) score += 15;
    else if (ratio <= 0.2) score += 10;
    else score += 5;
  }

  if (plan.sleepHours != null) {
    if (plan.sleepHours >= 7) score += 10;
    else if (plan.sleepHours >= 6) score += 7;
    else score += 3;
  }

  return Math.round(score * 10) / 10;
}
