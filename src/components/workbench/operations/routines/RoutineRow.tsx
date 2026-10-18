/**
 * RoutineRow — one routine in the routines table (RoutineList).
 *
 * ROUTINES-01: a routine is rows, not a card. Its own cell spans its lines'
 * rows (RoutineStepList) and holds the name, the description, the book, the
 * small print (time window, time zone, next due, active dates, fail threshold),
 * the figure per occurrence from the lines leaf, its place, "last done", and
 * its controls: edit · deactivate/reactivate · delete · + line. Nothing
 * collapses. "edit" opens the edit form as a full-width row directly under the
 * routine's rows. "deactivate"/"reactivate" toggles is_active via PATCH. Audit
 * trail shows the discrimination (deactivated as its own action_type;
 * reactivated as generic _updated with metadata.activation_toggle='reactivated').
 *
 * ROUTINE-02b (Alex, 2026-10-18): the edit form's start time is seeded from the
 * rule's own clock (the clock in force; the stored start_time was display only)
 * and byhour/byminute agree with it, so a start-time edit rewrites the rule and
 * moves the routine's history with it (the PATCH's rekey). The start and end
 * times are the builder's now. The routine-level COA select is disabled, and
 * says why, when a line carries the money (LINES-01 — the account goes on each
 * line); otherwise it works, and says beside it that an account needs its
 * amount (INTAKE-01's pair rule, the route's own words) before the save. The
 * book (entity) stays unchangeable: lines, codes and ledger links belong to one
 * book — "to move a routine to another book, end it and create it there".
 *
 * ROUTINE-02a (Alex, 2026-10-18): an ENDED routine (the list's judgement, handed
 * in as `end`) is read-only but for "edit" — to extend the end: no deactivate,
 * no delete, no "+ line", its lines' controls off (RoutineStepList readOnly),
 * "ended <date>" beside its name. Editing a line's amount would change past
 * days' budgets. The small print's "next:" reads "ended <date>" whenever the
 * end is set and nothing remains before it (next_due_at null). The zone is
 * shown as Intl's list spells it, and the edit form is seeded with that
 * spelling, so a stored name that differed only by case is saved canonical on
 * the next edit; a zone Intl cannot read is named in the small print.
 */

'use client';

import { ROLE_FIELD_WORDS, ROLE_SHORT_WORDS, ROLE_TITLE_WORDS, ROLE_WORDS, STOP_ROLES, type StopRole } from '@/lib/operations/stopRole';
import { useState } from 'react';
import type { Routine, RoutineForm } from './types';
import { DEFAULT_ROUTINE_FORM } from './types';
import RRULEBuilder from './RRULEBuilder';
import CoaSelect from './CoaSelect';
import FindThisPlace from './FindThisPlace';
import { AccountText, ROUTINE_TABLE_COLUMNS, RoutineStepList } from './RoutineStepList';
import { ignoredLine, plannedLine, routinePlanned } from '@/lib/operations/routineLines';
import { canonicalZone, clockOfRule, clockWords, isOnceRRule, type RoutineEnd } from '@/lib/operations/rruleHelpers';
import { ACCOUNT_CELL_WORDS, accountCell } from '@/lib/coa/accountCell';
import type { PlaceMatch } from '@/lib/calendar/findPlace';
import type { Entity } from '../EntitySelector';


interface Props {
  routine: Routine;
  /** ROUTINE-02a: the list's judgement — ended (read-only but for edit), or current, with a zone Intl could not read named. */
  end: RoutineEnd;
  /** The tab's entity list (useOperationsEntity) — the book's name and letter. */
  entities: Entity[];
  onUpdate: () => void;
  onDelete: () => void;
}

function routineToForm(r: Routine): RoutineForm {
  // Form fields derived from Routine: we don't reverse-compile RRULE on edit;
  // user is shown the live cadence_mode as 'custom' with the existing rrule
  // pre-populated. They can switch to a structured mode if desired (which
  // overrides the rrule on save).
  // ONEOFF-01: a one-off (COUNT=1) opens as cadence "once" — its date is the
  // one field that matters, and its hour/minute are read back off the rule.
  const once = isOnceRRule(r.schedule_rrule);
  // ROUTINE-02b: the clock in force is the rule's — the start time is seeded from it, and byhour/byminute agree with it.
  const clock = clockOfRule(r.schedule_rrule);
  return {
    ...DEFAULT_ROUTINE_FORM,
    name: r.name,
    description: r.description ?? '',
    entity_id: r.entity_id,
    // ROUTINE-02a: seeded as the list spells it, so the next save stores the canonical name; a name not in the list stays as stored (the select shows it as unlisted).
    timezone: canonicalZone(r.timezone) ?? r.timezone,
    ideal_time_label: r.ideal_time_label ?? '',
    fail_threshold_minutes: String(r.fail_threshold_minutes),
    role: r.role,
    start_date: r.start_date ? r.start_date.slice(0, 10) : '',
    end_date: r.end_date ? r.end_date.slice(0, 10) : '',
    start_time: clock !== null ? clockWords(clock) : r.start_time ? r.start_time.slice(11, 16) : '',
    end_time: r.end_time ? r.end_time.slice(11, 16) : '',
    is_active: r.is_active,
    cadence_mode: once ? 'once' : 'custom',
    custom_rrule: r.schedule_rrule,
    ...(clock !== null ? { byhour: String(clock.hour).padStart(2, '0'), byminute: String(clock.minute).padStart(2, '0') } : {}),
    // HB-4b: pre-fill budget + COA on edit (null → '' empty input/no selection).
    budget_amount: r.budget_amount != null ? String(r.budget_amount) : '',
    coa_code: r.coa_code ?? '',
    // ONEOFF-01: the place, as stored (null → '').
    location: r.location ?? '',
    latitude: r.latitude != null ? String(r.latitude) : '',
    longitude: r.longitude != null ? String(r.longitude) : '',
  };
}

function formatDateTime(iso: string | null, tz: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// HB-4e-style-2: humanize the "active" window's date (display only — same @db.Date value, rendered
// "Jun 1, 2026" not raw ISO "2026-06-01"). Build the Date from the Y-M-D parts so a UTC-midnight
// @db.Date never drifts a day under a negative-offset locale.
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso.slice(0, 10);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// HB-4e-style-2: humanize the intent-time window (display only — "00:00" → "12:00 AM").
function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

/** ROUTINE-02a: the row's words for an end that has passed, or past which nothing remains. */
export const endedWords = (dateWords: string): string => `ended ${dateWords}`;
/** ROUTINE-02b: why the routine-level COA is disabled when a line carries the money. */
export const COA_ON_LINES_WORDS = 'the lines carry the money — set the account on each line';
/** ROUTINE-02b: the pair rule, said beside the select before the save (planMoney.ts's own words). */
export const COA_NEEDS_AMOUNT_WORDS = 'an account needs its amount — enter the amount, or clear the account';
/** ROUTINE-02b: the book is not changeable — lines, codes and ledger links belong to one book. */
export const BOOK_FIXED_WORDS = 'to move a routine to another book, end it and create it there';

export default function RoutineRow({ routine, end, entities, onUpdate, onDelete }: Props & { }) {
  // LINES-01: ONE leaf decides the routine's figure. Read here, rendered below.
  const planned = routinePlanned({ budget_amount: routine.budget_amount ?? null, coa_code: routine.coa_code ?? null, steps: routine.steps });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RoutineForm>(() => routineToForm(routine));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ONEOFF-01: the place picked from a lookup while editing.
  const [picked, setPicked] = useState<PlaceMatch | null>(null);
  const onceForm = form.cadence_mode === 'once';

  const enterEdit = () => {
    setForm(routineToForm(routine));
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setForm(routineToForm(routine));
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          start_date: form.start_date || null,
          // ONEOFF-01: a one-off's window is its day.
          end_date: onceForm ? (form.start_date || null) : (form.end_date || null),
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          // ONEOFF-01: the place; '' → null, never 0.
          location: form.location || null,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
        }),
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

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !routine.is_active }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to toggle');
        return;
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete routine "${routine.name}"? All completion history will also be deleted.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

  // ROUTINES-01: the routine's own cell — the first cell of its first row,
  // spanning every row of its lines (RoutineStepList draws them).
  const book = entities.find((e) => e.id === routine.entity_id);
  const routineCell = (rowSpan: number, addLine: (() => void) | null) => (
    <td rowSpan={rowSpan} className="px-2 py-1.5 align-top border-t border-border-light w-64 min-w-[16rem]" data-routine-cell>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold text-text-primary">{routine.name}</span>
        {!routine.is_active && (
          <span className="px-2 py-0.5 border rounded text-xs bg-gray-100 text-gray-600 border-gray-300">
            inactive
          </span>
        )}
        {end.ended && (
          <span className="px-2 py-0.5 border rounded text-xs bg-gray-100 text-gray-600 border-gray-300" data-routine-ended>
            {endedWords(formatDate(end.day))}
          </span>
        )}
      </div>
      {routine.description && (
        <div className="text-text-secondary whitespace-pre-wrap">{routine.description}</div>
      )}
      <div className="text-text-muted" data-routine-book>{book ? book.name : ACCOUNT_CELL_WORDS.bookNotLoaded}</div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-text-muted" data-routine-small-print>
        {(routine.start_time || routine.end_time) && (
          <span title="intent time window">
            {(() => {
              const startStr = routine.start_time ? formatTime12h(routine.start_time.slice(11, 16)) : null;
              const endStr = routine.end_time ? formatTime12h(routine.end_time.slice(11, 16)) : null;
              if (startStr && endStr) return `${startStr} – ${endStr}`;
              if (startStr) return `from ${startStr}`;
              if (endStr) return `until ${endStr}`;
              return '';
            })()}
          </span>
        )}
        <span title="time zone" data-routine-zone>{canonicalZone(routine.timezone) ?? routine.timezone}</span>
        {!end.ended && end.reason !== null && (
          <span className="text-amber-800" data-routine-zone-unread>{end.reason}</span>
        )}
        {/* TASKS-01: no streak counter renders here — the columns and the
            evaluator are untouched; the row shows what is planned and when. */}
        {/* ROUTINE-02a: nothing remains before the end → "ended <date>" in place of a next. */}
        <span title="next scheduled occurrence" data-routine-next-due>
          {routine.next_due_at === null && routine.end_date !== null
            ? endedWords(formatDate(routine.end_date))
            : `next: ${formatDateTime(routine.next_due_at, routine.timezone)}`}
        </span>
        {(routine.start_date || routine.end_date) && (
          <span title="active date window">
            {(() => {
              const startStr = routine.start_date ? formatDate(routine.start_date) : null;
              const endStr = routine.end_date ? formatDate(routine.end_date) : null;
              if (startStr && endStr) return `active ${startStr} – ${endStr}`;
              if (startStr) return `active from ${startStr}`;
              if (endStr) return `active until ${endStr}`;
              return '';
            })()}
          </span>
        )}
        <span title="fail threshold">fail threshold {routine.fail_threshold_minutes} min</span>
        {routine.role !== 'none' && <span title={ROLE_TITLE_WORDS} data-routine-role={routine.role}>{ROLE_SHORT_WORDS[routine.role]}</span>}
      </div>
      {/* LINES-01: the figure is the leaf's — the sum of the lines when any
          carries an amount, else the routine-level pair. A lined routine shows
          its coverage; the routine-level account rides beside the figure only
          when that figure is the one in force. A routine with no lines draws
          its own account in its row's Account cell. */}
      {planned.amount !== null && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="font-mono tabular-nums font-bold text-text-primary"
            title={planned.from === 'lines' ? 'sum of the lines / occurrence' : 'budget / occurrence'}
            data-routine-planned={planned.from}
          >
            {plannedLine(planned)}
          </span>
          {planned.coaCode !== null && planned.lines.length > 0 && (
            <span className="text-[10px]" title="COA" data-routine-planned-coa>
              <AccountText cell={accountCell(entities, routine.entity_id, planned.coaCode)} />
            </span>
          )}
        </div>
      )}
      {/* LINES-01: the routine-level figure is REPORTED as set aside when the
          lines carry amounts — never silently ignored, never added. */}
      {ignoredLine(planned) && (
        <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800" data-routine-ignored>
          {ignoredLine(planned)}
        </div>
      )}
      {/* ONEOFF-01: the routine's place, when it has one — the name and, with
          both coordinates stored, the pin the day map plots. */}
      {(routine.location || (routine.latitude != null && routine.longitude != null)) && (
        <div className="mt-1 text-text-muted" data-routine-place-view>
          <span data-routine-place-text>{routine.location ?? '—'}</span>
          {routine.latitude != null && routine.longitude != null && (
            <span className="ml-1 font-mono text-[10px]" data-routine-pin>
              {Number(routine.latitude).toFixed(5)}, {Number(routine.longitude).toFixed(5)}
            </span>
          )}
        </div>
      )}
      <div className="mt-1 text-text-muted" title="last completed" data-routine-last-done>
        last done {formatDateTime(routine.last_completed_at, routine.timezone)}
      </div>
      {error && !editing && (
        <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800" data-routine-error>
          {error}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={enterEdit}
          disabled={editing}
          className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          edit
        </button>
        {/* ROUTINE-02a: an ended routine keeps "edit" alone — nothing is deactivated, deleted or added to it. */}
        {!end.ended && (
          <>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={toggling}
              className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              {toggling ? '…' : routine.is_active ? 'deactivate' : 'reactivate'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'deleting…' : 'delete'}
            </button>
            <button
              type="button"
              onClick={() => addLine?.()}
              disabled={addLine === null}
              className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50"
              data-routine-add-line
            >
              + line
            </button>
          </>
        )}
      </div>
    </td>
  );

  return (
    <tbody className={'text-xs ' + (routine.is_active && !end.ended ? '' : 'opacity-60')} data-routine-rows={routine.id} data-routine-is-ended={end.ended ? 'true' : undefined}>
      <RoutineStepList routine={routine} entities={entities} onUpdate={onUpdate} routineCell={routineCell} readOnly={end.ended} />

      {/* ROUTINES-01: the edit form is a full-width row directly under the
          routine's rows — the same fields, prefilled by routineToForm. */}
      {editing && (
        <tr data-routine-editing>
          <td colSpan={ROUTINE_TABLE_COLUMNS} className="px-4 py-3 border-t border-border-light text-xs space-y-3 bg-bg-row">
            {error && (
              <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <div className={labelClass}>name</div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  maxLength={200}
                />
              </div>
              <div className="col-span-2">
                <div className={labelClass}>description</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <div className={labelClass}>{ROLE_FIELD_WORDS}</div>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as StopRole })}
                  className={inputClass}
                  data-routine-role-select
                >
                  {STOP_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_WORDS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className={labelClass}>entity</div>
                <select
                  value={form.entity_id}
                  onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                  className={inputClass}
                  disabled
                  title={BOOK_FIXED_WORDS}
                  data-routine-book-select
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <div className="text-text-faint text-[10px] mt-1" data-routine-book-fixed>{BOOK_FIXED_WORDS}</div>
              </div>
            </div>

            {/* HB-4b: per-occurrence budget + COA (pre-filled from the routine; empty → null on save).
                COA scoped to the routine's entity (entity is fixed after creation). */}
            {/* ROUTINES-UX-1: the anchor pair gets the same strongest-cell
                treatment as the create form (see RoutineCreateForm) — the
                edit form is the other of the tab's two money renders. */}
            {/* LINES-01: the routine-level figure is REPORTED as set aside when the
                lines carry amounts — never silently ignored, never added. */}
            {ignoredLine(planned) && (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-routine-level-ignored>
                {ignoredLine(planned)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">budget / occurrence (optional)</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget_amount ?? ''}
                  onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
                  className={`${inputClass} font-mono tabular-nums font-bold`}
                  placeholder="e.g., 60"
                />
              </div>
              <div>
                <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">COA (optional)</div>
                {/* ROUTINE-02b: disabled, and said why, when a line carries the money; else the pair rule said before the save. */}
                <CoaSelect
                  entityId={form.entity_id}
                  value={form.coa_code ?? ''}
                  onChange={(code) => setForm({ ...form, coa_code: code })}
                  className={inputClass}
                  disabled={planned.from === 'lines'}
                  data-routine-coa
                />
                {planned.from === 'lines'
                  ? <div className="text-text-faint text-[10px] mt-1" data-routine-coa-lines>{COA_ON_LINES_WORDS}</div>
                  : (form.coa_code ?? '') !== '' && (form.budget_amount ?? '').trim() === '' && <div className="text-amber-800 text-[10px] mt-1" data-routine-coa-needs-amount>{COA_NEEDS_AMOUNT_WORDS}</div>}
              </div>
            </div>

            <RRULEBuilder form={form} setForm={setForm} />

            {/* ONEOFF-01: a one-off has ONE date — the occurrence is counted from it. */}
            {onceForm ? (
              <div>
                <div className={labelClass}>date</div>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value })}
                  className={inputClass}
                  required
                  data-routine-once-date
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={labelClass}>start date (optional)</div>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className={labelClass}>end date (optional)</div>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* ONEOFF-01: THE PLACE — the same three fields and the same one-press
                lookup the create form has. */}
            <div className="space-y-2 pt-2 border-t border-border-light" data-routine-place>
              <div>
                <div className={labelClass}>location (optional)</div>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, location: v });
                    if (picked && v.trim() !== picked.name) setPicked(null);
                  }}
                  className={inputClass}
                  maxLength={255}
                  data-routine-location
                />
              </div>
              <FindThisPlace
                location={form.location}
                picked={picked}
                onPick={(m) => { setForm({ ...form, location: m.name, latitude: String(m.latitude), longitude: String(m.longitude) }); setPicked(m); }}
                onClear={() => { setForm({ ...form, latitude: '', longitude: '' }); setPicked(null); }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={labelClass}>latitude</div>
                  <input inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className={`${inputClass} font-mono`} placeholder="optional" data-routine-latitude />
                </div>
                <div>
                  <div className={labelClass}>longitude</div>
                  <input inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className={`${inputClass} font-mono`} placeholder="optional" data-routine-longitude />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border-light">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
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
          </td>
        </tr>
      )}
    </tbody>
  );
}
