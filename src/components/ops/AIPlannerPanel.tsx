'use client';

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { DailyPlan, Task, ScheduleBlock, Meal, generateId } from './types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIPlannerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: DailyPlan | null;
  selectedDate: string;
  dayNumber: number;
  onApplyPlan: (planData: Partial<DailyPlan>) => void;
}

function extractPlanJSON(content: string): Record<string, unknown> | null {
  const match = content.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function stripPlanTags(content: string): string {
  return content.replace(/<plan>[\s\S]*?<\/plan>/g, '').trim();
}

function mapPlanToFields(raw: Record<string, unknown>): Partial<DailyPlan> {
  const result: Partial<DailyPlan> = {};

  if (raw.mission != null) result.mission = raw.mission as string;
  if (raw.budgetTarget != null) result.budgetTarget = raw.budgetTarget as number;
  if (raw.workoutPlanned != null) result.workoutPlanned = raw.workoutPlanned as boolean;
  if (raw.workoutType != null) result.workoutType = raw.workoutType as string;
  if (raw.workoutDuration != null) result.workoutDuration = raw.workoutDuration as number;
  if (raw.hydrationTargetOz != null) result.hydrationTargetOz = raw.hydrationTargetOz as number;
  if (raw.calorieTarget != null) result.calorieTarget = raw.calorieTarget as number;
  if (raw.proteinTargetG != null) result.proteinTargetG = raw.proteinTargetG as number;

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

export default function AIPlannerPanel({
  isOpen,
  onClose,
  currentPlan,
  selectedDate,
  dayNumber,
  onApplyPlan,
}: AIPlannerPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Seed initial message when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = currentPlan
        ? "You've already got a plan going. Want to adjust anything, or start fresh?"
        : "Hey! What's on your mind for today? Just dump it all — tasks, schedule, whatever. I'll organize it.";
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [isOpen, currentPlan, messages.length]);

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setApplied(false);
    }
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ops/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          currentPlan,
          date: selectedDate,
          dayNumber,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong. Try again?' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Try again?' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentPlan, selectedDate, dayNumber]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleApply = (planJSON: Record<string, unknown>) => {
    const fields = mapPlanToFields(planJSON);
    onApplyPlan(fields);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full md:w-[480px] bg-white border-l border-border shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-sm text-text-primary">
              Plan with AI
            </span>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-lg leading-none transition-colors"
            >
              &times;
            </button>
          </div>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">
            Brain dump your day. I&apos;ll organize it.
          </p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => {
            if (msg.role === 'user') {
              return (
                <div key={i} className="ml-8 bg-brand-purple-wash border border-brand-purple/10 rounded-lg px-3 py-2 text-terminal-base font-mono text-text-primary whitespace-pre-wrap">
                  {msg.content}
                </div>
              );
            }

            const planJSON = extractPlanJSON(msg.content);
            const textContent = stripPlanTags(msg.content);

            return (
              <div key={i} className="mr-8 space-y-2">
                {textContent && (
                  <div className="bg-bg-row border border-border-light rounded-lg px-3 py-2 text-terminal-base font-mono text-text-primary whitespace-pre-wrap">
                    {textContent}
                  </div>
                )}
                {planJSON && (
                  <PlanPreview
                    plan={planJSON}
                    onApply={() => handleApply(planJSON)}
                    applied={applied}
                  />
                )}
              </div>
            );
          })}

          {loading && (
            <div className="mr-8 bg-bg-row border border-border-light rounded-lg px-3 py-2">
              <span className="text-terminal-base text-text-muted font-mono animate-pulse">
                Thinking...
              </span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind..."
              disabled={loading}
              className="flex-1 resize-none font-mono text-terminal-base text-text-primary bg-bg-terminal border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="self-end px-3 py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-terminal-base disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan Preview Card ───────────────────────────────────────────────────────

function PlanPreview({
  plan,
  onApply,
  applied,
}: {
  plan: Record<string, unknown>;
  onApply: () => void;
  applied: boolean;
}) {
  const tasks = Array.isArray(plan.tasks) ? (plan.tasks as Array<{ text: string; priority: string }>) : [];
  const schedule = Array.isArray(plan.schedule) ? (plan.schedule as Array<{ time: string; activity: string }>) : [];
  const meals = Array.isArray(plan.meals) ? (plan.meals as Array<{ name: string; description: string; calories: number }>) : [];

  const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };

  return (
    <div className="bg-white border border-brand-purple/20 rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-brand-purple-wash border-b border-brand-purple/10">
        <span className="text-terminal-sm font-mono font-semibold text-brand-purple uppercase tracking-wider">
          Plan Preview
        </span>
      </div>
      <div className="px-3 py-2 space-y-2 text-terminal-sm font-mono">
        {plan.mission != null && (
          <p className="text-text-primary font-medium">
            &ldquo;{String(plan.mission)}&rdquo;
          </p>
        )}

        {tasks.length > 0 && (
          <div>
            <p className="text-text-muted text-terminal-sm mb-1">Tasks:</p>
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 ml-2">
                <span className={`w-2 h-2 rounded-full ${PRIO_DOT[t.priority] || 'bg-amber-500'}`} />
                <span className="text-text-primary">{t.text}</span>
              </div>
            ))}
          </div>
        )}

        {schedule.length > 0 && (
          <div>
            <p className="text-text-muted text-terminal-sm mb-1">Schedule:</p>
            {schedule.map((s, i) => (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-brand-purple w-12">{s.time}</span>
                <span className="text-text-primary">{s.activity}</span>
              </div>
            ))}
          </div>
        )}

        {meals.length > 0 && (
          <div>
            <p className="text-text-muted text-terminal-sm mb-1">Meals:</p>
            {meals.map((m, i) => (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-text-muted w-16">{m.name}</span>
                <span className="text-text-primary">{m.description}</span>
                {m.calories > 0 && (
                  <span className="text-text-faint ml-auto">{m.calories}cal</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-text-muted">
          {plan.budgetTarget != null && <span>Budget: ${String(plan.budgetTarget)}</span>}
          {plan.workoutType != null && <span>Workout: {String(plan.workoutType)}</span>}
          {plan.calorieTarget != null && <span>Cals: {String(plan.calorieTarget)}</span>}
          {plan.proteinTargetG != null && <span>Protein: {String(plan.proteinTargetG)}g</span>}
          {plan.hydrationTargetOz != null && <span>Water: {String(plan.hydrationTargetOz)}oz</span>}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border-light">
        <button
          onClick={onApply}
          disabled={applied}
          className="w-full px-3 py-1.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-terminal-base font-medium disabled:opacity-50"
        >
          {applied ? '✓ Plan applied!' : '🚀 Lock it in'}
        </button>
      </div>
    </div>
  );
}
