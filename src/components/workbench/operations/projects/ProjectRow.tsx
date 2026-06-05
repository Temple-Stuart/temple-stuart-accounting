/**
 * ProjectRow — single row in the Section D project list.
 *
 * Three modes, toggled by local state:
 *   1. Compact (default): one line — title + status pill + target date
 *   2. Expanded: compact line + 4 Bridgewater scoping fields readable
 *   3. Edit: inline form covering all writable fields
 *
 * Click row body → toggle expand. "edit" button (in expanded view) → swap to
 * edit mode. Save → PATCH → refetch parent (via onUpdate callback) → exit
 * edit mode. Delete → confirmation prompt → DELETE → refetch parent.
 *
 * Pattern mirrors COAManagementTable's editingId sentinel + per-row form
 * state, adapted for a card-style layout with long-form Text fields.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project, ProjectForm, ProjectStatus } from './types';
import { STATUS_LABELS, STATUS_PILL_CLASSES } from './types';
import TaskList from './TaskList';
import EvolutionTimeline from './EvolutionTimeline';
import DependencyList from './DependencyList';
import ListManager from './ListManager';
import InspectionDrawer, { type InspectionData } from '../ai/InspectionDrawer';
import AITaskPreview, { type AIGeneratedTask } from './AITaskPreview';

interface Entity {
  id: string;
  name: string;
}

interface Props {
  project: Project;
  entities: Entity[];
  allProjects: Project[];
  onUpdate: () => void;
  onDelete: () => void;
  /** When true, the row scrolls into view and auto-expands. */
  isJumpTarget: boolean;
  /** Called by SectionD to clear targetProjectId after the jump animates. */
  onClearTarget: () => void;
  /** Called when the user clicks a dependency link inside this row. */
  onJumpTo: (projectId: string) => void;
}

const STATUS_OPTIONS: ProjectStatus[] = [
  'not_started',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'archived',
];

function projectToForm(p: Project): ProjectForm {
  return {
    entity_id: p.entity_id,
    title: p.title,
    design: p.design ?? '',
    goalItems: Array.isArray(p.goal_items) ? p.goal_items.filter((x): x is string => typeof x === 'string') : [],
    problemItems: Array.isArray(p.problem_items) ? p.problem_items.filter((x): x is string => typeof x === 'string') : [],
    diagnosisItems: Array.isArray(p.diagnosis_items) ? p.diagnosis_items.filter((x): x is string => typeof x === 'string') : [],
    status: p.status,
    target_completion_date: p.target_completion_date
      ? p.target_completion_date.slice(0, 10)
      : '',
    estimated_total_minutes: p.estimated_total_minutes !== null ? String(p.estimated_total_minutes) : '',
    estimated_total_cost_usd: p.estimated_total_cost_usd ?? '',
  };
}

function formatTargetDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function entityName(entities: Entity[], entityId: string): string {
  return entities.find((e) => e.id === entityId)?.name ?? entityId;
}

export default function ProjectRow({ project, entities, allProjects, onUpdate, onDelete, isJumpTarget, onClearTarget, onJumpTo }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProjectForm>(() => projectToForm(project));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingDesign, setGeneratingDesign] = useState(false);
  const [generatedDesignPreview, setGeneratedDesignPreview] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationCost, setGenerationCost] = useState<
    { cost_usd: string; input_tokens: number; output_tokens: number } | null
  >(null);
  const [generationInspection, setGenerationInspection] = useState<{
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    userMessage: string;
    rawResponse: string;
    usageId: string;
  } | null>(null);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [tasksGenError, setTasksGenError] = useState<string | null>(null);
  const [tasksPreview, setTasksPreview] = useState<{
    tasks: AIGeneratedTask[];
    sourceAiUsageId: string;
    inspection?: InspectionData;
    costSummary?: { cost_usd: string; input_tokens: number; output_tokens: number };
  } | null>(null);
  const [flash, setFlash] = useState(false);
  const [showDesignReasoning, setShowDesignReasoning] = useState(false);
  // PR-Ops-Content-2: lazy-mount the read-only evolution timeline (the project's
  // trajectory by AI re-run). Fetches only when opened (mirrors the design-reasoning
  // toggle + TaskRow history-on-demand pattern).
  const [showEvolution, setShowEvolution] = useState(false);
  // PR-Ops-Evolve-1: manual paste targets that feed reality into task generation.
  const [researchInput, setResearchInput] = useState(project.deep_research_input ?? '');
  const [auditInput, setAuditInput] = useState(project.claude_code_audit_input ?? '');
  const [savingInputs, setSavingInputs] = useState(false);
  const [inputsSaved, setInputsSaved] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // When SectionD sets isJumpTarget=true on this row, scroll into view,
  // auto-expand, flash highlight for ~1.5s, then clear the target so the
  // same dependency click can re-trigger.
  useEffect(() => {
    if (!isJumpTarget) return;
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setExpanded(true);
    setFlash(true);
    const t1 = setTimeout(() => setFlash(false), 1500);
    const t2 = setTimeout(() => onClearTarget(), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // onClearTarget is intentionally omitted — it's a stable ref from SectionD;
    // including it would re-trigger the effect on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJumpTarget]);

  const enterEdit = () => {
    setForm(projectToForm(project));
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setForm(projectToForm(project));
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to save');
        return;
      }
      setEditing(false);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  // PR-Ops-Evolve-1: save the two reality-input paste boxes via the project PATCH
  // (same path as the Text sections), then refetch so generation reads the latest.
  const handleSaveInputs = async () => {
    setSavingInputs(true);
    setInputsSaved(false);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deep_research_input: researchInput,
          claude_code_audit_input: auditInput,
        }),
      });
      if (res.ok) {
        setInputsSaved(true);
        onUpdate();
      }
    } finally {
      setSavingInputs(false);
    }
  };

  const handleGenerateDesign = async () => {
    setGeneratingDesign(true);
    setGenerationError(null);
    setGeneratedDesignPreview(null);
    setGenerationCost(null);
    setGenerationInspection(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/generate-design`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setGenerationError(body?.message ?? body?.error ?? 'failed to generate design');
        return;
      }
      setGeneratedDesignPreview(body.generated_design);
      setGenerationCost({
        cost_usd: body.cost_usd,
        input_tokens: body.input_tokens,
        output_tokens: body.output_tokens,
      });
      if (body.inspection) {
        setGenerationInspection({
          model: body.inspection.model,
          temperature: body.inspection.temperature,
          maxTokens: body.inspection.maxTokens,
          systemPrompt: body.inspection.systemPrompt,
          userMessage: body.inspection.userMessage,
          rawResponse: body.inspection.rawResponse,
          usageId: body.usage_id,
        });
      }
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : 'failed to generate design');
    } finally {
      setGeneratingDesign(false);
    }
  };

  const handleGenerateTasks = async () => {
    setGeneratingTasks(true);
    setTasksGenError(null);
    setTasksPreview(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/generate-tasks`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setTasksGenError(body?.message ?? body?.error ?? 'failed to generate tasks');
        return;
      }
      const insp: InspectionData | undefined = body.inspection
        ? {
            model: body.inspection.model,
            temperature: body.inspection.temperature,
            maxTokens: body.inspection.maxTokens,
            systemPrompt: body.inspection.systemPrompt,
            userMessage: body.inspection.userMessage,
            rawResponse: body.inspection.rawResponse,
            inputTokens: body.input_tokens,
            outputTokens: body.output_tokens,
            costUsd: body.cost_usd,
            usageId: body.usage_id,
          }
        : undefined;
      setTasksPreview({
        tasks: body.tasks as AIGeneratedTask[],
        sourceAiUsageId: body.usage_id,
        inspection: insp,
        costSummary: {
          cost_usd: body.cost_usd,
          input_tokens: body.input_tokens,
          output_tokens: body.output_tokens,
        },
      });
    } catch (e) {
      setTasksGenError(e instanceof Error ? e.message : 'failed to generate tasks');
    } finally {
      setGeneratingTasks(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.title}"? This will also delete its tasks and dependencies.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // Soft archive: hides the project + its active tasks from active views; all
  // history is preserved (distinct from delete, which destroys records). Active
  // tasks are retired + future plan items removed server-side in one transaction.
  const handleArchive = async () => {
    if (
      !confirm(
        `Archive project "${project.title}"? It and its active tasks are hidden from active views but all history is preserved. (This is NOT delete — nothing is destroyed; you can unarchive later via "show archived".)`
      )
    )
      return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to archive');
        return;
      }
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  // Unarchive restores the project to the non-archived default status
  // (not_started — the schema/create default). Does NOT auto-restore task
  // statuses; archived tasks are unarchived individually.
  const handleUnarchive = async () => {
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'not_started' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to unarchive');
        return;
      }
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to unarchive');
    } finally {
      setArchiving(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';
  const pillClass = `inline-block px-2 py-0.5 border rounded text-xs font-mono ${STATUS_PILL_CLASSES[project.status]}`;

  // Derive structured-list arrays from the project. JsonB columns may
  // come back as JsonValue at runtime; filter to strings defensively.
  const goalItems = Array.isArray(project.goal_items)
    ? project.goal_items.filter((x): x is string => typeof x === 'string')
    : [];
  const problemItems = Array.isArray(project.problem_items)
    ? project.problem_items.filter((x): x is string => typeof x === 'string')
    : [];
  const diagnosisItems = Array.isArray(project.diagnosis_items)
    ? project.diagnosis_items.filter((x): x is string => typeof x === 'string')
    : [];

  /**
   * Render a structured field that may be either:
   *   - new structured array (project.goal_items / problem_items / diagnosis_items)
   *   - legacy paragraph (project.goal / problem / diagnosis as string|null)
   *
   * Prefers structured items; falls back to legacy paragraph when items
   * array is empty. Both states render readably in the row.
   */
  const renderStructuredField = (
    items: string[],
    legacyText: string | null
  ) => {
    if (items.length > 0) {
      return (
        <ul className="list-disc list-inside text-text-primary text-xs font-mono space-y-0.5 ml-2">
          {items.map((it, i) => (
            <li key={i} className="break-words">{it}</li>
          ))}
        </ul>
      );
    }
    if (legacyText && legacyText.trim().length > 0) {
      return (
        <div className="text-text-primary text-xs font-mono whitespace-pre-wrap">
          {legacyText}
          <span className="text-text-faint italic ml-2">(legacy paragraph format)</span>
        </div>
      );
    }
    return <div className="text-text-muted text-xs font-mono italic">(no content)</div>;
  };

  return (
    <div
      ref={rowRef}
      className={
        'border rounded bg-white transition-colors ' +
        (flash ? 'border-brand-purple shadow-md' : 'border-border') +
        (project.status === 'archived' ? ' opacity-60' : '')
      }
    >
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-bg-row text-xs font-mono"
        onClick={() => !editing && setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-text-faint">{expanded ? '▾' : '▸'}</span>
          <span className="font-bold text-text-primary truncate">{project.title}</span>
          <span className={pillClass}>{STATUS_LABELS[project.status]}</span>
          <span className="text-text-muted">{entityName(entities, project.entity_id)}</span>
        </div>
        <div className="flex items-center gap-3 text-text-muted shrink-0">
          <span>target: {formatTargetDate(project.target_completion_date)}</span>
        </div>
      </div>

      {expanded && !editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs font-mono space-y-3">
          <div>
            <div className={labelClass}>1 · goal</div>
            {renderStructuredField(goalItems, project.goal)}
          </div>
          <div>
            <div className={labelClass}>2 · problem</div>
            {renderStructuredField(problemItems, project.problem)}
          </div>
          <div>
            <div className={labelClass}>3 · diagnosis</div>
            {renderStructuredField(diagnosisItems, project.diagnosis)}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className={labelClass}>4 · design</div>
              {(project.design ?? '').trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDesignReasoning((x) => !x)}
                  className="px-2 py-0.5 border border-border rounded text-xs font-mono text-text-muted hover:bg-bg-row"
                >
                  {showDesignReasoning ? 'hide AI design reasoning' : 'view AI design reasoning'}
                </button>
              )}
            </div>
            {(project.design ?? '').trim().length > 0 ? (
              showDesignReasoning && (
                <div className="text-text-primary text-xs font-mono whitespace-pre-wrap p-3 bg-white border border-border-light rounded">
                  {project.design}
                </div>
              )
            ) : (
              <div className="text-text-muted text-xs font-mono italic">(no design)</div>
            )}
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>5 · execute (tasks)</div>
            <TaskList projectId={project.id} entity_id={project.entity_id} />
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className="flex items-center justify-between mb-1">
              <div className={labelClass}>evolution (trajectory by AI re-run)</div>
              <button
                type="button"
                onClick={() => setShowEvolution((x) => !x)}
                className="px-2 py-0.5 border border-border rounded text-xs font-mono text-text-muted hover:bg-bg-row"
              >
                {showEvolution ? 'hide evolution' : 'view evolution'}
              </button>
            </div>
            {showEvolution && <EvolutionTimeline projectId={project.id} />}
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>6 · dependencies</div>
            {/* PR-Ops-Evolve-1: reality inputs — paste targets that ground task
                regeneration in external research + a codebase audit. */}
            <div className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div className={labelClass}>deep research input</div>
                <textarea
                  value={researchInput}
                  onChange={(e) => { setResearchInput(e.target.value); setInputsSaved(false); }}
                  placeholder="Paste deep research output here…"
                  rows={4}
                  className="w-full text-xs font-mono border border-border rounded px-2 py-1.5 bg-white text-text-primary"
                />
              </div>
              <div>
                <div className={labelClass}>claude code audit input</div>
                <textarea
                  value={auditInput}
                  onChange={(e) => { setAuditInput(e.target.value); setInputsSaved(false); }}
                  placeholder="Paste Claude Code audit findings here…"
                  rows={4}
                  className="w-full text-xs font-mono border border-border rounded px-2 py-1.5 bg-white text-text-primary"
                />
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveInputs}
                disabled={savingInputs}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
              >
                {savingInputs ? 'saving…' : 'save inputs'}
              </button>
              {inputsSaved && <span className="text-text-faint text-xs">saved — regenerate tasks to use these</span>}
            </div>
            <DependencyList
              projectId={project.id}
              allProjects={allProjects}
              onJumpTo={onJumpTo}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-light">
            <div>
              <div className={labelClass}>est. minutes</div>
              <div className="text-text-primary">{project.estimated_total_minutes ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>est. cost (usd)</div>
              <div className="text-text-primary">{project.estimated_total_cost_usd ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={enterEdit}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row"
            >
              edit
            </button>
            {project.status === 'archived' ? (
              <button
                type="button"
                onClick={handleUnarchive}
                disabled={archiving}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
              >
                {archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="px-2 py-1 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50"
              >
                {archiving ? 'archiving…' : 'archive'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'deleting…' : 'delete'}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs font-mono space-y-3">
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className={labelClass}>title</div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
                maxLength={500}
              />
            </div>
            <div>
              <div className={labelClass}>entity</div>
              <select
                value={form.entity_id}
                onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                className={inputClass}
              >
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelClass}>status</div>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className={labelClass}>1 · goal — what success looks like</div>
            <ListManager
              items={form.goalItems}
              onChange={(next) => setForm({ ...form, goalItems: next })}
              verbPrefix="I WANT to "
              placeholder="get loans approved"
              disabled={saving}
            />
          </div>
          <div>
            <div className={labelClass}>2 · problem — gap between current and goal</div>
            <ListManager
              items={form.problemItems}
              onChange={(next) => setForm({ ...form, problemItems: next })}
              verbPrefix="I HAVE NOT "
              altVerbPrefix="I KEEP "
              placeholder="created an FSA ID yet"
              disabled={saving}
            />
          </div>
          <div>
            <div className={labelClass}>3 · diagnosis — root cause of the gap</div>
            <ListManager
              items={form.diagnosisItems}
              onChange={(next) => setForm({ ...form, diagnosisItems: next })}
              verbPrefix="Because "
              altVerbPrefix="The root cause is "
              placeholder="I never blocked dedicated time for it"
              disabled={saving}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className={labelClass}>4 · design — the plan (AI-generated)</div>
              <button
                type="button"
                onClick={handleGenerateDesign}
                disabled={generatingDesign}
                className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs font-mono hover:bg-purple-50 disabled:opacity-50"
                title="Generate institutional-rigor design field from your goal/problem/diagnosis items"
              >
                {generatingDesign ? 'generating…' : '↑ generate plan'}
              </button>
            </div>
            {form.design.trim().length > 0 ? (
              <div className="text-text-primary text-xs font-mono whitespace-pre-wrap p-3 bg-white border border-border-light rounded">
                {form.design}
              </div>
            ) : (
              <div className="text-text-muted text-xs font-mono italic p-3 bg-bg-row border border-border-light rounded">
                (no design yet — fill in goal/problem/diagnosis items above, then click "↑ generate plan")
              </div>
            )}
            {generationError && (
              <div className="mt-2 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
                {generationError}
              </div>
            )}
            {generatedDesignPreview && (
              <div className="mt-2 border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-2">
                <div className="font-bold text-text-primary flex items-center justify-between">
                  <span>AI-generated design (review before saving)</span>
                  {generationCost && (
                    <span className="text-text-muted text-xs font-normal">
                      ${generationCost.cost_usd} · {generationCost.input_tokens} in · {generationCost.output_tokens} out
                    </span>
                  )}
                </div>
                <div className="text-text-primary whitespace-pre-wrap p-2 bg-white border border-border-light rounded">
                  {generatedDesignPreview}
                </div>
                {generationInspection && (
                  <InspectionDrawer
                    data={{
                      model: generationInspection.model,
                      temperature: generationInspection.temperature,
                      maxTokens: generationInspection.maxTokens,
                      systemPrompt: generationInspection.systemPrompt,
                      userMessage: generationInspection.userMessage,
                      rawResponse: generationInspection.rawResponse,
                      inputTokens: generationCost?.input_tokens ?? 0,
                      outputTokens: generationCost?.output_tokens ?? 0,
                      costUsd: generationCost?.cost_usd ?? '0',
                      usageId: generationInspection.usageId,
                    }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, design: generatedDesignPreview });
                      setGeneratedDesignPreview(null);
                      setGenerationCost(null);
                      setGenerationInspection(null);
                    }}
                    className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90"
                  >
                    use this
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedDesignPreview(null);
                      setGenerationCost(null);
                      setGenerationInspection(null);
                    }}
                    className="px-3 py-1 border border-border rounded hover:bg-bg-row"
                  >
                    discard
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className={labelClass}>5 · execute (tasks) — AI-generated</div>
              <button
                type="button"
                onClick={handleGenerateTasks}
                disabled={generatingTasks}
                className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs font-mono hover:bg-purple-50 disabled:opacity-50"
                title="Generate institutional-rigor task array (web-search verified URLs) from your goal/problem/diagnosis items"
              >
                {generatingTasks ? 'generating…' : '↑ generate tasks'}
              </button>
            </div>
            {!tasksPreview && (
              <div className="text-text-muted text-xs font-mono italic p-3 bg-bg-row border border-border-light rounded">
                (tasks are saved directly to this project on accept — click "↑ generate tasks" to synthesize an atomic task array from the goal/problem/diagnosis items above)
              </div>
            )}
            {tasksGenError && (
              <div className="mt-2 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
                {tasksGenError}
              </div>
            )}
            {tasksPreview && (
              <>
                {tasksPreview.costSummary && (
                  <div className="text-text-muted text-xs font-mono text-right mb-1">
                    ${tasksPreview.costSummary.cost_usd} · {tasksPreview.costSummary.input_tokens} in · {tasksPreview.costSummary.output_tokens} out
                  </div>
                )}
                <AITaskPreview
                  tasks={tasksPreview.tasks}
                  sourceAiUsageId={tasksPreview.sourceAiUsageId}
                  projectId={project.id}
                  inspection={tasksPreview.inspection}
                  onAccepted={() => {
                    setTasksPreview(null);
                    setTasksGenError(null);
                  }}
                  onDiscarded={() => {
                    setTasksPreview(null);
                    setTasksGenError(null);
                  }}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className={labelClass}>target date</div>
              <input
                type="date"
                value={form.target_completion_date}
                onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. minutes</div>
              <input
                type="number"
                min={0}
                value={form.estimated_total_minutes}
                onChange={(e) => setForm({ ...form, estimated_total_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. cost (usd)</div>
              <input
                type="text"
                value={form.estimated_total_cost_usd}
                onChange={(e) => setForm({ ...form, estimated_total_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
