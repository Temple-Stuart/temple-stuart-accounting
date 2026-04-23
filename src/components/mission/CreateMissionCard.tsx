'use client';

import { useState } from 'react';

const DURATION_PRESETS = [30, 75, 90];

interface CreateMissionCardProps {
  mission: Record<string, unknown> | null;
  onCreated: (mission: Record<string, unknown>) => void;
}

export default function CreateMissionCard({ mission, onCreated }: CreateMissionCardProps) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(75);
  const [customDuration, setCustomDuration] = useState('');
  const [creating, setCreating] = useState(false);

  const effectiveDuration = customDuration ? parseInt(customDuration, 10) || 75 : duration;

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/mission/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), durationDays: effectiveDuration }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.mission);
      }
    } catch (err) {
      console.error('Failed to create mission:', err);
    } finally {
      setCreating(false);
    }
  };

  if (mission) {
    return (
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden opacity-80">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">
            Operations Planner
          </span>
          <span className="text-terminal-sm font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            Created
          </span>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-text-primary font-mono">{String(mission.name)}</span>
          <span className="text-terminal-sm text-text-muted font-mono">
            {mission.durationDays ? `${String(mission.durationDays)} days` : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">
          Operations Planner
        </span>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div>
          <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
            Mission Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Temple Stuart Bookkeeping Launch"
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
          />
        </div>
        <div>
          <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
            Duration
          </label>
          <div className="flex items-center gap-2">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => { setDuration(d); setCustomDuration(''); }}
                className={`px-3 py-1.5 rounded text-terminal-base font-mono transition-colors ${
                  duration === d && !customDuration
                    ? 'bg-brand-purple text-white'
                    : 'border border-border text-text-secondary hover:border-brand-purple'
                }`}
              >
                {d}d
              </button>
            ))}
            <input
              type="number"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              placeholder="Custom"
              className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-20 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
            />
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || creating}
          className="w-full py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
        >
          {creating ? 'Creating...' : 'Create Mission'}
        </button>
      </div>
    </div>
  );
}
