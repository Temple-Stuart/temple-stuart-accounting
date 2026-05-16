/**
 * src/components/workbench/operations/SectionD_ProjectBacklog.tsx
 *
 * Section D · Project Backlog — entity-scoped list of operations_projects
 * with full Bridgewater 5-step scoping (goal/problem/diagnosis/design)
 * required on create. Step 5 (execute) = tasks, ships in PR-Ops-3b.
 *
 * Reads selectedEntityId from useOperationsEntity() context. Filters the
 * project list fetch by ?entity_id when an entity is selected; passes
 * nothing when "All" is selected (returns user's full backlog across all
 * entities).
 *
 * "+ new project" affordance at the top right toggles an inline create
 * form ABOVE the list (matches COA management table's add pattern).
 */

'use client';

import { useEffect, useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import ProjectRow from './projects/ProjectRow';
import ListManager from './projects/ListManager';
import AITaskPreview, { type AIGeneratedTask } from './projects/AITaskPreview';
import type { Project, ProjectForm } from './projects/types';
import { DEFAULT_PROJECT_FORM } from './projects/types';
import InspectionDrawer, { type InspectionData } from './ai/InspectionDrawer';

interface Entity {
  id: string;
  name: string;
  is_default?: boolean;
}

export default function SectionD_ProjectBacklog() {
  const { entities, selectedEntityId } = useOperationsEntity();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ProjectForm>(DEFAULT_PROJECT_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Lifted target state for cross-row navigation. When a dependency in
  // ProjectRow A is clicked, this is set to the target project's id;
  // ProjectRow B's useEffect on isJumpTarget triggers scroll + expand.
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

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
    cancelCreate();
    fetchProjects();
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedEntityId
        ? `/api/operations/projects?entity_id=${encodeURIComponent(selectedEntityId)}`
        : '/api/operations/projects';
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load projects');
        setProjects([]);
        return;
      }
      setProjects(body.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId]);

  const startCreate = () => {
    // Default the new project's entity to the currently-selected one, or the
    // first available entity if "All" is selected.
    const initialEntity =
      selectedEntityId ?? entities.find((e) => e.is_default)?.id ?? entities[0]?.id ?? '';
    setCreateForm({ ...DEFAULT_PROJECT_FORM, entity_id: initialEntity });
    setCreateError(null);
    setShowCreate(true);
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setCreateForm(DEFAULT_PROJECT_FORM);
    setCreateError(null);
  };

  const handleCreate = async () => {
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
      cancelCreate();
      fetchProjects();
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
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          D · PROJECT BACKLOG
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-text-muted">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
          {!showCreate && (
            <button
              type="button"
              onClick={startCreate}
              disabled={entities.length === 0}
              className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              + new project
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono mb-3 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
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
                onChange={(e) => setCreateForm({ ...createForm, entity_id: e.target.value })}
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
              verbPrefix="I DID NOT "
              altVerbPrefix="I HAVE NOT "
              placeholder="create an FSA ID yet"
              disabled={createSaving}
            />
          </div>
          <div>
            <div className={labelClass}>3 · diagnosis — root cause</div>
            <ListManager
              items={createForm.diagnosisItems}
              onChange={(next) => setCreateForm({ ...createForm, diagnosisItems: next })}
              verbPrefix="I NEED TO "
              placeholder="complete personal tax return first"
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
                (no design yet — fill in goal/problem/diagnosis items above, then click "↑ generate plan")
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
              onClick={cancelCreate}
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
      )}

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="text-xs font-mono text-text-muted">
          {selectedEntityId
            ? 'no projects for this entity yet — click "+ new project" to scope your first one.'
            : 'no projects yet — click "+ new project" to scope your first one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              entities={entities}
              allProjects={projects}
              onUpdate={fetchProjects}
              onDelete={fetchProjects}
              isJumpTarget={targetProjectId === p.id}
              onClearTarget={() => setTargetProjectId(null)}
              onJumpTo={setTargetProjectId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
