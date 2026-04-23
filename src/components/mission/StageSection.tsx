'use client';

import { useState } from 'react';

interface StageData {
  id: string;
  stageType: string;
  status: string;
  attemptNumber: number;
  inputSnapshot?: unknown;
  systemPrompt?: string;
  userPrompt?: string;
  rawResponse?: string;
  parsedOutput?: Record<string, unknown>;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
};

const PRIO_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };
const SCOPE_BADGE: Record<string, string> = { small: 'bg-emerald-50 text-emerald-700', medium: 'bg-amber-50 text-amber-700', large: 'bg-red-50 text-red-700' };
const SEV_COLOR: Record<string, string> = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-text-muted' };

interface StageSectionProps {
  mission: Record<string, unknown>;
  stageType: string;
  title: string;
  onUpdate: () => void;
}

export default function StageSection({ mission, stageType, title, onUpdate }: StageSectionProps) {
  const missionId = mission.id as string;
  const stages = ((mission.stages as StageData[]) || []).filter((s) => s.stageType === stageType);
  const latestStage = stages[0] || null;
  const [running, setRunning] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const canRun = !latestStage || latestStage.status === 'rejected';
  const canApprove = latestStage?.status === 'completed';

  const runStage = async () => {
    setRunning(true);
    try {
      await fetch(`/api/mission/${missionId}/run-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageType }),
      });
      onUpdate();
    } catch (err) {
      console.error('Run stage failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const approve = async () => {
    if (!latestStage) return;
    await fetch(`/api/mission/${missionId}/stage/${latestStage.id}/approve`, { method: 'POST' });
    onUpdate();
  };

  const reject = async () => {
    if (!latestStage) return;
    await fetch(`/api/mission/${missionId}/stage/${latestStage.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason || null }),
    });
    setRejecting(false);
    setRejectReason('');
    onUpdate();
  };

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-lg font-semibold text-text-primary">{title}</span>
        {latestStage && (
          <span className={`text-terminal-sm font-mono px-2 py-0.5 rounded-full ${STATUS_BADGE[latestStage.status] || ''}`}>
            {latestStage.status}
            {latestStage.attemptNumber > 1 && ` (attempt ${latestStage.attemptNumber})`}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Run button */}
        {canRun && (
          <button
            onClick={runStage}
            disabled={running}
            className="w-full py-2 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40"
          >
            {running ? 'Running...' : `Run ${title}`}
          </button>
        )}

        {running && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-muted font-mono">Processing with AI...</span>
          </div>
        )}

        {/* Observability sections */}
        {latestStage && (
          <>
            <Collapsible title="Input Snapshot">
              <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(latestStage.inputSnapshot, null, 2)}
              </pre>
            </Collapsible>

            <Collapsible title="System Prompt">
              <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap">
                {latestStage.systemPrompt || '(none)'}
              </pre>
            </Collapsible>

            <Collapsible title="User Prompt">
              <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap">
                {latestStage.userPrompt || '(none)'}
              </pre>
            </Collapsible>

            {/* Parsed output */}
            {latestStage.parsedOutput && (
              <div className="border border-border-light rounded p-3">
                <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Output</p>
                <StageOutput stageType={stageType} output={latestStage.parsedOutput} />
              </div>
            )}

            <Collapsible title="Raw API Response">
              <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto">
                {latestStage.rawResponse || '(none)'}
              </pre>
            </Collapsible>

            {/* Approve / Reject */}
            {canApprove && (
              <div className="flex items-center gap-2 pt-2 border-t border-border-light">
                <button
                  onClick={approve}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded text-terminal-base font-mono hover:bg-emerald-700 transition-colors"
                >
                  Approve
                </button>
                {rejecting ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="flex-1 font-mono text-terminal-base border border-border rounded px-2 py-1 outline-none focus:border-brand-purple"
                    />
                    <button onClick={reject} className="px-3 py-1.5 bg-red-600 text-white rounded text-terminal-base font-mono">Reject</button>
                    <button onClick={() => setRejecting(false)} className="text-terminal-base text-text-muted font-mono">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRejecting(true)}
                    className="px-4 py-1.5 border border-red-300 text-red-600 rounded text-terminal-base font-mono hover:bg-red-50 transition-colors"
                  >
                    Reject
                  </button>
                )}
              </div>
            )}

            {latestStage.status === 'rejected' && latestStage.rejectionReason && (
              <p className="text-terminal-sm text-red-600 font-mono">Rejected: {latestStage.rejectionReason}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Collapsible ─────────────────────────────────────────────────────────────

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border-light rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors"
      >
        <span className="text-terminal-sm text-text-muted font-mono">{title}</span>
        <span className="text-text-faint text-terminal-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3 border-t border-border-light max-h-96 overflow-y-auto">{children}</div>}
    </div>
  );
}

// ── Stage-specific output renderers ─────────────────────────────────────────

function StageOutput({ stageType, output }: { stageType: string; output: Record<string, unknown> }) {
  if (stageType === 'structure') return <StructureOutputView output={output} />;
  if (stageType === 'goal_discovery') return <GoalDiscoveryOutputView output={output} />;
  return <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>;
}

function StructureOutputView({ output }: { output: Record<string, unknown> }) {
  const projects = (output.discoveredProjects as Array<{ projectName: string; description: string; estimatedScope: string; relatedEntries: Array<{ content: string }>; dependencies: string[]; blockers: string[] }>) || [];
  const themes = (output.emergentThemes as Array<{ theme: string; confidence: string; basis: string; evidence: string[] }>) || [];
  const contradictions = (output.contradictions as Array<{ itemA: { content: string }; itemB: { content: string }; nature: string; severity: string }>) || [];
  const constraints = (output.constraints as Array<{ constraint: string; impact: string }>) || [];
  const missingInputs = (output.missingInputs as Array<{ area: string; suggestedQuestion: string }>) || [];
  const gaps = (output.logicGaps as Array<{ statement: string; gap: string }>) || [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Discovered Projects ({projects.length})</p>
        <div className="space-y-2">
          {projects.map((p, i) => (
            <div key={i} className="border border-border-light rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-text-primary font-mono">{p.projectName}</span>
                <span className={`text-terminal-sm font-mono px-1.5 py-0.5 rounded ${SCOPE_BADGE[p.estimatedScope] || ''}`}>{p.estimatedScope}</span>
              </div>
              <p className="text-terminal-base text-text-secondary font-mono">{p.description}</p>
              {p.relatedEntries.length > 0 && (
                <div className="mt-1">
                  {p.relatedEntries.map((e, j) => (
                    <p key={j} className="text-terminal-sm text-text-faint font-mono">• {e.content}</p>
                  ))}
                </div>
              )}
              {p.dependencies.length > 0 && <p className="text-terminal-sm text-text-muted font-mono mt-1">Depends on: {p.dependencies.join(', ')}</p>}
              {p.blockers.length > 0 && <p className="text-terminal-sm text-red-500 font-mono mt-1">Blockers: {p.blockers.join(', ')}</p>}
            </div>
          ))}
        </div>
      </div>

      {themes.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Emergent Themes</p>
          {themes.map((t, i) => (
            <p key={i} className="text-terminal-base font-mono text-text-secondary">
              <span className="font-medium">{t.theme}</span> <span className="text-text-faint">({t.confidence}, {t.basis})</span>
            </p>
          ))}
        </div>
      )}

      {contradictions.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Contradictions</p>
          {contradictions.map((c, i) => (
            <div key={i} className={`text-terminal-base font-mono ${SEV_COLOR[c.severity]}`}>
              &ldquo;{c.itemA.content}&rdquo; vs &ldquo;{c.itemB.content}&rdquo; — {c.nature}
            </div>
          ))}
        </div>
      )}

      {constraints.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Constraints</p>
          {constraints.map((c, i) => (
            <p key={i} className="text-terminal-base font-mono text-text-secondary">{c.constraint} — <span className="text-text-faint">{c.impact}</span></p>
          ))}
        </div>
      )}

      {missingInputs.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Missing Inputs</p>
          {missingInputs.map((m, i) => (
            <p key={i} className="text-terminal-base font-mono text-amber-700">{m.area}: {m.suggestedQuestion}</p>
          ))}
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Logic Gaps</p>
          {gaps.map((g, i) => (
            <p key={i} className="text-terminal-base font-mono text-text-secondary">&ldquo;{g.statement}&rdquo; → Gap: {g.gap}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalDiscoveryOutputView({ output }: { output: Record<string, unknown> }) {
  const goals = (output.candidateGoals as Array<{
    rank: number; goalStatement: string; distinctiveAngle: string; rationale: string;
    executionProfile: { primaryFocus: string[]; deprioritizedAreas: string[]; likelyOperatingMode: string };
    tradeoffs: { gains: string[]; costs: string[]; risks: string[] };
    timelineFit: string; supportingEvidence: Array<{ type: string; reference: string }>;
  }>) || [];
  const questions = (output.openQuestions as Array<{ question: string; whyItMatters: string }>) || [];
  const assumptions = (output.assumptionsToValidate as Array<{ assumption: string; type: string; howToValidate: string }>) || [];
  const ignore = (output.itemsToIgnoreForNow as Array<{ content: string; reason: string }>) || [];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {goals.map((g) => (
          <div key={g.rank} className="border border-border-light rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-brand-purple font-mono">Goal {g.rank}</span>
            </div>
            <p className="text-sm font-semibold text-text-primary font-mono">{g.goalStatement}</p>
            <p className="text-terminal-sm text-text-muted font-mono mt-1 italic">{g.distinctiveAngle}</p>
            <p className="text-terminal-sm text-text-secondary font-mono mt-1">{g.rationale}</p>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <p className="text-terminal-sm text-emerald-600 font-mono font-medium">Gains</p>
                {g.tradeoffs.gains.map((t, i) => <p key={i} className="text-terminal-sm font-mono text-text-secondary">+ {t}</p>)}
              </div>
              <div>
                <p className="text-terminal-sm text-red-500 font-mono font-medium">Costs</p>
                {g.tradeoffs.costs.map((t, i) => <p key={i} className="text-terminal-sm font-mono text-text-secondary">- {t}</p>)}
              </div>
              <div>
                <p className="text-terminal-sm text-amber-600 font-mono font-medium">Risks</p>
                {g.tradeoffs.risks.map((t, i) => <p key={i} className="text-terminal-sm font-mono text-text-secondary">! {t}</p>)}
              </div>
            </div>
            <p className="text-terminal-sm text-text-faint font-mono mt-2">Mode: {g.executionProfile.likelyOperatingMode}</p>
            <p className="text-terminal-sm text-text-faint font-mono">Timeline: {g.timelineFit}</p>
          </div>
        ))}
      </div>

      {questions.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Open Questions</p>
          {questions.map((q, i) => (
            <p key={i} className="text-terminal-base font-mono text-text-secondary">? {q.question}</p>
          ))}
        </div>
      )}

      {assumptions.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Assumptions to Validate</p>
          {assumptions.map((a, i) => (
            <p key={i} className="text-terminal-base font-mono text-text-secondary">
              <span className="text-text-faint">[{a.type}]</span> {a.assumption} → {a.howToValidate}
            </p>
          ))}
        </div>
      )}

      {ignore.length > 0 && (
        <div>
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Items to Ignore</p>
          {ignore.map((item, i) => (
            <p key={i} className="text-terminal-base font-mono text-text-faint">{item.content} — {item.reason}</p>
          ))}
        </div>
      )}
    </div>
  );
}
