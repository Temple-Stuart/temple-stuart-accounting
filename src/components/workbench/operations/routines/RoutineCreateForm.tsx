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
 *   · its PLACE: a location, and coordinates found with GEO-01's "Find this
 *     place" (FindThisPlace — the component moved here from the calendar,
 *     intact: one lookup per press, never while you type, the same cap) or
 *     pasted as a pair. The pair is all-or-nothing; the name saves on its own.
 * For a one-off the routine-level budget/COA pair is not asked for — its money
 * is its lines. Nothing is defaulted: an empty amount is null, an empty time
 * stays empty, and a one-off without a date is refused by the server.
 */

'use client';

import { useEffect, useState } from 'react';
import RRULEBuilder from './RRULEBuilder';
import type { RoutineForm } from './types';
import CoaSelect from './CoaSelect';
import FindThisPlace from './FindThisPlace';
import { DEFAULT_ROUTINE_FORM, EMPTY_LINE_FORM } from './types';
import type { PlaceMatch } from '@/lib/calendar/findPlace';


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
  // ONEOFF-01: the place the person picked from a lookup, so the form can say
  // what filled the coordinates. Typing past the picked name drops it.
  const [picked, setPicked] = useState<PlaceMatch | null>(null);

  const once = createForm.cadence_mode === 'once';

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
          // The place: '' → null on the wire, never 0.
          location: createForm.location || null,
          latitude: createForm.latitude || null,
          longitude: createForm.longitude || null,
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

      {/* HB-4b: per-occurrence budget + COA. Both optional — empty budget → null (never 0), no COA
          → null (no default account). The COA list is scoped to the selected entity. */}
      {/* ROUTINES-UX-1: the dossier anchor (habits↔money) — this budget+COA pair
          IS the tab's only money-rendering surface (the linkage is schema-real,
          budget_amount/coa_code on every routine, but the display row renders no
          money — so no invented row UI). Strongest-cell treatment at the existing
          site: primary-weight labels + the mono numeral idiom on the money input
          (the RUNWAY/TRADE/TAX precedent). Handlers/fields untouched. */}
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

      <RRULEBuilder form={createForm} setForm={setForm} />

      {/* ONEOFF-01: a one-off has ONE date — the single occurrence is counted
          from it and the window is that day. Every other cadence keeps its
          optional start/end window. */}
      {once ? (
        <div>
          <div className={labelClass}>date</div>
          <input
            type="date"
            value={createForm.start_date}
            onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value, end_date: e.target.value })}
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
              value={createForm.start_date}
              onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>end date (optional)</div>
            <input
              type="date"
              value={createForm.end_date}
              onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>start time (optional)</div>
          <input
            type="time"
            value={createForm.start_time}
            /* ONEOFF-01: on a one-off the start time IS the occurrence's hour and
               minute, so it fills the builder's cron fields as it is typed. */
            onChange={(e) => {
              const v = e.target.value;
              setCreateForm({ ...createForm, start_time: v, ...(once && v ? { byhour: v.slice(0, 2), byminute: v.slice(3, 5) } : {}) });
            }}
            className={inputClass}
            data-routine-start-time
          />
        </div>
        <div>
          <div className={labelClass}>end time (optional)</div>
          <input
            type="time"
            value={createForm.end_time}
            onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })}
            className={inputClass}
            data-routine-end-time
          />
        </div>
      </div>

      {/* ONEOFF-01: THE PLACE. The location saves on its own; the coordinates
          come from ONE lookup on press (FindThisPlace) or a pasted pair. */}
      <div className="space-y-2 pt-2 border-t border-border-light" data-routine-place>
        <div>
          <div className={labelClass}>location (optional)</div>
          <input
            id="routine-location"
            type="text"
            value={createForm.location}
            /* Typing NEVER calls anything — it only drops a pick the text no longer matches. */
            onChange={(e) => {
              const v = e.target.value;
              setCreateForm({ ...createForm, location: v });
              if (picked && v.trim() !== picked.name) setPicked(null);
            }}
            className={inputClass}
            maxLength={255}
            placeholder="Thonglor barber"
            data-routine-location
          />
        </div>
        <FindThisPlace
          location={createForm.location}
          picked={picked}
          onPick={(m) => {
            setCreateForm({ ...createForm, location: m.name, latitude: String(m.latitude), longitude: String(m.longitude) });
            setPicked(m);
          }}
          onClear={() => {
            setCreateForm({ ...createForm, latitude: '', longitude: '' });
            setPicked(null);
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelClass}>latitude</div>
            <input
              inputMode="decimal"
              value={createForm.latitude}
              onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })}
              className={`${inputClass} font-mono`}
              placeholder="optional"
              data-routine-latitude
            />
          </div>
          <div>
            <div className={labelClass}>longitude</div>
            <input
              inputMode="decimal"
              value={createForm.longitude}
              onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })}
              className={`${inputClass} font-mono`}
              placeholder="optional"
              data-routine-longitude
            />
          </div>
        </div>
      </div>

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
