'use client';

import { useState, useEffect } from 'react';
import { DailyPlan, calculateDayScore } from './types';

interface EndOfDayCardProps {
  plan: DailyPlan;
  onUpdate: (field: keyof DailyPlan, value: DailyPlan[keyof DailyPlan]) => void;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function barColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-400';
}

export default function EndOfDayCard({ plan, onUpdate }: EndOfDayCardProps) {
  const [wins, setWins] = useState(plan.wins ?? '');
  const [blockers, setBlockers] = useState(plan.blockers ?? '');
  const [reflection, setReflection] = useState(plan.reflection ?? '');

  useEffect(() => {
    setWins(plan.wins ?? '');
    setBlockers(plan.blockers ?? '');
    setReflection(plan.reflection ?? '');
  }, [plan.wins, plan.blockers, plan.reflection]);

  const score = calculateDayScore(plan);

  // Sub-score breakdown
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const taskPts =
    tasks.length > 0
      ? Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 40 * 10) / 10
      : 0;

  const workoutPts = plan.workoutCompleted ? 20 : 0;

  let hydrationPts = 0;
  if (plan.hydrationActualOz && plan.hydrationTargetOz && plan.hydrationTargetOz > 0) {
    hydrationPts =
      Math.round(Math.min((plan.hydrationActualOz / plan.hydrationTargetOz) * 15, 15) * 10) / 10;
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

  const TEXTAREA_CLS =
    'w-full bg-transparent border-none outline-none text-terminal-base font-mono text-text-primary px-2 py-1.5 hover:bg-gray-50 focus:bg-gray-50 focus:ring-1 focus:ring-brand-purple/20 rounded resize-none transition-colors placeholder:text-text-faint';

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">End of Day</span>
        <span className={`text-terminal-base font-mono font-semibold ${scoreColor(score)}`}>
          {score} / 100
        </span>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Score bar */}
        <div>
          <div className="h-2 bg-gray-100 rounded-full">
            <div
              className={`h-2 rounded-full transition-all ${barColor(score)}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">
            Tasks: {taskPts}/40 &middot; Workout: {workoutPts}/20 &middot; Hydration:{' '}
            {hydrationPts}/15 &middot; Calories: {calPts}/15 &middot; Sleep: {sleepPts}/10
          </p>
        </div>

        {/* Wins */}
        <div>
          <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
            Wins
          </label>
          <textarea
            rows={2}
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            onBlur={() => onUpdate('wins', wins || null)}
            placeholder="What went well today?"
            className={TEXTAREA_CLS}
          />
        </div>

        {/* Blockers */}
        <div>
          <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
            Blockers
          </label>
          <textarea
            rows={2}
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            onBlur={() => onUpdate('blockers', blockers || null)}
            placeholder="What got in the way?"
            className={TEXTAREA_CLS}
          />
        </div>

        {/* Reflection */}
        <div>
          <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
            Reflection
          </label>
          <textarea
            rows={2}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            onBlur={() => onUpdate('reflection', reflection || null)}
            placeholder="Any thoughts on the day?"
            className={TEXTAREA_CLS}
          />
        </div>
      </div>
    </div>
  );
}
