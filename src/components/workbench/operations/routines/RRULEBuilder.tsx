/**
 * RRULEBuilder — THE DAYS CONTROL AND THE TIME ROW (FORM-01, Alex, 2026-10-19).
 *
 * A routine is which days · what time · how much · which account. This file
 * holds the first two as fields the forms compose in that order (DaysField,
 * TimeField; the default export is the pair):
 *
 *   DAYS is one control — Every day · Weekdays (Mon–Fri) · Weekends (Sat–Sun)
 *   · Pick days (seven toggles) · Once (a date) · Monthly (the two monthly
 *   shapes the form has always had) · Custom rule (the raw box, the escape
 *   hatch). The first four compile to the existing FREQ=DAILY or
 *   FREQ=WEEKLY;BYDAY rules (rruleHelpers.ts withDays sets the wire fields;
 *   no new rule shape). The edit form opens in the matching choice
 *   (formOfRule) and a change of choice moves the wire fields with it.
 *
 *   TIME is start · end — ROUTINE-02b (Alex, 2026-10-18): ONE TIME — the
 *   start time IS the routine's clock (withStartTime fills byhour/byminute and a custom
 *   rule's own BYHOUR/BYMINUTE); the end is the window; both required. No
 *   hour or minute box.
 *
 * The zone — ROUTINE-02a (Alex, 2026-10-18): picked from Intl's list, never
 * typed (ZoneSelect) — the ideal time label and "count as missed after N
 * minutes" left this file for the forms' own timezone and "more" blocks
 * (FORM-01). Nothing here is stored in the browser.
 */

'use client';

import { clockOfTime, withClock, withDays } from '@/lib/operations/rruleHelpers';
import type { DaysChoice, MonthlyKind, RoutineForm, WeekDay } from './types';
import { DAYS_CHOICE_LABELS, DAYS_CHOICE_ORDER, MONTHLY_KIND_LABELS, WEEKDAY_LABELS, WEEKDAY_ORDER } from './types';

interface Props {
  form: RoutineForm;
  setForm: (next: RoutineForm) => void;
}

/** ROUTINE-02b: the fail threshold's words (rendered by the forms' "more" block). */
export const MISSED_AFTER_WORDS = 'count as missed after N minutes';
/** FORM-01: the days control's words. */
export const DAYS_FIELD_WORDS = 'days';
export const PICK_DAYS_WORDS = 'which days';
export const ONCE_DATE_WORDS = 'the date';
export const CUSTOM_RULE_WORDS = 'raw RRULE (RFC 5545)';
export const CUSTOM_RULE_NOTE = "Escape hatch for cadences the choices above can't express (e.g., quarterly review on the 15th of mar/jun/sep/dec).";

/**
 * ROUTINE-02b: the form with this start time — the clock it names fills
 * byhour/byminute, and a custom rule's own BYHOUR/BYMINUTE, so every writer
 * agrees with the start time. A value that is not yet a time only moves the field.
 */
export function withStartTime(form: RoutineForm, startTime: string): RoutineForm {
  const clock = clockOfTime(startTime);
  if (clock === null) return { ...form, start_time: startTime };
  return {
    ...form,
    start_time: startTime,
    byhour: String(clock.hour).padStart(2, '0'),
    byminute: String(clock.minute).padStart(2, '0'),
    ...(form.cadence_mode === 'custom' && form.custom_rrule.trim() !== '' ? { custom_rrule: withClock(form.custom_rrule.trim(), clock) } : {}),
  };
}

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';

/** DAYS: one choice, then the choice's own fields. */
export function DaysField({ form, setForm }: Props) {
  const toggleWeekday = (d: WeekDay) => {
    const has = form.weekly_byday.includes(d);
    const next = has ? form.weekly_byday.filter((x) => x !== d) : [...form.weekly_byday, d];
    // Preserve weekday order for canonical RRULE output.
    next.sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
    setForm({ ...form, weekly_byday: next });
  };

  return (
    <div className="space-y-2" data-routine-days>
      <div>
        <div className={labelClass}>{DAYS_FIELD_WORDS}</div>
        <select
          value={form.days}
          onChange={(e) => setForm(withDays(form, e.target.value as DaysChoice))}
          className={inputClass}
          data-routine-days-select
        >
          {DAYS_CHOICE_ORDER.map((c) => (
            <option key={c} value={c}>{DAYS_CHOICE_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {form.days === 'pick_days' && (
        <div data-routine-pick-days>
          <div className={labelClass}>{PICK_DAYS_WORDS}</div>
          <div className="flex gap-1 flex-wrap">
            {WEEKDAY_ORDER.map((d) => {
              const selected = form.weekly_byday.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  aria-pressed={selected}
                  className={
                    'px-2 py-1 border rounded text-xs ' +
                    (selected
                      ? ('bg-brand-purple text-white border-brand-purple')
                      : 'bg-white text-text-primary border-border hover:bg-bg-row')
                  }
                  data-routine-weekday={d}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {form.days === 'once' && (
        <div>
          {/* ONEOFF-01: a one-off has ONE date — the occurrence is counted from it, and its window is that day. */}
          <div className={labelClass}>{ONCE_DATE_WORDS}</div>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value })}
            className={inputClass}
            required
            data-routine-once-date
          />
        </div>
      )}

      {form.days === 'monthly' && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className={labelClass}>monthly</div>
            <select
              value={form.cadence_mode === 'monthly_nth_weekday' ? 'monthly_nth_weekday' : 'monthly_day_of_month'}
              onChange={(e) => setForm({ ...form, cadence_mode: e.target.value as MonthlyKind })}
              className={inputClass}
              data-routine-monthly-kind
            >
              {(Object.keys(MONTHLY_KIND_LABELS) as MonthlyKind[]).map((k) => (
                <option key={k} value={k}>{MONTHLY_KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>
          {form.cadence_mode === 'monthly_nth_weekday' ? (
            <>
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
                    <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="col-span-2">
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
        </div>
      )}

      {form.days === 'custom' && (
        <div>
          <div className={labelClass}>{CUSTOM_RULE_WORDS}</div>
          {/* HB-4e-style-2: the raw RRULE is a CODE value (RFC 5545) — monospace; every other field is sans. */}
          <input
            type="text"
            value={form.custom_rrule}
            onChange={(e) => setForm({ ...form, custom_rrule: e.target.value })}
            className={`${inputClass} font-mono`}
            placeholder="FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15"
            data-routine-custom-rule
          />
          <div className="text-text-faint text-xs italic mt-1">{CUSTOM_RULE_NOTE}</div>
        </div>
      )}
    </div>
  );
}

/** TIME: start · end — the start time is the clock (ROUTINE-02b). */
export function TimeField({ form, setForm }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3" data-routine-time>
      <div>
        <div className={labelClass}>start time</div>
        <input
          type="time"
          value={form.start_time}
          onChange={(e) => setForm(withStartTime(form, e.target.value))}
          className={inputClass}
          required
          data-routine-start-time
        />
      </div>
      <div>
        <div className={labelClass}>end time</div>
        <input
          type="time"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          className={inputClass}
          required
          data-routine-end-time
        />
      </div>
    </div>
  );
}

/** Days, then time — the order the forms ask them in. */
export default function RRULEBuilder({ form, setForm }: Props) {
  return (
    <div className="space-y-3">
      <DaysField form={form} setForm={setForm} />
      <TimeField form={form} setForm={setForm} />
    </div>
  );
}
