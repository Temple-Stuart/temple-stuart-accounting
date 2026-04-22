'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const PLACEHOLDERS = [
  'I need to launch bookkeeping by end of month...',
  'Need to solve the dog / lease situation...',
  'Want to post daily reels for 75 days...',
];

const LOADING_MESSAGES = [
  'Finding your goals...',
  'Identifying priorities...',
  'Spotting blockers...',
  'Mapping your plan...',
];

const CATEGORY_LABELS: Record<string, string> = {
  goals: 'GOALS',
  priority1: 'PRIORITY 1',
  priority2: 'PRIORITY 2',
  priority3: 'PRIORITY 3',
  currentState: 'WHAT EXISTS',
  brokenBlockers: 'BLOCKERS',
  riskFactors: 'RISKS',
  healthGoals: 'HEALTH & WELLNESS',
  personalGoals: 'PERSONAL',
  mealStrategy: 'MEALS',
  timelineHints: 'TIMELINE HINTS',
  budgetHints: 'BUDGET HINTS',
};

interface BrainDumpProps {
  onComplete: (structuredData: Record<string, unknown>) => void;
}

export default function BrainDump({ onComplete }: BrainDumpProps) {
  const [bullets, setBullets] = useState(['', '', '']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [structuredResult, setStructuredResult] = useState<Record<string, unknown> | null>(null);
  const [editableResult, setEditableResult] = useState<Record<string, unknown> | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const updateBullet = (idx: number, value: string) => {
    setBullets((prev) => prev.map((b, i) => (i === idx ? value : b)));
  };

  const addBullet = () => {
    setBullets((prev) => [...prev, '']);
    setTimeout(() => {
      const lastRef = inputRefs.current[inputRefs.current.length];
      lastRef?.focus();
    }, 50);
  };

  const removeBullet = (idx: number) => {
    if (bullets.length <= 1) return;
    setBullets((prev) => prev.filter((_, i) => i !== idx));
  };

  const nonEmpty = bullets.filter((b) => b.trim().length > 0);
  const canSubmit = nonEmpty.length >= 2;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/ops/brain-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullets: nonEmpty }),
      });
      if (res.ok) {
        const data = await res.json();
        setStructuredResult(data.structured);
        setEditableResult({ ...data.structured });
      }
    } catch (err) {
      console.error('Brain dump failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [canSubmit, nonEmpty]);

  const updateEditable = (key: string, value: unknown) => {
    setEditableResult((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateDeliverable = (idx: number, value: string) => {
    setEditableResult((prev) => {
      if (!prev) return prev;
      const arr = [...((prev.deliverables as string[]) || [])];
      arr[idx] = value;
      return { ...prev, deliverables: arr };
    });
  };

  const updateUnknown = (idx: number, value: string) => {
    setEditableResult((prev) => {
      if (!prev) return prev;
      const arr = [...((prev.unknowns as string[]) || [])];
      arr[idx] = value;
      return { ...prev, unknowns: arr };
    });
  };

  // ── VIEW 1: Bullet Input ──────────────────────────────────────────────────

  if (!structuredResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold font-mono text-text-primary">What&apos;s in your head?</h1>
        <p className="text-sm text-text-muted font-mono mt-2">
          Dump everything. Goals, problems, ideas, worries &mdash; all of it.
        </p>
        <p className="text-terminal-sm text-text-faint font-mono mt-1">
          No wrong answers. No order needed.
        </p>

        <div className="space-y-2 mt-6">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-lg text-brand-purple font-bold w-4 text-center">&bull;</span>
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                value={b}
                onChange={(e) => updateBullet(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBullet();
                  }
                }}
                placeholder={PLACEHOLDERS[i] || 'Another thought...'}
                className="flex-1 font-mono text-base bg-transparent border-b border-border focus:border-brand-purple outline-none py-2 transition-colors placeholder:text-text-faint"
              />
              {bullets.length > 1 && (
                <button
                  onClick={() => removeBullet(i)}
                  className="text-text-faint hover:text-brand-red text-sm transition-colors px-1"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addBullet}
          className="mt-2 text-sm text-text-muted hover:text-brand-purple font-mono transition-colors"
        >
          + Add more
        </button>

        <div className="mt-8 text-center">
          {isProcessing ? (
            <div className="space-y-2">
              <p className="text-sm text-text-muted font-mono animate-pulse">
                Organizing your thoughts...
              </p>
              <p className="text-terminal-sm text-text-faint font-mono">{LOADING_MESSAGES[loadingMsgIdx]}</p>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-6 py-3 bg-brand-purple text-white rounded-lg font-mono font-semibold text-sm hover:bg-brand-purple-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &#129504; Organize My Thoughts
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── VIEW 2: Structured Review ─────────────────────────────────────────────

  const ed = editableResult || structuredResult;
  const deliverables = Array.isArray(ed.deliverables) ? (ed.deliverables as string[]) : [];
  const unknowns = Array.isArray(ed.unknowns) ? (ed.unknowns as string[]) : [];

  const stringCategories: Array<{ key: string; label: string }> = [
    { key: 'goals', label: 'GOALS' },
    { key: 'currentState', label: 'WHAT EXISTS' },
    { key: 'brokenBlockers', label: 'BLOCKERS' },
    { key: 'riskFactors', label: 'RISKS' },
    { key: 'healthGoals', label: 'HEALTH & WELLNESS' },
    { key: 'personalGoals', label: 'PERSONAL' },
    { key: 'mealStrategy', label: 'MEALS' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Dimmed bullets */}
      <div className="opacity-40 pointer-events-none">
        <h1 className="text-2xl font-bold font-mono text-text-primary">What&apos;s in your head?</h1>
        <div className="space-y-1 mt-4">
          {bullets.filter((b) => b.trim()).map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-lg text-brand-purple font-bold w-4 text-center">&bull;</span>
              <span className="font-mono text-sm text-text-primary">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mission statement */}
      {ed.missionStatement != null && (
        <div className="bg-brand-purple-wash border border-brand-purple/10 rounded-lg p-4 mt-8">
          <p className="text-lg font-medium text-text-primary font-mono italic">
            &ldquo;{String(ed.missionStatement)}&rdquo;
          </p>
          {ed.projectName != null && (
            <p className="text-terminal-sm text-text-muted font-mono mt-1">
              Suggested name: {String(ed.projectName)}
            </p>
          )}
        </div>
      )}

      <h2 className="text-xl font-bold font-mono text-text-primary mt-8">Here&apos;s what I found:</h2>

      {/* Priorities */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden mt-4">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">Top Priorities</span>
        </div>
        <div className="px-3 py-3 space-y-2">
          {(['priority1', 'priority2', 'priority3'] as const).map((key, idx) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-sm font-bold text-brand-purple w-5 flex-shrink-0 mt-2">{idx + 1}.</span>
              <textarea
                rows={1}
                value={String(ed[key] ?? '')}
                onChange={(e) => updateEditable(key, e.target.value || null)}
                placeholder={idx === 0 ? 'Highest leverage outcome' : 'Add if identified'}
                className="flex-1 font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* String categories */}
      <div className="space-y-3 mt-3">
        {stringCategories.map(({ key, label }) => {
          const val = ed[key];
          return (
            <div key={key} className="bg-white rounded border border-border shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">{label}</span>
              </div>
              <div className="px-3 py-3">
                <textarea
                  rows={2}
                  value={String(val ?? '')}
                  onChange={(e) => updateEditable(key, e.target.value || null)}
                  placeholder={val == null ? 'Nothing identified — add here if needed' : ''}
                  className="w-full font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint resize-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Deliverables */}
      {deliverables.length > 0 && (
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden mt-3">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">Deliverables</span>
          </div>
          <div className="px-3 py-3 space-y-1">
            {deliverables.map((d, i) => (
              <input
                key={i}
                type="text"
                value={d}
                onChange={(e) => updateDeliverable(i, e.target.value)}
                className="w-full font-mono text-sm bg-transparent border-b border-border-light focus:border-brand-purple outline-none py-1.5 px-1 transition-colors"
              />
            ))}
          </div>
        </div>
      )}

      {/* Unknowns */}
      {unknowns.length > 0 && (
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden mt-3">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">Unknowns</span>
          </div>
          <div className="px-3 py-3 space-y-1">
            {unknowns.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-amber-500 text-terminal-sm">?</span>
                <input
                  type="text"
                  value={u}
                  onChange={(e) => updateUnknown(i, e.target.value)}
                  className="flex-1 font-mono text-sm bg-transparent border-b border-border-light focus:border-brand-purple outline-none py-1.5 px-1 transition-colors text-amber-700"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info hints */}
      {(ed.timelineHints != null || ed.budgetHints != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {ed.timelineHints != null && (
            <div className="bg-white rounded border border-border shadow-sm p-3">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">{CATEGORY_LABELS.timelineHints}</p>
              <p className="text-terminal-base font-mono text-text-secondary">{String(ed.timelineHints)}</p>
            </div>
          )}
          {ed.budgetHints != null && (
            <div className="bg-white rounded border border-border shadow-sm p-3">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">{CATEGORY_LABELS.budgetHints}</p>
              <p className="text-terminal-base font-mono text-text-secondary">{String(ed.budgetHints)}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3 justify-center">
        <button
          onClick={() => onComplete(ed)}
          className="px-5 py-2.5 bg-brand-purple text-white rounded-lg font-mono font-semibold text-sm hover:bg-brand-purple-hover transition-colors"
        >
          &#10003; Looks good &mdash; let&apos;s plan
        </button>
        <button
          onClick={() => {
            setStructuredResult(null);
            setEditableResult(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-sm text-text-muted hover:text-brand-purple font-mono transition-colors"
        >
          + Add more thoughts
        </button>
      </div>
    </div>
  );
}
