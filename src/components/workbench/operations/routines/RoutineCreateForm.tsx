/**
 * RoutineCreateForm — the REAL, server-backed routine create form, extracted
 * verbatim from RoutineList so it can be mounted both there and on the Content
 * tab's "0 · CREATE" section (one source of truth).
 *
 * Owns its own submit (POST /api/operations/routines) — unchanged from the
 * original inline form (the server compiles schedule_rrule from the structured
 * form via RRULEBuilder; the date/time fields are normalised to null when
 * empty). The parent supplies the entity list, the default entity, and an
 * onCreated callback (fired after a successful create so the parent can refetch)
 * plus onCancel (fired when the user cancels).
 *
 * Entity default wiring matches ProjectCreateForm: `defaultEntityId` seeds the
 * dropdown; while untouched it tracks the parent default; once the user picks an
 * entity their choice is preserved; an empty default leaves entity REQUIRED
 * before submit (never silently picked).
 *
 * ONEOFF-01 (2026-09-18) — A ONE-OFF IS A ROUTINE THAT HAPPENS ONCE, AUTHORED
 * HERE LIKE EVERYTHING ELSE. Cadence "once" (RRULEBuilder) makes the date field
 * required — the single occurrence is counted from it — and the routine's
 * window that day. A routine is created WITH:
 *   · its LINES (LINES-01): each an activity with its own amount and account,
 *     the account from the ENTITY-SCOPED picker (CoaSelect) — never a merged
 *     chart. A one-off is made of lines: at least one, the thing itself.
 *   · (its PLACE left this form — FORM-01, below.)
 * For a one-off the routine-level budget/COA pair is not asked for — its money
 * is its lines. Nothing is defaulted: an empty amount is null, an empty time
 * stays empty, and a one-off without a date is refused by the server.
 *
 * ROUTINE-02b (Alex, 2026-10-18): the start and end times are the builder's
 * (RRULEBuilder) — the start time is the clock, required; nothing here fills
 * byhour/byminute any more.
 *
 * ROUTINE-02a (Alex, 2026-10-18): a new routine starts in the VIEWER'S OWN zone —
 * read after mount, so the server render and the first paint agree — and the
 * zone is picked from Intl's list (ZoneSelect).
 *
 * FORM-01 (Alex, 2026-10-19): THE FORM ASKS days · time · amount · account,
 * NOTHING ABOUT WHERE — the vendor is picked on the day card, stop by stop.
 * In this order: name · on the day card · entity · days (one control,
 * RRULEBuilder DaysField) · time (TimeField) · amount + account (and the
 * lines) · active from / until (a one-off: its date, in the days control) ·
 * timezone · "more" (description, ideal time label, count as missed after N
 * minutes — collapsed, React state). Location, latitude, longitude and "Find
 * this place" left the form; nothing of them is sent. The route still accepts
 * them and the hub map keeps reading what is stored.
 */

'use client';

import { ROLE_FIELD_WORDS, ROLE_WORDS, STOP_ROLES, type StopRole } from '@/lib/operations/stopRole';
import { useEffect, useState } from 'react';
import { DaysField, MISSED_AFTER_WORDS, TimeField } from './RRULEBuilder';
import ZoneSelect from './ZoneSelect';
import type { RoutineForm } from './types';
import CoaSelect from './CoaSelect';
import { DEFAULT_ROUTINE_FORM, EMPTY_LINE_FORM } from './types';


interface Entity {
  id: string;
  name: string;
}

interface Props {
  entities: Entity[];
  /** Entity to default the dropdown to ('' = none/All → entity required before submit). */
  defaultEntityId: string;
  /** Fired after a successful routine create (parent refetches its list). */
  onCreated: () => void;
  /** Fired when the user cancels (parent hides/collapses the form). */
  onCancel: () => void;
}

export default function RoutineCreateForm({ entities, defaultEntityId, onCreated, onCancel }: Props & { }) {
  const [createForm, setCreateForm] = useState<RoutineForm>({
    ...DEFAULT_ROUTINE_FORM,
    entity_id: defaultEntityId,
  });
  const [entityTouched, setEntityTouched] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // FORM-01: "more" — description, ideal time label, the miss threshold — closed until opened (React state only).
  const [more, setMore] = useState(false);

  const once = createForm.cadence_mode === 'once';

  // ROUTINE-02a: the viewer's zone seeds the form once it is on screen.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setCreateForm((f) => ({ ...f, timezone: zone }));
  }, []);

  // While the entity field is untouched, track the parent's default. Once the
  // user picks an entity, never overwrite their choice.
  useEffect(() => {
    if (!entityTouched) {
      setCreateForm((f) =>
        f.entity_id === defaultEntityId ? f : { ...f, entity_id: defaultEntityId }
      );
    }
  }, [defaultEntityId, entityTouched]);

  /**
   * The builder's setter. ONEOFF-01: switching to "once" with no lines opens one
   * empty line — a one-off is made of lines, and the first is the thing itself.
   * The person still types it; nothing is filled in for them.
   */
  const setForm = (next: RoutineForm) => {
    setCreateForm(next.cadence_mode === 'once' && next.lines.length === 0 ? { ...next, lines: [{ ...EMPTY_LINE_FORM }] } : next);
  };

  const setLine = (i: number, patch: Partial<RoutineForm['lines'][number]>) => {
    setCreateForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  };
  const addLine = () => setCreateForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE_FORM }] }));
  const removeLine = (i: number) => setCreateForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

  const handleCreate = async () => {
    if (!createForm.entity_id) {
      setCreateError('Entity is required — select one above.');
      return;
    }
    if (once && !createForm.start_date) {
      setCreateError('A one-off needs its date.');
      return;
    }
    if (once && !createForm.lines.some((l) => l.activity.trim())) {
      setCreateError('A one-off is made of lines — give it at least one, the thing itself.');
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/operations/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          start_date: createForm.start_date || null,
          // ONEOFF-01: a one-off's window is its day.
          end_date: once ? (createForm.start_date || null) : (createForm.end_date || null),
          start_time: createForm.start_time || null,
          end_time: createForm.end_time || null,
          // ONEOFF-01: a one-off's money is its lines — the routine-level pair is not sent.
          budget_amount: once ? '' : createForm.budget_amount,
          coa_code: once ? '' : createForm.coa_code,
          // FORM-01: no place is sent — location, latitude and longitude left the form.
          location: undefined,
          latitude: undefined,
          longitude: undefined,
          // The lines: a blank amount is NO amount; a blank account is none.
          lines: createForm.lines
            .filter((l) => l.activity.trim())
            .map((l) => ({ activity: l.activity, budget_amount: l.budget_amount.trim() || null, coa_code: l.coa_code || null })),
        }),
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
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

  return (
    <div className="border border-border rounded p-3 bg-white text-xs space-y-3" data-routine-create-form>
      <div className="text-sm font-semibold text-text-primary">{once ? 'new one-off' : 'new routine'}</div>
      {createError && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-routine-create-error>
          {createError}
        </div>
      )}

      {/* FORM-01: name · on the day card · entity. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className={labelClass}>name</div>
          <input
            type="text"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            className={inputClass}
            maxLength={200}
            placeholder="e.g., Morning reflection"
            data-routine-name
          />
        </div>
        <div>
          <div className={labelClass}>{ROLE_FIELD_WORDS}</div>
          <select
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as StopRole })}
            className={inputClass}
            data-routine-role
          >
            {STOP_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_WORDS[r]}</option>
            ))}
          </select>
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
            data-routine-entity
          >
            <option value="">— select —</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FORM-01: days, then time — the builder's two fields, in that order. */}
      <DaysField form={createForm} setForm={setForm} />
      <TimeField form={createForm} setForm={setForm} />

      {/* HB-4b: per-occurrence budget + COA. Both optional — empty budget → null (never 0), no COA
          → null (no default account). The COA list is scoped to the selected entity. */}
      {/* ROUTINES-UX-1: the dossier anchor (habits↔money) — strongest-cell treatment: primary-weight
          labels + the mono numeral idiom on the money input (the RUNWAY/TRADE/TAX precedent). */}
      {/* ONEOFF-01: not asked for on a one-off — its money is its lines (below). */}
      {!once && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">budget / occurrence (optional)</div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={createForm.budget_amount ?? ''}
              onChange={(e) => setCreateForm({ ...createForm, budget_amount: e.target.value })}
              className={`${inputClass} font-mono tabular-nums font-bold`}
              placeholder="e.g., 60"
            />
          </div>
          <div>
            <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">COA (optional)</div>
            <CoaSelect
              entityId={createForm.entity_id}
              value={createForm.coa_code ?? ''}
              onChange={(code) => setCreateForm({ ...createForm, coa_code: code })}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* ONEOFF-01 · LINES-01: the lines the routine is made of, each with its own
          amount and account from the ENTITY'S chart. A one-off has at least one. */}
      <div className="space-y-2 pt-2 border-t border-border-light" data-routine-lines>
        <div className="flex items-center justify-between">
          <div className={labelClass}>
            lines {once ? '— a one-off is made of lines' : '(optional — each with its own amount and account)'}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="px-2 py-1 border border-border rounded hover:bg-bg-row text-xs"
            data-routine-line-add
          >
            + add line
          </button>
        </div>
        {createForm.lines.length === 0 && (
          <div className="text-text-muted italic text-xs" data-routine-no-lines>no lines — the routine-level budget above stands</div>
        )}
        {createForm.lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2 items-end" data-routine-line={i}>
            <div>
              <div className={labelClass}>activity</div>
              <input
                type="text"
                value={l.activity}
                onChange={(e) => setLine(i, { activity: e.target.value })}
                className={inputClass}
                maxLength={200}
                placeholder="Haircut"
                data-routine-line-activity
              />
            </div>
            <div>
              <div className={labelClass}>amount</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={l.budget_amount}
                onChange={(e) => setLine(i, { budget_amount: e.target.value })}
                className={`${inputClass} font-mono tabular-nums`}
                placeholder="blank = no amount"
                data-routine-line-amount
              />
            </div>
            <div>
              <div className={labelClass}>COA</div>
              <CoaSelect
                entityId={createForm.entity_id}
                value={l.coa_code}
                onChange={(code) => setLine(i, { coa_code: code })}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeLine(i)}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row text-xs text-text-muted"
              title="remove this line"
              data-routine-line-remove
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* FORM-01: active from / until — a one-off's day is its date, asked in the days control. */}
      {!once && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelClass}>active from (optional)</div>
            <input
              type="date"
              value={createForm.start_date}
              onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
              className={inputClass}
              data-routine-start-date
            />
          </div>
          <div>
            <div className={labelClass}>active until (optional)</div>
            <input
              type="date"
              value={createForm.end_date}
              onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
              className={inputClass}
              data-routine-end-date
            />
          </div>
        </div>
      )}

      <div>
        <div className={labelClass}>timezone</div>
        <ZoneSelect
          value={createForm.timezone}
          onChange={(zone) => setCreateForm({ ...createForm, timezone: zone })}
          className={inputClass}
          data-routine-timezone
        />
      </div>

      {/* FORM-01: "more" — description, ideal time label, the miss threshold — closed until opened. */}
      <div className="pt-2 border-t border-border-light">
        <button type="button" onClick={() => setMore((m) => !m)} className="px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs" aria-expanded={more} data-routine-more>
          {more ? 'less' : 'more'}
        </button>
        {more && (
          <div className="mt-2 grid grid-cols-2 gap-3" data-routine-more-fields>
            <div className="col-span-2">
              <div className={labelClass}>description (optional)</div>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="what does this routine accomplish?"
              />
            </div>
            <div>
              <div className={labelClass}>ideal time label (optional)</div>
              <input
                type="text"
                value={createForm.ideal_time_label}
                onChange={(e) => setCreateForm({ ...createForm, ideal_time_label: e.target.value })}
                className={inputClass}
                placeholder="morning, before lunch, EOD"
              />
            </div>
            <div>
              <div className={labelClass}>{MISSED_AFTER_WORDS}</div>
              <input
                type="number"
                min={0}
                value={createForm.fail_threshold_minutes}
                onChange={(e) => setCreateForm({ ...createForm, fail_threshold_minutes: e.target.value })}
                className={inputClass}
                data-routine-missed-after
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={handleCreate}
          disabled={createSaving}
          className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
          data-routine-create-submit
        >
          {createSaving ? 'creating…' : once ? 'create one-off' : 'create routine'}
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
    </div>
  );
}
