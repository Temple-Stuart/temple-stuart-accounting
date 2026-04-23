'use client';

import { useState } from 'react';
import { TRIGGER_QUESTION_GROUPS, OPEN_DUMP_LABEL } from '@/lib/mission/trigger-questions';

interface BrainDumpSectionProps {
  mission: Record<string, unknown>;
  onUpdate: () => void;
}

interface LocalEntry {
  content: string;
  triggerQuestion: string | null;
  triggerGroupId: string | null;
}

export default function BrainDumpSection({ mission, onUpdate }: BrainDumpSectionProps) {
  const missionId = mission.id as string;
  const existingEntries = (mission.brainDumpEntries as Array<{ content: string; triggerQuestion?: string }>) || [];

  const [questionEntries, setQuestionEntries] = useState<Record<string, string>>(() => {
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allEntries: LocalEntry[] = [];

  for (const group of TRIGGER_QUESTION_GROUPS) {
    for (const q of group.questions) {
      const text = questionEntries[q.text]?.trim();
      if (text) {
        for (const line of text.split('\n').filter(Boolean)) {
          allEntries.push({ content: line, triggerQuestion: q.text, triggerGroupId: group.id });
        }
      }
    }
  }
  for (const line of openDump.split('\n').filter((l) => l.trim())) {
    allEntries.push({ content: line.trim(), triggerQuestion: null, triggerGroupId: null });
  }

  const handleSaveAndProcess = async () => {
    if (allEntries.length === 0) return;
    setSaving(true);
    try {
      const saveRes = await fetch(`/api/mission/${missionId}/brain-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: allEntries.map((e) => ({
            content: e.content,
            source: 'typed',
            triggerQuestion: e.triggerQuestion,
          })),
        }),
      });
      if (!saveRes.ok) return;

      await fetch(`/api/mission/${missionId}/run-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageType: 'structure' }),
      });

      onUpdate();
    } catch (err) {
      console.error('Save & process failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-lg font-semibold text-text-primary">Brain Dump</span>
        <span className="text-terminal-sm text-text-muted font-mono">{allEntries.length} entries</span>
      </div>

      <div className="md:flex">
        {/* Left: Trigger questions */}
        <div className="flex-1 border-r border-border-light p-4 space-y-2">
          <p className="text-terminal-sm text-text-muted font-mono mb-2">Answer what resonates. Skip the rest.</p>
          {TRIGGER_QUESTION_GROUPS.map((group) => (
            <div key={group.id} className="border border-border-light rounded">
              <button
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors"
              >
                <span className="text-sm font-medium text-text-primary font-mono">{group.title}</span>
                <span className="text-text-faint text-terminal-sm">{expandedGroup === group.id ? '▲' : '▼'}</span>
              </button>
              {expandedGroup === group.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-border-light">
                  <p className="text-terminal-sm text-text-faint font-mono pt-2">{group.description}</p>
                  {group.questions.map((q) => (
                    <div key={q.id}>
                      <p className="text-terminal-sm text-text-secondary font-mono mb-1">{q.text}</p>
                      <textarea
                        rows={2}
                        value={questionEntries[q.text] || ''}
                        onChange={(e) => setQuestionEntries((prev) => ({ ...prev, [q.text]: e.target.value }))}
                        placeholder="Type your answer..."
                        className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-2 py-1.5 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Open dump */}
        <div className="flex-1 p-4 md:max-w-[40%]">
          <p className="text-terminal-sm text-text-muted font-mono mb-2">Open dump</p>
          <textarea
            rows={12}
            value={openDump}
            onChange={(e) => setOpenDump(e.target.value)}
            placeholder={OPEN_DUMP_LABEL}
            className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
          />
        </div>
      </div>

      {/* Save & Process */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={handleSaveAndProcess}
          disabled={allEntries.length === 0 || saving}
          className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Processing...' : `Save & Process (${allEntries.length} entries) →`}
        </button>
      </div>
    </div>
  );
}
