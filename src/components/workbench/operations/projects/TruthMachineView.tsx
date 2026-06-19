/**
 * TruthMachineView — the TRANSPARENT pipeline render of a project, as a clean white
 * "finance" pipe (PR-TM-redesign restyle of TM-1/TM-2).
 *
 * Visible top-to-bottom FLOW: inputs → research → audit → fusion → tasks. Each stage is a
 * white card with a COLORED LEFT-STRIPE (purple/teal/blue/amber/purple) on a soft tint
 * canvas, separated by ↓ chevrons. Prompts render the SAME interpolated text the live call
 * fires — fixed template text in black, the user's INJECTED INPUTS in RED. The red is
 * builder-declared (server `segments` with kind:'input'|'template'), verified to rebuild
 * the exact fired string — never a regex guess.
 *
 * REUSE, no rebuild — the engines are untouched: the research agent (onRunResearch), the
 * fusion engine (onGenerateTasks → tasksPreview → <AITaskPreview/> human-accept gate), the
 * /prompts preview endpoint (no-drift shared builders), and the live <TaskList/> slot. This
 * view owns NO data/fetch — every action is a container callback. Mobile-first single column.
 */

'use client';

import { useState } from 'react';
import type { Project } from './types';
import AITaskPreview, { type AIGeneratedTask } from './AITaskPreview';
import { type InspectionData } from '../ai/InspectionDrawer';

/** A prompt span: 'input' = user-injected (rendered red), 'template' = fixed scaffold. */
export interface PromptSegmentDTO {
  text: string;
  kind: 'template' | 'input';
}

/** The three interpolated prompts from GET /projects/[id]/prompts (TM-2 + segments). */
export interface PromptPreview {
  research: { systemPrompt: string; userMessage: string; segments: PromptSegmentDTO[] };
  audit: { text: string; segments: PromptSegmentDTO[] };
  fusion: { systemPrompt: string; userMessage: string; segments: PromptSegmentDTO[] };
}

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
  /** TM-2: the live interpolated prompts (null while loading / unfetched). */
  prompts: PromptPreview | null;
  promptsLoading: boolean;

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

// ── palette (the clean finance look — deliberate hex per the redesign spec) ──
const CANVAS = '#F4F3F8';
const INPUT_RED = '#D62828';
const STRIPE = {
  inputs: '#6B46C1',   // purple
  research: '#0D9488', // teal
  audit: '#2563EB',    // blue
  fusion: '#D97706',   // amber/gold
  plan: '#6B46C1',     // purple
} as const;

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** White stage card with a 4px colored left-stripe + a small-caps colored label + badge. */
function Stage({
  n,
  label,
  color,
  badge,
  badgeTone,
  action,
  children,
}: {
  n: number;
  label: string;
  color: string;
  badge?: string;
  badgeTone?: 'auto' | 'paste';
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md border border-gray-200 bg-white p-3 sm:p-4 space-y-2.5 border-l-4 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color }}>
            {n} · {label}
          </span>
          {badge && (
            <span
              className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                badgeTone === 'paste'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const sub = 'text-gray-400 uppercase tracking-wide text-[10px] mb-1';

/** Read-only display of a structured list (goal/problem/diagnosis) with legacy fallback. */
function ItemList({ items, legacy }: { items: string[]; legacy: string | null }) {
  if (items.length > 0) {
    return (
      <ul className="list-disc pl-4 space-y-0.5 text-gray-900">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    );
  }
  const text = (legacy ?? '').trim();
  if (text.length > 0) return <div className="text-gray-900 whitespace-pre-wrap">{text}</div>;
  return <div className="text-gray-400 italic">(none yet)</div>;
}

/** ↓ flow chevron between stages. */
function Chevron() {
  return <div className="flex justify-center text-gray-300 text-base leading-none py-0.5" aria-hidden="true">↓</div>;
}

/** The PROMPT panel — black template text with user-injected spans in RED. The segments
 *  are builder-declared + server-verified (kind:'input' = the real interpolated input), so
 *  the red is truthful, not guessed. Copy yields the full real prompt string. */
function PromptBox({
  segments,
  copyText,
  systemPrompt,
  loading,
}: {
  segments: PromptSegmentDTO[] | undefined;
  copyText: string | undefined;
  systemPrompt?: string;
  loading: boolean;
}) {
  const [showSystem, setShowSystem] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const payload = systemPrompt && showSystem ? `${systemPrompt}\n\n---\n\n${copyText ?? ''}` : (copyText ?? '');
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the text is selectable in the box */
    }
  };
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/60">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-200">
        <div className="text-[10px] uppercase tracking-wide text-gray-400">
          prompt — <span style={{ color: INPUT_RED }} className="font-semibold">your inputs in red</span>
        </div>
        <div className="flex items-center gap-2">
          {systemPrompt && (
            <button type="button" onClick={() => setShowSystem((s) => !s)} className="text-[10px] text-gray-500 hover:text-gray-800 hover:underline">
              {showSystem ? 'hide system' : 'show system'}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            disabled={loading || !copyText}
            className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded text-gray-600 hover:bg-white disabled:opacity-40"
          >
            {copied ? 'copied ✓' : 'copy'}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="px-2 py-3 text-gray-400 text-[11px] italic">building prompt…</div>
      ) : segments && segments.length > 0 ? (
        <pre className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words text-gray-900 p-2 max-h-72 overflow-y-auto">
          {showSystem && systemPrompt && (
            <span className="text-gray-400">{systemPrompt}{'\n\n---\n\n'}</span>
          )}
          {segments.map((s, i) =>
            s.kind === 'input'
              ? <span key={i} style={{ color: INPUT_RED }} className="font-semibold">{s.text}</span>
              : <span key={i}>{s.text}</span>
          )}
        </pre>
      ) : (
        <div className="px-2 py-3 text-gray-400 text-[11px] italic">prompt unavailable</div>
      )}
    </div>
  );
}

const btn = 'px-2.5 py-1 text-[11px] font-medium rounded border disabled:opacity-50';
const outputTextarea = 'w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:border-brand-purple';

export default function TruthMachineView({
  project,
  onExit,
  prompts,
  promptsLoading,
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

  return (
    <div className="rounded-lg p-3 sm:p-4 space-y-2" style={{ backgroundColor: CANVAS }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <div className="text-sm font-bold text-gray-900">{project.title}</div>
          <div className="text-gray-500 text-[11px]">Truth Machine — the pipeline, end to end</div>
        </div>
        <button type="button" onClick={onExit} className="px-2 py-0.5 border border-gray-300 rounded text-gray-600 hover:bg-white text-xs">
          standard view
        </button>
      </div>

      {/* 1 · INPUTS */}
      <Stage n={1} label="inputs" color={STRIPE.inputs}>
        <div>
          <div className={sub}>goal</div>
          <ItemList items={goalItems} legacy={project.goal} />
        </div>
        {/* COND-INPUTS-1: problem/diagnosis render ONLY when they have content. New title+goals
            projects read clean (no "(none yet)" clutter); old projects with data still show them. */}
        {(problemItems.length > 0 || (project.problem ?? '').trim().length > 0) && (
          <div>
            <div className={sub}>problem</div>
            <ItemList items={problemItems} legacy={project.problem} />
          </div>
        )}
        {(diagnosisItems.length > 0 || (project.diagnosis ?? '').trim().length > 0) && (
          <div>
            <div className={sub}>diagnosis</div>
            <ItemList items={diagnosisItems} legacy={project.diagnosis} />
          </div>
        )}
      </Stage>

      <Chevron />

      {/* 2 · RESEARCH */}
      <Stage
        n={2}
        label="research"
        color={STRIPE.research}
        badge="auto"
        badgeTone="auto"
        action={
          <button
            type="button"
            onClick={onRunResearch}
            disabled={runningResearch}
            title="Run web research on the goals above and fill the output below for review"
            className={`${btn} border-current`}
            style={{ color: STRIPE.research }}
          >
            {runningResearch ? 'researching…' : '✨ run deep research'}
          </button>
        }
      >
        <PromptBox
          segments={prompts?.research.segments}
          copyText={prompts?.research.userMessage}
          systemPrompt={prompts?.research.systemPrompt}
          loading={promptsLoading}
        />
        <div className="flex justify-center text-gray-300 text-xs leading-none">↓ output</div>
        <div>
          <div className={sub}>research output (deep_research_input — review &amp; edit)</div>
          <textarea
            value={researchInput}
            onChange={(e) => onResearchInputChange(e.target.value)}
            placeholder="Run deep research, or paste findings here…"
            rows={5}
            className={outputTextarea}
          />
          {researchError && <div className="mt-1 text-[11px] text-red-700">{researchError}</div>}
        </div>
      </Stage>

      <Chevron />

      {/* 3 · AUDIT */}
      <Stage n={3} label="audit" color={STRIPE.audit} badge="paste" badgeTone="paste">
        <div className="text-gray-500 text-[11px]">Copy this prompt → run it in Claude Code (read-only) → paste the findings into the output below. (Phase 3 automates this.)</div>
        <PromptBox segments={prompts?.audit.segments} copyText={prompts?.audit.text} loading={promptsLoading} />
        <div className="flex justify-center text-gray-300 text-xs leading-none">↓ output</div>
        <div>
          <div className={sub}>audit output (claude_code_audit_input — paste; Phase 3 auto-fills here)</div>
          <textarea
            value={auditInput}
            onChange={(e) => onAuditInputChange(e.target.value)}
            placeholder="Paste Claude Code audit findings here… (Phase 3 will populate this automatically)"
            rows={5}
            className={outputTextarea}
          />
        </div>
      </Stage>

      {/* Save the two reality inputs (shared persistence with the standard view) */}
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={onSaveInputs}
          disabled={savingInputs}
          className="px-2.5 py-1 text-xs border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {savingInputs ? 'saving…' : 'save research + audit'}
        </button>
        {inputsSaved && <span className="text-gray-400 text-[11px]">saved — generate tasks to use these</span>}
      </div>

      <Chevron />

      {/* 4 · FUSION → tasks */}
      <Stage
        n={4}
        label="fusion → tasks"
        color={STRIPE.fusion}
        badge="auto"
        badgeTone="auto"
        action={
          <button
            type="button"
            onClick={onGenerateTasks}
            disabled={generatingTasks}
            title="Fuse goals + research + audit into an atomic task array (web-search verified)"
            className={`${btn} border-current`}
            style={{ color: STRIPE.fusion }}
          >
            {generatingTasks ? 'generating…' : '↑ generate tasks'}
          </button>
        }
      >
        <PromptBox
          segments={prompts?.fusion.segments}
          copyText={prompts?.fusion.userMessage}
          systemPrompt={prompts?.fusion.systemPrompt}
          loading={promptsLoading}
        />
        <div className="flex justify-center text-gray-300 text-xs leading-none">↓ output</div>
        {tasksGenError && (
          <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs">{tasksGenError}</div>
        )}
        {tasksPreview ? (
          <>
            {tasksPreview.costSummary && (
              <div className="text-gray-400 text-[11px] text-right">
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
          <div className="text-gray-500 text-[11px] italic p-2 bg-gray-50 border border-gray-200 rounded">
            Click “↑ generate tasks” — proposed tasks appear here for your review. Nothing is saved until you accept.
          </div>
        )}
      </Stage>

      <Chevron />

      {/* 5 · TASK LIST (live) */}
      <Stage n={5} label="plan" color={STRIPE.plan}>
        {taskSection}
      </Stage>
    </div>
  );
}
