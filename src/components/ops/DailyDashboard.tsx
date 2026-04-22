'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DailyPlan,
  ApiResponse,
  PreviousDay,
  Mission,
  WeekPlan,
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
import MissionPlanning from './MissionPlanning';

const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };

export default function DailyDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [isSprintDay, setIsSprintDay] = useState(true);
  const [previousDay, setPreviousDay] = useState<PreviousDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordMode, setRecordMode] = useState(false);
  const { save, showSaved } = useAutoSave();

  // Mission state
  const [mission, setMission] = useState<Mission | null>(null);
  const [missionLoading, setMissionLoading] = useState(true);
  const [editingMission, setEditingMission] = useState(false);

  // ── Fetch mission on mount ────────────────────────────────────────────────

  const fetchMission = useCallback(async () => {
    setMissionLoading(true);
    try {
      const res = await fetch('/api/ops/mission');
      if (res.ok) {
        const data = await res.json();
        setMission(data.mission);
      }
    } catch (err) {
      console.error('Failed to fetch mission:', err);
    } finally {
      setMissionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

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

  // ── Mission helpers ───────────────────────────────────────────────────────

  const handleMissionReady = useCallback((m: Mission) => {
    setMission(m);
    setEditingMission(false);
  }, []);

  const getMissionDayNumber = useCallback((m: Mission): number => {
    const today = new Date(selectedDate + 'T12:00:00');
    const start = new Date(m.startDate + 'T00:00:00');
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }, [selectedDate]);

  const getCurrentWeek = useCallback((m: Mission): WeekPlan | null => {
    if (!m.roadmap?.weeks) return null;
    const today = new Date(selectedDate + 'T12:00:00');
    return m.roadmap.weeks.find((w) => {
      const start = new Date(w.startDate + 'T00:00:00');
      const end = new Date(w.endDate + 'T23:59:59');
      return today >= start && today <= end;
    }) || null;
  }, [selectedDate]);

  const seedPlanFromRoadmap = useCallback(async () => {
    if (!mission?.roadmap) return;
    const week = getCurrentWeek(mission);
    if (!week) return;
    const tasks = week.dailyTasks.map((t, i) => ({
      id: generateId(),
      text: t.text,
      priority: t.priority,
      completed: false,
      order: i,
    }));
    try {
      const res = await fetch('/api/ops/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          tasks,
          mission: week.theme,
        }),
      });
      if (res.ok) fetchPlan(selectedDate);
    } catch (err) {
      console.error('Failed to seed plan:', err);
    }
  }, [mission, getCurrentWeek, selectedDate, fetchPlan]);

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

  if (missionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted font-mono text-terminal-base">Loading...</span>
        </div>
      </div>
    );
  }

  // ── STATE 1: No mission — show MissionPlanning ────────────────────────────

  if (!mission && !editingMission) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-3">
        <MissionPlanning existingMission={null} onMissionReady={handleMissionReady} />
      </div>
    );
  }

  // ── STATE 2: Editing mission ──────────────────────────────────────────────

  if (editingMission) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-3">
        <MissionPlanning
          existingMission={mission}
          onMissionReady={handleMissionReady}
          onCancel={() => setEditingMission(false)}
        />
      </div>
    );
  }

  // ── STATE 3+4: Mission exists — daily dashboard ───────────────────────────

  const effectiveTotalDays = mission ? mission.totalDays : SPRINT_TOTAL_DAYS;
  const effectiveDayNumber = mission ? getMissionDayNumber(mission) : dayNumber;
  const sprintPct = Math.max(0, Math.min(100, (effectiveDayNumber / effectiveTotalDays) * 100));
  const currentWeek = mission ? getCurrentWeek(mission) : null;

  void isSprintDay;

  // ── No daily plan yet — roadmap seeding ───────────────────────────────────

  if (!plan) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-4">
        {/* Hero */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-text-primary font-mono">DAY {effectiveDayNumber}</span>
              <span className="text-lg text-text-muted font-mono">/ {effectiveTotalDays}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => goToDate(-1)} className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">&#9664;</button>
              <button onClick={goToToday} className="px-3 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">Today</button>
              <button onClick={() => goToDate(1)} className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">&#9654;</button>
              <button onClick={() => setEditingMission(true)} className="ml-3 text-terminal-sm text-text-muted hover:text-brand-purple font-mono transition-colors">Edit Mission</button>
            </div>
          </div>
          <div className="w-full h-2 bg-bg-row rounded-full mb-2">
            <div className="h-2 rounded-full bg-brand-purple transition-all" style={{ width: `${sprintPct}%` }} />
          </div>
          <p className="text-terminal-base text-text-muted font-mono">
            {formatDisplayDate(selectedDate)} &mdash; {sprintPct.toFixed(1)}% complete
          </p>
        </div>

        {/* Current week context + seed button */}
        {currentWeek ? (
          <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-terminal-lg font-semibold text-text-primary">
                Week {currentWeek.weekNumber} &mdash; {currentWeek.theme}
              </span>
            </div>
            <div className="px-4 py-4 space-y-3">
              {currentWeek.milestoneTarget && (
                <p className="text-terminal-base font-mono text-text-secondary">
                  &#127919; {currentWeek.milestoneTarget}
                </p>
              )}
              {currentWeek.dailyTasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">Today&apos;s Tasks</p>
                  {currentWeek.dailyTasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIO_DOT[t.priority] || 'bg-amber-500'}`} />
                      <span className="text-terminal-base font-mono text-text-primary">{t.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {currentWeek.healthCadence && (
                <p className="text-terminal-sm text-text-faint font-mono">{currentWeek.healthCadence}</p>
              )}
              {currentWeek.notes && (
                <p className="text-terminal-sm text-amber-600 font-mono">{currentWeek.notes}</p>
              )}
              <button
                onClick={seedPlanFromRoadmap}
                className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium mt-2"
              >
                &#128203; Start Today&apos;s Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded border border-border shadow-sm p-6 text-center">
            <p className="text-text-muted font-mono text-terminal-base mb-3">No roadmap week for this date.</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/ops/daily-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: selectedDate }),
                  });
                  if (res.ok) fetchPlan(selectedDate);
                } catch (err) {
                  console.error('Failed to create plan:', err);
                }
              }}
              className="px-5 py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-terminal-base font-medium"
            >
              Create blank plan
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Plan exists — full execution dashboard ────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 space-y-4">
      {/* Hero */}
      <div className="bg-white rounded border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text-primary font-mono">DAY {effectiveDayNumber}</span>
            <span className="text-lg text-text-muted font-mono">/ {effectiveTotalDays}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => goToDate(-1)} className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">&#9664;</button>
            <button onClick={goToToday} className="px-3 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">Today</button>
            <button onClick={() => goToDate(1)} className="px-2 py-1 text-terminal-base text-text-secondary hover:text-text-primary border border-border rounded transition-colors font-mono">&#9654;</button>
            <button onClick={() => setEditingMission(true)} className="ml-3 text-terminal-sm text-text-muted hover:text-brand-purple font-mono transition-colors">Edit Mission</button>
            <button onClick={() => setRecordMode(true)} className="px-3 py-1.5 text-terminal-base bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono">&#127909; Record</button>
          </div>
        </div>

        <div className="w-full h-2 bg-bg-row rounded-full mb-2">
          <div className="h-2 rounded-full bg-brand-purple transition-all" style={{ width: `${sprintPct}%` }} />
        </div>
        <p className="text-terminal-base text-text-muted font-mono mb-1">
          {formatDisplayDate(selectedDate)} &mdash; {sprintPct.toFixed(1)}% complete
        </p>
        {currentWeek && (
          <p className="text-terminal-sm text-text-faint font-mono mb-3">
            Week {currentWeek.weekNumber} &mdash; {currentWeek.theme}
          </p>
        )}

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

      {/* Cards */}
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

      {/* Saved toast */}
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
