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
import DependencyList from './DependencyList';

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
    goal: p.goal,
    problem: p.problem,
    diagnosis: p.diagnosis,
    design: p.design,
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
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
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

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';
  const pillClass = `inline-block px-2 py-0.5 border rounded text-xs font-mono ${STATUS_PILL_CLASSES[project.status]}`;

  return (
    <div
      ref={rowRef}
      className={
        'border rounded bg-white transition-colors ' +
        (flash ? 'border-brand-purple shadow-md' : 'border-border')
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
            <div className="text-text-primary whitespace-pre-wrap">{project.goal}</div>
          </div>
          <div>
            <div className={labelClass}>2 · problem</div>
            <div className="text-text-primary whitespace-pre-wrap">{project.problem}</div>
          </div>
          <div>
            <div className={labelClass}>3 · diagnosis</div>
            <div className="text-text-primary whitespace-pre-wrap">{project.diagnosis}</div>
          </div>
          <div>
            <div className={labelClass}>4 · design</div>
            <div className="text-text-primary whitespace-pre-wrap">{project.design}</div>
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>5 · execute (tasks)</div>
            <TaskList projectId={project.id} />
          </div>
          <div className="pt-2 border-t border-border-light">
            <div className={labelClass}>6 · dependencies</div>
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
            <textarea
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>2 · problem — gap between current and goal</div>
            <textarea
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>3 · diagnosis — root cause of the gap</div>
            <textarea
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>4 · design — the plan</div>
            <textarea
              value={form.design}
              onChange={(e) => setForm({ ...form, design: e.target.value })}
              rows={3}
              className={inputClass}
            />
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
