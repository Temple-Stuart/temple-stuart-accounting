'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DailyPlan,
  ApiResponse,
  PreviousDay,
  Task,
  ScheduleBlock,
  Meal,
  SPRINT_TOTAL_DAYS,
  generateId,
} from './types';
import { useAutoSave } from './useAutoSave';
import TasksCard from './TasksCard';
import ScheduleCard from './ScheduleCard';
import BudgetCard from './BudgetCard';
import HealthCard from './HealthCard';
import MealsCard from './MealsCard';
import EndOfDayCard from './EndOfDayCard';
import RecordView from './RecordView';
import PlanningCard from './PlanningCard';
import PlanReviewCard from './PlanReviewCard';

// ── Plan parsing helpers ────────────────────────────────────────────────────

interface Answers {
  energy: string;
  mission: string;
  tasks: string;
  body: string;
  budget: string;
  schedule: string;
}

const EMPTY_ANSWERS: Answers = { energy: '', mission: '', tasks: '', body: '', budget: '', schedule: '' };

function extractPlanJSON(content: string): Record<string, unknown> | null {
  const match = content.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function mapPlanToFields(raw: Record<string, unknown>): Partial<DailyPlan> {
  const result: Partial<DailyPlan> = {};

  if (raw.mission != null) result.mission = String(raw.mission);
  if (raw.budgetTarget != null) result.budgetTarget = Number(raw.budgetTarget);
  if (raw.workoutPlanned != null) result.workoutPlanned = Boolean(raw.workoutPlanned);
  if (raw.workoutType != null) result.workoutType = String(raw.workoutType);
  if (raw.workoutDuration != null) result.workoutDuration = Number(raw.workoutDuration);
  if (raw.hydrationTargetOz != null) result.hydrationTargetOz = Number(raw.hydrationTargetOz);
  if (raw.calorieTarget != null) result.calorieTarget = Number(raw.calorieTarget);
  if (raw.proteinTargetG != null) result.proteinTargetG = Number(raw.proteinTargetG);
  if (raw.sleepHours != null) result.sleepHours = Number(raw.sleepHours);
  if (raw.sleepQuality != null) result.sleepQuality = String(raw.sleepQuality);

  if (Array.isArray(raw.tasks)) {
    result.tasks = (raw.tasks as Array<{ text: string; priority: string }>).map(
      (t, i): Task => ({
        id: generateId(),
        text: t.text || '',
        priority: (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium') as Task['priority'],
        completed: false,
        order: i,
      }),
    );
  }

  if (Array.isArray(raw.schedule)) {
    result.schedule = (raw.schedule as Array<{ time: string; activity: string }>).map(
      (s): ScheduleBlock => ({
        id: generateId(),
        time: s.time || '',
        activity: s.activity || '',
        completed: false,
        skipped: false,
      }),
    );
  }

  if (Array.isArray(raw.meals)) {
    result.meals = (
      raw.meals as Array<{ name: string; description: string; calories: number; protein: number }>
    ).map(
      (m): Meal => ({
        id: generateId(),
        name: (['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(m.name) ? m.name : 'Snack') as Meal['name'],
        description: m.description || '',
        calories: m.calories || 0,
        protein: m.protein || 0,
      }),
    );
  }

  return result;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DailyDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [isSprintDay, setIsSprintDay] = useState(true);
  const [previousDay, setPreviousDay] = useState<PreviousDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordMode, setRecordMode] = useState(false);
  const { save, showSaved } = useAutoSave();

  // Planning state
  const [replanning, setReplanning] = useState(false);
  const [planningAnswers, setPlanningAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Record<string, unknown> | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // ── Fetch plan for selected date ──────────────────────────────────────────

  const fetchPlan = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/daily-plan?date=${date}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setPlan(data.plan);
        setDayNumber(data.dayNumber);
        setIsSprintDay(data.isSprintDay);
        setPreviousDay(data.previousDay);
      }
    } catch (err) {
      console.error('Failed to fetch plan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan(selectedDate);
  }, [selectedDate, fetchPlan]);

  // Reset planning state when date changes
  useEffect(() => {
    setReplanning(false);
    setGeneratedPlan(null);
    setPlanningAnswers(EMPTY_ANSWERS);
  }, [selectedDate]);

  // ── Generic field updater ─────────────────────────────────────────────────

  const updateField = useCallback(
    (field: keyof DailyPlan, value: DailyPlan[keyof DailyPlan]) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, [field]: value };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  // ── Task helpers ──────────────────────────────────────────────────────────

  const addTask = useCallback(() => {
    setPlan((prev) => {
      if (!prev) return prev;
      const t: Task = { id: generateId(), text: '', priority: 'medium', completed: false, order: prev.tasks.length };
      const updated = { ...prev, tasks: [...prev.tasks, t] };
      save(updated);
      return updated;
    });
  }, [save]);

  const updateTask = useCallback(
    (taskId: string, changes: Partial<Task>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...changes } : t)) };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  const removeTask = useCallback(
    (taskId: string) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  // ── Schedule helpers ──────────────────────────────────────────────────────

  const addScheduleBlock = useCallback(() => {
    setPlan((prev) => {
      if (!prev) return prev;
      const b: ScheduleBlock = { id: generateId(), time: '', activity: '', completed: false, skipped: false };
      const updated = { ...prev, schedule: [...prev.schedule, b] };
      save(updated);
      return updated;
    });
  }, [save]);

  const updateScheduleBlock = useCallback(
    (blockId: string, changes: Partial<ScheduleBlock>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, schedule: prev.schedule.map((b) => (b.id === blockId ? { ...b, ...changes } : b)) };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  const removeScheduleBlock = useCallback(
    (blockId: string) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, schedule: prev.schedule.filter((b) => b.id !== blockId) };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  // ── Meal helpers ──────────────────────────────────────────────────────────

  const addMeal = useCallback(() => {
    setPlan((prev) => {
      if (!prev) return prev;
      const m: Meal = { id: generateId(), name: 'Snack', description: '', calories: 0, protein: 0 };
      const updated = { ...prev, meals: [...prev.meals, m] };
      save(updated);
      return updated;
    });
  }, [save]);

  const updateMeal = useCallback(
    (mealId: string, changes: Partial<Meal>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, meals: prev.meals.map((m) => (m.id === mealId ? { ...m, ...changes } : m)) };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  const removeMeal = useCallback(
    (mealId: string) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, meals: prev.meals.filter((m) => m.id !== mealId) };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  // ── AI plan generation ────────────────────────────────────────────────────

  const generatePlan = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ops/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: planningAnswers, date: selectedDate, dayNumber }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = extractPlanJSON(data.reply);
        if (parsed) setGeneratedPlan(parsed);
      }
    } catch (err) {
      console.error('Plan generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [planningAnswers, selectedDate, dayNumber]);

  const adjustPlan = useCallback(
    async (adjustment: string) => {
      if (!generatedPlan) return;
      setIsAdjusting(true);
      try {
        const res = await fetch('/api/ops/ai-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'adjust', adjustment, currentPlan: generatedPlan }),
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = extractPlanJSON(data.reply);
          if (parsed) setGeneratedPlan(parsed);
        }
      } catch (err) {
        console.error('Adjustment failed:', err);
      } finally {
        setIsAdjusting(false);
      }
    },
    [generatedPlan],
  );

  const lockItIn = useCallback(async () => {
    if (!generatedPlan) return;
    const fields = mapPlanToFields(generatedPlan);
    try {
      const res = await fetch('/api/ops/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, ...fields }),
      });
      if (res.ok) {
        setGeneratedPlan(null);
        setPlanningAnswers(EMPTY_ANSWERS);
        setReplanning(false);
        await fetchPlan(selectedDate);
      }
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
  }, [generatedPlan, selectedDate, fetchPlan]);

  // ── Date navigation ───────────────────────────────────────────────────────

  const goToDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => setSelectedDate(new Date().toISOString().split('T')[0]);

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ── Record mode ────────────────────────────────────────────────────────────

  if (recordMode && plan) {
    return (
      <RecordView
        plan={plan}
        dayNumber={dayNumber}
        selectedDate={selectedDate}
        previousDay={previousDay}
        onExit={() => setRecordMode(false)}
      />
    );
  }

  if (recordMode && !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-text-muted font-mono text-terminal-base">No plan to record yet.</p>
        <button onClick={() => setRecordMode(false)} className="text-terminal-base text-brand-purple hover:underline font-mono">
          &larr; Back to dashboard
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted font-mono text-terminal-base">Loading...</span>
        </div>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const sprintPct = Math.max(0, Math.min(100, (dayNumber / SPRINT_TOTAL_DAYS) * 100));
  const inPlanningMode = (!plan && !generatedPlan) || (replanning && !generatedPlan);
  const inReviewMode = generatedPlan !== null;
  const inExecutionMode = plan !== null && !replanning && !generatedPlan;
  const canGenerate = planningAnswers.mission.trim().length > 0 && planningAnswers.tasks.trim().length > 0;

  void isSprintDay;

  const setAnswer = (key: keyof Answers) => (value: string) =>
    setPlanningAnswers((prev) => ({ ...prev, [key]: value }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 space-y-4">
      {/* ── HERO SECTION (all states) ────────────────────────────────────── */}
      <div className="bg-white rounded border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text-primary font-mono">DAY {dayNumber}</span>
            <span className="text-lg text-text-muted font-mono">/ {SPRINT_TOTAL_DAYS}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => goToDate(-1)} className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">&#9664;</button>
            <button onClick={goToToday} className="px-3 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">Today</button>
            <button onClick={() => goToDate(1)} className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">&#9654;</button>
            {inExecutionMode && (
              <>
                <button onClick={() => setReplanning(true)} className="ml-3 px-3 py-1.5 text-terminal-base bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono">&#129504; Replan</button>
                <button onClick={() => setRecordMode(true)} className="px-3 py-1.5 text-terminal-base bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono">&#127909; Record</button>
              </>
            )}
            {replanning && (
              <button onClick={() => { setReplanning(false); setGeneratedPlan(null); setPlanningAnswers(EMPTY_ANSWERS); }} className="ml-3 text-terminal-base text-text-muted hover:text-text-primary font-mono transition-colors">Cancel</button>
            )}
          </div>
        </div>

        <div className="w-full h-2 bg-bg-row rounded-full mb-2">
          <div className="h-2 rounded-full bg-brand-purple transition-all" style={{ width: `${sprintPct}%` }} />
        </div>
        <p className="text-terminal-base text-text-muted font-mono mb-3">
          {formatDisplayDate(selectedDate)} &mdash; {sprintPct.toFixed(1)}% complete
        </p>

        {/* Mission — execution mode only */}
        {inExecutionMode && plan && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.missionCompleted}
              onChange={(e) => updateField('missionCompleted', e.target.checked)}
              className="w-4 h-4 rounded border-border accent-brand-purple"
            />
            <input
              type="text"
              value={plan.mission || ''}
              onChange={(e) => updateField('mission', e.target.value)}
              placeholder="What's today's mission?"
              className="flex-1 text-sm font-medium text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-brand-purple outline-none px-2 py-1 transition-colors font-mono placeholder:text-text-faint"
            />
          </div>
        )}

        {/* Subtitle for planning/review */}
        {inPlanningMode && (
          <p className="text-terminal-base text-text-faint font-mono">
            Answer the questions below. I&apos;ll build your schedule.
          </p>
        )}
        {inReviewMode && (
          <p className="text-terminal-base text-text-faint font-mono">
            Review your plan below. Adjust anything, then lock it in.
          </p>
        )}
      </div>

      {/* ── STATE A: PLANNING MODE ───────────────────────────────────────── */}
      {inPlanningMode && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlanningCard
              stepNumber="01" label="ENERGY & SLEEP"
              question="How are you feeling right now? How'd you sleep?"
              hint="Sharp and ready? Foggy and dragging? Just say it how it is."
              placeholder="I slept about 6 hours, feeling okay but a little scattered..."
              value={planningAnswers.energy} onChange={setAnswer('energy')}
            />
            <PlanningCard
              stepNumber="02" label="TODAY'S MISSION"
              question="If you could only accomplish ONE thing today, what would it be?"
              hint="What would make you feel like today was a win? One sentence."
              placeholder="Ship the bookkeeping commit flow and test with a new user..."
              value={planningAnswers.mission} onChange={setAnswer('mission')}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlanningCard
              stepNumber="03" label="BRAIN DUMP"
              question="What else needs to happen today? Dump it all."
              hint="Work tasks, errands, calls, emails. Don't organize, just list."
              placeholder="Fix the Plaid duplicate bug, call the vet, review PR, pick up dog food..."
              value={planningAnswers.tasks} onChange={setAnswer('tasks')} rows={5}
            />
            <PlanningCard
              stepNumber="04" label="BODY & FOOD"
              question="What's the plan for your body today?"
              hint="Gym plans, what you're eating, calorie/protein goals, hydration."
              placeholder="CorePower at 10am, trying to hit 2200 cals and 180g protein..."
              value={planningAnswers.body} onChange={setAnswer('body')} rows={5}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlanningCard
              stepNumber="05" label="BUDGET"
              question="What's your spending target today?"
              hint="A dollar amount, or just 'trying to spend nothing.'"
              placeholder="Trying to stay under $50, need to buy dog food though..."
              value={planningAnswers.budget} onChange={setAnswer('budget')}
            />
            <PlanningCard
              stepNumber="06" label="FIXED COMMITMENTS"
              question="Anything locked in at a specific time today?"
              hint="Meetings, appointments, calls — things you can't move."
              placeholder="CorePower at 10am, need to pick up a package before 5pm..."
              value={planningAnswers.schedule} onChange={setAnswer('schedule')}
            />
          </div>

          {/* Generate button */}
          {isGenerating ? (
            <div className="flex items-center justify-center py-4 gap-3">
              <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted font-mono">Building your plan...</span>
            </div>
          ) : (
            <button
              onClick={generatePlan}
              disabled={!canGenerate}
              className="w-full py-3 bg-brand-purple text-white rounded-lg hover:bg-brand-purple-hover transition-colors font-mono text-sm font-semibold disabled:opacity-40"
            >
              &#128640; Generate My Plan
            </button>
          )}
        </>
      )}

      {/* ── STATE B: REVIEW MODE ─────────────────────────────────────────── */}
      {inReviewMode && (
        <PlanReviewCard
          plan={generatedPlan!}
          aiNotes={generatedPlan!.aiNotes ? String(generatedPlan!.aiNotes) : null}
          onLockIn={lockItIn}
          onAdjust={adjustPlan}
          onStartOver={() => { setGeneratedPlan(null); }}
          isAdjusting={isAdjusting}
        />
      )}

      {/* ── STATE C: EXECUTION MODE ──────────────────────────────────────── */}
      {inExecutionMode && plan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TasksCard tasks={plan.tasks} onAdd={addTask} onUpdate={updateTask} onRemove={removeTask} />
            <ScheduleCard schedule={plan.schedule} onAdd={addScheduleBlock} onUpdate={updateScheduleBlock} onRemove={removeScheduleBlock} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BudgetCard budgetTarget={plan.budgetTarget} budgetActual={plan.budgetActual} onUpdate={updateField} />
            <HealthCard plan={plan} previousDay={previousDay} onUpdate={updateField} />
          </div>
          <MealsCard meals={plan.meals} onAdd={addMeal} onUpdate={updateMeal} onRemove={removeMeal} />
          <EndOfDayCard plan={plan} onUpdate={updateField} />
        </>
      )}

      {/* ── SAVED TOAST ──────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-4 right-4 bg-emerald-50 text-brand-green text-terminal-base font-mono px-3 py-1.5 rounded border border-emerald-200 shadow-sm transition-opacity duration-300 ${
          showSaved ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        &#10003; Saved
      </div>
    </div>
  );
}
