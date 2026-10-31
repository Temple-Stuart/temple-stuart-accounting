'use client';

/**
 * GEO-01 — "Find this place." ONE Google Places Text Search, and ONLY when the
 * person presses the button. ONEOFF-01 MOVED IT HERE, INTACT: it lived inline in
 * the calendar's Add-an-event form, and the calendar authors nothing now — a
 * one-off is a routine authored in Tasks, and its place is found here.
 *
 * THE SAME ONE-PRESS RULE, THE SAME CAP. There is no effect, no debounce and no
 * onBlur here on purpose: a metered call must be something the person decided to
 * spend, not something typing spent for them. The route
 * (/api/calendar/find-place) is the only call site of the metered lookup and
 * this component is the only thing in the repo that renders the button — both
 * are build laws.
 *
 * WHAT IT OWNS: the press, the matches, the cap line and the headroom. WHAT THE
 * PARENT OWNS: the typed location and the coordinate pair. A pick hands all
 * three up at once (onPick); declining keeps the typed name and clears the pair
 * (onClear). NOTHING IS AUTO-SELECTED — a pick is always a press.
 */

import { useState } from 'react';
import { atCapLine, type PlaceMatch, type FindPlaceResult } from '@/lib/calendar/findPlace';

export interface FindThisPlaceProps {
  /** The typed location, owned by the parent form. */
  location: string;
  /** The match the parent currently holds as picked, or null. */
  picked: PlaceMatch | null;
  /** A pick fills the parent's location, latitude and longitude at once. */
  onPick: (m: PlaceMatch) => void;
  /** Drop the pick and keep the typed name with no coordinates — first-class. */
  onClear: () => void;
}

export default function FindThisPlace({ location, picked, onPick, onClear }: FindThisPlaceProps) {
  const [finding, setFinding] = useState(false);
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null);
  // The exact text the matches belong to. A pick is only offered while the
  // typed location still equals this — otherwise the results are for something
  // the person is no longer asking about, so they are cleared rather than
  // reused against new text.
  const [matchesFor, setMatchesFor] = useState<string | null>(null);
  const [findError, setFindError] = useState<string | null>(null);
  const [usage, setUsage] = useState<FindPlaceResult['usage'] | null>(null);

  const atCap = usage != null && usage.remaining <= 0;
  // Results belong to the text that fetched them; typing past that drops them.
  const staleMatches = matches !== null && matchesFor !== null && matchesFor !== location.trim();

  /**
   * THE ONLY GEOCODE CALL SITE IN THE APP. Invoked from the button's onClick and
   * from nowhere else — not an effect, not a submit, not a prefill.
   */
  const findThisPlace = async () => {
    const q = location.trim();
    if (!q || finding || atCap) return;
    setFinding(true);
    setFindError(null);
    setMatches(null);
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

  /** A pick fills all three fields at once, in the parent. Nothing is auto-selected. */
  const pick = (m: PlaceMatch) => {
    setMatchesFor(m.name);
    setMatches(null);
    setFindError(null);
    onPick(m);
  };

  /** Drop the pick and keep the typed name with no coordinates — first-class. */
  const clearPick = () => {
    setMatches(null);
    setFindError(null);
    onClear();
  };

  return (
    <div className="space-y-2" data-find-this-place>
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

      {findError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert" data-find-place-error>{findError}</div>
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
      <p className="font-mono text-[10px] leading-relaxed text-text-faint" data-find-place-hint>
        Coordinates are optional. Press <span className="font-semibold">Find this place</span> to look the typed name up
        once — one lookup per press, never while you type — or paste a pair yourself. With both, the occurrence pins on
        the day map; with neither, it is listed under the map as having no location set.
        {usage && !atCap && (
          <span data-find-place-headroom> {usage.remaining} of {usage.cap} lookups left this month (resets {usage.resetsOn}).</span>
        )}
      </p>
    </div>
  );
}
