/**
 * RRULEBuilder — structured cadence input that compiles to RFC 5545 RRULE.
 *
 * Users do NOT type RRULE strings directly. They pick:
 *   - cadence_mode (daily / weekly / monthly day-of-month / monthly Nth-weekday / custom)
 *   - byhour + byminute (when in the day)
 *   - mode-specific fields (weekday chips, day number, Nth + weekday, raw RRULE)
 *
 * Server compiles the structured form via compileFormToRRule(). This
 * component is a controlled input — parent owns the form state.
 */

'use client';

import type { CadenceMode, RoutineForm, WeekDay } from './types';
import {
  CADENCE_MODE_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from './types';

interface Props {
  form: RoutineForm;
  setForm: (next: RoutineForm) => void;
}

const CADENCE_MODES: CadenceMode[] = [
  'daily',
  'weekly',
  'monthly_day_of_month',
  'monthly_nth_weekday',
  'custom',
];

export default function RRULEBuilder({ form, setForm }: Props) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

  const toggleWeekday = (d: WeekDay) => {
    const has = form.weekly_byday.includes(d);
    const next = has
      ? form.weekly_byday.filter((x) => x !== d)
      : [...form.weekly_byday, d];
    // Preserve weekday order for canonical RRULE output.
    next.sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
    setForm({ ...form, weekly_byday: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className={labelClass}>cadence</div>
        <select
          value={form.cadence_mode}
          onChange={(e) => setForm({ ...form, cadence_mode: e.target.value as CadenceMode })}
          className={inputClass}
        >
          {CADENCE_MODES.map((m) => (
            <option key={m} value={m}>
              {CADENCE_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {form.cadence_mode === 'weekly' && (
        <div>
          <div className={labelClass}>days of week</div>
          <div className="flex gap-1 flex-wrap">
            {WEEKDAY_ORDER.map((d) => {
              const selected = form.weekly_byday.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className={
                    'px-2 py-1 border rounded text-xs ' +
                    (selected
                      ? 'bg-brand-purple text-white border-brand-purple'
                      : 'bg-white text-text-primary border-border hover:bg-bg-row')
                  }
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {form.cadence_mode === 'monthly_day_of_month' && (
        <div>
          <div className={labelClass}>day of month (1–31)</div>
          <input
            type="number"
            min={1}
            max={31}
            value={form.monthly_day_of_month}
            onChange={(e) => setForm({ ...form, monthly_day_of_month: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      {form.cadence_mode === 'monthly_nth_weekday' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelClass}>nth (1=first, -1=last)</div>
            <select
              value={form.monthly_nth}
              onChange={(e) => setForm({ ...form, monthly_nth: e.target.value })}
              className={inputClass}
            >
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
              <option value="-1">last</option>
            </select>
          </div>
          <div>
            <div className={labelClass}>weekday</div>
            <select
              value={form.monthly_weekday}
              onChange={(e) => setForm({ ...form, monthly_weekday: e.target.value as WeekDay })}
              className={inputClass}
            >
              {WEEKDAY_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {form.cadence_mode === 'custom' && (
        <div>
          <div className={labelClass}>raw RRULE (RFC 5545)</div>
          {/* HB-4e-style-2: the raw RRULE is a CODE value (RFC 5545) — keep it monospace, like the
              rrule string shown in RoutineRow:249. Every other field in this builder is sans. */}
          <input
            type="text"
            value={form.custom_rrule}
            onChange={(e) => setForm({ ...form, custom_rrule: e.target.value })}
            className={`${inputClass} font-mono`}
            placeholder="FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15"
          />
          <div className="text-text-faint text-xs italic mt-1">
            Escape hatch for cadences the structured form can't express
            (e.g., quarterly review on the 15th of mar/jun/sep/dec).
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-light">
        <div>
          <div className={labelClass}>hour (00–23)</div>
          <input
            type="number"
            min={0}
            max={23}
            value={form.byhour}
            onChange={(e) => setForm({ ...form, byhour: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>minute (00–59)</div>
          <input
            type="number"
            min={0}
            max={59}
            value={form.byminute}
            onChange={(e) => setForm({ ...form, byminute: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>fail threshold (min)</div>
          <input
            type="number"
            min={0}
            value={form.fail_threshold_minutes}
            onChange={(e) => setForm({ ...form, fail_threshold_minutes: e.target.value })}
            className={inputClass}
            title="grace period before a missed occurrence is logged"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>timezone</div>
          <input
            type="text"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className={inputClass}
            placeholder="America/Los_Angeles"
          />
        </div>
        <div>
          <div className={labelClass}>ideal time label (optional)</div>
          <input
            type="text"
            value={form.ideal_time_label}
            onChange={(e) => setForm({ ...form, ideal_time_label: e.target.value })}
            className={inputClass}
            placeholder="morning, before lunch, EOD"
          />
        </div>
      </div>
    </div>
  );
}
