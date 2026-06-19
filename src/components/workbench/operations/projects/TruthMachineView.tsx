/**
 * TruthMachineView (PR-TM-1) — the TRANSPARENT pipeline render of a project.
 *
 * A pure, props-only alternative to ProjectRowView that shows the scoping pipeline
 * as a visible top-to-bottom FLOW: title + goals → RESEARCH (prompt → output) →
 * AUDIT (prompt → output) → FUSION (prompt → task list). Each stage shows its
 * PROMPT, then the OUTPUT it produced, so the user watches data move through the
 * machine.
 *
 * REUSE, no rebuild:
 *   - the research agent (Phase 1) — onRunResearch populates deep_research_input.
 *   - the fusion engine — onGenerateTasks → tasksPreview → <AITaskPreview/> (the
 *     human-accept gate; nothing is inserted without the user's "use these").
 *   - the live task list slot (taskSection) — the same <TaskList/> ProjectRowView uses.
 *
 * Scope of TM-1: the PROMPT panels are labeled placeholders describing what feeds
 * each stage (the full interpolated-prompt preview is TM-2). The AUDIT output stays
 * a PASTE BOX (claude_code_audit_input) — Phase 3's auto-audit writes that SAME field,
 * so this slot is forward-compatible. No streaming (TM-3), no evolve button (TM-4),
 * no migration. This view owns NO data/fetch — every action is a container callback.
 */

'use client';

import type { Project } from './types';
import AITaskPreview, { type AIGeneratedTask } from './AITaskPreview';
import { type InspectionData } from '../ai/InspectionDrawer';

export interface TruthMachineTasksPreview {
  tasks: AIGeneratedTask[];
  sourceAiUsageId: string;
  inspection?: InspectionData;
  costSummary?: { cost_usd: string; input_tokens: number; output_tokens: number };
}

export interface TruthMachineViewProps {
  project: Project;
  /** Back to the standard ProjectRowView render. */
  onExit: () => void;

  // ── RESEARCH stage (Phase 1) ────────────────────────────────────────────
  researchInput: string;
  onResearchInputChange: (value: string) => void;
  runningResearch: boolean;
  researchError: string | null;
  onRunResearch: () => void;

  // ── AUDIT stage (paste box now; Phase 3 auto-fills the same field) ────────
  auditInput: string;
  onAuditInputChange: (value: string) => void;
  savingInputs: boolean;
  inputsSaved: boolean;
  onSaveInputs: () => void;

  // ── FUSION stage (existing generate-tasks → accept gate) ──────────────────
  generatingTasks: boolean;
  tasksGenError: string | null;
  tasksPreview: TruthMachineTasksPreview | null;
  onGenerateTasks: () => void;
  onTasksAccepted: () => void;
  onTasksDiscarded: () => void;
  /** The live <TaskList/> slot — same element ProjectRowView receives. */
  taskSection: React.ReactNode;
}

const stageLabel = 'text-xs font-semibold uppercase tracking-wide text-brand-purple';
const subLabel = 'text-text-faint uppercase tracking-wide text-[10px] mb-1';

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Read-only display of a structured list (goal/problem/diagnosis) with legacy fallback. */
function ItemList({ items, legacy }: { items: string[]; legacy: string | null }) {
  if (items.length > 0) {
    return (
      <ul className="list-disc pl-4 space-y-0.5 text-text-primary">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    );
  }
  const text = (legacy ?? '').trim();
  if (text.length > 0) return <div className="text-text-primary whitespace-pre-wrap">{text}</div>;
  return <div className="text-text-muted italic">(none yet)</div>;
}

/** A labeled PROMPT panel. TM-1: describes what feeds the stage; TM-2 wires the live
 *  server-rendered interpolated prompt into the same slot. */
function PromptPanel({ title, feeds }: { title: string; feeds: string }) {
  return (
    <div className="rounded border border-dashed border-brand-purple/30 bg-brand-purple-wash/30 p-2">
      <div className={subLabel}>{title} · prompt</div>
      <div className="text-text-muted text-[11px] leading-relaxed">
        Feeds: {feeds}.{' '}
        <span className="text-text-faint">Full interpolated prompt preview — TM-2.</span>
      </div>
    </div>
  );
}

export default function TruthMachineView({
  project,
  onExit,
  researchInput,
  onResearchInputChange,
  runningResearch,
  researchError,
  onRunResearch,
  auditInput,
  onAuditInputChange,
  savingInputs,
  inputsSaved,
  onSaveInputs,
  generatingTasks,
  tasksGenError,
  tasksPreview,
  onGenerateTasks,
  onTasksAccepted,
  onTasksDiscarded,
  taskSection,
}: TruthMachineViewProps) {
  const goalItems = asStringArray(project.goal_items);
  const problemItems = asStringArray(project.problem_items);
  const diagnosisItems = asStringArray(project.diagnosis_items);
  const stageCard = 'rounded-lg border border-border bg-white p-3 space-y-2';
  const flowArrow = <div className="text-center text-brand-purple/50 text-sm leading-none">↓</div>;

  return (
    <div className="border border-brand-purple/20 rounded-lg bg-brand-purple-wash/20 p-4 text-xs space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-brand-purple">{project.title}</div>
          <div className="text-text-muted text-[11px]">Truth Machine — the pipeline, end to end</div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-2 py-0.5 border border-border rounded text-text-muted hover:bg-bg-row"
        >
          standard view
        </button>
      </div>

      {/* 1 · INPUTS — title + goals (what goes in) */}
      <div className={stageCard}>
        <div className={stageLabel}>1 · inputs</div>
        <div>
          <div className={subLabel}>goal</div>
          <ItemList items={goalItems} legacy={project.goal} />
        </div>
        <div>
          <div className={subLabel}>problem</div>
          <ItemList items={problemItems} legacy={project.problem} />
        </div>
        <div>
          <div className={subLabel}>diagnosis</div>
          <ItemList items={diagnosisItems} legacy={project.diagnosis} />
        </div>
      </div>

      {flowArrow}

      {/* 2 · RESEARCH — prompt → output (Phase 1 agent) */}
      <div className={stageCard}>
        <div className="flex items-center justify-between">
          <div className={stageLabel}>2 · research</div>
          <button
            type="button"
            onClick={onRunResearch}
            disabled={runningResearch}
            title="Run web research on the goals above and fill the output below for review"
            className="px-2 py-0.5 text-[11px] border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50 disabled:opacity-50"
          >
            {runningResearch ? 'researching…' : '✨ run deep research'}
          </button>
        </div>
        <PromptPanel title="research" feeds="the goal / problem / diagnosis above + live web_search" />
        <div className="text-center text-brand-purple/40 text-xs leading-none">↓ output</div>
        <div>
          <div className={subLabel}>research output (deep_research_input — review &amp; edit)</div>
          <textarea
            value={researchInput}
            onChange={(e) => onResearchInputChange(e.target.value)}
            placeholder="Run deep research, or paste findings here…"
            rows={5}
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
          />
          {researchError && <div className="mt-1 text-[11px] text-red-700">{researchError}</div>}
        </div>
      </div>

      {flowArrow}

      {/* 3 · AUDIT — prompt → output (paste box now; Phase 3 auto-fills the same field) */}
      <div className={stageCard}>
        <div className={stageLabel}>3 · audit</div>
        <PromptPanel title="audit" feeds="the goals above + a read-only codebase audit (Template B — authored in TM-2)" />
        <div className="text-center text-brand-purple/40 text-xs leading-none">↓ output</div>
        <div>
          <div className={subLabel}>audit output (claude_code_audit_input — paste; Phase 3 auto-fills here)</div>
          <textarea
            value={auditInput}
            onChange={(e) => onAuditInputChange(e.target.value)}
            placeholder="Paste Claude Code audit findings here… (Phase 3 will populate this automatically)"
            rows={5}
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
          />
        </div>
      </div>

      {/* Save the two reality inputs (shared persistence with the standard view) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveInputs}
          disabled={savingInputs}
          className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          {savingInputs ? 'saving…' : 'save research + audit'}
        </button>
        {inputsSaved && <span className="text-text-faint text-[11px]">saved — generate tasks to use these</span>}
      </div>

      {flowArrow}

      {/* 4 · FUSION — prompt → task list (existing engine + accept gate) */}
      <div className={stageCard}>
        <div className="flex items-center justify-between">
          <div className={stageLabel}>4 · fusion → tasks</div>
          <button
            type="button"
            onClick={onGenerateTasks}
            disabled={generatingTasks}
            title="Fuse goals + research + audit into an atomic task array (web-search verified)"
            className="px-2 py-0.5 text-[11px] border border-brand-purple text-brand-purple rounded hover:bg-purple-50 disabled:opacity-50"
          >
            {generatingTasks ? 'generating…' : '↑ generate tasks'}
          </button>
        </div>
        <PromptPanel title="fusion" feeds="goals + the research output + the audit output above, via web_search" />
        <div className="text-center text-brand-purple/40 text-xs leading-none">↓ output</div>
        {tasksGenError && (
          <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs">{tasksGenError}</div>
        )}
        {tasksPreview ? (
          <>
            {tasksPreview.costSummary && (
              <div className="text-text-muted text-[11px] text-right">
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
        ) : (
          <div className="text-text-muted text-[11px] italic p-2 bg-bg-row border border-border-light rounded">
            Click “↑ generate tasks” — proposed tasks appear here for your review. Nothing is saved until you accept.
          </div>
        )}
      </div>

      {/* The committed task list (live) */}
      <div className={stageCard}>
        <div className={stageLabel}>5 · task list</div>
        {taskSection}
      </div>
    </div>
  );
}
