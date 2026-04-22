'use client';

import { useState, useEffect } from 'react';
import { DailyPlan, PreviousDay } from './types';

const SLEEP_QUALITIES = ['great', 'good', 'okay', 'poor'] as const;

const INPUT_CLS =
  'bg-transparent border-none outline-none text-terminal-base font-mono text-text-primary px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

interface HealthCardProps {
  plan: DailyPlan;
  previousDay: PreviousDay | null;
  onUpdate: (field: keyof DailyPlan, value: DailyPlan[keyof DailyPlan]) => void;
}

export default function HealthCard({ plan, previousDay, onUpdate }: HealthCardProps) {
  const [weight, setWeight] = useState(plan.weightMorning?.toString() ?? '');
  const [workoutType, setWorkoutType] = useState(plan.workoutType ?? '');
  const [duration, setDuration] = useState(plan.workoutDuration?.toString() ?? '');
  const [hydActual, setHydActual] = useState(plan.hydrationActualOz?.toString() ?? '');
  const [hydTarget, setHydTarget] = useState(plan.hydrationTargetOz?.toString() ?? '');
  const [calActual, setCalActual] = useState(plan.calorieActual?.toString() ?? '');
  const [calTarget, setCalTarget] = useState(plan.calorieTarget?.toString() ?? '');
  const [proActual, setProActual] = useState(plan.proteinActualG?.toString() ?? '');
  const [proTarget, setProTarget] = useState(plan.proteinTargetG?.toString() ?? '');
  const [sleepHrs, setSleepHrs] = useState(plan.sleepHours?.toString() ?? '');
  const [steps, setSteps] = useState(plan.steps?.toString() ?? '');

  useEffect(() => {
    setWeight(plan.weightMorning?.toString() ?? '');
    setWorkoutType(plan.workoutType ?? '');
    setDuration(plan.workoutDuration?.toString() ?? '');
    setHydActual(plan.hydrationActualOz?.toString() ?? '');
    setHydTarget(plan.hydrationTargetOz?.toString() ?? '');
    setCalActual(plan.calorieActual?.toString() ?? '');
    setCalTarget(plan.calorieTarget?.toString() ?? '');
    setProActual(plan.proteinActualG?.toString() ?? '');
    setProTarget(plan.proteinTargetG?.toString() ?? '');
    setSleepHrs(plan.sleepHours?.toString() ?? '');
    setSteps(plan.steps?.toString() ?? '');
  }, [plan]);

  const commitFloat = (field: keyof DailyPlan, raw: string) => {
    const v = parseFloat(raw);
    onUpdate(field, isNaN(v) ? null : v);
  };

  const commitInt = (field: keyof DailyPlan, raw: string) => {
    const v = parseInt(raw, 10);
    onUpdate(field, isNaN(v) ? null : v);
  };

  // Weight delta
  const weightNum = parseFloat(weight);
  const prevWeight = previousDay?.weight;
  const weightDelta =
    !isNaN(weightNum) && prevWeight != null ? weightNum - prevWeight : null;

  // Hydration progress
  const hydA = parseInt(hydActual, 10) || 0;
  const hydT = parseInt(hydTarget, 10) || 128;
  const hydPct = hydT > 0 ? Math.min(100, (hydA / hydT) * 100) : 0;

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">
          Health &amp; Wellness
        </span>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        {/* Weight */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Weight</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => commitFloat('weightMorning', weight)}
            placeholder="0.0"
            step="0.1"
            className={`${INPUT_CLS} w-20`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">lbs</span>
          {weightDelta != null && weightDelta !== 0 && (
            <span
              className={`text-terminal-sm font-mono font-medium ${
                weightDelta < 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {weightDelta < 0 ? '▼' : '▲'}
              {Math.abs(weightDelta).toFixed(1)}
            </span>
          )}
        </div>

        {/* Workout */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Workout</span>
          <input
            type="checkbox"
            checked={plan.workoutCompleted}
            onChange={() => onUpdate('workoutCompleted', !plan.workoutCompleted)}
            className="w-3.5 h-3.5 rounded border-border accent-brand-purple flex-shrink-0"
          />
          <input
            type="text"
            value={workoutType}
            onChange={(e) => setWorkoutType(e.target.value)}
            onBlur={() => onUpdate('workoutType', workoutType || null)}
            placeholder="Workout type"
            className={`${INPUT_CLS} flex-1`}
          />
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => commitInt('workoutDuration', duration)}
            placeholder="min"
            className={`${INPUT_CLS} w-14`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">min</span>
        </div>

        {/* Hydration */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Hydration</span>
            <input
              type="number"
              value={hydActual}
              onChange={(e) => setHydActual(e.target.value)}
              onBlur={() => commitInt('hydrationActualOz', hydActual)}
              placeholder="0"
              className={`${INPUT_CLS} w-14`}
            />
            <span className="text-terminal-sm text-text-muted font-mono">/</span>
            <input
              type="number"
              value={hydTarget}
              onChange={(e) => setHydTarget(e.target.value)}
              onBlur={() => commitInt('hydrationTargetOz', hydTarget)}
              placeholder="128"
              className={`${INPUT_CLS} w-14`}
            />
            <span className="text-terminal-sm text-text-muted font-mono">oz</span>
          </div>
          <div className="ml-[88px] mt-1 h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-1.5 rounded-full bg-brand-purple transition-all"
              style={{ width: `${hydPct}%` }}
            />
          </div>
        </div>

        {/* Calories */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Calories</span>
          <input
            type="number"
            value={calActual}
            onChange={(e) => setCalActual(e.target.value)}
            onBlur={() => commitInt('calorieActual', calActual)}
            placeholder="0"
            className={`${INPUT_CLS} w-16`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">/</span>
          <input
            type="number"
            value={calTarget}
            onChange={(e) => setCalTarget(e.target.value)}
            onBlur={() => commitInt('calorieTarget', calTarget)}
            placeholder="2200"
            className={`${INPUT_CLS} w-16`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">cal</span>
        </div>

        {/* Protein */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Protein</span>
          <input
            type="number"
            value={proActual}
            onChange={(e) => setProActual(e.target.value)}
            onBlur={() => commitInt('proteinActualG', proActual)}
            placeholder="0"
            className={`${INPUT_CLS} w-16`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">/</span>
          <input
            type="number"
            value={proTarget}
            onChange={(e) => setProTarget(e.target.value)}
            onBlur={() => commitInt('proteinTargetG', proTarget)}
            placeholder="180"
            className={`${INPUT_CLS} w-16`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">g</span>
        </div>

        {/* Sleep */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Sleep</span>
          <input
            type="number"
            value={sleepHrs}
            onChange={(e) => setSleepHrs(e.target.value)}
            onBlur={() => commitFloat('sleepHours', sleepHrs)}
            placeholder="0"
            step="0.5"
            className={`${INPUT_CLS} w-14`}
          />
          <span className="text-terminal-sm text-text-muted font-mono">hrs</span>
          <div className="flex items-center gap-1 ml-1">
            {SLEEP_QUALITIES.map((q) => (
              <button
                key={q}
                onClick={() => onUpdate('sleepQuality', q)}
                className={`px-2 py-0.5 text-terminal-sm font-mono rounded-full transition-colors ${
                  plan.sleepQuality === q
                    ? 'bg-brand-purple-wash text-brand-purple border border-brand-purple/20'
                    : 'bg-gray-50 text-text-faint hover:bg-gray-100 border border-transparent'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-20 flex-shrink-0">Steps</span>
          <input
            type="number"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            onBlur={() => commitInt('steps', steps)}
            placeholder="0"
            className={`${INPUT_CLS} w-20`}
          />
        </div>
      </div>
    </div>
  );
}
