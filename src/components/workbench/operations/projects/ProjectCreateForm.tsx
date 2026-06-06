/**
 * ProjectCreateForm — the REAL, server-backed project create form, extracted
 * verbatim from SectionD_ProjectBacklog so it can be mounted both there and on
 * the Content tab's "0 · CREATE" section (one source of truth).
 *
 * Owns its own submit (POST /api/operations/projects) and the paid AI design /
 * tasks-preview flow (POST /api/operations/ai/generate-design,
 * /api/operations/ai/generate-tasks, then /tasks/bulk-create) — all unchanged
 * from the original inline form. The parent supplies the entity list, the
 * default entity, and an onCreated callback (fired after a successful create so
 * the parent can refetch) plus onCancel (fired when the user cancels).
 *
 * Entity default wiring: `defaultEntityId` seeds the entity dropdown. While the
 * user has NOT touched the entity field, a change to `defaultEntityId` (e.g. the
 * page-level entity filter changing) updates the default; once the user picks an
 * entity, their choice is preserved. An empty `defaultEntityId` ("All" / none)
 * leaves the dropdown unselected and entity becomes REQUIRED before submit — the
 * form never silently picks one.
 */

'use client';

import { useEffect, useState } from 'react';
import ListManager from './ListManager';
import AITaskPreview, { type AIGeneratedTask } from './AITaskPreview';
import type { ProjectForm } from './types';
import { DEFAULT_PROJECT_FORM } from './types';
import InspectionDrawer, { type InspectionData } from '../ai/InspectionDrawer';

interface Entity {
  id: string;
  name: string;
}

interface Props {
  entities: Entity[];
  /** Entity to default the dropdown to ('' = none/All → entity required before submit). */
  defaultEntityId: string;
  /** Fired after a successful project create (parent refetches its list). */
  onCreated: () => void;
  /** Fired when the user cancels (parent hides/collapses the form). */
  onCancel: () => void;
}

export default function ProjectCreateForm({ entities, defaultEntityId, onCreated, onCancel }: Props) {
  const [createForm, setCreateForm] = useState<ProjectForm>({
    ...DEFAULT_PROJECT_FORM,
    entity_id: defaultEntityId,
  });
  const [entityTouched, setEntityTouched] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [generatingCreateDesign, setGeneratingCreateDesign] = useState(false);
  const [createDesignPreview, setCreateDesignPreview] = useState<string | null>(null);
  const [createDesignError, setCreateDesignError] = useState<string | null>(null);
  const [createDesignCost, setCreateDesignCost] = useState<
    { cost_usd: string; input_tokens: number; output_tokens: number } | null
  >(null);
  const [createDesignInspection, setCreateDesignInspection] = useState<{
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    userMessage: string;
    rawResponse: string;
    usageId: string;
  } | null>(null);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksPreview, setTasksPreview] = useState<{
    tasks: AIGeneratedTask[];
    sourceAiUsageId: string;
    inspection?: InspectionData;
  } | null>(null);

  // While the entity field is untouched, track the parent's default (e.g. the
  // page-level entity filter changing). Once the user picks an entity, never
  // overwrite their choice.
  useEffect(() => {
    if (!entityTouched) {
      setCreateForm((f) =>
        f.entity_id === defaultEntityId ? f : { ...f, entity_id: defaultEntityId }
      );
    }
  }, [defaultEntityId, entityTouched]);

  const handleGenerateCreateDesign = async () => {
    const title = createForm.title?.trim() ?? '';
    if (
      title.length === 0 ||
      createForm.goalItems.length === 0 ||
      createForm.problemItems.length === 0 ||
      createForm.diagnosisItems.length === 0
    ) {
      setCreateDesignError('Title, goal, problem, and diagnosis are all required (with at least one item each).');
      return;
    }

    setGeneratingCreateDesign(true);
    setCreateDesignError(null);
    setCreateDesignPreview(null);
    setCreateDesignCost(null);
    setCreateDesignInspection(null);
    try {
      const res = await fetch('/api/operations/ai/generate-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          goalItems: createForm.goalItems,
          problemItems: createForm.problemItems,
          diagnosisItems: createForm.diagnosisItems,
          auditInput: createForm.claude_code_audit_input,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateDesignError(body?.message ?? body?.error ?? 'failed to generate design');
        return;
      }
      setCreateDesignPreview(body.generated_design);
      setCreateDesignCost({
        cost_usd: body.cost_usd,
        input_tokens: body.input_tokens,
        output_tokens: body.output_tokens,
      });
      if (body.inspection) {
        setCreateDesignInspection({
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
      setCreateDesignError(e instanceof Error ? e.message : 'failed to generate design');
    } finally {
      setGeneratingCreateDesign(false);
    }
  };

  const isFormValidForAI = () => {
    const title = createForm.title?.trim() ?? '';
    return (
      title.length > 0 &&
      createForm.goalItems.length > 0 &&
      createForm.problemItems.length > 0 &&
      createForm.diagnosisItems.length > 0
    );
  };

  const handleGenerateTasksPreview = async () => {
    if (!isFormValidForAI()) {
      setTasksError(
        'Title, goal, problem, and diagnosis are all required (with at least one item each).'
      );
      return;
    }

    setTasksError(null);
    setTasksPreview(null);
    setTasksLoading(true);
    try {
      const res = await fetch('/api/operations/ai/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle: createForm.title.trim(),
          goalItems: createForm.goalItems,
          problemItems: createForm.problemItems,
          diagnosisItems: createForm.diagnosisItems,
          auditInput: createForm.claude_code_audit_input,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setTasksError(body?.error ?? 'Failed to generate tasks');
        return;
      }
      const inspection: InspectionData | undefined = body.inspection
        ? {
            model: body.inspection.model,
            temperature: body.inspection.temperature,
            maxTokens: body.inspection.maxTokens,
            systemPrompt: body.inspection.systemPrompt,
            userMessage: body.inspection.userMessage,
            rawResponse: body.inspection.rawResponse,
            inputTokens: body.inputTokens,
            outputTokens: body.outputTokens,
            costUsd: body.costUsd,
            usageId: body.usageId,
          }
        : undefined;
      setTasksPreview({
        tasks: body.tasks,
        sourceAiUsageId: body.usageId,
        inspection,
      });
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : 'Failed to generate tasks');
    } finally {
      setTasksLoading(false);
    }
  };

  const handleAcceptStatelessTasks = async (
    acceptedTasks: AIGeneratedTask[],
    sourceAiUsageId: string
  ) => {
    if (!createForm.entity_id) {
      throw new Error('Entity is required — select one above.');
    }
    const projectRes = await fetch('/api/operations/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });
    const projectBody = await projectRes.json();
    if (!projectRes.ok) {
      throw new Error(
        projectBody?.message ?? projectBody?.error ?? 'failed to create project'
      );
    }
    const newProjectId = projectBody?.project?.id;
    if (!newProjectId) {
      throw new Error('project create response missing project.id');
    }

    const bulkRes = await fetch(
      `/api/operations/projects/${newProjectId}/tasks/bulk-create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_ai_usage_id: sourceAiUsageId,
          tasks: acceptedTasks.map((t) => ({
            title: t.title,
            description: t.description || null,
            link_url: t.link_url,
            notes: t.notes,
            suggested_order: t.suggested_order,
          })),
        }),
      }
    );
    const bulkBody = await bulkRes.json();
    if (!bulkRes.ok) {
      throw new Error(
        bulkBody?.message ?? bulkBody?.error ?? 'failed to bulk-create tasks'
      );
    }

    setTasksPreview(null);
    setTasksError(null);
    onCreated();
  };

  const handleCreate = async () => {
    if (!createForm.entity_id) {
      setCreateError('Entity is required — select one above.');
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/operations/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(body?.message ?? body?.error ?? 'failed to create');
        return;
      }
      onCreated();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'failed to create');
    } finally {
      setCreateSaving(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  return (
    <div className="mb-4 border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
      <div className="font-bold text-text-primary">new project · 5-step scoping required</div>
      {createError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {createError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className={labelClass}>title</div>
          <input
            type="text"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            className={inputClass}
            maxLength={500}
            placeholder="short, distinctive, unique within your projects"
          />
        </div>
        <div>
          <div className={labelClass}>entity</div>
          <select
            value={createForm.entity_id}
            onChange={(e) => {
              setEntityTouched(true);
              setCreateForm({ ...createForm, entity_id: e.target.value });
            }}
            className={inputClass}
          >
            <option value="">— select —</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelClass}>target date (optional)</div>
          <input
            type="date"
            value={createForm.target_completion_date}
            onChange={(e) => setCreateForm({ ...createForm, target_completion_date: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className={labelClass}>1 · goal — what success looks like</div>
        <ListManager
          items={createForm.goalItems}
          onChange={(next) => setCreateForm({ ...createForm, goalItems: next })}
          verbPrefix="I WANT to "
          placeholder="get loans approved"
          disabled={createSaving}
        />
      </div>
      <div>
        <div className={labelClass}>2 · problem — gap between current and goal</div>
        <ListManager
          items={createForm.problemItems}
          onChange={(next) => setCreateForm({ ...createForm, problemItems: next })}
          verbPrefix="I HAVE NOT "
          altVerbPrefix="I KEEP "
          placeholder="created an FSA ID yet"
          disabled={createSaving}
        />
      </div>
      <div>
        <div className={labelClass}>3 · diagnosis — root cause of the gap</div>
        <ListManager
          items={createForm.diagnosisItems}
          onChange={(next) => setCreateForm({ ...createForm, diagnosisItems: next })}
          verbPrefix="Because "
          altVerbPrefix="The root cause is "
          placeholder="I never blocked dedicated time for it"
          disabled={createSaving}
        />
      </div>
      <div>
        <div className={labelClass}>reality audit (optional — paste Claude Code audit report)</div>
        <textarea
          value={createForm.claude_code_audit_input}
          onChange={(e) => setCreateForm({ ...createForm, claude_code_audit_input: e.target.value })}
          rows={4}
          className="w-full px-2 py-1 bg-white border border-brand-purple/40 rounded text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          placeholder="Paste a codebase audit here so the plan reuses what already exists instead of proposing to rebuild it."
          disabled={createSaving}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className={labelClass}>4 · design — the plan (AI-generated)</div>
          <button
            type="button"
            onClick={handleGenerateCreateDesign}
            disabled={generatingCreateDesign}
            className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs font-mono hover:bg-purple-50 disabled:opacity-50"
            title="Generate institutional-rigor design field from your goal/problem/diagnosis items"
          >
            {generatingCreateDesign ? 'generating…' : '↑ generate plan'}
          </button>
        </div>
        {createForm.design.trim().length > 0 ? (
          <div className="text-text-primary text-xs font-mono whitespace-pre-wrap p-3 bg-white border border-border-light rounded">
            {createForm.design}
          </div>
        ) : (
          <div className="text-text-muted text-xs font-mono italic p-3 bg-bg-row border border-border-light rounded">
            (no design yet — fill in goal/problem/diagnosis items above, then click &quot;↑ generate plan&quot;)
          </div>
        )}
        {createDesignError && (
          <div className="mt-2 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
            {createDesignError}
          </div>
        )}
        {createDesignPreview && (
          <div className="mt-2 border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-2">
            <div className="font-bold text-text-primary flex items-center justify-between">
              <span>AI-generated design (review before saving)</span>
              {createDesignCost && (
                <span className="text-text-muted text-xs font-normal">
                  ${createDesignCost.cost_usd} · {createDesignCost.input_tokens} in · {createDesignCost.output_tokens} out
                </span>
              )}
            </div>
            <div className="text-text-primary whitespace-pre-wrap p-2 bg-white border border-border-light rounded">
              {createDesignPreview}
            </div>
            {createDesignInspection && (
              <InspectionDrawer
                data={{
                  model: createDesignInspection.model,
                  temperature: createDesignInspection.temperature,
                  maxTokens: createDesignInspection.maxTokens,
                  systemPrompt: createDesignInspection.systemPrompt,
                  userMessage: createDesignInspection.userMessage,
                  rawResponse: createDesignInspection.rawResponse,
                  inputTokens: createDesignCost?.input_tokens ?? 0,
                  outputTokens: createDesignCost?.output_tokens ?? 0,
                  costUsd: createDesignCost?.cost_usd ?? '0',
                  usageId: createDesignInspection.usageId,
                }}
              />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateForm({ ...createForm, design: createDesignPreview });
                  setCreateDesignPreview(null);
                  setCreateDesignCost(null);
                  setCreateDesignInspection(null);
                }}
                className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90"
              >
                use this
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateDesignPreview(null);
                  setCreateDesignCost(null);
                  setCreateDesignInspection(null);
                }}
                className="px-3 py-1 border border-border rounded hover:bg-bg-row"
              >
                discard
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>est. minutes (optional)</div>
          <input
            type="number"
            min={0}
            value={createForm.estimated_total_minutes}
            onChange={(e) => setCreateForm({ ...createForm, estimated_total_minutes: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>est. cost usd (optional)</div>
          <input
            type="text"
            value={createForm.estimated_total_cost_usd}
            onChange={(e) => setCreateForm({ ...createForm, estimated_total_cost_usd: e.target.value })}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={handleCreate}
          disabled={createSaving}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {createSaving ? 'creating…' : 'create project'}
        </button>
        <button
          type="button"
          onClick={handleGenerateTasksPreview}
          disabled={tasksLoading || createSaving || !isFormValidForAI()}
          className="px-3 py-1 border border-brand-purple text-brand-purple rounded hover:bg-purple-50 disabled:opacity-50"
          title="Generate AI task array now; review and edit before committing the project + tasks together"
        >
          {tasksLoading ? 'generating…' : '↑ preview tasks'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={createSaving}
          className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          cancel
        </button>
      </div>

      {tasksError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800 text-xs font-mono">
          {tasksError}
        </div>
      )}

      {tasksPreview && (
        <AITaskPreview
          tasks={tasksPreview.tasks}
          sourceAiUsageId={tasksPreview.sourceAiUsageId}
          projectId=""
          onAccepted={() => {}}
          onDiscarded={() => {
            setTasksPreview(null);
            setTasksError(null);
          }}
          inspection={tasksPreview.inspection}
          onAcceptStateless={handleAcceptStatelessTasks}
        />
      )}
    </div>
  );
}
