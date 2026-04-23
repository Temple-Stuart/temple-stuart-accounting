'use client';

import { useState } from 'react';

interface RealityConstraintsSectionProps {
  mission: Record<string, unknown>;
  onUpdate: () => void;
}

export default function RealityConstraintsSection({ mission, onUpdate }: RealityConstraintsSectionProps) {
  const missionId = mission.id as string;
  const existing = (mission.realityConstraints as Array<{ constraintType: string; category: string; description: string; value?: string }>) || [];

  const [builtExists, setBuiltExists] = useState(
    existing.filter((c) => c.constraintType === 'product' && c.category === 'already_built').map((c) => c.description).join('\n'),
  );
  const [broken, setBroken] = useState(
    existing.filter((c) => c.constraintType === 'product' && c.category === 'broken').map((c) => c.description).join('\n'),
  );
  const [missing, setMissing] = useState(
    existing.filter((c) => c.constraintType === 'product' && c.category === 'missing').map((c) => c.description).join('\n'),
  );
  const [hoursPerDay, setHoursPerDay] = useState(
    existing.find((c) => c.category === 'hours_per_day')?.value || '',
  );
  const [budget, setBudget] = useState(
    existing.find((c) => c.category === 'budget')?.value || '',
  );
  const [personalConstraints, setPersonalConstraints] = useState(
    existing.filter((c) => c.constraintType === 'operational' && c.category === 'personal').map((c) => c.description).join('\n'),
  );
  const [energyBlockers, setEnergyBlockers] = useState(
    existing.filter((c) => c.constraintType === 'operational' && c.category === 'energy').map((c) => c.description).join('\n'),
  );
  const [saving, setSaving] = useState(false);

  const buildConstraints = () => {
    const constraints: Array<{ constraintType: string; category: string; description: string; value?: string }> = [];

    for (const line of builtExists.split('\n').filter((l) => l.trim())) {
      constraints.push({ constraintType: 'product', category: 'already_built', description: line.trim() });
    }
    for (const line of broken.split('\n').filter((l) => l.trim())) {
      constraints.push({ constraintType: 'product', category: 'broken', description: line.trim() });
    }
    for (const line of missing.split('\n').filter((l) => l.trim())) {
      constraints.push({ constraintType: 'product', category: 'missing', description: line.trim() });
    }
    if (hoursPerDay.trim()) {
      constraints.push({ constraintType: 'operational', category: 'hours_per_day', description: `${hoursPerDay} hours per day`, value: hoursPerDay });
    }
    if (budget.trim()) {
      constraints.push({ constraintType: 'operational', category: 'budget', description: `Monthly budget: $${budget}`, value: budget });
    }
    for (const line of personalConstraints.split('\n').filter((l) => l.trim())) {
      constraints.push({ constraintType: 'operational', category: 'personal', description: line.trim() });
    }
    for (const line of energyBlockers.split('\n').filter((l) => l.trim())) {
      constraints.push({ constraintType: 'operational', category: 'energy', description: line.trim() });
    }

    return constraints;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/mission/${missionId}/reality-constraints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ constraints: buildConstraints() }),
      });
      onUpdate();
    } catch (err) {
      console.error('Save constraints failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const LABEL = 'block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1';
  const TEXTAREA = 'w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint';
  const INPUT = 'font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint';

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">Reality Constraints</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Product Reality */}
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Product Reality</p>
          <div className="space-y-3">
            <div>
              <label className={LABEL}>What already exists and works</label>
              <textarea rows={3} value={builtExists} onChange={(e) => setBuiltExists(e.target.value)} placeholder="One item per line..." className={TEXTAREA} />
            </div>
            <div>
              <label className={LABEL}>What&apos;s broken</label>
              <textarea rows={3} value={broken} onChange={(e) => setBroken(e.target.value)} placeholder="One item per line..." className={TEXTAREA} />
            </div>
            <div>
              <label className={LABEL}>What&apos;s missing</label>
              <textarea rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} placeholder="One item per line..." className={TEXTAREA} />
            </div>
          </div>
        </div>

        {/* Operational Reality */}
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Operational Reality</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Hours per day available</label>
              <input type="number" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} placeholder="5" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Monthly budget ($)</label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="800" className={INPUT} />
            </div>
          </div>
          <div className="space-y-3 mt-3">
            <div>
              <label className={LABEL}>Personal constraints</label>
              <textarea rows={2} value={personalConstraints} onChange={(e) => setPersonalConstraints(e.target.value)} placeholder="Dog walks, lease situation, appointments..." className={TEXTAREA} />
            </div>
            <div>
              <label className={LABEL}>Energy blockers</label>
              <textarea rows={2} value={energyBlockers} onChange={(e) => setEnergyBlockers(e.target.value)} placeholder="Sleep issues, medication timing, energy crashes..." className={TEXTAREA} />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Constraints'}
        </button>
      </div>
    </div>
  );
}
