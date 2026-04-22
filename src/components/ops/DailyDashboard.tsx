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
import GuidedPlanningFlow from './GuidedPlanningFlow';

export default function DailyDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [isSprintDay, setIsSprintDay] = useState(true);
  const [previousDay, setPreviousDay] = useState<PreviousDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordMode, setRecordMode] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const { save, showSaved } = useAutoSave();

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
      const t: Task = {
        id: generateId(),
        text: '',
        priority: 'medium',
        completed: false,
        order: prev.tasks.length,
      };
      const updated = { ...prev, tasks: [...prev.tasks, t] };
      save(updated);
      return updated;
    });
  }, [save]);

  const updateTask = useCallback(
    (taskId: string, changes: Partial<Task>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...changes } : t)),
        };
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
      const b: ScheduleBlock = {
        id: generateId(),
        time: '',
        activity: '',
        completed: false,
        skipped: false,
      };
      const updated = { ...prev, schedule: [...prev.schedule, b] };
      save(updated);
      return updated;
    });
  }, [save]);

  const updateScheduleBlock = useCallback(
    (blockId: string, changes: Partial<ScheduleBlock>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          schedule: prev.schedule.map((b) => (b.id === blockId ? { ...b, ...changes } : b)),
        };
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
        const updated = {
          ...prev,
          meals: prev.meals.map((m) => (m.id === mealId ? { ...m, ...changes } : m)),
        };
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

  // ── Handle guided plan completion ─────────────────────────────────────────

  const handlePlanComplete = useCallback(
    async (planData: Partial<DailyPlan>) => {
      try {
        const res = await fetch('/api/ops/daily-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, ...planData }),
        });
        if (res.ok) {
          setReplanning(false);
          await fetchPlan(selectedDate);
        }
      } catch (err) {
        console.error('Failed to save plan:', err);
      }
    },
    [selectedDate, fetchPlan],
  );

  // ── Date navigation ───────────────────────────────────────────────────────

  const goToDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => setSelectedDate(new Date().toISOString().split('T')[0]);

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
        <button
          onClick={() => setRecordMode(false)}
          className="text-terminal-base text-brand-purple hover:underline font-mono"
        >
          &larr; Back to dashboard
        </button>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

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

  // ── Guided planning flow (no plan yet, or replanning) ─────────────────────

  if (!plan || replanning) {
    return (
      <GuidedPlanningFlow
        selectedDate={selectedDate}
        dayNumber={dayNumber}
        sprintTotalDays={SPRINT_TOTAL_DAYS}
        onPlanComplete={handlePlanComplete}
        onCancel={replanning ? () => setReplanning(false) : undefined}
      />
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const sprintPct = Math.max(0, Math.min(100, (dayNumber / SPRINT_TOTAL_DAYS) * 100));

  void isSprintDay;

  // ── Render dashboard ──────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 space-y-4">
      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text-primary font-mono">
              DAY {dayNumber}
            </span>
            <span className="text-lg text-text-muted font-mono">/ {SPRINT_TOTAL_DAYS}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToDate(-1)}
              className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono"
            >
              &#9664;
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono"
            >
              Today
            </button>
            <button
              onClick={() => goToDate(1)}
              className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono"
            >
              &#9654;
            </button>
            <button
              onClick={() => setReplanning(true)}
              className="ml-3 px-3 py-1.5 text-terminal-base bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono"
            >
              &#129504; Replan
            </button>
            <button
              onClick={() => setRecordMode(true)}
              className="px-3 py-1.5 text-terminal-base bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono"
            >
              &#127909; Record
            </button>
          </div>
        </div>

        {/* Sprint progress bar */}
        <div className="w-full h-2 bg-bg-row rounded-full mb-2">
          <div
            className="h-2 rounded-full bg-brand-purple transition-all"
            style={{ width: `${sprintPct}%` }}
          />
        </div>
        <p className="text-terminal-base text-text-muted font-mono mb-3">
          {formatDisplayDate(selectedDate)} &mdash; {sprintPct.toFixed(1)}% complete
        </p>

        {/* Mission */}
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
      </div>

      {/* ── CARDS ────────────────────────────────────────────────────────── */}
      {/* ROW 1: Tasks + Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TasksCard
          tasks={plan.tasks}
          onAdd={addTask}
          onUpdate={updateTask}
          onRemove={removeTask}
        />
        <ScheduleCard
          schedule={plan.schedule}
          onAdd={addScheduleBlock}
          onUpdate={updateScheduleBlock}
          onRemove={removeScheduleBlock}
        />
      </div>

      {/* ROW 2: Budget + Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BudgetCard
          budgetTarget={plan.budgetTarget}
          budgetActual={plan.budgetActual}
          onUpdate={updateField}
        />
        <HealthCard
          plan={plan}
          previousDay={previousDay}
          onUpdate={updateField}
        />
      </div>

      {/* ROW 3: Meals */}
      <MealsCard
        meals={plan.meals}
        onAdd={addMeal}
        onUpdate={updateMeal}
        onRemove={removeMeal}
      />

      {/* ROW 4: End of Day */}
      <EndOfDayCard plan={plan} onUpdate={updateField} />

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
