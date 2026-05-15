/**
 * AITaskPreview — editable preview of an AI-generated task array.
 *
 * Lifecycle:
 *   1. Parent calls generateProjectTasks (via an endpoint) and receives
 *      { tasks, usageId (= source_ai_usage_id), inspection, ... }.
 *   2. Parent renders <AITaskPreview tasks={...} sourceAiUsageId={usageId}
 *      projectId={...} onAccepted={...} onDiscarded={...}
 *      inspection={...} />.
 *   3. User reviews — edits any task inline. The full institutional notes
 *      and the verified link_url are visible for every task.
 *   4. User clicks "Accept all" → POST /bulk-create with the edited array;
 *      onAccepted fires with the persisted task rows so the parent can
 *      refresh TaskList.
 *   5. User clicks "Discard" → onDiscarded fires; nothing persists.
 *
 * Truth-first: this component IS the explicit acceptance gate. The AI
 * synthesis already happened upstream; this is the human-in-the-loop
 * step. The InspectionDrawer (when inspection prop is provided) lets
 * the operator audit exactly what prompt produced this output before
 * accepting.
 *
 * No partial acceptance — accept all (after edits) or discard. Reorder /
 * status / additional fields are post-acceptance affordances on TaskRow.
 */

'use client';

import { useState } from 'react';
import InspectionDrawer, { type InspectionData } from '../ai/InspectionDrawer';

export interface AIGeneratedTask {
  title: string;
  description: string;
  link_url: string | null;
  notes: string | null;
  suggested_order: number;
}

interface Props {
  tasks: AIGeneratedTask[];
  sourceAiUsageId: string;
  projectId: string;
  onAccepted: (createdTasks: unknown[]) => void;
  onDiscarded: () => void;
  inspection?: InspectionData;
  /**
   * When provided, the accept button bypasses the bulk-create POST and
   * delegates persistence entirely to the caller. Used by SectionD's
   * preview-before-create flow, where the project row does not yet
   * exist and the caller must create the project first, then bulk-
   * create tasks against the returned id.
   */
  onAcceptStateless?: (
    tasks: AIGeneratedTask[],
    sourceAiUsageId: string
  ) => Promise<void>;
}

interface EditableTask {
  title: string;
  description: string;
  link_url: string;
  notes: string;
  suggested_order: number;
}

function toEditable(t: AIGeneratedTask): EditableTask {
  return {
    title: t.title,
    description: t.description,
    link_url: t.link_url ?? '',
    notes: t.notes ?? '',
    suggested_order: t.suggested_order,
  };
}

export default function AITaskPreview({
  tasks,
  sourceAiUsageId,
  projectId,
  onAccepted,
  onDiscarded,
  inspection,
  onAcceptStateless,
}: Props) {
  const [editable, setEditable] = useState<EditableTask[]>(() =>
    tasks.map(toEditable).sort((a, b) => a.suggested_order - b.suggested_order)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTask = (i: number, patch: Partial<EditableTask>) => {
    setEditable((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const handleAcceptAll = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const editedTasks: AIGeneratedTask[] = editable.map((t) => ({
        title: t.title.trim(),
        description: t.description.trim(),
        link_url: t.link_url.trim() || null,
        notes: t.notes.trim() || null,
        suggested_order: t.suggested_order,
      }));

      if (onAcceptStateless) {
        await onAcceptStateless(editedTasks, sourceAiUsageId);
        return;
      }

      const payload = {
        source_ai_usage_id: sourceAiUsageId,
        tasks: editedTasks.map((t) => ({
          title: t.title,
          description: t.description || null,
          link_url: t.link_url,
          notes: t.notes,
          suggested_order: t.suggested_order,
        })),
      };
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks/bulk-create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to accept');
        return;
      }
      onAccepted(body.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to accept');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  return (
    <div className="space-y-3 border border-brand-purple rounded p-4 bg-purple-50/30">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono font-bold text-text-primary">
          AI-generated tasks — {editable.length} {editable.length === 1 ? 'task' : 'tasks'} (review and edit before accepting)
        </div>
        <div className="text-xs font-mono text-text-muted">
          source: ai_usage_id <span className="text-text-faint">{sourceAiUsageId.slice(0, 8)}…</span>
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {editable.map((t, i) => (
          <div key={i} className="border border-border-light rounded p-3 bg-white space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <div className="text-text-faint">
                #{i + 1} · suggested_order {t.suggested_order}
              </div>
              <input
                type="number"
                min={0}
                value={t.suggested_order}
                onChange={(e) => updateTask(i, { suggested_order: Number(e.target.value) || 0 })}
                className="w-16 px-2 py-0.5 border border-border rounded text-xs font-mono"
                title="suggested order (0-indexed)"
              />
            </div>

            <div>
              <div className={labelClass}>title</div>
              <input
                type="text"
                value={t.title}
                onChange={(e) => updateTask(i, { title: e.target.value })}
                className={inputClass}
                maxLength={500}
              />
            </div>

            <div>
              <div className={labelClass}>description</div>
              <textarea
                value={t.description}
                onChange={(e) => updateTask(i, { description: e.target.value })}
                rows={3}
                className={inputClass}
                maxLength={2000}
              />
            </div>

            <div>
              <div className={labelClass}>link url (verified by web search)</div>
              <input
                type="url"
                value={t.link_url}
                onChange={(e) => updateTask(i, { link_url: e.target.value })}
                className={inputClass}
                maxLength={500}
                placeholder="https://..."
              />
            </div>

            <div>
              <div className={labelClass}>notes (institutional context, {t.notes.length}/1500 chars)</div>
              <textarea
                value={t.notes}
                onChange={(e) => updateTask(i, { notes: e.target.value })}
                rows={6}
                className={inputClass}
                maxLength={1500}
                placeholder="dependencies, timing anchors, decision points, gotchas..."
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={handleAcceptAll}
          disabled={submitting}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'creating…' : `accept all ${editable.length} ${editable.length === 1 ? 'task' : 'tasks'}`}
        </button>
        <button
          type="button"
          onClick={onDiscarded}
          disabled={submitting}
          className="px-3 py-1 border border-border rounded text-xs font-mono hover:bg-bg-row disabled:opacity-50"
        >
          discard
        </button>
      </div>

      {inspection && <InspectionDrawer data={inspection} />}
    </div>
  );
}
