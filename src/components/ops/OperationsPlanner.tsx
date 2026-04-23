'use client';

import { useState, useEffect, useCallback } from 'react';
import { TRIGGER_QUESTION_GROUPS, OPEN_DUMP_LABEL } from '@/lib/mission/trigger-questions';
import { STRUCTURE_SYSTEM_PROMPT, buildStructurePrompt } from '@/lib/mission/prompts';
import { type BrainDumpItem } from '@/lib/mission/prompts/types';

const DURATION_PRESETS = [30, 75, 90];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
};

const SCOPE_BADGE: Record<string, string> = {
  small: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  large: 'bg-red-50 text-red-700',
};

const SEV_COLOR: Record<string, string> = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-text-muted' };

interface ExistingEntry {
  content: string;
  triggerQuestion?: string | null;
}

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
  rejectionReason?: string;
}

export default function OperationsPlanner() {
  const [existingMission, setExistingMission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const [missionTitle, setMissionTitle] = useState('');
  const [durationDays, setDurationDays] = useState(75);
  const [customDuration, setCustomDuration] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openDump, setOpenDump] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(TRIGGER_QUESTION_GROUPS[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const effectiveDuration = customDuration ? parseInt(customDuration, 10) || 75 : durationDays;
  const hasMission = existingMission !== null;

  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch('/api/mission/active');
      if (res.ok) {
        const data = await res.json();
        if (data.mission) {
          setExistingMission(data.mission);
          setMissionTitle(String(data.mission.name || ''));
          setDurationDays(Number(data.mission.durationDays) || 75);

          const entries = (data.mission.brainDumpEntries || []) as ExistingEntry[];
          const answerMap: Record<string, string> = {};
          const openLines: string[] = [];
          for (const e of entries) {
            if (e.triggerQuestion) {
              answerMap[e.triggerQuestion] = (answerMap[e.triggerQuestion] || '') +
                (answerMap[e.triggerQuestion] ? '\n' : '') + e.content;
            } else {
              openLines.push(e.content);
            }
          }
          setAnswers(answerMap);
          setOpenDump(openLines.join('\n'));
        }
      }
    } catch (err) {
      console.error('Failed to fetch mission:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMission(); }, [fetchMission]);

  const entryCount =
    Object.values(answers).filter((v) => v.trim()).length +
    openDump.split('\n').filter((l) => l.trim()).length;

  const collectEntries = () => {
    const entries: Array<{ content: string; source: string; triggerQuestion: string | null }> = [];
    for (const group of TRIGGER_QUESTION_GROUPS) {
      for (const q of group.questions) {
        const text = answers[q.text]?.trim();
        if (text) {
          for (const line of text.split('\n').filter(Boolean)) {
            entries.push({ content: line, source: 'typed', triggerQuestion: q.text });
          }
        }
      }
    }
    for (const line of openDump.split('\n').filter((l) => l.trim())) {
      entries.push({ content: line.trim(), source: 'typed', triggerQuestion: null });
    }
    return entries;
  };

  const handleSaveAndProcess = async () => {
    if (!missionTitle.trim()) { setTitleError(true); return; }
    setTitleError(false);
    setSaving(true);

    try {
      // 1. Create mission (or use existing)
      let missionId = existingMission?.id as string | undefined;

      if (!missionId) {
        console.log('[SaveProcess] Creating mission...');
        const createRes = await fetch('/api/mission/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: missionTitle.trim(), durationDays: effectiveDuration }),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({ error: 'Failed to create mission' }));
          alert(`Mission creation failed: ${err.error || createRes.statusText}`);
          setSaving(false);
          return;
        }
        const createData = await createRes.json();
        missionId = createData.mission.id as string;
        console.log('[SaveProcess] Mission created:', missionId);
      }

      // 2. Save brain dump entries
      const entries = collectEntries();
      if (entries.length > 0) {
        console.log('[SaveProcess] Saving', entries.length, 'entries...');
        const dumpRes = await fetch(`/api/mission/${missionId}/brain-dump`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
        if (!dumpRes.ok) {
          const err = await dumpRes.json().catch(() => ({ error: 'Failed to save entries' }));
          alert(`Brain dump save failed: ${err.error || dumpRes.statusText}`);
          setSaving(false);
          return;
        }
        console.log('[SaveProcess] Entries saved');
      }

      // 3. Run structure stage
      setSaving(false);
      setProcessing(true);
      console.log('[SaveProcess] Running structure stage...');

      const stageRes = await fetch(`/api/mission/${missionId}/run-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageType: 'structure' }),
      });
      if (!stageRes.ok) {
        const err = await stageRes.json().catch(() => ({ error: 'Stage failed' }));
        console.error('[SaveProcess] Stage failed:', err);
        alert(`Structure stage failed: ${err.error || stageRes.statusText}`);
      } else {
        console.log('[SaveProcess] Structure stage complete');
      }

      // 4. Fetch full mission by ID to get stage output
      console.log('[SaveProcess] Fetching mission...');
      const missionRes = await fetch(`/api/mission/${missionId}`);
      if (missionRes.ok) {
        const missionData = await missionRes.json();
        setExistingMission(missionData.mission);
        console.log('[SaveProcess] Mission loaded with', (missionData.mission?.stages || []).length, 'stages');
      } else {
        await fetchMission();
      }
    } catch (err) {
      console.error('[SaveProcess] Unexpected error:', err);
      alert(`Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
      setProcessing(false);
    }
  };

  // Get latest structure stage from mission
  const stages = ((existingMission?.stages as StageData[]) || []);
  const structureStage = stages
    .filter((s) => s.stageType === 'structure')
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0] || null;

  const handleApprove = async () => {
    if (!existingMission || !structureStage) return;
    await fetch(`/api/mission/${existingMission.id}/stage/${structureStage.id}/approve`, { method: 'POST' });
    fetchMission();
  };

  const handleReject = async (reason: string) => {
    if (!existingMission || !structureStage) return;
    await fetch(`/api/mission/${existingMission.id}/stage/${structureStage.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || null }),
    });
    fetchMission();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted font-mono text-terminal-base">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-3 pb-8 space-y-4">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-text-primary font-mono">Operations Planner</h1>
        <p className="text-terminal-sm text-text-muted font-mono mt-1">
          Define your mission. Dump your thoughts. The pipeline will organize, analyze, and plan.
        </p>
      </div>

      {/* ── MISSION DETAILS ─────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-terminal-lg font-semibold text-text-primary">Mission</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">Mission Title</label>
            <input
              type="text"
              value={missionTitle}
              onChange={(e) => { setMissionTitle(e.target.value); setTitleError(false); }}
              placeholder="e.g. Temple Stuart Bookkeeping Launch"
              disabled={hasMission}
              className={`font-mono text-sm bg-transparent border rounded-md px-3 py-2 w-full outline-none transition-colors placeholder:text-text-faint ${titleError ? 'border-red-400' : 'border-border focus:border-brand-purple'} ${hasMission ? 'opacity-60' : ''}`}
            />
            {titleError && <p className="text-terminal-sm text-red-500 font-mono mt-1">Mission title is required</p>}
          </div>
          <div>
            <label className="block text-terminal-sm text-text-muted font-mono uppercase tracking-wider mb-1">Duration</label>
            <div className="flex items-center gap-2">
              {DURATION_PRESETS.map((d) => (
                <button key={d} onClick={() => { setDurationDays(d); setCustomDuration(''); }} disabled={hasMission}
                  className={`px-3 py-1.5 rounded text-terminal-base font-mono transition-colors ${durationDays === d && !customDuration ? 'bg-brand-purple text-white' : 'border border-border text-text-secondary hover:border-brand-purple'} ${hasMission ? 'opacity-60 pointer-events-none' : ''}`}>
                  {d}d
                </button>
              ))}
              <input type="number" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} placeholder="Custom" disabled={hasMission}
                className={`font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-20 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint ${hasMission ? 'opacity-60' : ''}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── TRIGGER QUESTIONS + OPEN DUMP ────────────────────────────────── */}
      <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-terminal-lg font-semibold text-text-primary">Brain Dump</span>
          <span className="text-terminal-sm text-text-muted font-mono">{entryCount} {entryCount === 1 ? 'entry' : 'entries'} captured</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          <div className="lg:col-span-3 lg:border-r lg:border-border-light p-4 space-y-2">
            <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Guided Questions</p>
            {TRIGGER_QUESTION_GROUPS.map((group) => (
              <div key={group.id} className="border border-border-light rounded overflow-hidden">
                <button onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-text-primary font-mono">{group.title}</span>
                    <span className="text-terminal-sm text-text-faint font-mono ml-2 hidden sm:inline">{group.description}</span>
                  </div>
                  <span className="text-text-faint text-terminal-sm flex-shrink-0 ml-2">{expandedGroup === group.id ? '▼' : '▶'}</span>
                </button>
                {expandedGroup === group.id && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border-light">
                    {group.questions.map((q) => (
                      <div key={q.id} className="pt-2">
                        <p className="text-terminal-sm text-text-secondary font-mono mb-1">{q.text}</p>
                        <textarea rows={2} value={answers[q.text] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.text]: e.target.value }))}
                          placeholder="Type your answer..."
                          className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-2 py-1.5 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
                          onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 p-4">
            <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-2">Open Dump</p>
            <p className="text-terminal-sm text-text-faint font-mono mb-2">{OPEN_DUMP_LABEL}</p>
            <textarea rows={8} value={openDump} onChange={(e) => setOpenDump(e.target.value)} placeholder="Drop anything here..."
              className="w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
              style={{ minHeight: '12rem' }}
              onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 192) + 'px'; }} />
          </div>
        </div>

        {/* ── PROMPT PREVIEW ─────────────────────────────────────────────── */}
        <PromptPreview
          answers={answers}
          openDump={openDump}
          missionTitle={missionTitle}
          durationDays={effectiveDuration}
        />

        <div className="px-4 py-3 border-t border-border">
          {processing ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted font-mono">Processing your brain dump...</span>
            </div>
          ) : (
            <button onClick={handleSaveAndProcess} disabled={saving}
              className="w-full py-2.5 bg-brand-purple text-white rounded hover:bg-brand-purple-hover transition-colors font-mono text-sm font-medium disabled:opacity-40">
              {saving ? 'Saving...' : hasMission ? 'Update & Re-process →' : 'Save & Process →'}
            </button>
          )}
        </div>
      </div>

      {/* ── STAGE OUTPUT: STRUCTURE ───────────────────────────────────────── */}
      {structureStage && <StructureStageOutput stage={structureStage} onApprove={handleApprove} onReject={handleReject} />}
    </div>
  );
}

// ── Collapsible ─────────────────────────────────────────────────────────────

// ── Prompt Preview ──────────────────────────────────────────────────────────

function PromptPreview({ answers, openDump, missionTitle, durationDays }: {
  answers: Record<string, string>;
  openDump: string;
  missionTitle: string;
  durationDays: number;
}) {
  const [showSystem, setShowSystem] = useState(true);

  const items: BrainDumpItem[] = [];
  let idx = 0;
  for (const group of TRIGGER_QUESTION_GROUPS) {
    for (const q of group.questions) {
      const text = answers[q.text]?.trim();
      if (text) {
        for (const line of text.split('\n').filter(Boolean)) {
          items.push({ id: q.id + '_' + idx++, content: line, source: 'typed', triggerQuestion: q.text, triggerGroupId: group.id });
        }
      }
    }
  }
  for (const line of openDump.split('\n').filter((l) => l.trim())) {
    items.push({ id: `open_${idx++}`, content: line.trim(), source: 'typed', triggerQuestion: null, triggerGroupId: null });
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-border-light">
        <p className="text-terminal-sm text-text-faint font-mono text-center py-2">
          Start answering questions above to see the prompt that will be sent to the AI.
        </p>
      </div>
    );
  }

  const userPrompt = buildStructurePrompt({
    brainDumpEntries: items,
    missionTitle: missionTitle || 'Untitled Mission',
    missionDuration: durationDays,
  });

  return (
    <div className="border-t border-border-light">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-terminal-sm font-semibold text-text-primary font-mono">Prompt Preview</span>
            <span className="text-terminal-sm text-text-faint font-mono ml-2">Exactly what the AI will receive</span>
          </div>
        </div>

        {/* System prompt — collapsible */}
        <div className="border border-border-light rounded mb-2">
          <button onClick={() => setShowSystem(!showSystem)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors">
            <span className="text-terminal-sm text-text-muted font-mono">System Prompt</span>
            <span className="text-text-faint text-terminal-sm">{showSystem ? '▲' : '▼'}</span>
          </button>
          {showSystem && (
            <div className="border-t border-border-light">
              <pre className="px-3 py-2 bg-gray-50 text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto">
                {STRUCTURE_SYSTEM_PROMPT}
              </pre>
            </div>
          )}
        </div>

        {/* User prompt — always visible */}
        <div className="border border-border-light rounded">
          <div className="px-3 py-1.5 border-b border-border-light">
            <span className="text-terminal-sm text-text-muted font-mono">User Prompt (live)</span>
          </div>
          <pre className="px-3 py-2 bg-gray-50 text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap max-h-96 overflow-y-auto overflow-x-auto">
            {userPrompt}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Collapsible ─────────────────────────────────────────────────────────────

function Collapsible({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border-light rounded">
      <button onClick={() => setOpen(!open)} className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-bg-row/50 transition-colors">
        <span className="text-terminal-sm text-text-muted font-mono">{title}</span>
        <span className="text-text-faint text-terminal-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3 border-t border-border-light max-h-[32rem] overflow-y-auto">{children}</div>}
    </div>
  );
}

// ── Structure Stage Output ──────────────────────────────────────────────────

function StructureStageOutput({ stage, onApprove, onReject }: { stage: StageData; onApprove: () => void; onReject: (reason: string) => void }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const output = stage.parsedOutput;

  const projects = (output?.discoveredProjects as Array<{ projectName: string; description: string; estimatedScope: string; relatedEntries: Array<{ content: string }>; dependencies: string[]; blockers: string[] }>) || [];
  const themes = (output?.emergentThemes as Array<{ theme: string; confidence: string; basis: string }>) || [];
  const contradictions = (output?.contradictions as Array<{ itemA: { content: string }; itemB: { content: string }; nature: string; severity: string }>) || [];
  const constraints = (output?.constraints as Array<{ constraint: string; impact: string }>) || [];
  const missingInputs = (output?.missingInputs as Array<{ area: string; suggestedQuestion: string }>) || [];
  const deps = (output?.latentDependencies as Array<{ item: string; dependsOn: string[] }>) || [];
  const gaps = (output?.logicGaps as Array<{ statement: string; gap: string }>) || [];

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-lg font-semibold text-text-primary">Stage 1 — Project Discovery</span>
        <span className={`text-terminal-sm font-mono px-2 py-0.5 rounded-full ${STATUS_BADGE[stage.status] || ''}`}>
          {stage.status}{stage.attemptNumber > 1 ? ` (attempt ${stage.attemptNumber})` : ''}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Observability */}
        <Collapsible title="Input Data">
          <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">{JSON.stringify(stage.inputSnapshot, null, 2)}</pre>
        </Collapsible>
        <Collapsible title="System Prompt">
          <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap">{stage.systemPrompt || '(none)'}</pre>
        </Collapsible>
        <Collapsible title="User Prompt">
          <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap">{stage.userPrompt || '(none)'}</pre>
        </Collapsible>

        {/* Output */}
        {output && (
          <Collapsible title="Output" defaultOpen>
            <div className="space-y-4 pt-2">
              {projects.length > 0 && (
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
                          <div className="mt-1">{p.relatedEntries.map((e, j) => <p key={j} className="text-terminal-sm text-text-faint font-mono">• {e.content}</p>)}</div>
                        )}
                        {p.dependencies.length > 0 && <p className="text-terminal-sm text-text-muted font-mono mt-1">Depends on: {p.dependencies.join(', ')}</p>}
                        {p.blockers.length > 0 && <p className="text-terminal-sm text-red-500 font-mono mt-1">Blockers: {p.blockers.join(', ')}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {themes.length > 0 && (
                <div>
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Emergent Themes</p>
                  {themes.map((t, i) => <p key={i} className="text-terminal-base font-mono text-text-secondary"><span className="font-medium">{t.theme}</span> <span className="text-text-faint">({t.confidence}, {t.basis})</span></p>)}
                </div>
              )}

              {contradictions.length > 0 && (
                <div>
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Contradictions</p>
                  {contradictions.map((c, i) => <div key={i} className={`text-terminal-base font-mono ${SEV_COLOR[c.severity]}`}>&ldquo;{c.itemA.content}&rdquo; vs &ldquo;{c.itemB.content}&rdquo; — {c.nature}</div>)}
                </div>
              )}

              {constraints.length > 0 && (
                <div>
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Constraints</p>
                  {constraints.map((c, i) => <p key={i} className="text-terminal-base font-mono text-text-secondary">{c.constraint} — <span className="text-text-faint">{c.impact}</span></p>)}
                </div>
              )}

              {missingInputs.length > 0 && (
                <div>
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Missing Inputs</p>
                  {missingInputs.map((m, i) => <p key={i} className="text-terminal-base font-mono text-amber-700">{m.area}: {m.suggestedQuestion}</p>)}
                </div>
              )}

              {deps.length > 0 && (
                <div>
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Latent Dependencies</p>
                  {deps.map((d, i) => <p key={i} className="text-terminal-base font-mono text-text-secondary">{d.item} → needs: {d.dependsOn.join(', ')}</p>)}
                </div>
              )}

              {gaps.length > 0 && (
                <div>
                  <p className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono mb-1">Logic Gaps</p>
                  {gaps.map((g, i) => <p key={i} className="text-terminal-base font-mono text-text-secondary">&ldquo;{g.statement}&rdquo; → Gap: {g.gap}</p>)}
                </div>
              )}
            </div>
          </Collapsible>
        )}

        <Collapsible title="Raw API Response">
          <pre className="text-terminal-sm font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">{stage.rawResponse || '(none)'}</pre>
        </Collapsible>

        {/* Approve / Reject */}
        {stage.status === 'completed' && (
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button onClick={onApprove} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-terminal-base font-mono hover:bg-emerald-700 transition-colors">Approve</button>
            {rejectMode ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (optional)"
                  className="flex-1 font-mono text-terminal-base border border-border rounded px-2 py-1 outline-none focus:border-brand-purple" />
                <button onClick={() => { onReject(rejectReason); setRejectMode(false); setRejectReason(''); }} className="px-3 py-1.5 bg-red-600 text-white rounded text-terminal-base font-mono">Reject</button>
                <button onClick={() => setRejectMode(false)} className="text-terminal-base text-text-muted font-mono">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setRejectMode(true)} className="px-4 py-1.5 border border-red-300 text-red-600 rounded text-terminal-base font-mono hover:bg-red-50 transition-colors">Reject</button>
            )}
          </div>
        )}

        {stage.status === 'approved' && <p className="text-terminal-sm text-emerald-600 font-mono pt-1">Approved</p>}
        {stage.status === 'rejected' && stage.rejectionReason && <p className="text-terminal-sm text-red-600 font-mono pt-1">Rejected: {stage.rejectionReason}</p>}
      </div>
    </div>
  );
}
