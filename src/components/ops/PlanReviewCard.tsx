'use client';

import { useState, KeyboardEvent } from 'react';

const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };
const MEAL_EMOJI: Record<string, string> = { Breakfast: '\u{1F305}', Lunch: '\u{1F31E}', Dinner: '\u{1F319}', Snack: '\u{1F34E}' };

interface PlanReviewCardProps {
  plan: Record<string, unknown>;
  aiNotes: string | null;
  onLockIn: () => void;
  onAdjust: (adjustment: string) => Promise<void>;
  onStartOver: () => void;
  isAdjusting: boolean;
}

export default function PlanReviewCard({
  plan,
  aiNotes,
  onLockIn,
  onAdjust,
  onStartOver,
  isAdjusting,
}: PlanReviewCardProps) {
  const [adjustText, setAdjustText] = useState('');

  const tasks = Array.isArray(plan.tasks) ? (plan.tasks as Array<{ text: string; priority: string; estimatedMinutes?: number }>) : [];
  const schedule = Array.isArray(plan.schedule) ? (plan.schedule as Array<{ time: string; activity: string; durationMinutes?: number }>) : [];
  const meals = Array.isArray(plan.meals) ? (plan.meals as Array<{ name: string; description: string; calories?: number; protein?: number }>) : [];
  const totalMinutes = tasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);

  const handleAdjust = async () => {
    if (!adjustText.trim()) return;
    await onAdjust(adjustText);
    setAdjustText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdjust();
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-lg font-semibold text-text-primary">Your Plan</span>
          <p className="text-terminal-sm text-text-muted font-mono mt-0.5">Review and adjust, then lock it in.</p>
        </div>

        <div className="divide-y divide-border-light">
          {/* AI Notes */}
          {aiNotes && (
            <div className="px-3 py-3">
              <div className="bg-brand-purple-wash border border-brand-purple/10 rounded p-3 text-terminal-sm font-mono text-text-secondary">
                {aiNotes}
              </div>
            </div>
          )}

          {/* Mission */}
          {plan.mission != null && (
            <div className="px-3 py-3">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Mission</p>
              <p className="text-sm font-medium text-text-primary font-mono">&ldquo;{String(plan.mission)}&rdquo;</p>
            </div>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">Tasks</p>
                <span className="text-terminal-sm text-text-faint font-mono">{tasks.length} tasks &middot; ~{totalMinutes}min</span>
              </div>
              <div className="space-y-1">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIO_DOT[t.priority] || 'bg-amber-500'}`} />
                    <span className="text-terminal-base font-mono text-text-primary flex-1">{t.text}</span>
                    {t.estimatedMinutes != null && t.estimatedMinutes > 0 && (
                      <span className="text-terminal-sm text-text-faint font-mono">{t.estimatedMinutes}m</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          {schedule.length > 0 && (
            <div className="px-3 py-3">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Schedule</p>
              <div className="space-y-1">
                {schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-terminal-base font-mono text-brand-purple w-14 flex-shrink-0">{s.time}</span>
                    <span className="text-terminal-base font-mono text-text-primary flex-1">{s.activity}</span>
                    {s.durationMinutes != null && s.durationMinutes > 0 && (
                      <span className="text-terminal-sm text-text-faint font-mono">{s.durationMinutes}m</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health + Budget */}
          <div className="px-3 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Health</p>
              <div className="space-y-0.5 text-terminal-base font-mono text-text-primary">
                {plan.workoutPlanned === true && (
                  <p>Workout: {plan.workoutType != null ? String(plan.workoutType) : 'Planned'}
                    {plan.workoutDuration != null && <span className="text-text-muted"> &middot; {String(plan.workoutDuration)}min</span>}
                  </p>
                )}
                {plan.hydrationTargetOz != null && <p>Hydration: {String(plan.hydrationTargetOz)}oz</p>}
                {plan.calorieTarget != null && <p>Calories: {String(plan.calorieTarget)}</p>}
                {plan.proteinTargetG != null && <p>Protein: {String(plan.proteinTargetG)}g</p>}
                {plan.sleepHours != null && (
                  <p>Sleep: {String(plan.sleepHours)}h
                    {plan.sleepQuality != null && <span className="text-text-muted"> ({String(plan.sleepQuality)})</span>}
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Budget</p>
              <p className="text-terminal-base font-mono text-text-primary">
                {plan.budgetTarget != null ? `$${String(plan.budgetTarget)}` : '—'}
              </p>
            </div>
          </div>

          {/* Meals */}
          {meals.length > 0 && (
            <div className="px-3 py-3">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Meals</p>
              <div className="space-y-1">
                {meals.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 text-center">{MEAL_EMOJI[m.name] || '\u{1F34E}'}</span>
                    <span className="text-terminal-sm text-text-muted font-mono w-16 flex-shrink-0">{m.name}</span>
                    <span className="text-terminal-base font-mono text-text-primary flex-1">{m.description || '—'}</span>
                    {m.calories != null && m.calories > 0 && (
                      <span className="text-terminal-sm text-text-faint font-mono">{m.calories}cal</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjustment */}
          <div className="px-3 py-3">
            <p className="text-terminal-sm text-text-muted font-mono mb-2">Want to change anything?</p>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={adjustText}
                onChange={(e) => setAdjustText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Move gym to 6am, add a task, drop something..."
                disabled={isAdjusting}
                className="flex-1 resize-none font-mono text-terminal-base text-text-primary bg-bg-terminal border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint disabled:opacity-50"
              />
              <button
                onClick={handleAdjust}
                disabled={isAdjusting || !adjustText.trim()}
                className="self-end px-3 py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-terminal-base disabled:opacity-40"
              >
                {isAdjusting ? '...' : 'Adjust'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions — outside the card */}
      <div className="flex items-center justify-between">
        <button
          onClick={onStartOver}
          className="text-terminal-base text-text-muted hover:text-text-primary font-mono transition-colors"
        >
          Start over
        </button>
        <button
          onClick={onLockIn}
          className="px-6 py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium"
        >
          &#128640; Lock it in
        </button>
      </div>
    </div>
  );
}
