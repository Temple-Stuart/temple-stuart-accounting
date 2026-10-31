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
 * subtree is provably fetch-free. <InspectionDrawer /> and <AITaskPreview />
 * remain rendered as-is.
 *
 * BACKLOG-01b (Alex, 2026-10-20): one fact, one home — the read view and the
 * edit view name the capture's facts in the brief's order (problem · why ·
 * goal · rulings · open questions · by when and why · proof of done · links ·
 * notes), then THE AUDIT (diagnosis) and THE PLAN (design) pasted back from
 * the chat; "— not answered —" when empty, never blank. The three ListManagers
 * and the structured *_items blocks left with their columns' UI (CLEAN-03
 * rules on dropping). "copy brief prompt" and "scope it" are container-owned
 * actions (absent in the showroom → no button), like the pipeline door.
 */

'use client';

import type { Project, ProjectForm, ProjectSize, ProjectStatus, ProjectType } from './types';
import { PROJECT_SIZES, PROJECT_TYPES, SIZE_LABELS, STATUS_LABELS, STATUS_PILL_CLASSES, TYPE_LABELS, formatAllocatedCents } from './types';
import { AUDIT_LABEL, NOT_ANSWERED_WORDS, PLAN_LABEL, captureQuestion } from '@/lib/operations/projectBrief';
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
  showEvolution: boolean;
  researchInput: string;
  auditInput: string;
  savingInputs: boolean;
  inputsSaved: boolean;
  /** PR-Loop-1: research agent running flag + last error. */
  runningResearch: boolean;
  researchError: string | null;
  /** BACKLOG-01b: "copy brief prompt" (the container writes the clipboard) and its 2-second word; absent (the showroom) → no button. */
  briefWords?: string | null;
  onCopyBrief?: () => void;
  /** BACKLOG-01b: "scope it" (the container's PATCH) — shown while the row is in the backlog; the route's refusal prints by name. */
  scopeWords?: string | null;
  scoping?: boolean;
  onScopeIt?: () => void;

  // ── actions (owned by the container) ─────────────────────────────────────
  onToggleExpanded: () => void;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onFormChange: (form: ProjectForm) => void;
  onSave: () => void;
  onResearchInputChange: (value: string) => void;
  onAuditInputChange: (value: string) => void;
  onSaveInputs: () => void;
  /** PR-Loop-1: PAID Anthropic AI (web_search) — POST research (container-owned). */
  onRunResearch: () => void;
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
  /** TASKS-01: opens the project's pipeline (TruthMachineView) — a plain
   *  control on the row, never a phase. Absent (the showroom) → no button. */
  onEnterPipeline?: () => void;
}

const STATUS_OPTIONS: ProjectStatus[] = [
  // BACKLOG-01 (Alex, 2026-10-20): the capture's four first, in the order a
  // project moves; the six that were here follow. No transition table yet —
  // the PATCH accepts any of the ten (BACKLOG-03 adds the allowed moves).
  'backlog',
  'scoped',
  'scheduled',
  'not_started',
  'in_progress',
  'blocked',
  'completed',
  'dropped',
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

export default function ProjectRowView({ project,
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
  showEvolution,
  researchInput,
  auditInput,
  savingInputs,
  inputsSaved,
  runningResearch,
  researchError,
  briefWords = null,
  onCopyBrief,
  scopeWords = null,
  scoping = false,
  onScopeIt,
  onToggleExpanded,
  onEnterEdit,
  onCancelEdit,
  onFormChange,
  onSave,
  onResearchInputChange,
  onAuditInputChange,
  onSaveInputs,
  onRunResearch,
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
  onEnterPipeline,
}: ProjectRowViewProps & { }) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';
  const pillClass = `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL_CLASSES[project.status]}`;

  // BACKLOG-01b (Alex, 2026-10-20): one fact, one home — the texts ARE the fields;
  // the structured *_items derivations and renderStructuredField left with them.
  const links = Array.isArray(project.links)
    ? project.links.filter((x): x is string => typeof x === 'string')
    : [];
  /** A capture text, or the honest "— not answered —" — never blank. */
  const answered = (t: string | null): string => ((t ?? '').trim().length > 0 ? (t as string) : NOT_ANSWERED_WORDS);

  return (
    <div
      ref={rowRef}
      className={
        'border rounded bg-white transition-colors ' +
        (flash ? ('border-brand-purple shadow-md') : 'border-border') +
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
          {/* BACKLOG-01: type · size beside the status — "—" on a row captured before. */}
          <span className="text-text-muted" data-project-row-type-size>
            {project.type ? TYPE_LABELS[project.type] : '—'} · {project.size ? SIZE_LABELS[project.size] : '—'}
          </span>
          <span className="text-text-muted">{entityName(entities, project.entity_id)}</span>
        </div>
        <div className="flex items-center gap-3 text-text-muted shrink-0">
          <span>target: {formatTargetDate(project.target_completion_date)}</span>
          {/* BACKLOG-01b: THE BRIEF FORMAT from the row + the TO THE CHAT paragraph → the clipboard. */}
          {onCopyBrief && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCopyBrief(); }}
              className="px-2 py-0.5 border border-border rounded text-xs text-text-muted hover:bg-bg-row"
              data-project-copy-brief
            >
              copy brief prompt
            </button>
          )}
          {briefWords && <span className="text-text-faint text-xs" data-project-brief-words>{briefWords}</span>}
        </div>
      </div>

      {expanded && !editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs space-y-3">
          {/* BACKLOG-01b (Alex, 2026-10-20): the capture, read — one fact, one home, in
              the brief's order; "— not answered —" when empty, never blank. THE AUDIT
              (diagnosis) and THE PLAN (design) paste back from the chat. */}
          <div className="space-y-2" data-project-capture>
            {([
              ['problem', project.problem],
              ['why', project.why],
              ['goal', project.goal],
              ['rulings', project.rulings],
              ['open_questions', project.open_questions],
            ] as const).map(([key, text]) => (
              <div key={key}>
                <div className={labelClass}>{captureQuestion(key).label}</div>
                <div className="text-text-primary text-xs whitespace-pre-wrap" data-project-text={key}>{answered(text)}</div>
              </div>
            ))}
            <div>
              <div className={labelClass}>{captureQuestion('by_when').label}</div>
              <div className="text-text-primary text-xs" data-project-text="target_completion_date">
                {project.target_completion_date ? formatTargetDate(project.target_completion_date) : NOT_ANSWERED_WORDS}
              </div>
              <div className="text-text-primary text-xs whitespace-pre-wrap" data-project-text="deadline_reason">{answered(project.deadline_reason)}</div>
            </div>
            <div>
              <div className={labelClass}>{captureQuestion('definition_of_done').label}</div>
              <div className="text-text-primary text-xs whitespace-pre-wrap" data-project-text="definition_of_done">{answered(project.definition_of_done)}</div>
            </div>
            <div>
              <div className={labelClass}>{captureQuestion('links').label}</div>
              {links.length > 0 ? (
                <ul className="list-disc list-inside text-text-primary text-xs space-y-0.5 ml-2" data-project-links>
                  {links.map((l, i) => (
                    <li key={i} className="break-all">{l}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-text-primary text-xs" data-project-links>{NOT_ANSWERED_WORDS}</div>
              )}
            </div>
            <div>
              <div className={labelClass}>{captureQuestion('notes').label}</div>
              <div className="text-text-primary text-xs whitespace-pre-wrap" data-project-text="notes">{answered(project.notes)}</div>
            </div>
            <div>
              <div className={labelClass}>{AUDIT_LABEL}</div>
              <div className="text-text-primary text-xs whitespace-pre-wrap" data-project-text="diagnosis">{answered(project.diagnosis)}</div>
            </div>
            <div>
              <div className={labelClass}>{PLAN_LABEL}</div>
              <div className="text-text-primary text-xs whitespace-pre-wrap" data-project-text="design">{answered(project.design)}</div>
            </div>
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>reality inputs (ground AI regeneration)</div>
            {/* PR-Ops-Evolve-1: reality inputs — paste targets that ground task
                regeneration in external research + a codebase audit. Sits beside the
                design/plan it grounds. */}
            <div className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className={labelClass}>deep research input</div>
                  {/* PR-Loop-1: research agent — runs server-side web_search and POPULATES
                      this field for review (does NOT generate tasks). Human checkpoint kept. */}
                  <button
                    type="button"
                    onClick={onRunResearch}
                    disabled={runningResearch}
                    title="Run web research on this project's goals and fill this field for review"
                    className={`px-2 py-0.5 text-[11px] border rounded disabled:opacity-50 ${'border-brand-purple text-brand-purple hover:bg-purple-100/50'}`}
                  >
                    {runningResearch ? 'researching…' : '✨ run deep research'}
                  </button>
                </div>
                <textarea
                  value={researchInput}
                  onChange={(e) => onResearchInputChange(e.target.value)}
                  placeholder="Paste deep research output here, or click “run deep research”…"
                  rows={4}
                  className="w-full text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
                />
                {researchError && (
                  <div className="mt-1 text-[11px] text-red-700">{researchError}</div>
                )}
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
              {/* PROJECTS-UX-1: the dossier anchor (cost-per-project) — the
                  project's cost cell gets the strongest-cell treatment at its
                  existing site (the ROUTINES-UX-1 precedent): primary-weight
                  label + the mono numeral idiom. Same field, same value. */}
              <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">est. cost (usd)</div>
              <div className="text-text-primary font-mono tabular-nums font-bold">{project.estimated_total_cost_usd ?? '—'}</div>
            </div>
            {/* PROJECTS-UX-2: REAL ledger money — the DIM allocation rollup,
                rendered DISTINCT from the self-reported estimate beside it
                (label honesty is load-bearing). Coverage declared per the
                DIM-1 doctrine (N ledger lines feed the sum). No links or a
                failed rollup → the cell does not render — no fabricated
                zeros, no dashes (the ROUTINES absence-is-honest precedent). */}
            {project.ledger_allocated && (
              <div>
                <div
                  className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs"
                  title="Real money from your ledger, allocated to this project via line links — distinct from the self-reported estimates"
                >
                  allocated from ledger
                </div>
                <div className="text-text-primary font-mono tabular-nums font-bold">
                  {formatAllocatedCents(project.ledger_allocated.cents)}
                </div>
                <div className="text-[10px] font-mono text-text-faint mt-0.5">
                  {project.ledger_allocated.line_count} ledger line{project.ledger_allocated.line_count === 1 ? '' : 's'} · {project.ledger_allocated.link_count} link{project.ledger_allocated.link_count === 1 ? '' : 's'}
                </div>
              </div>
            )}
          </div>
          {/* TASKS-01: a refused delete (409 — a live link) or a failed one
              renders HERE, on the read view where the button is. Before, the
              error slot existed only in edit mode and a refusal was silent. */}
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-project-error>
              {error}
            </div>
          )}
          {scopeWords && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-project-scope-words>
              {scopeWords}
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={onEnterEdit}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row"
            >
              edit
            </button>
            {onEnterPipeline && (
              <button
                type="button"
                onClick={onEnterPipeline}
                title="Open this project's pipeline: research → audit → tasks → plan → evolve"
                className="px-2 py-1 border border-border rounded hover:bg-bg-row"
                data-project-pipeline
              >
                pipeline
              </button>
            )}
            {/* BACKLOG-01b: "scope it" — backlog → scoped; the route refuses by name (scope it needs: …). */}
            {onScopeIt && project.status === 'backlog' && (
              <button
                type="button"
                onClick={onScopeIt}
                disabled={scoping}
                className="px-2 py-1 border border-brand-purple text-brand-purple rounded hover:bg-purple-50 disabled:opacity-50"
                data-project-scope-it
              >
                {scoping ? 'scoping…' : 'scope it'}
              </button>
            )}
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
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-project-error>
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

          {/* BACKLOG-01b (Alex, 2026-10-20): the capture's fields, editable here in the
              brief's order; THE AUDIT and THE PLAN are paste boxes. The PATCH refuses by
              name a type cleared once set, 1/2/3 emptied once set, THE AUDIT or THE PLAN
              cleared once scoped, and a target date without its reason. */}
          <div className="grid grid-cols-2 gap-3" data-project-capture-edit>
            <div>
              <div className={labelClass}>type</div>
              <select
                value={form.type}
                onChange={(e) => onFormChange({ ...form, type: e.target.value as ProjectType | '' })}
                className={inputClass}
                aria-label="Type"
              >
                <option value="">— choose —</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelClass}>size</div>
              <select
                value={form.size}
                onChange={(e) => onFormChange({ ...form, size: e.target.value as ProjectSize | '' })}
                className={inputClass}
                aria-label="Size"
              >
                <option value="">— not sized —</option>
                {PROJECT_SIZES.map((x) => (
                  <option key={x} value={x}>
                    {SIZE_LABELS[x]}
                  </option>
                ))}
              </select>
            </div>
            {(['problem', 'why', 'goal', 'rulings', 'open_questions'] as const).map((key) => (
              <div className="col-span-2" key={key}>
                <div className={labelClass}>{captureQuestion(key).label}</div>
                <textarea
                  value={form[key]}
                  onChange={(e) => onFormChange({ ...form, [key]: e.target.value })}
                  className={inputClass}
                  rows={3}
                  maxLength={4000}
                  aria-label={captureQuestion(key).label}
                />
              </div>
            ))}
            <div className="col-span-2">
              <div className={labelClass}>{captureQuestion('by_when').label}</div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="date"
                  value={form.target_completion_date}
                  onChange={(e) => onFormChange({ ...form, target_completion_date: e.target.value })}
                  className={inputClass}
                  aria-label="Target date"
                />
                <textarea
                  value={form.deadline_reason}
                  onChange={(e) => onFormChange({ ...form, deadline_reason: e.target.value })}
                  className={`${inputClass} col-span-2`}
                  rows={2}
                  maxLength={500}
                  placeholder={captureQuestion('by_when').question}
                  aria-label="Why that date"
                />
              </div>
            </div>
            <div className="col-span-2">
              <div className={labelClass}>{captureQuestion('definition_of_done').label}</div>
              <textarea
                value={form.definition_of_done}
                onChange={(e) => onFormChange({ ...form, definition_of_done: e.target.value })}
                className={inputClass}
                rows={3}
                aria-label={captureQuestion('definition_of_done').label}
              />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>links (one per line)</div>
              <textarea
                value={form.links.join('\n')}
                onChange={(e) => onFormChange({ ...form, links: e.target.value.split(/\r\n|\r|\n/) })}
                className={inputClass}
                rows={2}
                placeholder="a doc path or a url, one per line"
                aria-label="Links"
              />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>notes</div>
              <textarea
                value={form.notes}
                onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
                className={inputClass}
                rows={2}
                aria-label="Notes"
              />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>{AUDIT_LABEL}</div>
              <textarea
                value={form.diagnosis}
                onChange={(e) => onFormChange({ ...form, diagnosis: e.target.value })}
                className={inputClass}
                rows={6}
                placeholder="paste the chat's audit here"
                aria-label={AUDIT_LABEL}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className={labelClass}>{PLAN_LABEL}</div>
              <button
                type="button"
                onClick={onGenerateDesign}
                disabled={generatingDesign}
                className={`px-2 py-0.5 border rounded text-xs disabled:opacity-50 ${'border-brand-purple text-brand-purple hover:bg-purple-50'}`}
                title="Generate a design from the project's goal/problem/diagnosis"
              >
                {generatingDesign ? 'generating…' : '↑ generate plan'}
              </button>
            </div>
            <textarea
              value={form.design}
              onChange={(e) => onFormChange({ ...form, design: e.target.value })}
              className={inputClass}
              rows={6}
              placeholder="paste the plan here"
              aria-label={PLAN_LABEL}
            />
            {generationError && (
              <div className="mt-2 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs">
                {generationError}
              </div>
            )}
            {generatedDesignPreview && (
              <div className={`mt-2 rounded p-3 text-xs space-y-2 border ${'border-brand-purple bg-purple-50/30'}`}>
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
                    className={`px-3 py-1 border text-white rounded hover:opacity-90 ${'border-brand-purple bg-brand-purple'}`}
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
                className={`px-2 py-0.5 border rounded text-xs disabled:opacity-50 ${'border-brand-purple text-brand-purple hover:bg-purple-50'}`}
                title="Generate institutional-rigor task array (web-search verified URLs) from your goal/problem/diagnosis items"
              >
                {generatingTasks ? 'generating…' : '↑ generate tasks'}
              </button>
            </div>
            {!tasksPreview && (
              <div className="text-text-muted text-xs italic p-3 bg-bg-row border border-border-light rounded">
                (tasks are saved directly to this project on accept — click &quot;↑ generate tasks&quot; to synthesize an atomic task array from the goal/problem/diagnosis items above)
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

          {/* BACKLOG-01b: the target date moved up into 6 BY WHEN, AND WHY. */}
          <div className="grid grid-cols-2 gap-3">
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
              className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
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
