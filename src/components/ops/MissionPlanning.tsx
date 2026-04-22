'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mission, Milestone, Roadmap, WeekPlan, generateId } from './types';

interface MissionPlanningProps {
  existingMission: Mission | null;
  onMissionReady: (mission: Mission) => void;
  onCancel?: () => void;
}

const LABEL_CLS = 'block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1';
const INPUT_CLS = 'font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint';
const TEXTAREA_CLS = `${INPUT_CLS} resize-none`;
const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };

export default function MissionPlanning({ existingMission, onMissionReady, onCancel }: MissionPlanningProps) {
  const [name, setName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [doneDefinition, setDoneDefinition] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: generateId(), text: '', targetDate: null, completed: false },
    { id: generateId(), text: '', targetDate: null, completed: false },
    { id: generateId(), text: '', targetDate: null, completed: false },
  ]);
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [offDays, setOffDays] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [blockers, setBlockers] = useState('');
  const [healthGoals, setHealthGoals] = useState('');
  const [personalGoals, setPersonalGoals] = useState('');
  const [mealStrategy, setMealStrategy] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRoadmap, setGeneratedRoadmap] = useState<Roadmap | null>(null);
  const [roadmapMissionId, setRoadmapMissionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!existingMission) return;
    setName(existingMission.name);
    setGoalDescription(existingMission.goalDescription);
    setDoneDefinition(existingMission.doneDefinition);
    setStartDate(existingMission.startDate);
    setEndDate(existingMission.endDate);
    setMilestones(existingMission.milestones.length > 0 ? existingMission.milestones : [
      { id: generateId(), text: '', targetDate: null, completed: false },
    ]);
    setHoursPerDay(existingMission.hoursPerDay?.toString() ?? '');
    setOffDays(existingMission.offDays ?? '');
    setMonthlyBudget(existingMission.monthlyBudget?.toString() ?? '');
    setBlockers(existingMission.blockers ?? '');
    setHealthGoals(existingMission.healthGoals ?? '');
    setPersonalGoals(existingMission.personalGoals ?? '');
    setMealStrategy(existingMission.mealStrategy ?? '');
    if (existingMission.roadmap) {
      setGeneratedRoadmap(existingMission.roadmap);
      setRoadmapMissionId(existingMission.id);
    }
  }, [existingMission]);

  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const canGenerate = name.trim() && goalDescription.trim() && doneDefinition.trim() && endDate;

  const addMilestone = () => setMilestones((prev) => [...prev, { id: generateId(), text: '', targetDate: null, completed: false }]);
  const removeMilestone = (id: string) => setMilestones((prev) => prev.filter((m) => m.id !== id));
  const updateMilestone = (id: string, field: keyof Milestone, value: string | boolean | null) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const generateRoadmap = useCallback(async () => {
    setIsGenerating(true);
    try {
      const missionBody = {
        name, goalDescription, doneDefinition, startDate, endDate,
        milestones: milestones.filter((m) => m.text.trim()),
        hoursPerDay: hoursPerDay ? parseFloat(hoursPerDay) : null,
        offDays: offDays || null,
        monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : null,
        blockers: blockers || null,
        healthGoals: healthGoals || null,
        personalGoals: personalGoals || null,
        mealStrategy: mealStrategy || null,
      };

      const saveRes = await fetch('/api/ops/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(missionBody),
      });
      if (!saveRes.ok) return;
      const saveData = await saveRes.json();
      const missionId = saveData.mission.id;
      setRoadmapMissionId(missionId);

      const genRes = await fetch('/api/ops/mission/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        const roadmap = genData.mission.roadmap as Roadmap;
        setGeneratedRoadmap(roadmap);
      }
    } catch (err) {
      console.error('Roadmap generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [name, goalDescription, doneDefinition, startDate, endDate, milestones, hoursPerDay, offDays, monthlyBudget, blockers, healthGoals, personalGoals, mealStrategy]);

  const lockItIn = useCallback(async () => {
    if (!generatedRoadmap || !roadmapMissionId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/ops/mission');
      if (res.ok) {
        const data = await res.json();
        if (data.mission) {
          onMissionReady(data.mission as Mission);
        }
      }
    } catch (err) {
      console.error('Failed to finalize mission:', err);
    } finally {
      setIsSaving(false);
    }
  }, [generatedRoadmap, roadmapMissionId, onMissionReady]);

  const formatWeekDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return d; }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary font-mono">Mission Planning</h1>
        <p className="text-sm text-text-muted font-mono mt-1">Define your goal. I&apos;ll build your roadmap.</p>
        {onCancel && (
          <button onClick={onCancel} className="mt-2 text-terminal-sm text-text-muted hover:text-text-primary font-mono transition-colors">
            &larr; Back to Dashboard
          </button>
        )}
      </div>

      {/* SECTION A — THE GOAL */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-lg font-semibold text-text-primary">The Goal</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className={LABEL_CLS}>Project Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Temple Stuart Bookkeeping Launch" className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>What are you building?</label>
            <textarea rows={3} value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Launch bookkeeping product to paying customers..." className={TEXTAREA_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>What does DONE look like?</label>
            <textarea rows={3} value={doneDefinition} onChange={(e) => setDoneDefinition(e.target.value)} placeholder="New user can sign up, connect bank, categorize transactions, see analytics, and pay..." className={TEXTAREA_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
          {totalDays > 0 && (
            <p className="text-terminal-sm text-text-faint font-mono">{totalDays} days — Day 1 starts {new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          )}
        </div>
      </div>

      {/* SECTION B — MILESTONES */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-lg font-semibold text-text-primary">Milestones</span>
        </div>
        <div className="px-4 py-4">
          {milestones.length === 0 && (
            <p className="text-terminal-sm text-text-faint font-mono mb-2">Add at least 2-3 milestones for the AI to plan around</p>
          )}
          <div className="space-y-2">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2 group">
                <input type="text" value={m.text} onChange={(e) => updateMilestone(m.id, 'text', e.target.value)} placeholder="Milestone description..." className={`${INPUT_CLS} flex-1`} />
                <input type="date" value={m.targetDate ?? ''} onChange={(e) => updateMilestone(m.id, 'targetDate', e.target.value || null)} className={`${INPUT_CLS} w-36`} />
                <button onClick={() => removeMilestone(m.id)} className="text-text-faint hover:text-brand-red text-terminal-base opacity-0 group-hover:opacity-100 transition-opacity px-1">&times;</button>
              </div>
            ))}
          </div>
          <button onClick={addMilestone} className="mt-2 text-terminal-sm text-text-muted hover:text-text-secondary font-mono transition-colors">+ Add Milestone</button>
        </div>
      </div>

      {/* SECTION C — CONSTRAINTS */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-lg font-semibold text-text-primary">Constraints &amp; Capacity</span>
        </div>
        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLS}>Hours per day</label>
              <input type="number" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} placeholder="8" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Off days</label>
              <input type="text" value={offDays} onChange={(e) => setOffDays(e.target.value)} placeholder="Sundays, Saturday half-day..." className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Monthly tool/API budget</label>
              <div className="flex items-center gap-1">
                <span className="text-terminal-base text-text-muted font-mono">$</span>
                <input type="number" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} placeholder="800" className={INPUT_CLS} />
              </div>
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>Blockers &amp; constraints</label>
            <textarea rows={4} value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Known bugs to fix, dependencies, logistics, deadlines..." className={TEXTAREA_CLS} />
          </div>
        </div>
      </div>

      {/* SECTION D — WHOLE LIFE */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-lg font-semibold text-text-primary">Health, Personal &amp; Meals</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className={LABEL_CLS}>Health goals</label>
            <textarea rows={2} value={healthGoals} onChange={(e) => setHealthGoals(e.target.value)} placeholder="Lose 10 lbs, gym 5x/week, 2200 cal/day, 128oz water..." className={TEXTAREA_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Personal goals</label>
            <textarea rows={2} value={personalGoals} onChange={(e) => setPersonalGoals(e.target.value)} placeholder="Daily reels, solve dog/lease situation, meditation..." className={TEXTAREA_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Meal strategy</label>
            <textarea rows={2} value={mealStrategy} onChange={(e) => setMealStrategy(e.target.value)} placeholder="Prep on Sundays, $15/day food budget, high protein..." className={TEXTAREA_CLS} />
          </div>
        </div>
      </div>

      {/* GENERATE BUTTON */}
      {isGenerating ? (
        <div className="flex items-center justify-center py-4 gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-muted font-mono animate-pulse">Generating your roadmap...</span>
        </div>
      ) : !generatedRoadmap ? (
        <button
          onClick={generateRoadmap}
          disabled={!canGenerate}
          className="w-full py-3 bg-brand-purple text-white rounded-lg hover:bg-brand-purple-hover transition-colors font-mono text-sm font-semibold disabled:opacity-40"
        >
          &#128640; Generate Roadmap
        </button>
      ) : null}

      {/* ROADMAP DISPLAY */}
      {generatedRoadmap && (
        <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-terminal-lg font-semibold text-text-primary">
              Your Roadmap &mdash; {totalDays} Days, {generatedRoadmap.weeks.length} Weeks
            </span>
          </div>
          <div className="px-4 py-4 space-y-4">
            {generatedRoadmap.summary && (
              <div className="bg-brand-purple-wash border border-brand-purple/10 rounded p-3 text-terminal-base font-mono text-text-secondary">
                {generatedRoadmap.summary}
              </div>
            )}
            {generatedRoadmap.warnings && generatedRoadmap.warnings.length > 0 && (
              <div className="space-y-2">
                {generatedRoadmap.warnings.map((w, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-100 rounded p-3 text-terminal-base font-mono text-amber-800">
                    &#9888; {w}
                  </div>
                ))}
              </div>
            )}

            {/* Weekly timeline */}
            <div className="space-y-3">
              {generatedRoadmap.weeks.map((week: WeekPlan) => {
                const isBuffer = week.theme.toLowerCase().includes('buffer') || week.theme.toLowerCase().includes('recovery');
                const borderColor = isBuffer ? 'border-l-emerald-300' : 'border-l-brand-purple/30';
                return (
                  <div key={week.weekNumber} className={`border-l-2 ${borderColor} pl-4 py-2`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-terminal-sm text-text-muted font-mono">
                        Week {week.weekNumber} &mdash; {formatWeekDate(week.startDate)} - {formatWeekDate(week.endDate)}
                      </span>
                      {week.milestoneTarget && (
                        <span className="text-terminal-sm text-text-muted font-mono">&#127919; {week.milestoneTarget}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-text-primary font-mono mt-0.5">{week.theme}</p>
                    {week.dailyTasks.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {week.dailyTasks.map((t, i) => (
                          <span key={i} className="flex items-center gap-1 text-terminal-sm font-mono text-text-secondary">
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIO_DOT[t.priority] || 'bg-amber-500'}`} />
                            {t.text}
                          </span>
                        ))}
                      </div>
                    )}
                    {week.healthCadence && (
                      <p className="text-terminal-sm text-text-faint font-mono mt-1">{week.healthCadence}</p>
                    )}
                    {week.notes && (
                      <p className="text-terminal-sm text-amber-600 font-mono mt-1">{week.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons below roadmap */}
      {generatedRoadmap && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setGeneratedRoadmap(null)} className="text-terminal-base text-text-muted hover:text-text-primary font-mono transition-colors">Edit Mission</button>
            <button onClick={generateRoadmap} className="text-terminal-base text-text-muted hover:text-text-primary font-mono transition-colors">Regenerate</button>
          </div>
          <button
            onClick={lockItIn}
            disabled={isSaving}
            className="px-6 py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : '\u{1F680} Lock it in & Start'}
          </button>
        </div>
      )}
    </div>
  );
}
