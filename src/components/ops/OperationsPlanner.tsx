'use client';

import { useState, useEffect, useCallback } from 'react';
import { TRIGGER_QUESTION_GROUPS, OPEN_DUMP_LABEL } from '@/lib/mission/trigger-questions';
import DailyDashboard from './DailyDashboard';

const DURATION_PRESETS = [30, 75, 90];

interface ExistingEntry {
  content: string;
  triggerQuestion?: string | null;
}

export default function OperationsPlanner() {
  // Mission from server
  const [existingMission, setExistingMission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [missionTitle, setMissionTitle] = useState('');
  const [durationDays, setDurationDays] = useState(75);
  const [customDuration, setCustomDuration] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openDump, setOpenDump] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(TRIGGER_QUESTION_GROUPS[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const effectiveDuration = customDuration ? parseInt(customDuration, 10) || 75 : durationDays;
  const hasMission = existingMission !== null;

  // Fetch existing mission on mount
  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch('/api/mission/active');
      if (res.ok) {
        const data = await res.json();
        if (data.mission) {
          setExistingMission(data.mission);
          setMissionTitle(String(data.mission.name || ''));
          setDurationDays(Number(data.mission.durationDays) || 75);

          // Pre-fill from existing brain dump entries
          const entries = (data.mission.brainDumpEntries || []) as ExistingEntry[];
          const answerMap: Record<string, string> = {};
          const openLines: string[] = [];
          for (const e of entries) {
            if (e.triggerQuestion) {
              answerMap[e.triggerQuestion] = (answerMap[e.triggerQuestion] || '') +
                (answerMap[e.triggerQuestion] ? '\n' : '') + e.content;
            } else {
              openLines.push(e.content);
            }
          }
          setAnswers(answerMap);
          setOpenDump(openLines.join('\n'));
        }
      }
    } catch (err) {
      console.error('Failed to fetch mission:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  // Count entries
  const entryCount =
    Object.values(answers).filter((v) => v.trim()).length +
    openDump.split('\n').filter((l) => l.trim()).length;

  // Collect entries for API
  const collectEntries = () => {
    const entries: Array<{ content: string; source: string; triggerQuestion: string | null }> = [];
    for (const group of TRIGGER_QUESTION_GROUPS) {
      for (const q of group.questions) {
        const text = answers[q.text]?.trim();
        if (text) {
          for (const line of text.split('\n').filter(Boolean)) {
            entries.push({ content: line, source: 'typed', triggerQuestion: q.text });
          }
        }
      }
    }
    for (const line of openDump.split('\n').filter((l) => l.trim())) {
      entries.push({ content: line.trim(), source: 'typed', triggerQuestion: null });
    }
    return entries;
  };

  const handleSaveAndProcess = async () => {
    if (!missionTitle.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    setSaving(true);

    try {
      let missionId = existingMission?.id as string | undefined;

      if (!missionId) {
        // Create mission
        const createRes = await fetch('/api/mission/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: missionTitle.trim(), durationDays: effectiveDuration }),
        });
        if (!createRes.ok) return;
        const createData = await createRes.json();
        missionId = createData.mission.id;
      }

      // Save brain dump entries
      const entries = collectEntries();
      if (entries.length > 0) {
        await fetch(`/api/mission/${missionId}/brain-dump`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
      }

      await fetchMission();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 pt-3 pb-4 space-y-4">
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-text-primary font-mono">Operations Planner</h1>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">
            Define your mission. Dump your thoughts. The pipeline will organize, analyze, and plan.
          </p>
        </div>

        {/* ── MISSION DETAILS ─────────────────────────────────────────────── */}
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-lg font-semibold text-text-primary">Mission</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
                Mission Title
              </label>
              <input
                type="text"
                value={missionTitle}
                onChange={(e) => { setMissionTitle(e.target.value); setTitleError(false); }}
                placeholder="e.g. Temple Stuart Bookkeeping Launch"
                disabled={hasMission}
                className={`font-mono text-sm bg-transparent border rounded-md px-3 py-2 w-full outline-none transition-colors placeholder:text-text-faint ${
                  titleError ? 'border-red-400' : 'border-border focus:border-brand-purple'
                } ${hasMission ? 'opacity-60' : ''}`}
              />
              {titleError && (
                <p className="text-terminal-sm text-red-500 font-mono mt-1">Mission title is required</p>
              )}
            </div>
            <div>
              <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
                Duration
              </label>
              <div className="flex items-center gap-2">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDurationDays(d); setCustomDuration(''); }}
                    disabled={hasMission}
                    className={`px-3 py-1.5 rounded text-terminal-base font-mono transition-colors ${
                      durationDays === d && !customDuration
                        ? 'bg-brand-purple text-white'
                        : 'border border-border text-text-secondary hover:border-brand-purple'
                    } ${hasMission ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    {d}d
                  </button>
                ))}
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Custom"
                  disabled={hasMission}
                  className={`font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-20 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint ${
                    hasMission ? 'opacity-60' : ''
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── TRIGGER QUESTIONS + OPEN DUMP ────────────────────────────────── */}
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-terminal-lg font-semibold text-text-primary">Brain Dump</span>
            <span className="text-terminal-sm text-text-muted font-mono">
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'} captured
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
            {/* Left: Guided questions */}
            <div className="lg:col-span-3 lg:border-r lg:border-border-light p-4 space-y-2">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">
                Guided Questions
              </p>
              {TRIGGER_QUESTION_GROUPS.map((group) => (
                <div key={group.id} className="border border-border-light rounded overflow-hidden">
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text-primary font-mono">{group.title}</span>
                      <span className="text-terminal-sm text-text-faint font-mono ml-2 hidden sm:inline">{group.description}</span>
                    </div>
                    <span className="text-text-faint text-terminal-sm flex-shrink-0 ml-2">
                      {expandedGroup === group.id ? '▼' : '▶'}
                    </span>
                  </button>
                  {expandedGroup === group.id && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border-light">
                      {group.questions.map((q) => (
                        <div key={q.id} className="pt-2">
                          <p className="text-terminal-sm text-text-secondary font-mono mb-1">{q.text}</p>
                          <textarea
                            rows={2}
                            value={answers[q.text] || ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.text]: e.target.value }))}
                            placeholder="Type your answer..."
                            className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-2 py-1.5 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = 'auto';
                              el.style.height = el.scrollHeight + 'px';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right: Open dump */}
            <div className="lg:col-span-2 p-4">
              <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">
                Open Dump
              </p>
              <p className="text-terminal-sm text-text-faint font-mono mb-2">
                {OPEN_DUMP_LABEL}
              </p>
              <textarea
                rows={8}
                value={openDump}
                onChange={(e) => setOpenDump(e.target.value)}
                placeholder="Drop anything here..."
                className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
                style={{ minHeight: '12rem' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.max(el.scrollHeight, 192) + 'px';
                }}
              />
            </div>
          </div>

          {/* Footer: Save button */}
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={handleSaveAndProcess}
              disabled={saving}
              className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
            >
              {saving ? 'Saving...' : hasMission ? 'Update & Re-process →' : 'Save & Process →'}
            </button>
          </div>
        </div>
      </div>

      {/* ── DAILY DASHBOARD (existing functionality) ──────────────────────── */}
      <DailyDashboard />
    </div>
  );
}
