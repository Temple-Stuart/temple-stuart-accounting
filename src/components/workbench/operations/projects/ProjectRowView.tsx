/**
 * ProjectRowView — the PURE, props-only render of a single Section D project row.
 *
 * Extracted from ProjectRow (PR5). It owns NO data: no fetch, no /api/* call, no
 * data-loading useEffect, no context, no server import. It is FULLY CONTROLLED —
 * every piece of display state (expanded/editing/form/saving/…/generation
 * previews) arrives as props, and every action ProjectRow used to fire itself —
 * INCLUDING the two PAID Anthropic AI calls (generate-design, generate-tasks) —
 * arrives as a callback prop owned by the container. The rendered markup is
 * byte-for-byte equivalent to the pre-extraction ProjectRow output.
 *
 * Its three data-bearing sections (task list, evolution, dependencies) are NOT
 * rendered by this view directly — they arrive as injected slots
 * (taskSection / evolutionSection / dependencySection, PR7a). The authed
 * container passes the LIVE PR1–PR3 containers (TaskList / EvolutionTimeline /
 * DependencyList); the public showroom passes the pure PR1–PR4 views fed with
 * static seed. The view owns only the section wrappers + the showEvolution gate,
 * never the section's data source — so when fed pure views the whole expanded
 * subtree is provably fetch-free. <ListManager/>, <InspectionDrawer/> and
 * <AITaskPreview/> remain rendered as-is.
 */

'use client';

import type { Project, ProjectForm, ProjectStatus } from './types';
import { STATUS_LABELS, STATUS_PILL_CLASSES } from './types';
import ListManager from './ListManager';
import InspectionDrawer, { type InspectionData } from '../ai/InspectionDrawer';
import AITaskPreview, { type AIGeneratedTask } from './AITaskPreview';

export interface Entity {
  id: string;
  name: string;
}

export interface GenerationCost {
  cost_usd: string;
  input_tokens: number;
  output_tokens: number;
}

export interface GenerationInspection {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  usageId: string;
}

export interface TasksPreview {
  tasks: AIGeneratedTask[];
  sourceAiUsageId: string;
  inspection?: InspectionData;
  costSummary?: GenerationCost;
}

export interface ProjectRowViewProps {
  // ── data ──────────────────────────────────────────────────────────────
  project: Project;
  entities: Entity[];
  /** Attached to the outer row div; the container owns the scroll-into-view effect. */
  rowRef: React.RefObject<HTMLDivElement>;

  // ── injected section slots (PR7a) ───────────────────────────────────────
  // The data source for each section is the slot-builder's concern, never this
  // view's. Authed → live containers; showroom → pure views fed with seed.
  taskSection: React.ReactNode;
  evolutionSection: React.ReactNode;
  dependencySection: React.ReactNode;

  /**
   * Optional read-view slot (PR A). Rendered in the EXPANDED, NON-editing read
   * block, directly under the reality-input boxes. The authed container leaves
   * it undefined → the read view is byte-for-byte unchanged. The public showroom
   * fills it with the LOCKED generate buttons + a plain-language caption, so a
   * logged-out visitor sees the whole input → generate → plan loop on one screen.
   * Never carries data or a fetch — just inert nodes supplied by the parent.
   */
  readViewAiActions?: React.ReactNode;

  // ── display state (fully controlled) ─────────────────────────────────────
  expanded: boolean;
  editing: boolean;
  form: ProjectForm;
  saving: boolean;
  deleting: boolean;
  archiving: boolean;
  error: string | null;
  generatingDesign: boolean;
  generatedDesignPreview: string | null;
  generationError: string | null;
  generationCost: GenerationCost | null;
  generationInspection: GenerationInspection | null;
  generatingTasks: boolean;
  tasksGenError: string | null;
  tasksPreview: TasksPreview | null;
  flash: boolean;
  showDesignReasoning: boolean;
  showEvolution: boolean;
  researchInput: string;
  auditInput: string;
  savingInputs: boolean;
  inputsSaved: boolean;

  // ── actions (owned by the container) ─────────────────────────────────────
  onToggleExpanded: () => void;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onFormChange: (form: ProjectForm) => void;
  onSave: () => void;
  onResearchInputChange: (value: string) => void;
  onAuditInputChange: (value: string) => void;
  onSaveInputs: () => void;
  onToggleDesignReasoning: () => void;
  onToggleEvolution: () => void;
  /** PAID Anthropic AI — POST generate-design (container-owned). */
  onGenerateDesign: () => void;
  onUseGeneratedDesign: () => void;
  onDiscardGeneratedDesign: () => void;
  /** PAID Anthropic AI — POST generate-tasks (container-owned). */
  onGenerateTasks: () => void;
  onTasksAccepted: () => void;
  onTasksDiscarded: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

const STATUS_OPTIONS: ProjectStatus[] = [
  'not_started',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'archived',
];

function formatTargetDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function entityName(entities: Entity[], entityId: string): string {
  return entities.find((e) => e.id === entityId)?.name ?? entityId;
}

export default function ProjectRowView({
  project,
  entities,
  rowRef,
  taskSection,
  evolutionSection,
  dependencySection,
  readViewAiActions,
  expanded,
  editing,
  form,
  saving,
  deleting,
  archiving,
  error,
  generatingDesign,
  generatedDesignPreview,
  generationError,
  generationCost,
  generationInspection,
  generatingTasks,
  tasksGenError,
  tasksPreview,
  flash,
  showDesignReasoning,
  showEvolution,
  researchInput,
  auditInput,
  savingInputs,
  inputsSaved,
  onToggleExpanded,
  onEnterEdit,
  onCancelEdit,
  onFormChange,
  onSave,
  onResearchInputChange,
  onAuditInputChange,
  onSaveInputs,
  onToggleDesignReasoning,
  onToggleEvolution,
  onGenerateDesign,
  onUseGeneratedDesign,
  onDiscardGeneratedDesign,
  onGenerateTasks,
  onTasksAccepted,
  onTasksDiscarded,
  onDelete,
  onArchive,
  onUnarchive,
}: ProjectRowViewProps) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';
  const pillClass = `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL_CLASSES[project.status]}`;

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
        <ul className="list-disc list-inside text-text-primary text-xs space-y-0.5 ml-2">
          {items.map((it, i) => (
            <li key={i} className="break-words">{it}</li>
          ))}
        </ul>
      );
    }
    if (legacyText && legacyText.trim().length > 0) {
      return (
        <div className="text-text-primary text-xs whitespace-pre-wrap">
          {legacyText}
          <span className="text-text-faint italic ml-2">(legacy paragraph format)</span>
        </div>
      );
    }
    return <div className="text-text-muted text-xs italic">(no content)</div>;
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
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-bg-row text-xs"
        onClick={() => !editing && onToggleExpanded()}
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
        <div className="px-4 py-3 border-t border-border-light text-xs space-y-3">
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
                  onClick={onToggleDesignReasoning}
                  className="px-2 py-0.5 border border-border rounded text-xs text-text-muted hover:bg-bg-row"
                >
                  {showDesignReasoning ? 'hide AI design reasoning' : 'view AI design reasoning'}
                </button>
              )}
            </div>
            {(project.design ?? '').trim().length > 0 ? (
              showDesignReasoning && (
                <div className="text-text-primary text-xs whitespace-pre-wrap p-3 bg-white border border-border-light rounded">
                  {project.design}
                </div>
              )
            ) : (
              <div className="text-text-muted text-xs italic">(no design)</div>
            )}
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>reality inputs (ground AI regeneration)</div>
            {/* PR-Ops-Evolve-1: reality inputs — paste targets that ground task
                regeneration in external research + a codebase audit. Sits beside the
                design/plan it grounds. */}
            <div className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div className={labelClass}>deep research input</div>
                <textarea
                  value={researchInput}
                  onChange={(e) => onResearchInputChange(e.target.value)}
                  placeholder="Paste deep research output here…"
                  rows={4}
                  className="w-full text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
                />
              </div>
              <div>
                <div className={labelClass}>claude code audit input</div>
                <textarea
                  value={auditInput}
                  onChange={(e) => onAuditInputChange(e.target.value)}
                  placeholder="Paste Claude Code audit findings here…"
                  rows={4}
                  className="w-full text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
                />
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveInputs}
                disabled={savingInputs}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
              >
                {savingInputs ? 'saving…' : 'save inputs'}
              </button>
              {inputsSaved && <span className="text-text-faint text-xs">saved — regenerate tasks to use these</span>}
            </div>
          </div>
          {/* PR A: optional read-view slot — undefined on the authed path (read view
              unchanged), the locked generate buttons + caption in the showroom. */}
          {readViewAiActions}
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>5 · execute (tasks)</div>
            {taskSection}
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className="flex items-center justify-between mb-1">
              <div className={labelClass}>evolution (trajectory by AI re-run)</div>
              <button
                type="button"
                onClick={onToggleEvolution}
                className="px-2 py-0.5 border border-border rounded text-xs text-text-muted hover:bg-bg-row"
              >
                {showEvolution ? 'hide evolution' : 'view evolution'}
              </button>
            </div>
            {showEvolution && evolutionSection}
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>6 · dependencies</div>
            {dependencySection}
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
              onClick={onEnterEdit}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row"
            >
              edit
            </button>
            {project.status === 'archived' ? (
              <button
                type="button"
                onClick={onUnarchive}
                disabled={archiving}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
              >
                {archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onArchive}
                disabled={archiving}
                className="px-2 py-1 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50"
              >
                {archiving ? 'archiving…' : 'archive'}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'deleting…' : 'delete'}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs space-y-3">
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
                onChange={(e) => onFormChange({ ...form, title: e.target.value })}
                className={inputClass}
                maxLength={500}
              />
            </div>
            <div>
              <div className={labelClass}>entity</div>
              <select
                value={form.entity_id}
                onChange={(e) => onFormChange({ ...form, entity_id: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, status: e.target.value as ProjectStatus })}
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
              onChange={(next) => onFormChange({ ...form, goalItems: next })}
              verbPrefix="I WANT to "
              placeholder="get loans approved"
              disabled={saving}
            />
          </div>
          <div>
            <div className={labelClass}>2 · problem — gap between current and goal</div>
            <ListManager
              items={form.problemItems}
              onChange={(next) => onFormChange({ ...form, problemItems: next })}
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
              onChange={(next) => onFormChange({ ...form, diagnosisItems: next })}
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
                onClick={onGenerateDesign}
                disabled={generatingDesign}
                className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs hover:bg-purple-50 disabled:opacity-50"
                title="Generate institutional-rigor design field from your goal/problem/diagnosis items"
              >
                {generatingDesign ? 'generating…' : '↑ generate plan'}
              </button>
            </div>
            {form.design.trim().length > 0 ? (
              <div className="text-text-primary text-xs whitespace-pre-wrap p-3 bg-white border border-border-light rounded">
                {form.design}
              </div>
            ) : (
              <div className="text-text-muted text-xs italic p-3 bg-bg-row border border-border-light rounded">
                (no design yet — fill in goal/problem/diagnosis items above, then click "↑ generate plan")
              </div>
            )}
            {generationError && (
              <div className="mt-2 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs">
                {generationError}
              </div>
            )}
            {generatedDesignPreview && (
              <div className="mt-2 border border-brand-purple rounded p-3 bg-purple-50/30 text-xs space-y-2">
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
                    onClick={onUseGeneratedDesign}
                    className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90"
                  >
                    use this
                  </button>
                  <button
                    type="button"
                    onClick={onDiscardGeneratedDesign}
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
                onClick={onGenerateTasks}
                disabled={generatingTasks}
                className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs hover:bg-purple-50 disabled:opacity-50"
                title="Generate institutional-rigor task array (web-search verified URLs) from your goal/problem/diagnosis items"
              >
                {generatingTasks ? 'generating…' : '↑ generate tasks'}
              </button>
            </div>
            {!tasksPreview && (
              <div className="text-text-muted text-xs italic p-3 bg-bg-row border border-border-light rounded">
                (tasks are saved directly to this project on accept — click "↑ generate tasks" to synthesize an atomic task array from the goal/problem/diagnosis items above)
              </div>
            )}
            {tasksGenError && (
              <div className="mt-2 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs">
                {tasksGenError}
              </div>
            )}
            {tasksPreview && (
              <>
                {tasksPreview.costSummary && (
                  <div className="text-text-muted text-xs text-right mb-1">
                    ${tasksPreview.costSummary.cost_usd} · {tasksPreview.costSummary.input_tokens} in · {tasksPreview.costSummary.output_tokens} out
                  </div>
                )}
                <AITaskPreview
                  tasks={tasksPreview.tasks}
                  sourceAiUsageId={tasksPreview.sourceAiUsageId}
                  projectId={project.id}
                  inspection={tasksPreview.inspection}
                  onAccepted={onTasksAccepted}
                  onDiscarded={onTasksDiscarded}
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
                onChange={(e) => onFormChange({ ...form, target_completion_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. minutes</div>
              <input
                type="number"
                min={0}
                value={form.estimated_total_minutes}
                onChange={(e) => onFormChange({ ...form, estimated_total_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. cost (usd)</div>
              <input
                type="text"
                value={form.estimated_total_cost_usd}
                onChange={(e) => onFormChange({ ...form, estimated_total_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
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
