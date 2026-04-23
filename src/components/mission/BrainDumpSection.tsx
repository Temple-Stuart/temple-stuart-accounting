'use client';

import { useState } from 'react';
import { TRIGGER_QUESTION_GROUPS, OPEN_DUMP_LABEL } from '@/lib/mission/trigger-questions';

interface BrainDumpEntry {
  content: string;
  triggerQuestion?: string | null;
}

interface BrainDumpSectionProps {
  missionId: string;
  existingEntries?: BrainDumpEntry[];
  onSaved: () => void;
}

export default function BrainDumpSection({ missionId, existingEntries = [], onSaved }: BrainDumpSectionProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const e of existingEntries) {
      if (e.triggerQuestion) {
        map[e.triggerQuestion] = (map[e.triggerQuestion] || '') + (map[e.triggerQuestion] ? '\n' : '') + e.content;
      }
    }
    return map;
  });

  const [openDump, setOpenDump] = useState(() =>
    existingEntries.filter((e) => !e.triggerQuestion).map((e) => e.content).join('\n'),
  );

  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    TRIGGER_QUESTION_GROUPS[0]?.id || null,
  );
  const [saving, setSaving] = useState(false);

  const entryCount = Object.values(answers).filter((v) => v.trim()).length +
    openDump.split('\n').filter((l) => l.trim()).length;

  const handleSave = async () => {
    if (entryCount === 0) return;
    setSaving(true);
    try {
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

      const res = await fetch(`/api/mission/${missionId}/brain-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });

      if (res.ok) onSaved();
    } catch (err) {
      console.error('Brain dump save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-lg font-semibold text-text-primary">Brain Dump</span>
        <span className="text-terminal-sm text-text-muted font-mono">
          {entryCount} {entryCount === 1 ? 'entry' : 'entries'} captured
        </span>
      </div>

      <div className="md:flex">
        {/* Left: Trigger questions */}
        <div className="flex-1 md:border-r md:border-border-light p-4 space-y-2">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">
            Guided Questions
          </p>
          {TRIGGER_QUESTION_GROUPS.map((group) => (
            <div key={group.id} className="border border-border-light rounded overflow-hidden">
              <button
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-text-primary font-mono">{group.title}</span>
                  <span className="text-terminal-sm text-text-faint font-mono ml-2">{group.description}</span>
                </div>
                <span className="text-text-faint text-terminal-sm flex-shrink-0 ml-2">
                  {expandedGroup === group.id ? '▲' : '▼'}
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
                        style={{ minHeight: '2.5rem', height: 'auto' }}
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
        <div className="md:w-[40%] p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">
            Open Dump
          </p>
          <p className="text-terminal-sm text-text-faint font-mono mb-2">
            {OPEN_DUMP_LABEL}
          </p>
          <textarea
            rows={6}
            value={openDump}
            onChange={(e) => setOpenDump(e.target.value)}
            placeholder="Drop anything here..."
            className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
            style={{ minHeight: '10rem', height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.max(el.scrollHeight, 160) + 'px';
            }}
          />
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={handleSave}
          disabled={entryCount === 0 || saving}
          className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save & Process →'}
        </button>
      </div>
    </div>
  );
}
