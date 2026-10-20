/**
 * ProjectCreateForm — the CAPTURE form (BACKLOG-01, Alex, 2026-10-20).
 *
 * "The 'New project' form becomes the CAPTURE form." A project is captured
 * with its TITLE, its TYPE (engineering · accounting · content · travel · ops
 * — required), its BOOK (the entity select — required; Trading filtered out as
 * before; no default: an unselected book refuses), its WHY (the problem it
 * solves, or the value — a paragraph, required), and optionally its SIZE
 * (small · medium · large — "not sized" when left), its DEFINITION OF DONE,
 * its LINKS (one per line — a doc path or a url), its NOTES and a TARGET DATE.
 * It lands in the BACKLOG — the POST sets the status. The Dalio loop (goal ·
 * problem · diagnosis · design) is "scope it": the row's edit view, which
 * already has it — the goal ListManager and its "I WANT to " prefix left this
 * file (ruling A), and the POST no longer requires goal items.
 *
 * It owns ONLY the create submit (POST /api/operations/projects). The columns
 * the pipe fills later (design, claude_code_audit_input, estimated_total_*)
 * ride along EMPTY from DEFAULT_PROJECT_FORM, as before (PD-Strip). A submit
 * without a type or a why is refused here by name, next to the field; the
 * route holds the same rule and refuses by name too.
 *
 * The parent supplies the entity list, the default entity, an onCreated
 * callback (fired after a successful create so the parent can refetch) and
 * onCancel.
 *
 * Book default wiring (unchanged from PD-Strip): `defaultEntityId` seeds the
 * book select. While the user has NOT touched it, a change to `defaultEntityId`
 * (the page's entity selector changing) updates the default; once the user
 * picks a book, their choice is preserved. An empty `defaultEntityId` leaves it
 * unselected and the book becomes REQUIRED before submit — the form never
 * silently picks one.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectForm, ProjectSize, ProjectType } from './types';
import { DEFAULT_PROJECT_FORM, PROJECT_SIZES, PROJECT_TYPES, SIZE_LABELS, TYPE_LABELS } from './types';


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

/** The two fields refused by name next to themselves when empty at submit. */
interface FieldErrors {
  type?: string;
  why?: string;
}

// PD-Entity: projects are scoped to Business + Personal Finances only — Trading has no
// projects. This is a UI filter on THIS form's dropdown only; the entity records and every
// other surface that uses Trading are untouched (no rename, no delete, no data change).
const isProjectEntity = (name: string) => name.trim().toLowerCase() !== 'trading';

/** LINKS is typed one per line; the list the POST receives holds each non-blank line, trimmed. */
export const splitLinks = (text: string): string[] =>
  text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter((line) => line.length > 0);

export const TYPE_REQUIRED_WORDS = 'type is required — choose one';
export const WHY_REQUIRED_WORDS = 'why is required — the problem it solves, or the value';
export const BOOK_REQUIRED_WORDS = 'Book is required — select one above.';

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

  // The create action. POSTs the full ProjectForm — design / claude_code_audit_input /
  // estimated_total_* ride along EMPTY (from DEFAULT_PROJECT_FORM) and are optional
  // server-side; the pipe + edit view fill them later. Auth + validation are the route's;
  // the two required capture fields are refused here first, by name, next to the field.
  const handleCreate = async () => {
    const errors: FieldErrors = {};
    if (!createForm.type) errors.type = TYPE_REQUIRED_WORDS;
    if (createForm.why.trim().length === 0) errors.why = WHY_REQUIRED_WORDS;
    setFieldErrors(errors);
    if (!createForm.entity_id) {
      setCreateError(BOOK_REQUIRED_WORDS);
      return;
    }
    if (errors.type || errors.why) return;
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
  const fieldErrorClass = 'mt-1 text-[10px] text-red-700';

  return (
    <div
      className="mb-4 rounded-md border border-gray-200 border-l-4 bg-white p-3 sm:p-4 text-xs space-y-3 shadow-sm"
      style={{ borderLeftColor: '#6B46C1' }}
      data-capture-form
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-bold text-gray-900">New project</div>
        <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#6B46C1' }}>CAPTURE — scope it on the row</div>
      </div>

      {createError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-capture-error="form">
          {createError}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2" data-capture-field="title">
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
        <div data-capture-field="type">
          <div className={labelClass}>type</div>
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
          {fieldErrors.type && <div className={fieldErrorClass} data-capture-error="type">{fieldErrors.type}</div>}
        </div>
        <div data-capture-field="book">
          <div className={labelClass}>book</div>
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
        </div>
        <div className="col-span-2" data-capture-field="why">
          <div className={labelClass}>why</div>
          <textarea
            value={createForm.why}
            onChange={(e) => {
              setCreateForm({ ...createForm, why: e.target.value });
              if (e.target.value.trim().length > 0) setFieldErrors((f) => ({ ...f, why: undefined }));
            }}
            className={inputClass}
            rows={3}
            maxLength={4000}
            placeholder="the problem it solves, or the value — a paragraph"
            aria-label="Why"
          />
          {fieldErrors.why && <div className={fieldErrorClass} data-capture-error="why">{fieldErrors.why}</div>}
        </div>
        <div data-capture-field="size">
          <div className={labelClass}>size (optional)</div>
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
        </div>
        <div className="col-span-2" data-capture-field="definition_of_done">
          <div className={labelClass}>definition of done (optional)</div>
          <textarea
            value={createForm.definition_of_done}
            onChange={(e) => setCreateForm({ ...createForm, definition_of_done: e.target.value })}
            className={inputClass}
            rows={2}
            placeholder="how we will know it is done"
            aria-label="Definition of done"
          />
        </div>
        <div className="col-span-2" data-capture-field="links">
          <div className={labelClass}>links (optional — one per line)</div>
          <textarea
            value={linksText}
            onChange={(e) => {
              setLinksText(e.target.value);
              setCreateForm({ ...createForm, links: splitLinks(e.target.value) });
            }}
            className={inputClass}
            rows={2}
            placeholder="a doc path or a url, one per line"
            aria-label="Links"
          />
        </div>
        <div className="col-span-2" data-capture-field="notes">
          <div className={labelClass}>notes (optional)</div>
          <textarea
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            className={inputClass}
            rows={2}
            aria-label="Notes"
          />
        </div>
        <div data-capture-field="target_completion_date">
          <div className={labelClass}>target date (optional)</div>
          <input
            type="date"
            value={createForm.target_completion_date}
            onChange={(e) => setCreateForm({ ...createForm, target_completion_date: e.target.value })}
            className={inputClass}
          />
        </div>
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
