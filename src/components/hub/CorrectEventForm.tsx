'use client';

/**
 * ONEOFF-01 — "Correct the event." THE CALENDAR AUTHORS NOTHING. This file was
 * EVENT-01's AddEventForm: "Add an event", above the grid, the door DAY-01's
 * audit found missing. That door is closed and moved: a one-off is a routine
 * that happens once, authored in Tasks with its lines (LINES-01) and its place
 * (GEO-01's Find-this-place, now in Tasks), and it logs to this calendar like
 * every other routine. POST /api/calendar/events is gone.
 *
 * WHAT STAYS. An event entered by hand BEFORE the ruling is the calendar's own
 * row (calendar_events, source 'manual'). Its owner may still re-state it —
 * from the day it sits on, or from its chain panel — and this is that form:
 * edit-only, PATCH-only, opened on an existing row and never empty.
 *
 * WHAT IT ASKS FOR is what the row holds: title, date, an optional start and
 * end time, a category from the census the existing writers use (untouched —
 * it describes what exists), an optional expected cost, an optional location,
 * and optional coordinates as two numbers.
 *
 * WHAT IT DOES NOT OFFER. No account picker: the old one merged EVERY entity's
 * chart (three 1010s, three 3000s), which is why it is gone and why ONEOFF-01
 * forbids a merged list anywhere. The row's stored account code is shown and
 * sent back exactly as stored — a correction never silently clears a code,
 * and never re-picks one. No place lookup: that metered press lives in Tasks
 * now; a pair can still be pasted, or the pin dropped.
 *
 * WHAT IT NEVER DEFAULTS. An empty cost box is NOT $0: it posts nothing and
 * the row stores null. The same for the times and the coordinates.
 */

import { useEffect, useState } from 'react';
import { EVENT_CATEGORIES } from '@/lib/calendar/manualEvent';
import { MANUAL_EVENT_BADGE } from '@/lib/calendar/sources';
import { MONEY_ACTION, SECTION_HEADER, STATE } from '@/lib/ds';

const INPUT = 'w-full bg-white border border-border rounded px-1.5 py-1 text-[11px] font-mono text-text-primary outline-none focus:border-brand-purple';
const LABEL = 'block text-[9px] uppercase tracking-wider text-text-muted mb-0.5';

/**
 * A hand-entered event the day view or the chain panel already holds, handed in
 * for a correction. The form does NOT re-fetch it: both read it from the same
 * merged list the grid drew, so a second read could only disagree with what the
 * person is looking at.
 */
export interface EditableEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  cost: number | null;
  location: string | null;
  coaCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CorrectEventFormProps {
  /** The hand-entered event being corrected. The form opens on it and on nothing else. */
  event: EditableEvent;
  /** Called after the correction lands, with the day it sits on, so the calendar reloads. */
  onCorrected: (dateKey: string) => void;
  onCancel: () => void;
}

/** A typed number, or undefined when the box is empty. `Number('')` is 0 — never that. */
function typedNumber(v: string): number | undefined {
  const s = v.trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** A stored number back into the box it came from. Null stays empty, not "0". */
const box = (v: number | null) => (v == null ? '' : String(v));

export default function CorrectEventForm({ event, onCorrected, onCancel }: CorrectEventFormProps) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [startTime, setStartTime] = useState(event.startTime ?? '');
  const [endTime, setEndTime] = useState(event.endTime ?? '');
  const [category, setCategory] = useState(
    EVENT_CATEGORIES.some((c) => c.category === event.category) ? event.category : EVENT_CATEGORIES[0].category,
  );
  const [cost, setCost] = useState(box(event.cost));
  const [location, setLocation] = useState(event.location ?? '');
  const [lat, setLat] = useState(box(event.latitude));
  const [lon, setLon] = useState(box(event.longitude));
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  // A correction starts from what is STORED, handed in by the caller. A
  // different row handed in re-seeds every box.
  useEffect(() => {
    setRefusal(null);
    setTitle(event.title);
    setDate(event.date);
    setStartTime(event.startTime ?? '');
    setEndTime(event.endTime ?? '');
    setCategory(EVENT_CATEGORIES.some((c) => c.category === event.category) ? event.category : EVENT_CATEGORIES[0].category);
    setCost(box(event.cost));
    setLocation(event.location ?? '');
    setLat(box(event.latitude));
    setLon(box(event.longitude));
  }, [event]);

  const submit = async () => {
    setSubmitting(true);
    setRefusal(null);
    try {
      const body = {
        id: event.id,
        title,
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        category,
        // An empty box posts NOTHING — the row stores null, not zero.
        cost: typedNumber(cost) ?? null,
        location: location || null,
        // The stored account code goes back EXACTLY as stored — never re-picked
        // from a merged chart, never silently cleared by a correction.
        coaCode: event.coaCode ?? null,
        latitude: typedNumber(lat) ?? null,
        longitude: typedNumber(lon) ?? null,
      };
      const res = await fetch('/api/calendar/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // The server's own words, verbatim — it names the field it refused.
        setRefusal(data?.error ?? `The correction was not saved (HTTP ${res.status}).`);
        return;
      }
      const landedDate = data?.event?.start_date ? String(data.event.start_date).slice(0, 10) : date;
      onCorrected(landedDate);
    } catch (err) {
      setRefusal(err instanceof Error ? `The correction was not saved: ${err.message}` : 'The correction was not saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Above the day view (z-50) and the chain panel (z-60): a correction opens
       FROM either, so it sits on top of both. */
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" data-correct-event-layer>
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-white shadow-sm" data-correct-event-form>
        <div className={SECTION_HEADER}>
          <span>Correct the event <span className="font-mono text-[10px] text-text-muted">{MANUAL_EVENT_BADGE}</span></span>
          <button
            type="button"
            onClick={onCancel}
            data-correct-event-cancel
            className="rounded bg-bg-row px-2 py-0.5 text-[10px] font-semibold text-text-muted hover:bg-border"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className={LABEL} htmlFor="cef-title">Title</label>
              <input id="cef-title" className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-date">Date</label>
              <input id="cef-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-category">Category</label>
              <select id="cef-category" className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)}>
                {EVENT_CATEGORIES.map((c) => <option key={c.category} value={c.category}>{c.icon} {c.category}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-start">Start time</label>
              <input id="cef-start" type="time" className={INPUT} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-end">End time</label>
              <input id="cef-end" type="time" className={INPUT} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-cost">Expected cost</label>
              <input id="cef-cost" inputMode="decimal" className={INPUT} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="leave empty if none" />
            </div>
            <div className="col-span-2">
              <label className={LABEL} htmlFor="cef-location">Location</label>
              <input id="cef-location" className={INPUT} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="as typed — no lookup here" />
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-lat">Latitude</label>
              <input id="cef-lat" inputMode="decimal" className={INPUT} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className={LABEL} htmlFor="cef-lon">Longitude</label>
              <input id="cef-lon" inputMode="decimal" className={INPUT} value={lon} onChange={(e) => setLon(e.target.value)} placeholder="optional" />
            </div>
          </div>

          {/* The stored account, kept as stored — shown, never re-picked, never cleared. */}
          <p className="font-mono text-[10px] text-text-muted" data-correct-event-coa>
            {event.coaCode
              ? <>Account <span className="font-semibold">{event.coaCode}</span> — kept as stored. An account is chosen per line when a one-off is planned in Tasks; this row&rsquo;s is not re-picked here.</>
              : <>No account code on this row, and none is picked here — an account is chosen per line when a one-off is planned in Tasks.</>}
          </p>

          <p className="font-mono text-[10px] leading-relaxed text-text-faint" data-correct-event-coord-hint>
            Coordinates are optional: paste a pair, or clear both to drop the pin. Nothing is looked up here — a place
            lookup is part of planning a one-off in Tasks. An empty cost or time stays empty; it is never saved as 0 or as midnight.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={submit} disabled={submitting} className={`${MONEY_ACTION} ml-auto`} data-correct-event-submit>
              {submitting ? 'Saving…' : 'Save correction'}
            </button>
          </div>

          {refusal && <div className={STATE.errorCard} role="alert" data-correct-event-refusal>{refusal}</div>}
        </div>
      </div>
    </div>
  );
}
