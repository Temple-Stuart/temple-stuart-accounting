'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';
import QuestionInput from '@/components/ops/QuestionInput';
import { TRADING_OPS_MODULE } from '@/lib/ops/tradingQuestions';
import type { TradingWorkstream, TradingQuestion, LaunchStage } from '@/lib/ops/tradingQuestions';
import type { OpsQuestion } from '@/lib/ops/bookkeepingQuestions';

const MODULE_ID = 'trading';

const STAGE_COLORS: Record<LaunchStage, { bg: string; text: string; label: string }> = {
  required_now: { bg: 'bg-red-100', text: 'text-red-800', label: 'Required Now' },
  required_before_charging: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Before Charging' },
  required_at_scale: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'At Scale' },
  best_practice: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Best Practice' },
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Text', boolean: 'Yes/No', select: 'Select',
  multiselect: 'Multi', checklist: 'Checklist', date: 'Date',
};

function stageCounts() {
  const counts: Record<LaunchStage, number> = {
    required_now: 0, required_before_charging: 0, required_at_scale: 0, best_practice: 0,
  };
  for (const ws of TRADING_OPS_MODULE.workstreams) {
    for (const q of ws.questions) counts[q.launchStage]++;
  }
  return counts;
}

function isAnswered(value: string | undefined): boolean {
  return !!value && value.trim() !== '' && value !== '[]';
}

export default function TradingQuestionnairePage() {
  const [expandedWorkstream, setExpandedWorkstream] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missionId, setMissionId] = useState<string | null>(null);
  const [loadingMission, setLoadingMission] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const [analyses, setAnalyses] = useState<Record<string, { analysis: Record<string, unknown>; isStale: boolean }>>({});
  const [analyzingWs, setAnalyzingWs] = useState<string | null>(null);
  const [synthesis, setSynthesis] = useState<{ synthesis: Record<string, unknown>; isStale: boolean; workstreamsCovered: string[] } | null>(null);
  const [runningSynthesis, setRunningSynthesis] = useState(false);
  const counts = stageCounts();

  // Fetch active mission
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/mission/active');
        if (res.ok) {
          const data = await res.json();
          if (data.mission?.id) setMissionId(data.mission.id as string);
        }
      } catch (err) {
        console.error('Failed to fetch mission:', err);
      } finally {
        setLoadingMission(false);
      }
    })();
  }, []);

  // Load answers when missionId is available
  useEffect(() => {
    if (!missionId) return;
    setLoadingAnswers(true);
    (async () => {
      try {
        const res = await fetch(`/api/ops/questionnaire-answers?missionId=${missionId}&moduleId=${MODULE_ID}`);
        if (res.ok) {
          const data = await res.json();
          setAnswers(data.answers || {});
        }
      } catch (err) {
        console.error('Failed to load answers:', err);
      } finally {
        setLoadingAnswers(false);
      }
    })();
  }, [missionId]);

  // Load existing analyses
  useEffect(() => {
    if (!missionId) return;
    (async () => {
      for (const ws of TRADING_OPS_MODULE.workstreams) {
        try {
          const res = await fetch(`/api/ops/workstream-analysis?missionId=${missionId}&moduleId=${MODULE_ID}&workstreamId=${ws.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.analysis) {
              setAnalyses((prev) => ({ ...prev, [ws.id]: { analysis: data.analysis, isStale: data.isStale } }));
            }
          }
        } catch { /* skip failed loads */ }
      }
    })();
  }, [missionId]);

  // Load existing synthesis
  useEffect(() => {
    if (!missionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/ops/synthesis-report?missionId=${missionId}&moduleId=${MODULE_ID}`);
        if (res.ok) {
          const data = await res.json();
          if (data.synthesis) setSynthesis({ synthesis: data.synthesis, isStale: data.isStale, workstreamsCovered: data.workstreamsCovered || [] });
        }
      } catch { /* skip */ }
    })();
  }, [missionId]);

  const runSynthesis = useCallback(async () => {
    if (!missionId) return;
    setRunningSynthesis(true);
    try {
      const res = await fetch('/api/ops/synthesis-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, moduleId: MODULE_ID }),
      });
      if (res.ok) {
        const data = await res.json();
        setSynthesis({ synthesis: data.synthesis, isStale: false, workstreamsCovered: data.workstreamsCovered || [] });
      } else {
        const err = await res.json().catch(() => ({ error: 'Synthesis failed' }));
        alert(err.error || 'Synthesis failed');
      }
    } catch (err) {
      console.error('Synthesis failed:', err);
    } finally {
      setRunningSynthesis(false);
    }
  }, [missionId]);

  const runAnalysis = useCallback(async (workstreamId: string) => {
    if (!missionId) return;
    setAnalyzingWs(workstreamId);
    try {
      const res = await fetch('/api/ops/workstream-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, moduleId: MODULE_ID, workstreamId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyses((prev) => ({ ...prev, [workstreamId]: { analysis: data.analysis, isStale: false } }));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzingWs(null);
    }
  }, [missionId]);

  const persistAnswer = useCallback(
    async (question: TradingQuestion, value: string) => {
      if (!missionId) return;
      const wsId = TRADING_OPS_MODULE.workstreams.find((ws) =>
        ws.questions.some((q) => q.id === question.id),
      )?.id || '';

      setSavingQuestions((prev) => ({ ...prev, [question.id]: 'saving' }));
      try {
        const res = await fetch('/api/ops/questionnaire-answers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            missionId,
            moduleId: MODULE_ID,
            workstreamId: wsId,
            questionId: question.id,
            questionType: question.type,
            answerValue: value,
          }),
        });
        setSavingQuestions((prev) => ({ ...prev, [question.id]: res.ok ? 'saved' : 'error' }));
        if (res.ok) {
          setTimeout(() => setSavingQuestions((prev) => { const n = { ...prev }; delete n[question.id]; return n; }), 1500);
        }
      } catch {
        setSavingQuestions((prev) => ({ ...prev, [question.id]: 'error' }));
      }
    },
    [missionId],
  );

  const handleAnswerChange = useCallback(
    (question: TradingQuestion, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev };
        if (value === '' || value === '[]') delete next[question.id];
        else next[question.id] = value;
        return next;
      });

      if (question.type === 'text') {
        if (debounceTimers.current[question.id]) clearTimeout(debounceTimers.current[question.id]);
        debounceTimers.current[question.id] = setTimeout(() => persistAnswer(question, value), 600);
      } else {
        persistAnswer(question, value);
      }
    },
    [persistAnswer],
  );

  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = TRADING_OPS_MODULE.totalQuestions;
  const progressPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  const wsAnsweredCount = (ws: TradingWorkstream) =>
    ws.questions.filter((q) => isAnswered(answers[q.id])).length;

  const hasDepsAnswered = (q: TradingQuestion) => {
    if (!q.dependsOn || q.dependsOn.length === 0) return true;
    return q.dependsOn.every((depId) => isAnswered(answers[depId]));
  };

  // Loading states
  if (loadingMission) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!missionId) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="max-w-6xl mx-auto px-4 pt-8 text-center">
          <p className="text-text-muted font-mono text-sm">No mission found.</p>
          <p className="text-text-faint font-mono text-terminal-sm mt-1">
            Create a mission on the{' '}
            <a href="/ops" className="text-brand-purple hover:underline">Overview tab</a>{' '}
            first.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (loadingAnswers) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading answers...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-8 space-y-5">
        {/* Module Header */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <h1 className="text-xl font-bold text-text-primary font-mono">{TRADING_OPS_MODULE.title}</h1>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">{TRADING_OPS_MODULE.description}</p>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-terminal-sm text-text-muted font-mono">{totalAnswered} / {totalQuestions} questions answered</span>
              <span className="text-terminal-sm text-text-faint font-mono">{progressPct}%</span>
            </div>
            <div className="h-2 bg-bg-row rounded-full">
              <div className="h-2 rounded-full bg-brand-purple transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {(Object.entries(counts) as Array<[LaunchStage, number]>).map(([stage, count]) => {
              const style = STAGE_COLORS[stage];
              return (
                <span key={stage} className={`${style.bg} ${style.text} text-terminal-sm font-mono px-2 py-0.5 rounded-full`}>
                  {style.label}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Synthesis */}
        <SynthesisSection
          analysisCount={Object.keys(analyses).length}
          synthesis={synthesis}
          runningSynthesis={runningSynthesis}
          onRun={runSynthesis}
        />

        {/* Workstream Accordion */}
        {TRADING_OPS_MODULE.workstreams.map((ws: TradingWorkstream) => {
          const isExpanded = expandedWorkstream === ws.id;
          const answered = wsAnsweredCount(ws);
          return (
            <div key={ws.id} className="bg-white rounded border border-border shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedWorkstream(isExpanded ? null : ws.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-purple font-mono">{ws.letter}</span>
                    <span className="text-sm font-semibold text-text-primary font-mono">{ws.title}</span>
                  </div>
                  <p className="text-terminal-sm text-text-faint font-mono mt-0.5">{ws.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className={`text-terminal-sm font-mono ${answered === ws.questions.length && answered > 0 ? 'text-emerald-600' : 'text-text-muted'}`}>
                    {answered}/{ws.questions.length}
                  </span>
                  <span className="text-text-faint text-terminal-sm">{isExpanded ? '▼' : '▶'}</span>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border">
                  {ws.questions.map((q: TradingQuestion) => {
                    const stageStyle = STAGE_COLORS[q.launchStage];
                    const depsOk = hasDepsAnswered(q);
                    const saveState = savingQuestions[q.id];
                    return (
                      <div key={q.id} className={`px-4 py-4 border-b border-border last:border-b-0 ${!depsOk ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-terminal-sm text-text-faint font-mono flex-shrink-0 mt-0.5 w-16">{q.id}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-terminal-base text-text-primary font-mono">{q.text}</p>
                            {q.helpText && <p className="text-terminal-sm text-text-faint font-mono mt-1">{q.helpText}</p>}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-terminal-sm font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-medium">{TYPE_LABELS[q.type] || q.type}</span>
                              <span className="text-terminal-sm font-mono px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple font-medium">{q.regulatoryTag.replace(/_/g, ' ')}</span>
                              <span className={`text-terminal-sm font-mono px-1.5 py-0.5 rounded-full ${stageStyle.bg} ${stageStyle.text}`}>{stageStyle.label}</span>
                              {!depsOk && q.dependsOn && (
                                <span className="text-terminal-sm font-mono text-amber-600">Answer {q.dependsOn.join(', ')} first</span>
                              )}
                              {saveState === 'saving' && <span className="text-terminal-sm font-mono text-text-faint animate-pulse">Saving...</span>}
                              {saveState === 'saved' && <span className="text-terminal-sm font-mono text-emerald-600">Saved</span>}
                              {saveState === 'error' && <span className="text-terminal-sm font-mono text-red-500">Failed to save</span>}
                            </div>
                            <div className="mt-3">
                              <QuestionInput
                                question={q as unknown as OpsQuestion}
                                value={answers[q.id] || ''}
                                onChange={(v) => handleAnswerChange(q, v)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Analyze button */}
                  <div className="px-4 py-3 border-t border-border-light">
                    {analyzingWs === ws.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
                        <span className="text-terminal-sm text-text-muted font-mono">Analyzing workstream...</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => runAnalysis(ws.id)}
                        disabled={answered === 0}
                        className="px-4 py-1.5 bg-brand-purple text-white rounded text-terminal-sm font-mono hover:bg-brand-purple-hover transition-colors disabled:opacity-40"
                      >
                        {analyses[ws.id] ? 'Re-analyze' : 'Analyze Workstream'}
                      </button>
                    )}
                  </div>

                  {/* Analysis results */}
                  {analyses[ws.id] && (
                    <AnalysisResults wsId={ws.id} data={analyses[ws.id]} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}

// ── Analysis Results Component ──────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  decided: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Decided' },
  undecided: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Undecided' },
  blocked: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Blocked' },
  at_risk: { bg: 'bg-red-100', text: 'text-red-800', label: 'At Risk' },
  not_applicable: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'N/A' },
};

interface Decision {
  questionId: string;
  questionText: string;
  answer: string | null;
  status: string;
  statusReason: string;
  regulatoryExposure: { statute: string; penaltyRange: string; enforcementLikelihood: string; notes: string };
  requiredAction: { action: string | null; deadline: string | null; effort: string; blockedBy: string[] };
}

function AnalysisResults({ wsId, data }: { wsId: string; data: { analysis: Record<string, unknown>; isStale: boolean } }) {
  const { analysis, isStale } = data;
  const decisions = (analysis.decisions as Decision[]) || [];
  const summary = analysis.workstreamSummary as Record<string, unknown> | undefined;
  const criticalActions = (summary?.criticalActions as string[]) || [];
  const crossDeps = (summary?.crossWorkstreamDependencies as Array<{ dependsOnWorkstream: string; reason: string }>) || [];

  void wsId;

  return (
    <div className="border-t-2 border-border bg-bg-row/40">
      <div className="px-4 py-2 bg-gray-50 border-b border-border">
        <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono font-medium">AI Decision Register</span>
      </div>
      {isStale && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <span className="text-terminal-sm font-mono text-amber-700">Answers changed since last analysis. Re-analyze to update.</span>
        </div>
      )}

      <div className="px-4 py-3 space-y-3">

        {/* Summary */}
        {summary && (
          <div className="flex flex-wrap gap-2 text-terminal-sm font-mono">
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Decided: {String(summary.decided || 0)}</span>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">Undecided: {String(summary.undecided || 0)}</span>
            <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">Blocked: {String(summary.blocked || 0)}</span>
            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-medium">At Risk: {String(summary.atRisk || 0)}</span>
            {summary.totalExposure != null && <span className="text-red-600 font-medium">Exposure: {String(summary.totalExposure)}</span>}
          </div>
        )}

        {/* Decisions */}
        <div className="space-y-2">
          {decisions.map((d) => {
            const style = STATUS_STYLE[d.status] || STATUS_STYLE.undecided;
            const showDetail = d.status === 'undecided' || d.status === 'at_risk' || d.status === 'blocked';
            return (
              <div key={d.questionId} className="border border-border-light rounded p-2.5">
                <div className="flex items-start gap-2">
                  <span className={`text-terminal-sm font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${style.bg} ${style.text}`}>{style.label}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-terminal-sm text-text-faint font-mono">{d.questionId}</span>
                    <p className="text-terminal-sm text-text-secondary font-mono">{d.statusReason}</p>
                    {showDetail && d.regulatoryExposure.statute !== 'N/A' && (
                      <p className="text-terminal-sm font-mono text-red-600 mt-1">
                        {d.regulatoryExposure.statute}: {d.regulatoryExposure.penaltyRange}
                      </p>
                    )}
                    {showDetail && d.requiredAction.action && (
                      <p className="text-terminal-sm font-mono text-text-primary mt-1">
                        Action: {d.requiredAction.action}
                        {d.requiredAction.deadline && <span className="text-text-muted"> — by {d.requiredAction.deadline}</span>}
                        {d.requiredAction.effort && <span className="text-text-faint"> ({d.requiredAction.effort})</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Critical actions */}
        {criticalActions.length > 0 && (
          <div>
            <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Critical Actions</p>
            {criticalActions.map((a, i) => (
              <p key={i} className="text-terminal-sm font-mono text-red-600">! {a}</p>
            ))}
          </div>
        )}

        {/* Cross-workstream deps */}
        {crossDeps.length > 0 && (
          <div>
            <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Cross-Workstream Dependencies</p>
            {crossDeps.map((d, i) => (
              <p key={i} className="text-terminal-sm font-mono text-text-secondary">
                Depends on <span className="text-brand-purple font-medium">{d.dependsOnWorkstream}</span>: {d.reason}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Synthesis Section ───────────────────────────────────────────────────────

interface Blocker { questionId: string; workstreamId: string; reason: string; statute: string; penaltyIfIgnored: string; resolution: string; estimatedEffort: string }
interface SeqAction { order: number; questionId: string; action: string; deadline: string; effort: string; workstreamId: string }

function SynthesisSection({ analysisCount, synthesis, runningSynthesis, onRun }: {
  analysisCount: number;
  synthesis: { synthesis: Record<string, unknown>; isStale: boolean; workstreamsCovered: string[] } | null;
  runningSynthesis: boolean;
  onRun: () => void;
}) {
  const canRun = analysisCount >= 2;

  return (
    <div className="space-y-5">
      {/* Run button */}
      <div className="bg-white rounded border border-border shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-terminal-sm text-text-muted font-mono">
              {analysisCount} of 18 workstreams analyzed
            </span>
          </div>
          {runningSynthesis ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <span className="text-terminal-sm text-text-muted font-mono">Running synthesis...</span>
            </div>
          ) : (
            <button onClick={onRun} disabled={!canRun}
              className="px-4 py-1.5 bg-brand-purple text-white rounded text-terminal-sm font-mono hover:bg-brand-purple-hover transition-colors disabled:opacity-40">
              {synthesis ? 'Re-run Synthesis' : 'Run Full Synthesis'}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {synthesis && <SynthesisResults data={synthesis} />}
    </div>
  );
}

function SynthesisResults({ data }: { data: { synthesis: Record<string, unknown>; isStale: boolean; workstreamsCovered: string[] } }) {
  const { synthesis: s, isStale, workstreamsCovered } = data;
  const lr = s.launchReadiness as { canLaunch: boolean; blockers: Blocker[]; conditionalItems?: Array<{ questionId: string; condition: string }> } | undefined;
  const exposure = s.totalRegulatoryExposure as { totalMinPenalty: string; totalMaxPenalty: string; breakdownByStatute?: Array<{ statute: string; exposure: string; status: string }> } | undefined;
  const cp = s.criticalPath as { launchDate: string; longestPole?: { item: string; reason: string; estimatedDuration: string }; sequencedActions?: SeqAction[] } | undefined;
  const contradictions = (s.contradictions as Array<{ questionId1: string; answer1: string; questionId2: string; answer2: string; contradiction: string; resolution: string }>) || [];
  const deps = (s.crossWorkstreamDependencies as Array<{ fromWorkstream: string; toWorkstream: string; dependency: string; impact: string }>) || [];
  const execSummary = s.executiveSummary as string | undefined;
  const notAnalyzed = (s.workstreamsNotAnalyzed as string[]) || [];

  return (
    <div className="space-y-5">
      {isStale && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <span className="text-terminal-sm font-mono text-amber-700">Workstream analyses updated since this synthesis. Re-run to update.</span>
        </div>
      )}

      {/* Launch Readiness Banner */}
      {lr && (
        <div className={`rounded border p-5 ${lr.canLaunch ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-lg font-bold font-mono ${lr.canLaunch ? 'text-emerald-700' : 'text-red-700'}`}>
            {lr.canLaunch ? 'LAUNCH READY — all compliance gates passed' : `NOT READY TO LAUNCH — ${lr.blockers?.length || 0} blockers`}
          </p>
          {lr.blockers && lr.blockers.length > 0 && (
            <div className="mt-3 space-y-2">
              {lr.blockers.map((b, i) => (
                <div key={i} className="border border-red-200 rounded p-2.5 bg-white">
                  <div className="flex items-start gap-2">
                    <span className="text-terminal-sm font-mono text-text-faint">{b.questionId}</span>
                    <div className="flex-1">
                      <p className="text-terminal-sm font-mono text-text-primary">{b.reason}</p>
                      <p className="text-terminal-sm font-mono text-red-600 mt-0.5">{b.statute}: {b.penaltyIfIgnored}</p>
                      <p className="text-terminal-sm font-mono text-text-secondary mt-0.5">Resolution: {b.resolution} ({b.estimatedEffort})</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Executive Summary */}
      {execSummary && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Executive Summary</p>
          <p className="text-terminal-base font-mono text-text-primary">{execSummary}</p>
        </div>
      )}

      {/* Exposure */}
      {exposure && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Total Regulatory Exposure</p>
          <p className="text-sm font-bold font-mono text-red-600">{exposure.totalMinPenalty} — {exposure.totalMaxPenalty}</p>
          {exposure.breakdownByStatute && exposure.breakdownByStatute.length > 0 && (
            <div className="mt-2 space-y-1">
              {exposure.breakdownByStatute.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-terminal-sm font-mono">
                  <span className={`px-1.5 py-0.5 rounded ${s.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{s.status}</span>
                  <span className="text-text-primary">{s.statute}</span>
                  <span className="text-text-faint">{s.exposure}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Critical Path */}
      {cp && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Critical Path</p>
          <p className="text-terminal-base font-mono text-text-primary mb-2">Earliest launch: {cp.launchDate}</p>
          {cp.longestPole && (
            <div className="bg-amber-50 border border-amber-100 rounded p-2.5 mb-3">
              <p className="text-terminal-sm font-mono text-amber-700 font-medium">Longest pole: {cp.longestPole.item}</p>
              <p className="text-terminal-sm font-mono text-text-muted">{cp.longestPole.reason} ({cp.longestPole.estimatedDuration})</p>
            </div>
          )}
          {cp.sequencedActions && cp.sequencedActions.length > 0 && (
            <div className="space-y-1.5">
              {cp.sequencedActions.map((a) => (
                <div key={a.order} className="flex items-start gap-2 text-terminal-sm font-mono">
                  <span className="w-6 text-brand-purple font-bold flex-shrink-0">{a.order}.</span>
                  <div className="flex-1">
                    <span className="text-text-primary">{a.action}</span>
                    <span className="text-text-faint"> — {a.deadline} ({a.effort})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contradictions */}
      {contradictions.length > 0 && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Contradictions Found</p>
          {contradictions.map((c, i) => (
            <div key={i} className="border-l-2 border-l-red-300 pl-3 py-1.5 mb-2">
              <p className="text-terminal-sm font-mono text-red-600">{c.contradiction}</p>
              <p className="text-terminal-sm font-mono text-text-faint">{c.questionId1}: &ldquo;{c.answer1}&rdquo; vs {c.questionId2}: &ldquo;{c.answer2}&rdquo;</p>
              <p className="text-terminal-sm font-mono text-text-secondary mt-0.5">Resolution: {c.resolution}</p>
            </div>
          ))}
        </div>
      )}

      {/* Dependencies */}
      {deps.length > 0 && (
        <div className="bg-white rounded border border-border shadow-sm p-4">
          <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Cross-Workstream Dependencies</p>
          {deps.map((d, i) => (
            <p key={i} className="text-terminal-sm font-mono text-text-secondary mb-1">
              <span className="text-brand-purple">{d.fromWorkstream}</span> → <span className="text-brand-purple">{d.toWorkstream}</span>: {d.dependency}
            </p>
          ))}
        </div>
      )}

      {/* Not analyzed warning */}
      {notAnalyzed.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded p-3">
          <p className="text-terminal-sm font-mono text-amber-700 font-medium">{notAnalyzed.length} workstreams not included in this assessment:</p>
          <p className="text-terminal-sm font-mono text-amber-600 mt-1">{notAnalyzed.join(', ')}</p>
        </div>
      )}

      {/* Covered */}
      <p className="text-terminal-sm text-text-faint font-mono">Synthesis covers: {workstreamsCovered.join(', ')}</p>
    </div>
  );
}
