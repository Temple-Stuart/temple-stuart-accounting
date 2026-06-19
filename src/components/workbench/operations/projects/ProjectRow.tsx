/**
 * ProjectRow — the LIVE, authed container for a single Section D project row.
 *
 * PR5 split: this file keeps the EXACT live behavior it had before — every
 * fetch it fired itself (PATCH save / PATCH save-inputs / POST generate-design /
 * POST generate-tasks / DELETE / PATCH archive / PATCH unarchive) plus the
 * scroll-into-view jump effect and all UI toggles — and now renders the pure
 * <ProjectRowView/> with the live state + the real handlers wired to its
 * callbacks. The two PAID Anthropic AI calls (generate-design, generate-tasks)
 * are container-owned, never reachable from the pure view. The public name +
 * prop shape ({ project, entities, allProjects, onUpdate, onDelete, isJumpTarget,
 * onClearTarget, onJumpTo }) are unchanged, so the existing call site
 * (SectionD_ProjectBacklog.tsx:145) is untouched and /operations/projects behaves
 * identically. NO new behavior, NO demo data, NO fallback.
 *
 * Three modes (unchanged): compact (title + status + target), expanded (4
 * scoping fields + live task list / evolution / dependencies children), edit
 * (inline form covering all writable fields + the two AI generators).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project, ProjectForm } from './types';
import { type InspectionData } from '../ai/InspectionDrawer';
import { type AIGeneratedTask } from './AITaskPreview';
import TaskList from './TaskList';
import EvolutionTimeline from './EvolutionTimeline';
import DependencyList from './DependencyList';
import TruthMachineView, { type PromptPreview } from './TruthMachineView';
import ProjectRowView, {
  type Entity,
  type GenerationCost,
  type GenerationInspection,
  type TasksPreview,
} from './ProjectRowView';

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
  /** PD-2: start expanded (the queue card opens straight into the detail). Default false
   *  → existing behavior unchanged everywhere else. */
  defaultExpanded?: boolean;
}

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
    // Round-tripped so edits via this form preserve the saved audit (the edit form
    // has no input for it; the reality paste box lives in the expanded view).
    claude_code_audit_input: p.claude_code_audit_input ?? '',
  };
}

export default function ProjectRow({ project, entities, allProjects, onUpdate, onDelete, isJumpTarget, onClearTarget, onJumpTo, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProjectForm>(() => projectToForm(project));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingDesign, setGeneratingDesign] = useState(false);
  const [generatedDesignPreview, setGeneratedDesignPreview] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationCost, setGenerationCost] = useState<GenerationCost | null>(null);
  const [generationInspection, setGenerationInspection] = useState<GenerationInspection | null>(null);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [tasksGenError, setTasksGenError] = useState<string | null>(null);
  const [tasksPreview, setTasksPreview] = useState<TasksPreview | null>(null);
  // PR-Loop-1: the research agent populates deep_research_input for review.
  const [runningResearch, setRunningResearch] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
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
  // PR-TM-1: render the project as the transparent Truth Machine pipeline instead of
  // the standard row. Pure UI toggle — same container state + handlers feed both views.
  // PR-TM-1 / PD-3a: the Truth Machine pipe is the DEFAULT project detail — opening a
  // project shows the clean pipe-step layout (with the interpolated prompts surfaced for
  // review). "standard view" (TruthMachineView onExit) returns to ProjectRowView read/edit.
  const [pipelineMode, setPipelineMode] = useState(true);
  // PR-TM-2: the live interpolated prompts (research / audit / fusion), fetched from the
  // read-only preview endpoint (NO Anthropic call). promptsRefresh re-pulls them after a
  // research run / save so the fusion preview never drifts from the DB state that fires.
  const [prompts, setPrompts] = useState<PromptPreview | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsRefresh, setPromptsRefresh] = useState(0);
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

  // PR-TM-2: fetch the live interpolated prompts when the pipeline view is open (and on
  // refresh after a research run / save). Read-only GET — NO Anthropic call, no cost.
  useEffect(() => {
    if (!pipelineMode) return;
    let cancelled = false;
    setPromptsLoading(true);
    fetch(`/api/operations/projects/${project.id}/prompts`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setPrompts(data as PromptPreview | null); })
      .catch(() => { if (!cancelled) setPrompts(null); })
      .finally(() => { if (!cancelled) setPromptsLoading(false); });
    return () => { cancelled = true; };
  }, [pipelineMode, project.id, promptsRefresh]);

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
        setPromptsRefresh((n) => n + 1); // TM-2: refresh prompt preview after saving inputs
        onUpdate();
      }
    } finally {
      setSavingInputs(false);
    }
  };

  // PAID Anthropic AI — POST generate-design. Container-owned: never reachable
  // from the pure <ProjectRowView/>.
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

  // PR-Loop-1: PAID Anthropic AI (web_search) — POST research. Container-owned: never
  // reachable from the pure <ProjectRowView/>. POPULATES deep_research_input for review;
  // does NOT trigger fusion (generate-tasks) or insert tasks — the human checkpoint stays.
  const handleRunResearch = async () => {
    setRunningResearch(true);
    setResearchError(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/research`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setResearchError(body?.message ?? body?.error ?? 'failed to run research');
        return;
      }
      // Populate the editable field for the user to REVIEW (they save/regenerate when ready).
      setResearchInput(body.deep_research_input ?? '');
      setInputsSaved(false);
      // TM-2: the DB's deep_research_input changed → refresh the prompt preview so the
      // fusion prompt shows the new research (no drift from what would fire).
      setPromptsRefresh((n) => n + 1);
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : 'failed to run research');
    } finally {
      setRunningResearch(false);
    }
  };

  // PAID Anthropic AI — POST generate-tasks. Container-owned: never reachable
  // from the pure <ProjectRowView/>.
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

  const handleUseGeneratedDesign = () => {
    if (generatedDesignPreview === null) return;
    setForm({ ...form, design: generatedDesignPreview });
    setGeneratedDesignPreview(null);
    setGenerationCost(null);
    setGenerationInspection(null);
  };

  const handleDiscardGeneratedDesign = () => {
    setGeneratedDesignPreview(null);
    setGenerationCost(null);
    setGenerationInspection(null);
  };

  // PR-TM-1: the Truth Machine pipeline view — a transparent top-to-bottom render of
  // the SAME project, fed by the SAME container handlers (research / fusion / accept
  // gate). ProjectRowView + the public showroom are untouched; this is an alternate
  // render the user opts into. rowRef stays on a wrapper so the jump-scroll still works.
  if (pipelineMode) {
    return (
      <div ref={rowRef}>
        <TruthMachineView
          project={project}
          onExit={() => setPipelineMode(false)}
          prompts={prompts}
          promptsLoading={promptsLoading}
          researchInput={researchInput}
          onResearchInputChange={(value) => { setResearchInput(value); setInputsSaved(false); }}
          runningResearch={runningResearch}
          researchError={researchError}
          onRunResearch={handleRunResearch}
          auditInput={auditInput}
          onAuditInputChange={(value) => { setAuditInput(value); setInputsSaved(false); }}
          savingInputs={savingInputs}
          inputsSaved={inputsSaved}
          onSaveInputs={handleSaveInputs}
          generatingTasks={generatingTasks}
          tasksGenError={tasksGenError}
          tasksPreview={tasksPreview}
          onGenerateTasks={handleGenerateTasks}
          onTasksAccepted={() => { setTasksPreview(null); setTasksGenError(null); }}
          onTasksDiscarded={() => { setTasksPreview(null); setTasksGenError(null); }}
          taskSection={<TaskList projectId={project.id} entity_id={project.entity_id} />}
        />
      </div>
    );
  }

  return (
    <ProjectRowView
      project={project}
      entities={entities}
      rowRef={rowRef}
      // PR7a slots — the SAME live containers with the SAME props as before.
      // These are plain React elements; React mounts each only when the view
      // actually renders it (taskSection/dependencySection inside the expanded
      // block, evolutionSection only when showEvolution), so the lazy-fetch
      // behavior is byte-for-byte identical to the pre-slot inline renders.
      taskSection={<TaskList projectId={project.id} entity_id={project.entity_id} />}
      evolutionSection={<EvolutionTimeline projectId={project.id} />}
      dependencySection={
        <DependencyList
          projectId={project.id}
          allProjects={allProjects}
          onJumpTo={onJumpTo}
        />
      }
      expanded={expanded}
      editing={editing}
      form={form}
      saving={saving}
      deleting={deleting}
      archiving={archiving}
      error={error}
      generatingDesign={generatingDesign}
      generatedDesignPreview={generatedDesignPreview}
      generationError={generationError}
      generationCost={generationCost}
      generationInspection={generationInspection}
      generatingTasks={generatingTasks}
      tasksGenError={tasksGenError}
      tasksPreview={tasksPreview}
      flash={flash}
      showDesignReasoning={showDesignReasoning}
      showEvolution={showEvolution}
      researchInput={researchInput}
      auditInput={auditInput}
      savingInputs={savingInputs}
      inputsSaved={inputsSaved}
      runningResearch={runningResearch}
      researchError={researchError}
      onToggleExpanded={() => setExpanded((x) => !x)}
      onEnterEdit={enterEdit}
      onCancelEdit={cancelEdit}
      onFormChange={setForm}
      onSave={handleSave}
      onRunResearch={handleRunResearch}
      onResearchInputChange={(value) => { setResearchInput(value); setInputsSaved(false); }}
      onAuditInputChange={(value) => { setAuditInput(value); setInputsSaved(false); }}
      onSaveInputs={handleSaveInputs}
      onToggleDesignReasoning={() => setShowDesignReasoning((x) => !x)}
      onToggleEvolution={() => setShowEvolution((x) => !x)}
      onGenerateDesign={handleGenerateDesign}
      onUseGeneratedDesign={handleUseGeneratedDesign}
      onDiscardGeneratedDesign={handleDiscardGeneratedDesign}
      onGenerateTasks={handleGenerateTasks}
      onTasksAccepted={() => { setTasksPreview(null); setTasksGenError(null); }}
      onTasksDiscarded={() => { setTasksPreview(null); setTasksGenError(null); }}
      onDelete={handleDelete}
      onArchive={handleArchive}
      onUnarchive={handleUnarchive}
    />
  );
}
