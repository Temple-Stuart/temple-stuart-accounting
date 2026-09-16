'use client';

/**
 * EVENT-01 STEP 3/4 — "Add an event." The door DAY-01's audit found missing:
 * /api/calendar was GET-only, so the founder could plan a trip but not a
 * Tuesday. This is on /calendar, above the grid.
 *
 * WHAT IT ASKS FOR is exactly what a calendar_events row holds and nothing
 * invented: title, date, an optional start and end time, a category from the
 * census the existing writers already use, an optional expected cost, an
 * optional location, an optional account code, and — because this app adds NO
 * geocoder — optional coordinates as two numbers.
 *
 * WHAT IT NEVER DEFAULTS. An empty cost box is NOT $0: it posts nothing, the
 * row stores null, and DAY-01's day view renders it blank and counts it out of
 * the day's total. The same for the times (an untimed event groups under "no
 * time set") and the coordinates (the event lists under the map). The category
 * is the one field with no blank option, because a row with no category has no
 * icon and would render as a blank tile.
 *
 * THE ACCOUNT CODE is present only when there is a chart to pick from. The
 * chart list (GET /api/chart-of-accounts) is gated on the BOOKS module, so a
 * calendar-only user gets a 403 and no picker — the field is absent with a line
 * saying why, never an empty required box and never a free-text code.
 *
 * RECURRENCE IS NOT HERE. is_recurring and recurrence_rule exist on the table
 * and are written false/null. A recurring hand-entered event is EVENT-02: every
 * reader would have to expand occurrences, and nothing on this path does.
 */

import { useCallback, useEffect, useState } from 'react';
import { EVENT_CATEGORIES } from '@/lib/calendar/manualEvent';
// GEO-01: one Text Search, only on the press. The route is the only call site.
import { atCapLine, type PlaceMatch, type FindPlaceResult } from '@/lib/calendar/findPlace';
import { MANUAL_EVENT_BADGE } from '@/lib/calendar/sources';
import { MONEY_ACTION, SECTION_HEADER, STATE } from '@/lib/ds';

const INPUT = 'w-full bg-white border border-border rounded px-1.5 py-1 text-[11px] font-mono text-text-primary outline-none focus:border-brand-purple';
const LABEL = 'block text-[9px] uppercase tracking-wider text-text-muted mb-0.5';

interface CoaAccount { code: string; name: string }

/**
 * A hand-entered event the day view already holds, handed in for a correction.
 * The form does NOT re-fetch it: the day view read it from the same merged list
 * the grid drew, so a second read could only disagree with what the person is
 * looking at.
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

export interface AddEventFormProps {
  /** Called after an event lands, so the calendar reloads. */
  onAdded?: (dateKey: string) => void;
  /** When set, the form opens on this event and PATCHes instead of POSTing. */
  editEvent?: EditableEvent | null;
  onEditDone?: () => void;
}

/** A typed number, or undefined when the box is empty. `Number('')` is 0 — never that. */
function typedNumber(v: string): number | undefined {
  const s = v.trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export default function AddEventForm({ onAdded, editEvent, onEditDone }: AddEventFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState(EVENT_CATEGORIES[0].category);
  const [cost, setCost] = useState('');
  const [location, setLocation] = useState('');
  const [coaCode, setCoaCode] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  // ── GEO-01 — "Find this place" ──────────────────────────────────────────
  // ONE Google Places lookup, and ONLY from the button's handler below. There
  // is no effect, no debounce and no onBlur here on purpose: a metered call
  // must be something the person decided to spend, not something typing spent
  // for them. A build law holds this.
  const [finding, setFinding] = useState(false);
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null);
  // The exact text the matches belong to. A pick is only offered while the
  // typed location still equals this — otherwise the results are for something
  // the person is no longer asking about, so they are cleared rather than
  // reused against new text.
  const [matchesFor, setMatchesFor] = useState<string | null>(null);
  const [findError, setFindError] = useState<string | null>(null);
  const [usage, setUsage] = useState<FindPlaceResult['usage'] | null>(null);
  /** The picked match, so the form can say what filled the coordinates. */
  const [picked, setPicked] = useState<PlaceMatch | null>(null);

  const atCap = usage != null && usage.remaining <= 0;
  // Results belong to the text that fetched them; typing past that drops them.
  const staleMatches = matches !== null && matchesFor !== null && matchesFor !== location.trim();
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [landed, setLanded] = useState<{ title: string; start_date: string } | null>(null);

  // The chart, when the caller can read one. A 403 (no Books module) is not an
  // error to show — it is simply "no chart to pick from", and the field goes.
  const [coaAccounts, setCoaAccounts] = useState<CoaAccount[] | null>(null);
  const [coaUnavailable, setCoaUnavailable] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/chart-of-accounts')
      .then(async (res) => {
        if (!live) return;
        if (!res.ok) {
          setCoaAccounts([]);
          // The two refusals this route actually gives, each said in its own
          // words: 403 = no Books module, 412 = no entity set up yet
          // (chart-of-accounts/route.ts requireTabAccess / requireEntitySetup).
          setCoaUnavailable(
            res.status === 403
              ? 'No account code: the chart of accounts belongs to the Books module, which this account does not have.'
              : res.status === 412
                ? 'No account code: this account has no entity yet, so it has no chart of accounts.'
                : `No account code: the chart of accounts could not be read (HTTP ${res.status}).`,
          );
          return;
        }
        const data = await res.json();
        const list = (data.accounts ?? data.coaAccounts ?? []) as CoaAccount[];
        setCoaAccounts(list);
        if (list.length === 0) setCoaUnavailable('No account code: this chart has no accounts yet.');
      })
      .catch(() => { if (live) { setCoaAccounts([]); setCoaUnavailable('No account code: the chart of accounts could not be read.'); } });
    return () => { live = false; };
  }, []);

  const reset = useCallback(() => {
    setTitle(''); setDate(''); setStartTime(''); setEndTime('');
    setCategory(EVENT_CATEGORIES[0].category); setCost(''); setLocation('');
    setCoaCode(''); setLat(''); setLon(''); setRefusal(null);
    setMatches(null); setMatchesFor(null); setFindError(null); setPicked(null);
  }, []);

  /**
   * THE ONLY GEOCODE CALL SITE IN THE APP'S CALENDAR PATH. Invoked from the
   * button's onClick and from nowhere else — not an effect, not the submit, not
   * the edit prefill.
   */
  const findThisPlace = async () => {
    const q = location.trim();
    if (!q || finding || atCap) return;
    setFinding(true);
    setFindError(null);
    setMatches(null);
    setPicked(null);
    try {
      const res = await fetch(`/api/calendar/find-place?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => null);
      if (data?.usage) setUsage(data.usage);
      if (!res.ok) {
        // Every failure is NAMED — a refusal never comes back as "no matches".
        setFindError(data?.error ?? `The place could not be looked up (HTTP ${res.status}).`);
        return;
      }
      setMatches(data.matches ?? []);
      setMatchesFor(q);
    } catch (err) {
      setFindError(err instanceof Error ? `The place could not be looked up: ${err.message}` : 'The place could not be looked up.');
    } finally {
      setFinding(false);
    }
  };

  /** A pick fills all three fields at once. Nothing is auto-selected. */
  const pick = (m: PlaceMatch) => {
    setLocation(m.name);
    setMatchesFor(m.name);
    setLat(String(m.latitude));
    setLon(String(m.longitude));
    setPicked(m);
    setMatches(null);
    setFindError(null);
  };

  /** Drop the pick and keep the typed name with no coordinates — first-class. */
  const clearPick = () => {
    setPicked(null);
    setLat('');
    setLon('');
    setMatches(null);
    setFindError(null);
  };

  /** A stored number back into the box it came from. Null stays empty, not "0". */
  const box = (v: number | null) => (v == null ? '' : String(v));

  // A correction starts from what is STORED, handed in by the day view.
  useEffect(() => {
    if (!editEvent) return;
    setRefusal(null);
    setLanded(null);
    setTitle(editEvent.title);
    setDate(editEvent.date);
    setStartTime(editEvent.startTime ?? '');
    setEndTime(editEvent.endTime ?? '');
    setCategory(EVENT_CATEGORIES.some((c) => c.category === editEvent.category) ? editEvent.category : EVENT_CATEGORIES[0].category);
    setCost(box(editEvent.cost));
    setLocation(editEvent.location ?? '');
    setCoaCode(editEvent.coaCode ?? '');
    setLat(box(editEvent.latitude));
    setLon(box(editEvent.longitude));
    setOpen(true);
  }, [editEvent]);

  const submit = async () => {
    setSubmitting(true);
    setRefusal(null);
    setLanded(null);
    try {
      const body = {
        ...(editEvent ? { id: editEvent.id } : {}),
        title,
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        category,
        // An empty box posts NOTHING — the row stores null, not zero.
        cost: typedNumber(cost) ?? null,
        location: location || null,
        coaCode: coaCode || null,
        latitude: typedNumber(lat) ?? null,
        longitude: typedNumber(lon) ?? null,
      };
      const res = await fetch('/api/calendar/events', {
        method: editEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // The server's own words, verbatim — it names the field it refused.
        setRefusal(data?.error ?? `The event was not saved (HTTP ${res.status}).`);
        return;
      }
      setLanded(data?.event ?? null);
      const landedDate = data?.event?.start_date ? String(data.event.start_date).slice(0, 10) : date;
      reset();
      onEditDone?.();
      onAdded?.(landedDate);
    } catch (err) {
      setRefusal(err instanceof Error ? `The event was not saved: ${err.message}` : 'The event was not saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden border-x border-b border-border" data-add-event-form>
      <div className={SECTION_HEADER}>
        <span>{editEvent ? 'Correct the event' : 'Add an event'}</span>
        <button
          type="button"
          onClick={() => { if (open && editEvent) { reset(); onEditDone?.(); } setOpen((o) => !o); }}
          data-add-event-toggle
          className="rounded bg-brand-purple px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-purple-hover"
        >
          {open ? 'Close' : 'Add an event'}
        </button>
      </div>

      {landed && (
        <div className="bg-white px-4 py-2 text-xs text-status-success" role="status" data-add-event-landed>
          &ldquo;{landed.title}&rdquo; saved to {String(landed.start_date).slice(0, 10)}. Marked <span className="font-mono">{MANUAL_EVENT_BADGE}</span>.
        </div>
      )}

      {open && (
        <div className="bg-white px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className={LABEL} htmlFor="aef-title">Title</label>
              <input id="aef-title" className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Haircut" />
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-date">Date</label>
              <input id="aef-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-category">Category</label>
              <select id="aef-category" className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)}>
                {EVENT_CATEGORIES.map((c) => <option key={c.category} value={c.category}>{c.icon} {c.category}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-start">Start time</label>
              <input id="aef-start" type="time" className={INPUT} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-end">End time</label>
              <input id="aef-end" type="time" className={INPUT} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-cost">Expected cost</label>
              <input id="aef-cost" inputMode="decimal" className={INPUT} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="leave empty if none" />
            </div>
            {coaAccounts !== null && coaAccounts.length > 0 && (
              <div>
                <label className={LABEL} htmlFor="aef-coa">Account</label>
                <select id="aef-coa" className={INPUT} value={coaCode} onChange={(e) => setCoaCode(e.target.value)} data-add-event-coa>
                  <option value="">none</option>
                  {coaAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className={LABEL} htmlFor="aef-location">Location</label>
              <div className="flex items-center gap-1">
                <input
                  id="aef-location"
                  className={INPUT}
                  value={location}
                  /* Typing NEVER calls anything — it only invalidates results
                     that belonged to different text. */
                  onChange={(e) => { setLocation(e.target.value); setFindError(null); if (picked && e.target.value.trim() !== picked.name) setPicked(null); }}
                  placeholder="Thonglor barber"
                />
                <button
                  type="button"
                  data-find-place
                  onClick={findThisPlace}
                  disabled={finding || atCap || !location.trim()}
                  title={atCap && usage ? atCapLine(usage.cap, usage.resetsOn) : 'One lookup, when you press it'}
                  className="whitespace-nowrap rounded bg-brand-purple px-2 py-1 text-[10px] font-semibold text-white hover:bg-brand-purple-hover disabled:opacity-50"
                >
                  {finding ? 'Finding…' : atCap ? 'At the cap' : 'Find this place'}
                </button>
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-lat">Latitude</label>
              <input id="aef-lat" inputMode="decimal" className={INPUT} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className={LABEL} htmlFor="aef-lon">Longitude</label>
              <input id="aef-lon" inputMode="decimal" className={INPUT} value={lon} onChange={(e) => setLon(e.target.value)} placeholder="optional" />
            </div>
          </div>

          {/* ── GEO-01: the matches, the pick, the cap ── */}
          {findError && (
            <div className={STATE.errorCard} role="alert" data-find-place-error>{findError}</div>
          )}
          {atCap && usage && (
            <p className="font-mono text-[10px] leading-relaxed text-status-warning" data-find-place-at-cap>
              {atCapLine(usage.cap, usage.resetsOn)}
            </p>
          )}
          {matches !== null && !staleMatches && (
            <div data-find-place-matches>
              {matches.length === 0 ? (
                <p className="font-mono text-[10px] text-text-faint" data-find-place-none>
                  Google found nothing for that. Save the typed name on its own, or try different words.
                </p>
              ) : (
                <>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    {matches.length} match{matches.length === 1 ? '' : 'es'} — pick one, or keep what you typed
                  </div>
                  <ul className="divide-y divide-border rounded border border-border">
                    {matches.map((m) => (
                      <li key={m.placeId || `${m.latitude},${m.longitude}`}>
                        {/* NOTHING is auto-selected — a pick is always a press. */}
                        <button type="button" data-find-place-match onClick={() => pick(m)}
                          className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-bg-row">
                          <span className="font-medium">{m.name}</span>
                          {m.address && <span className="ml-1.5 text-text-muted">{m.address}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {picked && (
            <p className="font-mono text-[10px] text-text-muted" data-find-place-picked>
              Pinned to {picked.name} ({picked.latitude.toFixed(5)}, {picked.longitude.toFixed(5)}).
              <button type="button" data-find-place-clear onClick={clearPick} className="ml-2 underline hover:text-text-primary">
                Use the typed name with no coordinates
              </button>
            </p>
          )}

          {/* The place name saves on its own — coordinates are never required. */}
          <p className="font-mono text-[10px] leading-relaxed text-text-faint" data-add-event-coord-hint>
            Coordinates are optional. Press <span className="font-semibold">Find this place</span> to look the typed name up
            once — one lookup per press, never while you type — or paste a pair yourself. With both, the event pins on the
            day map; with neither, it is listed under the map as having no location set.
            {usage && !atCap && (
              <span data-find-place-headroom> {usage.remaining} of {usage.cap} lookups left this month (resets {usage.resetsOn}).</span>
            )}
          </p>
          {coaUnavailable && (
            <p className="font-mono text-[10px] text-text-faint" data-add-event-no-coa>{coaUnavailable}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-text-faint">
              An empty cost or time stays empty — it is never saved as 0 or as midnight.
            </span>
            <button type="button" onClick={submit} disabled={submitting} className={`${MONEY_ACTION} ml-auto`} data-add-event-submit>
              {submitting ? 'Saving…' : editEvent ? 'Save correction' : 'Add event'}
            </button>
          </div>

          {refusal && <div className={STATE.errorCard} role="alert" data-add-event-refusal>{refusal}</div>}
        </div>
      )}
    </div>
  );
}
