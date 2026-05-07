/**
 * src/components/workbench/operations/SectionB_NorthStar.tsx
 *
 * Section B · North Star — per-user mission anchor with always-edit-mode form.
 *
 * Three render branches:
 *   - Loading: section card with "loading north star…" body
 *   - Empty (no row): section card with empty-state pitch + form populated
 *     from defaults + "Save Your North Star" button
 *   - Has row: section card showing display view by default, with an "edit"
 *     toggle to enter form mode and an "I reviewed this — still holds"
 *     button to record a review attestation
 *
 * Bridgewater convention: review-without-change is a distinct audit event
 * (operations_north_star_reviewed) from a content edit (..._updated).
 */

'use client';

import { useEffect, useState } from 'react';
import type { NorthStar, NorthStarForm } from './types';
import { DEFAULT_NORTH_STAR_FORM } from './types';

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    const future = -ms;
    if (future < 3_600_000) return `in ${Math.ceil(future / 60_000)}m`;
    if (future < 86_400_000) return `in ${Math.ceil(future / 3_600_000)}h`;
    return `in ${Math.ceil(future / 86_400_000)}d`;
  }
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function toForm(ns: NorthStar): NorthStarForm {
  return {
    mission_statement: ns.mission_statement ?? '',
    life_stage: ns.life_stage ?? '',
    core_values: ns.core_values,
    guiding_principles: ns.guiding_principles ?? '',
    one_year_target: ns.one_year_target ?? '',
    three_year_target: ns.three_year_target ?? '',
    current_location_label: ns.current_location_label ?? '',
    current_timezone: ns.current_timezone,
    review_cadence_days: ns.review_cadence_days,
  };
}

export default function SectionB_NorthStar() {
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [form, setForm] = useState<NorthStarForm>(DEFAULT_NORTH_STAR_FORM);
  const [coreValueInput, setCoreValueInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/operations/north-star');
        if (!cancelled && res.ok) {
          const body = await res.json();
          const ns: NorthStar | null = body?.northStar ?? null;
          setNorthStar(ns);
          if (ns) {
            setForm(toForm(ns));
            setEditing(false);
          } else {
            setForm(DEFAULT_NORTH_STAR_FORM);
            setEditing(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const addCoreValue = () => {
    const v = coreValueInput.trim();
    if (!v) return;
    if (form.core_values.includes(v)) {
      setCoreValueInput('');
      return;
    }
    setForm({ ...form, core_values: [...form.core_values, v] });
    setCoreValueInput('');
  };

  const removeCoreValue = (v: string) => {
    setForm({ ...form, core_values: form.core_values.filter((x) => x !== v) });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/north-star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to save');
        return;
      }
      setNorthStar(body.northStar);
      setForm(toForm(body.northStar));
      setEditing(false);
      setSuccessMessage(body.isCreate ? 'north star saved' : 'north star updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    if (!northStar) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/north-star/review', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to record review');
        return;
      }
      setNorthStar(body.northStar);
      setForm(toForm(body.northStar));
      setSuccessMessage('review recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to record review');
    } finally {
      setReviewing(false);
    }
  };

  const handleCancelEdit = () => {
    if (northStar) {
      setForm(toForm(northStar));
      setEditing(false);
    }
    setError(null);
  };

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          B · NORTH STAR
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          {northStar && !editing && (
            <>
              <button
                type="button"
                onClick={handleReview}
                disabled={reviewing}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
                title="Record a review-without-edit attestation"
              >
                {reviewing ? 'recording…' : 'I reviewed — still holds'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row"
              >
                edit
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono mb-3 px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="text-xs font-mono mb-3 px-3 py-2 rounded border bg-green-50 border-green-200 text-green-800">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading north star…</div>
      ) : editing ? (
        <NorthStarEditor
          form={form}
          setForm={setForm}
          coreValueInput={coreValueInput}
          setCoreValueInput={setCoreValueInput}
          addCoreValue={addCoreValue}
          removeCoreValue={removeCoreValue}
          saving={saving}
          onSave={handleSave}
          onCancel={northStar ? handleCancelEdit : undefined}
        />
      ) : northStar ? (
        <NorthStarDisplay northStar={northStar} />
      ) : (
        <div className="text-xs font-mono text-text-muted">no north star yet — entering edit mode…</div>
      )}
    </section>
  );
}

function NorthStarDisplay({ northStar }: { northStar: NorthStar }) {
  const daysToReview = daysUntil(northStar.next_review_at);
  return (
    <div className="space-y-4 text-xs font-mono">
      {northStar.mission_statement ? (
        <div>
          <div className="text-text-faint uppercase tracking-wide mb-1">mission</div>
          <div className="text-text-primary text-sm whitespace-pre-wrap">
            {northStar.mission_statement}
          </div>
        </div>
      ) : (
        <div className="text-text-muted italic">no mission statement set</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-text-faint uppercase tracking-wide mb-1">life stage</div>
          <div className="text-text-primary">{northStar.life_stage ?? '—'}</div>
        </div>
        <div>
          <div className="text-text-faint uppercase tracking-wide mb-1">location · timezone</div>
          <div className="text-text-primary">
            {northStar.current_location_label ?? '—'} · {northStar.current_timezone}
          </div>
        </div>
      </div>

      <div>
        <div className="text-text-faint uppercase tracking-wide mb-1">core values</div>
        {northStar.core_values.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {northStar.core_values.map((v) => (
              <span
                key={v}
                className="px-2 py-0.5 border border-border rounded bg-bg-row text-text-primary"
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-text-muted">—</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-text-faint uppercase tracking-wide mb-1">1-year target</div>
          <div className="text-text-primary whitespace-pre-wrap">
            {northStar.one_year_target ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-text-faint uppercase tracking-wide mb-1">3-year target</div>
          <div className="text-text-primary whitespace-pre-wrap">
            {northStar.three_year_target ?? '—'}
          </div>
        </div>
      </div>

      {northStar.guiding_principles && (
        <div>
          <div className="text-text-faint uppercase tracking-wide mb-1">guiding principles</div>
          <div className="text-text-primary whitespace-pre-wrap">{northStar.guiding_principles}</div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-2 border-t border-border-light text-text-muted">
        <span>
          last reviewed:{' '}
          {northStar.last_reviewed_at ? relTime(northStar.last_reviewed_at) : 'never'}
        </span>
        <span>
          cadence: every {northStar.review_cadence_days}d
        </span>
        {daysToReview !== null && (
          <span
            className={
              daysToReview < 0
                ? 'text-red-700'
                : daysToReview <= 7
                ? 'text-amber-700'
                : 'text-text-muted'
            }
          >
            {daysToReview < 0
              ? `review overdue by ${-daysToReview}d`
              : daysToReview === 0
              ? 'review due today'
              : `review due in ${daysToReview}d`}
          </span>
        )}
      </div>
    </div>
  );
}

interface EditorProps {
  form: NorthStarForm;
  setForm: (f: NorthStarForm) => void;
  coreValueInput: string;
  setCoreValueInput: (s: string) => void;
  addCoreValue: () => void;
  removeCoreValue: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel?: () => void;
}

function NorthStarEditor({
  form,
  setForm,
  coreValueInput,
  setCoreValueInput,
  addCoreValue,
  removeCoreValue,
  saving,
  onSave,
  onCancel,
}: EditorProps) {
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';

  return (
    <div className="space-y-4">
      <div>
        <div className={labelClass}>mission statement</div>
        <textarea
          value={form.mission_statement}
          onChange={(e) => setForm({ ...form, mission_statement: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="why are you doing this work?"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>life stage</div>
          <input
            type="text"
            value={form.life_stage}
            onChange={(e) => setForm({ ...form, life_stage: e.target.value })}
            className={inputClass}
            placeholder="building / scaling / transitioning"
          />
        </div>
        <div>
          <div className={labelClass}>review cadence (days)</div>
          <input
            type="number"
            min={1}
            value={form.review_cadence_days}
            onChange={(e) =>
              setForm({ ...form, review_cadence_days: parseInt(e.target.value, 10) || 90 })
            }
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className={labelClass}>core values</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.core_values.map((v) => (
            <span
              key={v}
              className="px-2 py-0.5 border border-border rounded bg-bg-row text-text-primary text-xs font-mono inline-flex items-center gap-1"
            >
              {v}
              <button
                type="button"
                onClick={() => removeCoreValue(v)}
                className="text-text-muted hover:text-red-700"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={coreValueInput}
            onChange={(e) => setCoreValueInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCoreValue();
              }
            }}
            className={inputClass}
            placeholder="add a value (press Enter)"
          />
          <button
            type="button"
            onClick={addCoreValue}
            className="px-3 py-1 border border-border rounded text-xs font-mono hover:bg-bg-row"
          >
            add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>1-year target</div>
          <textarea
            value={form.one_year_target}
            onChange={(e) => setForm({ ...form, one_year_target: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="where do you want to be in 12 months?"
          />
        </div>
        <div>
          <div className={labelClass}>3-year target</div>
          <textarea
            value={form.three_year_target}
            onChange={(e) => setForm({ ...form, three_year_target: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="where do you want to be in 3 years?"
          />
        </div>
      </div>

      <div>
        <div className={labelClass}>guiding principles</div>
        <textarea
          value={form.guiding_principles}
          onChange={(e) => setForm({ ...form, guiding_principles: e.target.value })}
          rows={4}
          className={inputClass}
          placeholder="long-form principles you want to anchor decisions to"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>location label</div>
          <input
            type="text"
            value={form.current_location_label}
            onChange={(e) => setForm({ ...form, current_location_label: e.target.value })}
            className={inputClass}
            placeholder="Los Angeles, CA"
          />
        </div>
        <div>
          <div className={labelClass}>timezone (IANA)</div>
          <input
            type="text"
            value={form.current_timezone}
            onChange={(e) => setForm({ ...form, current_timezone: e.target.value })}
            className={inputClass}
            placeholder="America/Los_Angeles"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'saving…' : 'save north star'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1 border border-border rounded text-xs font-mono hover:bg-bg-row disabled:opacity-50"
          >
            cancel
          </button>
        )}
      </div>
    </div>
  );
}
