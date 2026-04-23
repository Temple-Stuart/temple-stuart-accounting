'use client';

import { useState } from 'react';

interface GoalCandidate {
  rank: number;
  goalStatement: string;
  distinctiveAngle: string;
  tradeoffs: { gains: string[]; costs: string[]; risks: string[] };
  timelineFit: string;
}

interface GoalConfirmationSectionProps {
  mission: Record<string, unknown>;
  onUpdate: () => void;
}

export default function GoalConfirmationSection({ mission, onUpdate }: GoalConfirmationSectionProps) {
  const missionId = mission.id as string;
  const stages = (mission.stages as Array<{ stageType: string; status: string; parsedOutput?: Record<string, unknown> }>) || [];
  const goalStage = stages.find((s) => s.stageType === 'goal_discovery' && s.status === 'approved');
  const goals = ((goalStage?.parsedOutput?.candidateGoals || []) as GoalCandidate[]);
  const openQuestions = ((goalStage?.parsedOutput?.openQuestions || []) as Array<{ question: string; whyItMatters: string }>);

  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [editedGoal, setEditedGoal] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!selectedRank) return;
    setConfirming(true);
    try {
      await fetch(`/api/mission/${missionId}/confirm-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalRank: selectedRank, editedGoalStatement: editedGoal || undefined }),
      });
      onUpdate();
    } catch (err) {
      console.error('Goal confirmation failed:', err);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">Confirm Your Goal</span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-terminal-sm text-text-muted font-mono">Select a goal to commit to for this mission.</p>

        {goals.map((g) => (
          <button
            key={g.rank}
            onClick={() => {
              setSelectedRank(g.rank);
              setEditedGoal(g.goalStatement);
            }}
            className={`w-full text-left border rounded p-3 transition-colors ${
              selectedRank === g.rank
                ? 'border-brand-purple bg-brand-purple-wash'
                : 'border-border-light hover:border-border'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-brand-purple font-mono">Goal {g.rank}</span>
              {selectedRank === g.rank && <span className="text-terminal-sm text-brand-purple font-mono">Selected</span>}
            </div>
            <p className="text-sm font-medium text-text-primary font-mono">{g.goalStatement}</p>
            <p className="text-terminal-sm text-text-faint font-mono mt-1">{g.distinctiveAngle}</p>
          </button>
        ))}

        {selectedRank && (
          <div>
            <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">
              Edit goal statement (optional)
            </label>
            <textarea
              rows={2}
              value={editedGoal}
              onChange={(e) => setEditedGoal(e.target.value)}
              className="w-full resize-none font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-brand-purple transition-colors"
            />
          </div>
        )}

        {openQuestions.length > 0 && (
          <div className="border-t border-border-light pt-3">
            <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Open Questions to Consider</p>
            {openQuestions.map((q, i) => (
              <p key={i} className="text-terminal-base font-mono text-text-secondary">? {q.question}</p>
            ))}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selectedRank || confirming}
          className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
        >
          {confirming ? 'Confirming...' : 'Confirm Goal →'}
        </button>
      </div>
    </div>
  );
}
