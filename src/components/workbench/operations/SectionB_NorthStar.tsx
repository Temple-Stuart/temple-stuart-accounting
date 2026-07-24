/**
 * src/components/workbench/operations/SectionB_NorthStar.tsx
 *
 * Section B · North Star — per-user mission anchor with always-edit-mode form.
 *
 * Three render branches:
 *   - Loading: section card with "loading north star…" body
 *   - Empty (no row): section card with empty-state pitch + form populated
 *     from defaults + "Save Your North Star" button
 *   - Has row: section card showing display view by default, with an "edit"
 *     toggle to enter form mode and an "I reviewed this — still holds"
 *     button to record a review attestation
 *
 * Bridgewater convention: review-without-change is a distinct audit event
 * (operations_north_star_reviewed) from a content edit (..._updated).
 */

'use client';

import { useEffect, useState } from 'react';
import type {
  NorthStar,
  NorthStarForm,
  OptimizableSection,
  OptimizeSectionInspection,
  OptimizeSectionResponse,
} from './types';
import { DEFAULT_NORTH_STAR_FORM } from './types';
import InspectionDrawer from './ai/InspectionDrawer';
import { themed, type Surface } from '@/lib/ds';

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  // Rough char count used for the live token/cost estimate. The
  // server has authoritative cost on response; this is a UX preview.
  approx_chars: number;
}

function sectionKindOf(s: OptimizableSection): 'prose' | 'chips' {
  return s === 'core_values' ? 'chips' : 'prose';
}

function readableSectionLabel(s: OptimizableSection): string {
  switch (s) {
    case 'mission_statement':
      return 'mission';
    case 'one_year_target':
      return '1-year target';
    case 'three_year_target':
      return '3-year target';
    case 'guiding_principles':
      return 'guiding principles';
    case 'core_values':
      return 'core values';
  }
}

function approxCostUsd(approxInputChars: number): string {
  // ~4 chars/token, $3.00 per million input tokens, ~500 output tokens
  // at $15.00 per million ≈ $0.0075. Surface the input-driven floor.
  const inputTokens = approxInputChars / 4;
  const cost = (inputTokens * 3.0) / 1_000_000 + (500 * 15.0) / 1_000_000;
  return cost.toFixed(4);
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    const future = -ms;
    if (future < 3_600_000) return `in ${Math.ceil(future / 60_000)}m`;
    if (future < 86_400_000) return `in ${Math.ceil(future / 3_600_000)}h`;
    return `in ${Math.ceil(future / 86_400_000)}d`;
  }
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function toForm(ns: NorthStar): NorthStarForm {
  return {
    mission_statement: ns.mission_statement ?? '',
    life_stage: ns.life_stage ?? '',
    core_values: ns.core_values,
    guiding_principles: ns.guiding_principles ?? '',
    one_year_target: ns.one_year_target ?? '',
    three_year_target: ns.three_year_target ?? '',
    current_location_label: ns.current_location_label ?? '',
    current_timezone: ns.current_timezone,
    review_cadence_days: ns.review_cadence_days,
  };
}

export default function SectionB_NorthStar({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [form, setForm] = useState<NorthStarForm>(DEFAULT_NORTH_STAR_FORM);
  const [coreValueInput, setCoreValueInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Optimize-from-reality state — lifted to the parent so the picker
  // panel and the editor stay in sync about which section is being
  // optimized.
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [openOptimizer, setOpenOptimizer] = useState<OptimizableSection | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [optimizing, setOptimizing] = useState(false);
  const [lastInspection, setLastInspection] = useState<
    (OptimizeSectionInspection & { inputTokens: number; outputTokens: number; costUsd: string; usageId: string }) | null
  >(null);
  // Original-value snapshot per section captured at optimize-time so
  // "undo to original" reverts the AI proposal cleanly. Map keyed by
  // section_name; value is the pre-proposal form value for that section.
  const [originalValues, setOriginalValues] = useState<Partial<Record<OptimizableSection, string | string[]>>>({});

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/operations/north-star');
        if (!cancelled && res.ok) {
          const body = await res.json();
          const ns: NorthStar | null = body?.northStar ?? null;
          setNorthStar(ns);
          if (ns) {
            setForm(toForm(ns));
            setEditing(false);
          } else {
            setForm(DEFAULT_NORTH_STAR_FORM);
            setEditing(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Lazy-load projects when the user first opens any optimizer picker.
  // Char-count per project is a rough proxy for input-token volume so
  // the live estimate updates as the user toggles checkboxes.
  useEffect(() => {
    if (!openOptimizer || projectsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/operations/projects');
        if (!res.ok) {
          if (!cancelled) {
            setError('failed to load projects for optimization picker');
            setProjects([]);
            setProjectsLoaded(true);
          }
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        type ProjectRow = {
          id: string;
          title: string;
          status: string;
          goal: string | null;
          problem: string | null;
          diagnosis: string | null;
          design: string | null;
          goal_items?: string[] | null;
          problem_items?: string[] | null;
          diagnosis_items?: string[] | null;
        };
        const list: ProjectSummary[] = ((body.projects ?? []) as ProjectRow[]).map((p) => {
          const itemsLen =
            (p.goal_items ?? []).reduce((s, v) => s + v.length, 0) +
            (p.problem_items ?? []).reduce((s, v) => s + v.length, 0) +
            (p.diagnosis_items ?? []).reduce((s, v) => s + v.length, 0);
          const proseLen =
            (p.goal?.length ?? 0) +
            (p.problem?.length ?? 0) +
            (p.diagnosis?.length ?? 0) +
            (p.design?.length ?? 0);
          return {
            id: p.id,
            title: p.title,
            status: p.status,
            // ~600 char overhead per project framing + items + prose.
            // Per-task chars aren't known until the server fetches tasks;
            // tasks add to the server-side estimate but the client preview
            // is bounded to project text. Good-enough for live UX.
            approx_chars: 600 + p.title.length + itemsLen + proseLen,
          };
        });
        setProjects(list);
        // Smart default: ALL active projects pre-selected. The user
        // unchecks irrelevant ones. NO heuristic title-matching — that
        // would be a hidden fallback.
        const active = new Set(list.filter((p) => p.status !== 'archived' && p.status !== 'cancelled').map((p) => p.id));
        setSelectedProjectIds(active);
        setProjectsLoaded(true);
      } catch {
        if (!cancelled) {
          setError('failed to load projects for optimization picker');
          setProjects([]);
          setProjectsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openOptimizer, projectsLoaded]);

  const handleOpenOptimizer = (section: OptimizableSection) => {
    setOpenOptimizer(section);
    setError(null);
  };

  const handleCloseOptimizer = () => {
    setOpenOptimizer(null);
    setOptimizing(false);
  };

  const toggleProjectSelection = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOptimize = async () => {
    if (!openOptimizer) return;
    setOptimizing(true);
    setError(null);
    try {
      // Snapshot original value for "undo to original" affordance.
      const originalForSection =
        openOptimizer === 'core_values'
          ? [...form.core_values]
          : (form[openOptimizer as keyof NorthStarForm] as string);

      const res = await fetch('/api/operations/ai/optimize-north-star-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_name: openOptimizer,
          project_ids: Array.from(selectedProjectIds),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the truthful error — including 413 overflow messages
        // that tell the user to narrow their project selection. NO
        // fallback content is injected into the form.
        setError(body?.message ?? body?.error ?? 'optimization failed');
        return;
      }
      const data = body as OptimizeSectionResponse;

      // Apply the proposal to the form. Original value is preserved in
      // originalValues so "undo to original" works.
      setOriginalValues((prev) => ({ ...prev, [openOptimizer]: originalForSection }));
      if (openOptimizer === 'core_values') {
        if (!Array.isArray(data.proposed_value)) {
          setError('AI returned non-array for core_values; refusing to apply');
          return;
        }
        setForm({ ...form, core_values: data.proposed_value });
      } else {
        if (typeof data.proposed_value !== 'string') {
          setError('AI returned non-string for a prose section; refusing to apply');
          return;
        }
        setForm({ ...form, [openOptimizer]: data.proposed_value });
      }

      setLastInspection({
        ...data.inspection,
        inputTokens: data.input_tokens,
        outputTokens: data.output_tokens,
        costUsd: data.cost_usd,
        usageId: data.usage_id,
      });
      setSuccessMessage(`AI proposal applied to ${readableSectionLabel(openOptimizer)} — review, edit, then save to commit`);
      handleCloseOptimizer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleUndoSection = (section: OptimizableSection) => {
    const original = originalValues[section];
    if (original === undefined) return;
    if (section === 'core_values') {
      setForm({ ...form, core_values: original as string[] });
    } else {
      setForm({ ...form, [section]: original as string });
    }
    setOriginalValues((prev) => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  };

  const addCoreValue = () => {
    const v = coreValueInput.trim();
    if (!v) return;
    if (form.core_values.includes(v)) {
      setCoreValueInput('');
      return;
    }
    setForm({ ...form, core_values: [...form.core_values, v] });
    setCoreValueInput('');
  };

  const removeCoreValue = (v: string) => {
    setForm({ ...form, core_values: form.core_values.filter((x) => x !== v) });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/north-star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to save');
        return;
      }
      setNorthStar(body.northStar);
      setForm(toForm(body.northStar));
      setEditing(false);
      setSuccessMessage(body.isCreate ? 'north star saved' : 'north star updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    if (!northStar) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/north-star/review', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to record review');
        return;
      }
      setNorthStar(body.northStar);
      setForm(toForm(body.northStar));
      setSuccessMessage('review recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to record review');
    } finally {
      setReviewing(false);
    }
  };

  const handleCancelEdit = () => {
    if (northStar) {
      setForm(toForm(northStar));
      setEditing(false);
    }
    setError(null);
  };

  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          B · NORTH STAR
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          {northStar && !editing && (
            <>
              <button
                type="button"
                onClick={handleReview}
                disabled={reviewing}
                className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
                title="Record a review-without-edit attestation"
              >
                {reviewing ? 'recording…' : 'I reviewed — still holds'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row', dk)}
              >
                edit
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono mb-3 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="text-xs font-mono mb-3 px-3 py-2 rounded border bg-green-50 border-green-200 text-green-800">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>loading north star…</div>
      ) : editing ? (
        <>
          <NorthStarEditor dk={dk}
            form={form}
            setForm={setForm}
            coreValueInput={coreValueInput}
            setCoreValueInput={setCoreValueInput}
            addCoreValue={addCoreValue}
            removeCoreValue={removeCoreValue}
            saving={saving}
            onSave={handleSave}
            onCancel={northStar ? handleCancelEdit : undefined}
            onOpenOptimizer={handleOpenOptimizer}
            sectionHasProposal={originalValues}
            onUndoSection={handleUndoSection}
          />
          {openOptimizer && (
            <OptimizePicker dk={dk}
              sectionName={openOptimizer}
              projects={projects}
              projectsLoaded={projectsLoaded}
              selectedIds={selectedProjectIds}
              onToggle={toggleProjectSelection}
              optimizing={optimizing}
              onOptimize={handleOptimize}
              onCancel={handleCloseOptimizer}
            />
          )}
          {lastInspection && (
            <div className="mt-4">
              <InspectionDrawer surface={surface}
                data={{
                  model: lastInspection.model,
                  temperature: lastInspection.temperature,
                  maxTokens: lastInspection.maxTokens,
                  systemPrompt: lastInspection.systemPrompt,
                  userMessage: lastInspection.userMessage,
                  rawResponse: lastInspection.rawResponse,
                  inputTokens: lastInspection.inputTokens,
                  outputTokens: lastInspection.outputTokens,
                  costUsd: lastInspection.costUsd,
                  usageId: lastInspection.usageId,
                }}
              />
            </div>
          )}
        </>
      ) : northStar ? (
        <NorthStarDisplay dk={dk} northStar={northStar} />
      ) : (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>no north star yet — entering edit mode…</div>
      )}
    </section>
  );
}

function NorthStarDisplay({ dk = false, northStar }: { dk?: boolean; northStar: NorthStar }) {
  const daysToReview = daysUntil(northStar.next_review_at);
  return (
    <div className="space-y-4 text-xs font-mono">
      {northStar.mission_statement ? (
        <div>
          <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>mission</div>
          <div className={themed('text-text-primary text-sm whitespace-pre-wrap', dk)}>
            {northStar.mission_statement}
          </div>
        </div>
      ) : (
        <div className={themed('text-text-muted italic', dk)}>no mission statement set</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>life stage</div>
          <div className={themed('text-text-primary', dk)}>{northStar.life_stage ?? '—'}</div>
        </div>
        <div>
          <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>location · timezone</div>
          <div className={themed('text-text-primary', dk)}>
            {northStar.current_location_label ?? '—'} · {northStar.current_timezone}
          </div>
        </div>
      </div>

      <div>
        <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>core values</div>
        {northStar.core_values.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {northStar.core_values.map((v) => (
              <span
                key={v}
                className={themed('px-2 py-0.5 border border-border rounded bg-bg-row text-text-primary', dk)}
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <div className={themed('text-text-muted', dk)}>—</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>1-year target</div>
          <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>
            {northStar.one_year_target ?? '—'}
          </div>
        </div>
        <div>
          <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>3-year target</div>
          <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>
            {northStar.three_year_target ?? '—'}
          </div>
        </div>
      </div>

      {northStar.guiding_principles && (
        <div>
          <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>guiding principles</div>
          <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{northStar.guiding_principles}</div>
        </div>
      )}

      <div className={themed('flex items-center gap-4 pt-2 border-t border-border-light text-text-muted', dk)}>
        <span>
          last reviewed:{' '}
          {northStar.last_reviewed_at ? relTime(northStar.last_reviewed_at) : 'never'}
        </span>
        <span>
          cadence: every {northStar.review_cadence_days}d
        </span>
        {daysToReview !== null && (
          <span
            className={
              daysToReview < 0
                ? 'text-red-700'
                : daysToReview <= 7
                ? 'text-amber-700'
                : themed('text-text-muted', dk)
            }
          >
            {daysToReview < 0
              ? `review overdue by ${-daysToReview}d`
              : daysToReview === 0
              ? 'review due today'
              : `review due in ${daysToReview}d`}
          </span>
        )}
      </div>
    </div>
  );
}

interface OptimizePickerProps {
  dk?: boolean;
  sectionName: OptimizableSection;
  projects: ProjectSummary[];
  projectsLoaded: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  optimizing: boolean;
  onOptimize: () => void;
  onCancel: () => void;
}

function OptimizePicker({ dk = false,
  sectionName,
  projects,
  projectsLoaded,
  selectedIds,
  onToggle,
  optimizing,
  onOptimize,
  onCancel,
}: OptimizePickerProps) {
  const selectedList = projects.filter((p) => selectedIds.has(p.id));
  const selectedChars = selectedList.reduce((s, p) => s + p.approx_chars, 0);
  const approxTokens = Math.round(selectedChars / 4);
  const approxCost = approxCostUsd(selectedChars);
  const kind = sectionKindOf(sectionName);

  return (
    <div className="mt-4 border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-2">
      <div className="flex items-center justify-between">
        <div className={themed('font-bold text-text-primary', dk)}>
          optimize {readableSectionLabel(sectionName)} from reality{' '}
          <span className={themed('text-text-muted font-normal', dk)}>
            ({kind === 'chips' ? 'AI proposes a revised chip set' : 'AI proposes replacement text'})
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={themed('text-text-muted hover:text-text-primary', dk)}
          title="Close picker"
        >
          ✕
        </button>
      </div>
      <div className={themed('text-text-muted', dk)}>
        Pick the projects whose tasks should ground the proposal. Full project + task rows are
        sent to the model — never summarized, never truncated. If the payload exceeds the
        context window the server returns an error asking you to narrow the selection.
      </div>
      {!projectsLoaded ? (
        <div className={themed('text-text-muted italic', dk)}>loading projects…</div>
      ) : projects.length === 0 ? (
        <div className={themed('text-text-muted italic', dk)}>
          no projects yet — the AI will propose based on the current section text alone.
        </div>
      ) : (
        <div className={themed('max-h-48 overflow-y-auto border border-border rounded bg-white', dk)}>
          {projects.map((p) => (
            <label
              key={p.id}
              className={themed('flex items-center gap-2 px-2 py-1 border-b border-border-light last:border-b-0 hover:bg-bg-row cursor-pointer', dk)}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => onToggle(p.id)}
              />
              <span className={themed('flex-1 truncate text-text-primary', dk)}>{p.title}</span>
              <span className={themed('text-text-faint', dk)}>{p.status}</span>
            </label>
          ))}
        </div>
      )}
      <div className={themed('text-text-muted', dk)}>
        selected: {selectedList.length} of {projects.length} projects · ~
        {approxTokens.toLocaleString()} input tokens · ~${approxCost} per call (estimate; server
        logs authoritative cost)
      </div>
      <div className={themed('flex items-center gap-2 pt-2 border-t border-border-light', dk)}>
        <button
          type="button"
          onClick={onOptimize}
          disabled={optimizing}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {optimizing ? 'optimizing…' : 'optimize'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={optimizing}
          className={themed('px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
        >
          cancel
        </button>
      </div>
    </div>
  );
}

interface EditorProps {
  dk?: boolean;
  form: NorthStarForm;
  setForm: (f: NorthStarForm) => void;
  coreValueInput: string;
  setCoreValueInput: (s: string) => void;
  addCoreValue: () => void;
  removeCoreValue: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel?: () => void;
  onOpenOptimizer: (section: OptimizableSection) => void;
  /** Sections that currently hold an AI proposal (so "undo" is visible). */
  sectionHasProposal: Partial<Record<OptimizableSection, string | string[]>>;
  onUndoSection: (section: OptimizableSection) => void;
}

function OptimizeButton({ dk = false,
  section,
  onClick,
  hasProposal,
  onUndo,
}: { dk?: boolean;
  section: OptimizableSection;
  onClick: (s: OptimizableSection) => void;
  hasProposal: boolean;
  onUndo: (s: OptimizableSection) => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono">
      <button
        type="button"
        onClick={() => onClick(section)}
        className="px-1.5 py-0.5 border border-brand-purple text-brand-purple rounded hover:bg-purple-50"
        title="Propose a sharpened version of this section from the reality of your selected projects + tasks"
      >
        + optimize from reality
      </button>
      {hasProposal && (
        <button
          type="button"
          onClick={() => onUndo(section)}
          className={themed('text-text-muted hover:text-text-primary underline', dk)}
          title="Revert this section to its pre-proposal value"
        >
          🤖 AI proposal · undo
        </button>
      )}
    </span>
  );
}

function NorthStarEditor({ dk = false,
  form,
  setForm,
  coreValueInput,
  setCoreValueInput,
  addCoreValue,
  removeCoreValue,
  saving,
  onSave,
  onCancel,
  onOpenOptimizer,
  sectionHasProposal,
  onUndoSection,
}: EditorProps) {
  const labelClass = themed('text-text-faint uppercase tracking-wide mb-1 text-xs font-mono', dk);
  const inputClass =
    themed('w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple', dk);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={labelClass}>mission statement</div>
          <OptimizeButton dk={dk}
            section="mission_statement"
            onClick={onOpenOptimizer}
            hasProposal={sectionHasProposal.mission_statement !== undefined}
            onUndo={onUndoSection}
          />
        </div>
        <textarea
          value={form.mission_statement}
          onChange={(e) => setForm({ ...form, mission_statement: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="why are you doing this work?"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>life stage</div>
          <input
            type="text"
            value={form.life_stage}
            onChange={(e) => setForm({ ...form, life_stage: e.target.value })}
            className={inputClass}
            placeholder="building / scaling / transitioning"
          />
        </div>
        <div>
          <div className={labelClass}>review cadence (days)</div>
          <input
            type="number"
            min={1}
            value={form.review_cadence_days}
            onChange={(e) =>
              setForm({ ...form, review_cadence_days: parseInt(e.target.value, 10) || 90 })
            }
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={labelClass}>core values</div>
          <OptimizeButton dk={dk}
            section="core_values"
            onClick={onOpenOptimizer}
            hasProposal={sectionHasProposal.core_values !== undefined}
            onUndo={onUndoSection}
          />
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.core_values.map((v) => (
            <span
              key={v}
              className={themed('px-2 py-0.5 border border-border rounded bg-bg-row text-text-primary text-xs font-mono inline-flex items-center gap-1', dk)}
            >
              {v}
              <button
                type="button"
                onClick={() => removeCoreValue(v)}
                className={themed('text-text-muted hover:text-red-700', dk)}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={coreValueInput}
            onChange={(e) => setCoreValueInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCoreValue();
              }
            }}
            className={inputClass}
            placeholder="add a value (press Enter)"
          />
          <button
            type="button"
            onClick={addCoreValue}
            className={themed('px-3 py-1 border border-border rounded text-xs font-mono hover:bg-bg-row', dk)}
          >
            add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className={labelClass}>1-year target</div>
            <OptimizeButton dk={dk}
              section="one_year_target"
              onClick={onOpenOptimizer}
              hasProposal={sectionHasProposal.one_year_target !== undefined}
              onUndo={onUndoSection}
            />
          </div>
          <textarea
            value={form.one_year_target}
            onChange={(e) => setForm({ ...form, one_year_target: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="where do you want to be in 12 months?"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className={labelClass}>3-year target</div>
            <OptimizeButton dk={dk}
              section="three_year_target"
              onClick={onOpenOptimizer}
              hasProposal={sectionHasProposal.three_year_target !== undefined}
              onUndo={onUndoSection}
            />
          </div>
          <textarea
            value={form.three_year_target}
            onChange={(e) => setForm({ ...form, three_year_target: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="where do you want to be in 3 years?"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={labelClass}>guiding principles</div>
          <OptimizeButton dk={dk}
            section="guiding_principles"
            onClick={onOpenOptimizer}
            hasProposal={sectionHasProposal.guiding_principles !== undefined}
            onUndo={onUndoSection}
          />
        </div>
        <textarea
          value={form.guiding_principles}
          onChange={(e) => setForm({ ...form, guiding_principles: e.target.value })}
          rows={4}
          className={inputClass}
          placeholder="long-form principles you want to anchor decisions to"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>location label</div>
          <input
            type="text"
            value={form.current_location_label}
            onChange={(e) => setForm({ ...form, current_location_label: e.target.value })}
            className={inputClass}
            placeholder="Los Angeles, CA"
          />
        </div>
        <div>
          <div className={labelClass}>timezone (IANA)</div>
          <input
            type="text"
            value={form.current_timezone}
            onChange={(e) => setForm({ ...form, current_timezone: e.target.value })}
            className={inputClass}
            placeholder="America/Los_Angeles"
          />
        </div>
      </div>

      <div className={themed('flex items-center gap-2 pt-2 border-t border-border-light', dk)}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'saving…' : 'save north star'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={themed('px-3 py-1 border border-border rounded text-xs font-mono hover:bg-bg-row disabled:opacity-50', dk)}
          >
            cancel
          </button>
        )}
      </div>
    </div>
  );
}
