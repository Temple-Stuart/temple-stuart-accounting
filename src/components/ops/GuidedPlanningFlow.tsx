'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DailyPlan, Task, ScheduleBlock, Meal, generateId } from './types';

interface Answers {
  energy: string;
  mission: string;
  tasks: string;
  body: string;
  budget: string;
  schedule: string;
}

const EMPTY_ANSWERS: Answers = { energy: '', mission: '', tasks: '', body: '', budget: '', schedule: '' };

const STEPS = [
  {
    key: 'energy' as const,
    label: '01 — ENERGY & SLEEP',
    question: 'How are you feeling right now? How’d you sleep?',
    hint: 'Sharp and ready? Foggy and dragging? Wired on caffeine? Just say it how it is.',
    placeholder: 'I slept about 6 hours, feeling okay but a little scattered...',
    rows: 4,
  },
  {
    key: 'mission' as const,
    label: '02 — TODAY’S MISSION',
    question: 'If you could only accomplish ONE thing today, what would it be?',
    hint: 'What would make you feel like today was a win? One sentence.',
    placeholder: 'Ship the bookkeeping commit flow and test with a new user...',
    rows: 4,
  },
  {
    key: 'tasks' as const,
    label: '03 — BRAIN DUMP',
    question: 'What else needs to happen today? Dump it all.',
    hint: 'Work tasks, errands, calls, emails, stuff you’ve been putting off. Don’t organize, just list.',
    placeholder: 'Fix the Plaid duplicate bug, call the vet about Winston, review Claude Code PR, pick up dog food, respond to that email from the accountant...',
    rows: 6,
  },
  {
    key: 'body' as const,
    label: '04 — BODY & FOOD',
    question: 'What’s the plan for your body today? Workout, meals, anything health-related?',
    hint: 'Gym plans, what you’re eating, calorie/protein goals, hydration, rest day — whatever applies.',
    placeholder: 'CorePower at 10am, trying to hit 2200 cals and 180g protein, need to drink more water today...',
    rows: 4,
  },
  {
    key: 'budget' as const,
    label: '05 — BUDGET',
    question: 'What’s your spending target today? Any purchases planned?',
    hint: 'A dollar amount, or just “trying to spend nothing.” Known expenses are helpful too.',
    placeholder: 'Trying to stay under $50, need to buy dog food though which will be about $30...',
    rows: 4,
  },
  {
    key: 'schedule' as const,
    label: '06 — FIXED COMMITMENTS',
    question: 'Anything locked in at a specific time today?',
    hint: 'Meetings, appointments, classes, calls — things you can’t move. If nothing, say “nothing fixed.”',
    placeholder: 'CorePower at 10am, need to pick up a package before 5pm...',
    rows: 4,
  },
];

const LOADING_MESSAGES = [
  'Analyzing energy level...',
  'Organizing tasks by priority...',
  'Building your time blocks...',
  'Finalizing your plan...',
];

const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };
const MEAL_EMOJI: Record<string, string> = { Breakfast: '\u{1F305}', Lunch: '\u{1F31E}', Dinner: '\u{1F319}', Snack: '\u{1F34E}' };

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

interface GuidedPlanningFlowProps {
  selectedDate: string;
  dayNumber: number;
  sprintTotalDays: number;
  onPlanComplete: (planData: Partial<DailyPlan>) => void;
  onCancel?: () => void;
}

export default function GuidedPlanningFlow({
  selectedDate,
  dayNumber,
  sprintTotalDays,
  onPlanComplete,
  onCancel,
}: GuidedPlanningFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [generatedPlan, setGeneratedPlan] = useState<Record<string, unknown> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [adjustmentText, setAdjustmentText] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const sprintPct = Math.max(0, Math.min(100, (dayNumber / sprintTotalDays) * 100));

  useEffect(() => {
    if (currentStep >= 1 && currentStep <= 6) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const generatePlan = useCallback(async () => {
    setIsGenerating(true);
    setCurrentStep(7);
    try {
      const res = await fetch('/api/ops/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, date: selectedDate, dayNumber }),
      });
      if (res.ok) {
        const data = await res.json();
        const plan = extractPlanJSON(data.reply);
        if (plan) {
          setGeneratedPlan(plan);
        }
      }
    } catch (err) {
      console.error('Plan generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [answers, selectedDate, dayNumber]);

  const adjustPlan = useCallback(async () => {
    if (!adjustmentText.trim() || !generatedPlan) return;
    setIsAdjusting(true);
    try {
      const res = await fetch('/api/ops/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'adjust', adjustment: adjustmentText, currentPlan: generatedPlan }),
      });
      if (res.ok) {
        const data = await res.json();
        const plan = extractPlanJSON(data.reply);
        if (plan) {
          setGeneratedPlan(plan);
          setAdjustmentText('');
        }
      }
    } catch (err) {
      console.error('Adjustment failed:', err);
    } finally {
      setIsAdjusting(false);
    }
  }, [adjustmentText, generatedPlan]);

  const lockItIn = () => {
    if (!generatedPlan) return;
    const fields = mapPlanToFields(generatedPlan);
    onPlanComplete(fields);
  };

  const stepKey = currentStep >= 1 && currentStep <= 6 ? STEPS[currentStep - 1].key : null;
  const currentAnswer = stepKey ? answers[stepKey] : '';

  const setCurrentAnswer = (val: string) => {
    if (!stepKey) return;
    setAnswers((prev) => ({ ...prev, [stepKey]: val }));
  };

  const goNext = () => {
    if (currentStep === 6) {
      generatePlan();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  // ── STEP 0: Intro ────────────────────────────────────────────────────────

  if (currentStep === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-3xl font-bold text-text-primary font-mono">DAY {dayNumber}</span>
          <span className="text-lg text-text-muted font-mono">/ {sprintTotalDays}</span>
        </div>
        <p className="text-terminal-base text-text-muted font-mono mb-4">{displayDate}</p>
        <div className="w-full h-2 bg-bg-row rounded-full mb-8 max-w-xs mx-auto">
          <div className="h-2 rounded-full bg-brand-purple transition-all" style={{ width: `${sprintPct}%` }} />
        </div>
        <h1 className="text-xl font-medium text-text-primary mb-2">Let&apos;s plan your day.</h1>
        <p className="text-sm text-text-muted font-mono mb-8">
          6 quick questions. Talk naturally. I&apos;ll build your schedule.
        </p>
        <button
          onClick={() => setCurrentStep(1)}
          className="px-6 py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium"
        >
          &#128640; Let&apos;s go
        </button>
        <p className="text-terminal-sm text-text-faint font-mono mt-4">Takes about 2 minutes</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 text-terminal-sm text-text-muted hover:text-text-primary font-mono transition-colors"
          >
            &larr; Back to dashboard
          </button>
        )}
      </div>
    );
  }

  // ── STEPS 1-6: Question screens ──────────────────────────────────────────

  if (currentStep >= 1 && currentStep <= 6) {
    const step = STEPS[currentStep - 1];
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < currentStep - 1 ? 'bg-brand-purple-light' : i === currentStep - 1 ? 'bg-brand-purple' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-terminal-sm text-text-muted font-mono">Step {currentStep} of 6</span>
        </div>

        {/* Question */}
        <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-3">
          {step.label}
        </p>
        <h2 className="text-lg font-medium text-text-primary mb-2">{step.question}</h2>
        <p className="text-terminal-sm text-text-faint font-mono mb-6">{step.hint}</p>

        {/* Answer */}
        <textarea
          ref={textareaRef}
          rows={step.rows}
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          placeholder={step.placeholder}
          className="w-full resize-none font-mono text-sm text-text-primary bg-white border border-border rounded-lg p-3 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
        />

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            className="text-terminal-base text-text-muted hover:text-text-primary font-mono transition-colors"
          >
            &larr; Back
          </button>
          <button
            onClick={goNext}
            disabled={!currentAnswer.trim()}
            className="px-5 py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
          >
            {currentStep === 6 ? 'Generate Plan →' : 'Next →'}
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 7: Generating / Review ──────────────────────────────────────────

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-medium text-text-primary">Building your plan...</p>
        <p className="text-sm text-text-muted font-mono transition-opacity">{LOADING_MESSAGES[loadingMsgIdx]}</p>
      </div>
    );
  }

  if (!generatedPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-text-muted font-mono text-sm">Something went wrong generating your plan.</p>
        <button
          onClick={() => setCurrentStep(6)}
          className="text-sm text-brand-purple hover:underline font-mono"
        >
          &larr; Try again
        </button>
      </div>
    );
  }

  // ── Plan Review ────────────────────────────────────────────────────────

  const tasks = Array.isArray(generatedPlan.tasks) ? (generatedPlan.tasks as Array<{ text: string; priority: string; estimatedMinutes?: number }>) : [];
  const schedule = Array.isArray(generatedPlan.schedule) ? (generatedPlan.schedule as Array<{ time: string; activity: string; durationMinutes?: number }>) : [];
  const meals = Array.isArray(generatedPlan.meals) ? (generatedPlan.meals as Array<{ name: string; description: string; calories?: number; protein?: number }>) : [];
  const aiNotes = generatedPlan.aiNotes ? String(generatedPlan.aiNotes) : null;
  const totalMinutes = tasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-text-primary font-mono">
        Here&apos;s your plan for Day {dayNumber}
      </h1>

      {/* AI Notes */}
      {aiNotes && (
        <div className="bg-brand-purple-wash border border-brand-purple/10 rounded-lg p-3 text-terminal-base font-mono text-text-secondary">
          {aiNotes}
        </div>
      )}

      {/* Mission */}
      {generatedPlan.mission != null && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Mission</p>
          <p className="text-sm font-medium text-text-primary font-mono">&ldquo;{String(generatedPlan.mission)}&rdquo;</p>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-terminal-lg font-semibold text-text-primary">Tasks</span>
            <span className="text-terminal-sm text-text-muted font-mono">
              {tasks.length} tasks &middot; ~{totalMinutes}min
            </span>
          </div>
          <div>
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5">
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
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-lg font-semibold text-text-primary">Schedule</span>
          </div>
          <div>
            {schedule.map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
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

      {/* Health + Budget row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Health */}
        <div className="bg-white rounded border border-border shadow-sm p-3 space-y-1">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Health</p>
          {generatedPlan.workoutPlanned === true && (
            <p className="text-terminal-base font-mono text-text-primary">
              Workout: {generatedPlan.workoutType != null ? String(generatedPlan.workoutType) : 'Planned'}
              {generatedPlan.workoutDuration != null && <span className="text-text-muted"> &middot; {String(generatedPlan.workoutDuration)}min</span>}
            </p>
          )}
          {generatedPlan.hydrationTargetOz != null && (
            <p className="text-terminal-base font-mono text-text-primary">Hydration: {String(generatedPlan.hydrationTargetOz)}oz</p>
          )}
          {generatedPlan.calorieTarget != null && (
            <p className="text-terminal-base font-mono text-text-primary">Calories: {String(generatedPlan.calorieTarget)}</p>
          )}
          {generatedPlan.proteinTargetG != null && (
            <p className="text-terminal-base font-mono text-text-primary">Protein: {String(generatedPlan.proteinTargetG)}g</p>
          )}
          {generatedPlan.sleepHours != null && (
            <p className="text-terminal-base font-mono text-text-primary">
              Sleep: {String(generatedPlan.sleepHours)}h
              {generatedPlan.sleepQuality != null && <span className="text-text-muted"> ({String(generatedPlan.sleepQuality)})</span>}
            </p>
          )}
        </div>

        {/* Budget */}
        <div className="bg-white rounded border border-border shadow-sm p-3">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Budget</p>
          <p className="text-terminal-base font-mono text-text-primary">
            {generatedPlan.budgetTarget != null ? `$${String(generatedPlan.budgetTarget)}` : '—'}
          </p>
        </div>
      </div>

      {/* Meals */}
      {meals.length > 0 && (
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-lg font-semibold text-text-primary">Meals</span>
          </div>
          <div>
            {meals.map((m, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5">
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

      {/* Adjustment input */}
      <div className="bg-white rounded border border-border shadow-sm p-3">
        <p className="text-terminal-sm text-text-muted font-mono mb-2">Want to change anything?</p>
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={adjustmentText}
            onChange={(e) => setAdjustmentText(e.target.value)}
            placeholder="&ldquo;Move gym to 6am&rdquo;, &ldquo;add grocery run&rdquo;, &ldquo;drop the vet call&rdquo;..."
            disabled={isAdjusting}
            className="flex-1 resize-none font-mono text-terminal-base text-text-primary bg-bg-terminal border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint disabled:opacity-50"
          />
          <button
            onClick={adjustPlan}
            disabled={isAdjusting || !adjustmentText.trim()}
            className="self-end px-3 py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-terminal-base disabled:opacity-40"
          >
            {isAdjusting ? '...' : 'Adjust'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => { setGeneratedPlan(null); setCurrentStep(0); }}
          className="text-terminal-base text-text-muted hover:text-text-primary font-mono transition-colors"
        >
          Start over
        </button>
        <button
          onClick={lockItIn}
          className="px-6 py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium"
        >
          &#128640; Lock it in
        </button>
      </div>
    </div>
  );
}
