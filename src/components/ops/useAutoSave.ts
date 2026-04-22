import { useRef, useState, useCallback } from 'react';
import { DailyPlan, calculateDayScore } from './types';

export function useAutoSave() {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async (plan: DailyPlan) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const score = calculateDayScore(plan);
        const res = await fetch('/api/ops/daily-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...plan, dayScore: score }),
        });
        if (res.ok) {
          setShowSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setShowSaved(false), 1200);
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setSaving(false);
      }
    }, 500);
  }, []);

  return { save, saving, showSaved };
}
