'use client';

import BrainDumpSection from './BrainDumpSection';
import StageSection from './StageSection';
import GoalConfirmationSection from './GoalConfirmationSection';
import RealityConstraintsSection from './RealityConstraintsSection';

interface Stage {
  stageType: string;
  status: string;
  attemptNumber: number;
}

function hasApprovedStage(mission: Record<string, unknown>, stageType: string): boolean {
  const stages = (mission.stages as Stage[]) || [];
  return stages.some((s) => s.stageType === stageType && s.status === 'approved');
}

interface MissionPipelineProps {
  mission: Record<string, unknown>;
  onUpdate: () => void;
}

export default function MissionPipeline({ mission, onUpdate }: MissionPipelineProps) {
  const entries = (mission.brainDumpEntries as Array<unknown>) || [];
  const constraints = (mission.realityConstraints as Array<unknown>) || [];
  const confirmedGoal = mission.confirmedGoal as string | null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-1">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary font-mono">{String(mission.name)}</h1>
        <p className="text-terminal-sm text-text-muted font-mono mt-1">
          {mission.durationDays ? `${String(mission.durationDays)} day mission` : 'Mission'} &middot; Status: {String(mission.missionStatus)}
        </p>
      </div>

      {/* 1. Brain Dump */}
      <BrainDumpSection
        missionId={mission.id as string}
        existingEntries={(mission.brainDumpEntries as Array<{ content: string; triggerQuestion?: string }>) || []}
        onSaved={onUpdate}
      />

      <PipelineConnector />

      {/* 2. Structure */}
      {entries.length > 0 && (
        <>
          <StageSection mission={mission} stageType="structure" title="Structure — Project Discovery" onUpdate={onUpdate} />
          <PipelineConnector />
        </>
      )}

      {/* 3. Goal Discovery */}
      {hasApprovedStage(mission, 'structure') && (
        <>
          <StageSection mission={mission} stageType="goal_discovery" title="Goal Discovery" onUpdate={onUpdate} />
          <PipelineConnector />
        </>
      )}

      {/* 4. Goal Confirmation */}
      {hasApprovedStage(mission, 'goal_discovery') && !confirmedGoal && (
        <>
          <GoalConfirmationSection mission={mission} onUpdate={onUpdate} />
          <PipelineConnector />
        </>
      )}

      {/* Show confirmed goal */}
      {confirmedGoal && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Confirmed Goal</p>
          <p className="text-sm font-medium text-text-primary font-mono">{confirmedGoal}</p>
        </div>
      )}

      {/* 5. Reality Constraints */}
      {confirmedGoal && (
        <>
          <PipelineConnector />
          <RealityConstraintsSection mission={mission} onUpdate={onUpdate} />
        </>
      )}

      {/* 6. Reality Audit */}
      {confirmedGoal && constraints.length > 0 && (
        <>
          <PipelineConnector />
          <StageSection mission={mission} stageType="reality_audit" title="Reality Audit" onUpdate={onUpdate} />
        </>
      )}

      {/* 7. Roadmap */}
      {hasApprovedStage(mission, 'reality_audit') && (
        <>
          <PipelineConnector />
          <StageSection mission={mission} stageType="roadmap" title="Roadmap" onUpdate={onUpdate} />
        </>
      )}
    </div>
  );
}

function PipelineConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="w-px h-6 bg-border" />
    </div>
  );
}
