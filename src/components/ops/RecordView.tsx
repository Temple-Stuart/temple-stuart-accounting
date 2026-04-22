'use client';

import { useState } from 'react';
import { DailyPlan, PreviousDay, Task, Meal, calculateDayScore } from './types';

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const MEAL_EMOJI: Record<Meal['name'], string> = {
  Breakfast: '\u{1F305}',
  Lunch: '\u{1F31E}',
  Dinner: '\u{1F319}',
  Snack: '\u{1F34E}',
};

const CARD = 'bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 backdrop-blur';
const LABEL = 'text-xs uppercase tracking-widest text-gray-500 font-mono';

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400';
  if (s >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function barFill(s: number) {
  if (s >= 80) return 'bg-emerald-500';
  if (s >= 60) return 'bg-amber-500';
  return 'bg-red-400';
}

interface RecordViewProps {
  plan: DailyPlan;
  dayNumber: number;
  selectedDate: string;
  previousDay: PreviousDay | null;
  onExit: () => void;
}

export default function RecordView({
  plan,
  dayNumber,
  selectedDate,
  previousDay,
  onExit,
}: RecordViewProps) {
  const [recordTab, setRecordTab] = useState<'morning' | 'evening'>('morning');

  const sprintPct = Math.max(0, Math.min(100, (dayNumber / plan.sprintTotalDays) * 100));
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const score = calculateDayScore(plan);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const schedule = Array.isArray(plan.schedule) ? plan.schedule : [];
  const meals = Array.isArray(plan.meals) ? plan.meals : [];
  const completedTasks = tasks.filter((t) => t.completed).length;

  // Sub-scores for evening
  const taskPts = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 40 * 10) / 10 : 0;
  const workoutPts = plan.workoutCompleted ? 20 : 0;
  let hydrationPts = 0;
  if (plan.hydrationActualOz && plan.hydrationTargetOz && plan.hydrationTargetOz > 0) {
    hydrationPts = Math.round(Math.min((plan.hydrationActualOz / plan.hydrationTargetOz) * 15, 15) * 10) / 10;
  }
  let calPts = 0;
  if (plan.calorieActual && plan.calorieTarget && plan.calorieTarget > 0) {
    const ratio = Math.abs(plan.calorieActual - plan.calorieTarget) / plan.calorieTarget;
    if (ratio <= 0.1) calPts = 15;
    else if (ratio <= 0.2) calPts = 10;
    else calPts = 5;
  }
  let sleepPts = 0;
  if (plan.sleepHours != null) {
    if (plan.sleepHours >= 7) sleepPts = 10;
    else if (plan.sleepHours >= 6) sleepPts = 7;
    else sleepPts = 3;
  }

  const hydPct =
    plan.hydrationTargetOz && plan.hydrationTargetOz > 0
      ? Math.min(100, ((plan.hydrationActualOz || 0) / plan.hydrationTargetOz) * 100)
      : 0;

  const weightDelta =
    plan.weightMorning != null && previousDay?.weight != null
      ? plan.weightMorning - previousDay.weight
      : null;

  const budgetDelta =
    plan.budgetTarget && plan.budgetTarget > 0 && plan.budgetActual != null
      ? ((plan.budgetActual - plan.budgetTarget) / plan.budgetTarget) * 100
      : null;

  const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalPro = meals.reduce((s, m) => s + (m.protein || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 to-gray-900 overflow-y-auto">
      <div className="p-8 md:p-12 max-w-5xl mx-auto">
        {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm font-mono">TS</span>
            </div>
            <span className="text-sm text-gray-500 font-mono">Temple Stuart</span>
          </div>
          <div className="bg-gray-800 rounded-full p-0.5 flex">
            <button
              onClick={() => setRecordTab('morning')}
              className={`px-4 py-1.5 text-xs font-mono rounded-full transition ${
                recordTab === 'morning'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Morning
            </button>
            <button
              onClick={() => setRecordTab('evening')}
              className={`px-4 py-1.5 text-xs font-mono rounded-full transition ${
                recordTab === 'evening'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Evening
            </button>
          </div>
        </div>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-baseline">
            <span className="text-7xl font-bold text-white tracking-tight">DAY {dayNumber}</span>
            <span className="text-3xl text-gray-600 ml-2">/ {plan.sprintTotalDays}</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full mt-4">
            <div
              className="h-3 bg-indigo-500 rounded-full transition-all"
              style={{ width: `${sprintPct}%` }}
            />
          </div>
          <p className="text-lg text-gray-400 font-mono mt-2">{displayDate}</p>
          {plan.mission && (
            <p className="text-2xl text-gray-200 font-medium mt-4">
              {plan.missionCompleted && (
                <span className="text-emerald-400 mr-2">&#10003;</span>
              )}
              {plan.mission}
            </p>
          )}
        </div>

        {/* ── MORNING TAB ──────────────────────────────────────────────────── */}
        {recordTab === 'morning' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Tasks */}
            <div className={CARD}>
              <div className="flex items-center justify-between mb-4">
                <span className={LABEL}>Tasks</span>
                <span className="text-xs text-gray-500 font-mono">{tasks.length} planned</span>
              </div>
              {tasks.length === 0 && (
                <p className="text-sm text-gray-600 font-mono">No tasks planned</p>
              )}
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${PRIORITY_COLORS[t.priority]}`} />
                    <span className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-200 font-mono">{t.text || 'Untitled task'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className={CARD}>
              <div className="flex items-center justify-between mb-4">
                <span className={LABEL}>Schedule</span>
              </div>
              {schedule.length === 0 && (
                <p className="text-sm text-gray-600 font-mono">No schedule set</p>
              )}
              <div className="space-y-2">
                {schedule.map((b) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className="text-sm text-indigo-400 font-mono w-20 flex-shrink-0">
                      {b.time || '--:--'}
                    </span>
                    <span className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-200 font-mono">{b.activity || 'Untitled'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className={CARD}>
              <div className="mb-4">
                <span className={LABEL}>Budget</span>
              </div>
              <p className="text-lg text-gray-200 font-mono">
                Target: ${plan.budgetTarget?.toFixed(2) ?? '—'}
              </p>
            </div>

            {/* Targets */}
            <div className={CARD}>
              <div className="mb-4">
                <span className={LABEL}>Targets</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-mono">
                  <span className="text-gray-500">Workout: </span>
                  <span className="text-gray-300">
                    {plan.workoutPlanned ? plan.workoutType || 'Planned' : 'Rest day'}
                  </span>
                </p>
                <p className="text-sm font-mono">
                  <span className="text-gray-500">Hydration: </span>
                  <span className="text-gray-300">{plan.hydrationTargetOz ?? 128} oz</span>
                </p>
                <p className="text-sm font-mono">
                  <span className="text-gray-500">Calories: </span>
                  <span className="text-gray-300">{plan.calorieTarget ?? '—'} cal</span>
                </p>
                <p className="text-sm font-mono">
                  <span className="text-gray-500">Protein: </span>
                  <span className="text-gray-300">{plan.proteinTargetG ?? '—'}g</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── EVENING TAB ──────────────────────────────────────────────────── */}
        {recordTab === 'evening' && (
          <div className="space-y-6 mt-8">
            {/* ROW 1: Tasks + Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tasks with results */}
              <div className={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <span className={LABEL}>Tasks</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {completedTasks}/{tasks.length} completed
                  </span>
                </div>
                {tasks.length === 0 && (
                  <p className="text-sm text-gray-600 font-mono">No tasks</p>
                )}
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${PRIORITY_COLORS[t.priority]}`} />
                      {t.completed ? (
                        <span className="text-emerald-400 text-sm w-5 text-center flex-shrink-0">&#10003;</span>
                      ) : (
                        <span className="text-red-400 text-sm w-5 text-center flex-shrink-0">&#10007;</span>
                      )}
                      <span
                        className={`text-sm font-mono ${
                          t.completed ? 'text-gray-200' : 'text-gray-500'
                        }`}
                      >
                        {t.text || 'Untitled task'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule with results */}
              <div className={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <span className={LABEL}>Schedule</span>
                </div>
                {schedule.length === 0 && (
                  <p className="text-sm text-gray-600 font-mono">No schedule</p>
                )}
                <div className="space-y-2">
                  {schedule.map((b) => (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className="text-sm text-indigo-400 font-mono w-20 flex-shrink-0">
                        {b.time || '--:--'}
                      </span>
                      {b.completed ? (
                        <span className="text-emerald-400 text-sm w-5 text-center flex-shrink-0">&#10003;</span>
                      ) : (
                        <span className="text-gray-600 text-sm w-5 text-center flex-shrink-0">&#9675;</span>
                      )}
                      <span
                        className={`text-sm font-mono ${
                          b.completed ? 'text-gray-200' : 'text-gray-500'
                        }`}
                      >
                        {b.activity || 'Untitled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 2: Budget + Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Budget plan vs actual */}
              <div className={CARD}>
                <div className="mb-4">
                  <span className={LABEL}>Budget</span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Target: </span>
                    <span className="text-gray-200">${plan.budgetTarget?.toFixed(2) ?? '—'}</span>
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Actual: </span>
                    <span className="text-gray-200">${plan.budgetActual?.toFixed(2) ?? '—'}</span>
                  </p>
                  {budgetDelta != null && (
                    <p
                      className={`text-sm font-mono font-medium ${
                        budgetDelta <= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {budgetDelta <= 0
                        ? `Under ▼${Math.abs(budgetDelta).toFixed(0)}%`
                        : `Over ▲${budgetDelta.toFixed(0)}%`}
                    </p>
                  )}
                </div>
              </div>

              {/* Health actuals */}
              <div className={CARD}>
                <div className="mb-4">
                  <span className={LABEL}>Health</span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Weight: </span>
                    <span className="text-gray-200">
                      {plan.weightMorning != null ? `${plan.weightMorning} lbs` : '—'}
                    </span>
                    {weightDelta != null && weightDelta !== 0 && (
                      <span
                        className={`ml-2 ${
                          weightDelta < 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {weightDelta < 0 ? '▼' : '▲'}
                        {Math.abs(weightDelta).toFixed(1)}
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Workout: </span>
                    {plan.workoutCompleted ? (
                      <span className="text-emerald-400">
                        &#10003; {plan.workoutType || 'Done'}
                        {plan.workoutDuration ? ` · ${plan.workoutDuration}min` : ''}
                      </span>
                    ) : (
                      <span className="text-red-400">&#10007; Skipped</span>
                    )}
                  </p>
                  <div>
                    <p className="text-sm font-mono">
                      <span className="text-gray-500">Hydration: </span>
                      <span className="text-gray-200">
                        {plan.hydrationActualOz ?? 0}/{plan.hydrationTargetOz ?? 128} oz
                      </span>
                    </p>
                    <div className="h-1.5 bg-gray-700 rounded-full mt-1">
                      <div
                        className="h-1.5 bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${hydPct}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Calories: </span>
                    <span className="text-gray-200">
                      {plan.calorieActual ?? '—'}/{plan.calorieTarget ?? '—'} cal
                    </span>
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Protein: </span>
                    <span className="text-gray-200">
                      {plan.proteinActualG ?? '—'}/{plan.proteinTargetG ?? '—'}g
                    </span>
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Sleep: </span>
                    <span className="text-gray-200">
                      {plan.sleepHours != null ? `${plan.sleepHours}h` : '—'}
                    </span>
                    {plan.sleepQuality && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-mono rounded-full bg-gray-700 text-gray-300">
                        {plan.sleepQuality}
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-mono">
                    <span className="text-gray-500">Steps: </span>
                    <span className="text-gray-200">
                      {plan.steps != null ? plan.steps.toLocaleString() : '—'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* ROW 3: Meals */}
            {meals.length > 0 && (
              <div className={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <span className={LABEL}>Meals</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {totalCal} cal &middot; {totalPro}g protein
                  </span>
                </div>
                <div className="space-y-2">
                  {meals.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="w-6 text-center">{MEAL_EMOJI[m.name]}</span>
                      <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">{m.name}</span>
                      <span className="text-sm text-gray-200 font-mono flex-1">{m.description || '—'}</span>
                      <span className="text-xs text-gray-400 font-mono">{m.calories} cal</span>
                      <span className="text-xs text-gray-500 font-mono">{m.protein}g</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ROW 4: Day Score */}
            <div className="bg-gray-800/70 border border-gray-700/50 rounded-xl p-6 backdrop-blur">
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold ${scoreColor(score)}`}>{score}</span>
                <span className="text-2xl text-gray-600">/ 100</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full mt-4">
                <div
                  className={`h-3 rounded-full transition-all ${barFill(score)}`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 font-mono mt-2">
                Tasks: {taskPts}/40 &middot; Workout: {workoutPts}/20 &middot; Hydration:{' '}
                {hydrationPts}/15 &middot; Calories: {calPts}/15 &middot; Sleep: {sleepPts}/10
              </p>
              {plan.wins && (
                <p className="text-sm text-gray-300 font-mono mt-4">
                  <span className="text-indigo-400 mr-2">&#10022;</span>
                  {plan.wins}
                </p>
              )}
              {plan.blockers && (
                <p className="text-sm text-gray-400 font-mono mt-2">
                  <span className="text-amber-400 mr-2">&#9651;</span>
                  {plan.blockers}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── EXIT BUTTON ──────────────────────────────────────────────────── */}
      <button
        onClick={onExit}
        className="fixed bottom-4 right-4 bg-gray-800/80 text-gray-400 hover:text-white text-xs font-mono px-3 py-1.5 rounded-lg border border-gray-700 backdrop-blur transition-colors"
      >
        Exit Record Mode
      </button>
    </div>
  );
}
