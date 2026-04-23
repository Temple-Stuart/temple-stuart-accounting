'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/ui/AppLayout';

const DURATION_PRESETS = [30, 75, 90];

export default function MissionListPage() {
  const router = useRouter();
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
        router.push(`/mission/${data.mission.id}`);
      }
    } catch (err) {
      console.error('Failed to create mission:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-text-primary font-mono">Mission Planner</h1>
        <p className="text-sm text-text-muted font-mono mt-1">
          Define a time-bound mission. The pipeline will help you plan it.
        </p>

        <div className="bg-white rounded border border-border shadow-sm overflow-hidden mt-6">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-lg font-semibold text-text-primary">New Mission</span>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div>
              <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
                Mission Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Temple Stuart Bookkeeping Launch"
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
                    {d} days
                  </button>
                ))}
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Custom"
                  className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-24 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
                />
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create Mission'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
