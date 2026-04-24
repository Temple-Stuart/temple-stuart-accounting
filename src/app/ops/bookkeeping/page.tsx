'use client';

import { useState } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';
import QuestionInput from '@/components/ops/QuestionInput';
import { BOOKKEEPING_OPS_MODULE } from '@/lib/ops/bookkeepingQuestions';
import type { OpsWorkstream, OpsQuestion, LaunchStage } from '@/lib/ops/bookkeepingQuestions';

const STAGE_COLORS: Record<LaunchStage, { bg: string; text: string; label: string }> = {
  required_now: { bg: 'bg-red-50', text: 'text-red-700', label: 'Required Now' },
  required_before_charging: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Before Charging' },
  required_at_scale: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'At Scale' },
  best_practice: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Best Practice' },
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  boolean: 'Yes/No',
  select: 'Select',
  multiselect: 'Multi',
  checklist: 'Checklist',
  date: 'Date',
};

function stageCounts() {
  const counts: Record<LaunchStage, number> = {
    required_now: 0,
    required_before_charging: 0,
    required_at_scale: 0,
    best_practice: 0,
  };
  for (const ws of BOOKKEEPING_OPS_MODULE.workstreams) {
    for (const q of ws.questions) {
      counts[q.launchStage]++;
    }
  }
  return counts;
}

function isAnswered(value: string | undefined): boolean {
  if (!value || value.trim() === '') return false;
  if (value === '[]') return false;
  return true;
}

export default function BookkeepingQuestionnairePage() {
  const [expandedWorkstream, setExpandedWorkstream] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const counts = stageCounts();

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === '' || value === '[]') {
        delete next[questionId];
      } else {
        next[questionId] = value;
      }
      return next;
    });
  };

  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = BOOKKEEPING_OPS_MODULE.totalQuestions;
  const progressPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  const wsAnsweredCount = (ws: OpsWorkstream) =>
    ws.questions.filter((q) => isAnswered(answers[q.id])).length;

  const hasDepsAnswered = (q: OpsQuestion) => {
    if (!q.dependsOn || q.dependsOn.length === 0) return true;
    return q.dependsOn.every((depId) => isAnswered(answers[depId]));
  };

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Module Header */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <h1 className="text-xl font-bold text-text-primary font-mono">{BOOKKEEPING_OPS_MODULE.title}</h1>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">{BOOKKEEPING_OPS_MODULE.description}</p>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-terminal-sm text-text-muted font-mono">
                {totalAnswered} / {totalQuestions} questions answered
              </span>
              <span className="text-terminal-sm text-text-faint font-mono">{progressPct}%</span>
            </div>
            <div className="h-2 bg-bg-row rounded-full">
              <div
                className="h-2 rounded-full bg-brand-purple transition-all"
                style={{ width: `${progressPct}%` }}
              />
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

        {/* Workstream Accordion */}
        {BOOKKEEPING_OPS_MODULE.workstreams.map((ws: OpsWorkstream) => {
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
                  {ws.questions.map((q: OpsQuestion) => {
                    const stageStyle = STAGE_COLORS[q.launchStage];
                    const depsOk = hasDepsAnswered(q);
                    return (
                      <div
                        key={q.id}
                        className={`px-4 py-3 border-b border-border-light last:border-b-0 ${
                          !depsOk ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-terminal-sm text-text-faint font-mono flex-shrink-0 mt-0.5 w-16">{q.id}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-terminal-base text-text-primary font-mono">{q.text}</p>
                            {q.helpText && (
                              <p className="text-terminal-sm text-text-faint font-mono mt-1">{q.helpText}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-terminal-sm font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {TYPE_LABELS[q.type] || q.type}
                              </span>
                              <span className="text-terminal-sm font-mono px-1.5 py-0.5 rounded bg-brand-purple-wash text-brand-purple">
                                {q.regulatoryTag.replace(/_/g, ' ')}
                              </span>
                              <span className={`text-terminal-sm font-mono px-1.5 py-0.5 rounded-full ${stageStyle.bg} ${stageStyle.text}`}>
                                {stageStyle.label}
                              </span>
                              {!depsOk && q.dependsOn && (
                                <span className="text-terminal-sm font-mono text-amber-600">
                                  Answer {q.dependsOn.join(', ')} first
                                </span>
                              )}
                            </div>
                            <div className="mt-3">
                              <QuestionInput
                                question={q}
                                value={answers[q.id] || ''}
                                onChange={(v) => setAnswer(q.id, v)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
