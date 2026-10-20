/**
 * ProjectCreateForm — the CAPTURE form (BACKLOG-01b, Alex, 2026-10-20).
 *
 * THE LOOP: the evening card's "copy reflection prompt" → the chat returns the
 * NEXT PROJECTS in THE BRIEF FORMAT → "paste brief" HERE → review → "create
 * project" (backlog). The capture asks only what Alex knows (ruling A) — the
 * code facts are the audit's job, pasted back on the row. THE CAPTURE'S
 * QUESTIONS, verbatim (src/lib/operations/projectBrief.ts CAPTURE_QUESTIONS),
 * in this order: TITLE · TYPE · BOOK · 1 WHAT IS WRONG TODAY (problem) · 2 WHY
 * IT MATTERS (why) · 3 THE ONE CORRECT OUTCOME (goal) · 4 ALREADY RULED
 * (rulings) · 5 WANT A RECOMMENDATION ON (open_questions) · 6 BY WHEN, AND WHY
 * (the target date and deadline_reason) · PROOF OF DONE (definition_of_done)
 * · SIZE · LINKS · NOTES. Required: title, type, book, 1, 2, 3 — refused by
 * name beside the field before any fetch; a target date requires its reason.
 * The route holds the same rules.
 *
 * "paste brief" (ruling D): a box above the fields takes THE BRIEF FORMAT,
 * parseBrief fills the fields for REVIEW — nothing posts until "create
 * project"; an unknown heading, a bad TYPE or SIZE, or a BOOK matching no
 * entity is refused by name under the box and its field left empty. The box
 * collapses after a fill.
 *
 * One fact, one home (ruling B): the texts are the columns — no ListManager,
 * no *_items (they ride along EMPTY from DEFAULT_PROJECT_FORM for one release;
 * CLEAN-03 rules on dropping). The columns the pipe fills later (design,
 * claude_code_audit_input, estimated_total_*) ride along EMPTY as before.
 *
 * The parent supplies the entity list, the default entity, an onCreated
 * callback (fired after a successful create so the parent can refetch) and
 * onCancel. Book default wiring (unchanged from PD-Strip): `defaultEntityId`
 * seeds the book select while the user has NOT touched it; once picked, their
 * choice is preserved; an empty default leaves it unselected and the book is
 * REQUIRED before submit — the form never silently picks one.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectForm, ProjectSize, ProjectType } from './types';
import { DEFAULT_PROJECT_FORM, PROJECT_SIZES, PROJECT_TYPES, SIZE_LABELS, TYPE_LABELS } from './types';
import { captureQuestion, parseBrief } from '@/lib/operations/projectBrief';


interface Entity {
  id: string;
  name: string;
}

interface Props {
  entities: Entity[];
  /** Entity to default the dropdown to ('' = none/All → book required before submit). */
  defaultEntityId: string;
  /** Fired after a successful project create (parent refetches its list). */
  onCreated: () => void;
  /** Fired when the user cancels (parent hides/collapses the form). */
  onCancel: () => void;
}

/** The fields refused by name next to themselves at submit. */
interface FieldErrors {
  type?: string;
  problem?: string;
  why?: string;
  goal?: string;
  deadline_reason?: string;
}

// PD-Entity: projects are scoped to Business + Personal Finances only — Trading has no
// projects. This is a UI filter on THIS form's dropdown only; the entity records and every
// other surface that uses Trading are untouched (no rename, no delete, no data change).
const isProjectEntity = (name: string) => name.trim().toLowerCase() !== 'trading';

/** LINKS is typed one per line; the list the POST receives holds each non-blank line, trimmed. */
export const splitLinks = (text: string): string[] =>
  text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter((line) => line.length > 0);

export const TYPE_REQUIRED_WORDS = 'type is required — choose one';
export const PROBLEM_REQUIRED_WORDS = '1 WHAT IS WRONG TODAY is required';
export const WHY_REQUIRED_WORDS = '2 WHY IT MATTERS is required';
export const GOAL_REQUIRED_WORDS = '3 THE ONE CORRECT OUTCOME is required';
export const REASON_REQUIRED_WORDS = 'the reason is required when a date is set';
export const BOOK_REQUIRED_WORDS = 'Book is required — select one above.';
export const BRIEF_FILLED_WORDS = 'filled from the brief — review, then create project';

export default function ProjectCreateForm({ entities, defaultEntityId, onCreated, onCancel }: Props & { }) {
  // The options offered for project creation — Trading filtered out (display-only).
  const selectableEntities = useMemo(
    () => entities.filter((e) => isProjectEntity(e.name)),
    [entities]
  );
  // Clamp an incoming entity id to a selectable (non-Trading) one — a Trading page-filter
  // default must not pre-select / submit Trading. No selectable → '' (the required "— select —").
  const resolveEntityId = (id: string) =>
    selectableEntities.some((e) => e.id === id) ? id : (selectableEntities[0]?.id ?? '');

  const [createForm, setCreateForm] = useState<ProjectForm>({
    ...DEFAULT_PROJECT_FORM,
    entity_id: resolveEntityId(defaultEntityId),
  });
  // The links as typed (one per line); createForm.links is the split list.
  const [linksText, setLinksText] = useState('');
  const [entityTouched, setEntityTouched] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // "paste brief": the box, its text, what it refused, and the word after a fill.
  const [briefOpen, setBriefOpen] = useState(true);
  const [briefText, setBriefText] = useState('');
  const [briefRefused, setBriefRefused] = useState<string[]>([]);
  const [briefWords, setBriefWords] = useState<string | null>(null);

  // While the entity field is untouched, track the parent's default (e.g. the page-level
  // entity filter changing) — clamped to a selectable (non-Trading) entity. Once the user
  // picks an entity, never overwrite their choice.
  useEffect(() => {
    if (entityTouched) return;
    const resolved = selectableEntities.some((e) => e.id === defaultEntityId)
      ? defaultEntityId
      : (selectableEntities[0]?.id ?? '');
    setCreateForm((f) => (f.entity_id === resolved ? f : { ...f, entity_id: resolved }));
  }, [defaultEntityId, entityTouched, selectableEntities]);

  // "fill from brief": THE BRIEF FORMAT → the fields, for review. Nothing posts.
  const fillFromBrief = () => {
    const { form: filled, refused } = parseBrief(briefText, selectableEntities);
    setCreateForm((f) => ({ ...f, ...filled }));
    if (filled.links !== undefined) setLinksText(filled.links.join('\n'));
    if (filled.entity_id !== undefined) setEntityTouched(true);
    setBriefRefused(refused);
    setFieldErrors({});
    setBriefWords(BRIEF_FILLED_WORDS);
    setBriefOpen(false);
  };

  // The create action. POSTs the full ProjectForm — design / claude_code_audit_input /
  // estimated_total_* and the *_items ride along EMPTY (from DEFAULT_PROJECT_FORM) and are
  // optional server-side. Auth + validation are the route's; the required capture fields
  // are refused here first, by name, next to the field.
  const handleCreate = async () => {
    const errors: FieldErrors = {};
    if (!createForm.type) errors.type = TYPE_REQUIRED_WORDS;
    if (createForm.problem.trim().length === 0) errors.problem = PROBLEM_REQUIRED_WORDS;
    if (createForm.why.trim().length === 0) errors.why = WHY_REQUIRED_WORDS;
    if (createForm.goal.trim().length === 0) errors.goal = GOAL_REQUIRED_WORDS;
    if (createForm.target_completion_date.length > 0 && createForm.deadline_reason.trim().length === 0) errors.deadline_reason = REASON_REQUIRED_WORDS;
    setFieldErrors(errors);
    if (!createForm.entity_id) {
      setCreateError(BOOK_REQUIRED_WORDS);
      return;
    }
    if (Object.keys(errors).length > 0) return;
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
    'w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20';
  const labelClass = 'text-gray-400 uppercase tracking-wide mb-1 text-[10px] font-medium';
  const questionClass = 'text-gray-500 mb-1 text-[11px]';
  const fieldErrorClass = 'mt-1 text-[10px] text-red-700';

  /** A field: the label (uppercase, the existing style), the question under it, the control, its refusal. */
  const field = (key: string, control: React.ReactNode, error?: string, className = '') => {
    const q = captureQuestion(key);
    return (
      <div className={className} data-capture-field={key}>
        <div className={labelClass}>{q.label}</div>
        {q.question && <div className={questionClass} data-capture-question={key}>{q.question}</div>}
        {control}
        {error && <div className={fieldErrorClass} data-capture-error={key}>{error}</div>}
      </div>
    );
  };
  const textarea = (key: 'problem' | 'why' | 'goal' | 'rulings' | 'open_questions' | 'definition_of_done' | 'notes', rows: number, clearError?: keyof FieldErrors) => (
    <textarea
      value={createForm[key]}
      onChange={(e) => {
        setCreateForm({ ...createForm, [key]: e.target.value });
        if (clearError && e.target.value.trim().length > 0) setFieldErrors((f) => ({ ...f, [clearError]: undefined }));
      }}
      className={inputClass}
      rows={rows}
      maxLength={4000}
      aria-label={captureQuestion(key).label}
    />
  );

  return (
    <div
      className="mb-4 rounded-md border border-gray-200 border-l-4 bg-white p-3 sm:p-4 text-xs space-y-3 shadow-sm"
      style={{ borderLeftColor: '#6B46C1' }}
      data-capture-form
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-bold text-gray-900">New project</div>
        <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#6B46C1' }}>CAPTURE — what only you know</div>
      </div>

      {/* paste brief — THE BRIEF FORMAT in, the fields filled for review. */}
      {briefOpen ? (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 space-y-2" data-capture-brief>
          <div className="flex items-baseline justify-between gap-2">
            <div className={labelClass}>paste brief</div>
            <button type="button" onClick={() => setBriefOpen(false)} className="text-[10px] text-gray-500 hover:text-gray-800">hide</button>
          </div>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            className={inputClass}
            rows={6}
            placeholder="THE BRIEF FORMAT — TITLE: · TYPE: · BOOK: · SIZE: · TARGET:, then the sections under their headings"
            aria-label="Brief"
          />
          <button
            type="button"
            onClick={fillFromBrief}
            disabled={briefText.trim().length === 0}
            className="px-2 py-1 text-xs border border-brand-purple text-brand-purple rounded hover:bg-purple-50 disabled:opacity-50"
            data-capture-fill
          >
            fill from brief
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setBriefOpen(true)} className="text-[10px] text-brand-purple hover:underline" data-capture-brief-open>
          paste brief
        </button>
      )}
      {briefWords && <div className="text-[10px] text-gray-500" data-capture-brief-words>{briefWords}</div>}
      {briefRefused.length > 0 && (
        <ul className="text-[10px] text-red-700 list-disc list-inside" data-capture-brief-refused>
          {briefRefused.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {createError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-capture-error="form">
          {createError}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('title', (
          <input
            type="text"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            className={inputClass}
            maxLength={500}
            aria-label="Title"
          />
        ), undefined, 'col-span-2')}
        {field('type', (
          <select
            value={createForm.type}
            onChange={(e) => {
              setCreateForm({ ...createForm, type: e.target.value as ProjectType | '' });
              if (e.target.value) setFieldErrors((f) => ({ ...f, type: undefined }));
            }}
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
        ), fieldErrors.type)}
        {field('book', (
          <select
            value={createForm.entity_id}
            onChange={(e) => {
              setEntityTouched(true);
              setCreateForm({ ...createForm, entity_id: e.target.value });
            }}
            className={inputClass}
            aria-label="Book"
          >
            <option value="">— select —</option>
            {selectableEntities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        ))}
        {field('problem', textarea('problem', 3, 'problem'), fieldErrors.problem, 'col-span-2')}
        {field('why', textarea('why', 3, 'why'), fieldErrors.why, 'col-span-2')}
        {field('goal', textarea('goal', 3, 'goal'), fieldErrors.goal, 'col-span-2')}
        {field('rulings', textarea('rulings', 3), undefined, 'col-span-2')}
        {field('open_questions', textarea('open_questions', 3), undefined, 'col-span-2')}
        {field('by_when', (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div data-capture-field="target_completion_date">
              <input
                type="date"
                value={createForm.target_completion_date}
                onChange={(e) => setCreateForm({ ...createForm, target_completion_date: e.target.value })}
                className={inputClass}
                aria-label="Target date"
              />
            </div>
            <div className="sm:col-span-2" data-capture-field="deadline_reason">
              <textarea
                value={createForm.deadline_reason}
                onChange={(e) => {
                  setCreateForm({ ...createForm, deadline_reason: e.target.value });
                  if (e.target.value.trim().length > 0) setFieldErrors((f) => ({ ...f, deadline_reason: undefined }));
                }}
                className={inputClass}
                rows={2}
                maxLength={500}
                aria-label="Why that date"
              />
            </div>
          </div>
        ), fieldErrors.deadline_reason, 'col-span-2')}
        {field('definition_of_done', textarea('definition_of_done', 3), undefined, 'col-span-2')}
        {field('size', (
          <select
            value={createForm.size}
            onChange={(e) => setCreateForm({ ...createForm, size: e.target.value as ProjectSize | '' })}
            className={inputClass}
            aria-label="Size"
          >
            <option value="">— not sized —</option>
            {PROJECT_SIZES.map((s) => (
              <option key={s} value={s}>
                {SIZE_LABELS[s]}
              </option>
            ))}
          </select>
        ))}
        {field('links', (
          <textarea
            value={linksText}
            onChange={(e) => {
              setLinksText(e.target.value);
              setCreateForm({ ...createForm, links: splitLinks(e.target.value) });
            }}
            className={inputClass}
            rows={2}
            aria-label="Links"
          />
        ), undefined, 'col-span-2')}
        {field('notes', textarea('notes', 2), undefined, 'col-span-2')}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={handleCreate}
          disabled={createSaving}
          className={`px-3 py-1.5 text-xs font-medium border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
        >
          {createSaving ? 'creating…' : 'create project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={createSaving}
          className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
