'use client';

// BOOK-3: "YOUR TRIP SO FAR" — the guest's session trip, rendered under the
// landing's booking section. REPAINT-4a: Direction-C light chrome (white
// table on cream, gold money numerals); rows + running total + the
// honest account pitch (the ruled line, verbatim). AUTHED USERS NEVER SEE
// THIS by construction: it mounts only inside Landing, which only the FD-2
// verified-guest arrival branch renders (page.tsx — an authed arrival gets
// <HomeClient/>, never the Landing); authed users have the real trip hub.
// Fail-honest: readGuestTrip validates every row (guestTrip.ts) — absent or
// unparseable storage renders NOTHING; rows are never invented.
//
// HOME-TRAVEL-01 (Alex's brief, 2026-11-12 16:08 Manila: "if someone selects events, they add to a queue table below the search bar, so the
// person who adds them can see them for review to like aid in booking flights and stuff.... the see what they wanna do when it is, so they know
// dates they need to filter for flights and stuff, to build around the events"; the board approved on the design canvas at 20:26: "ok I approve
// the travel market place") — THE TRIP CARD, AS DRAWN (design-refs/home-travel-01/Section-Reference.html, .tm-trip; its rules ported to
// src/app/globals.css). It moved INTO the travel section: LandingBookingSection.tsx renders it directly under the box and above the lookup, on
// every tab, so its Stay near it → and Search flights → reach the box's open tab. Its own full-width band below the section is gone (until then:
// '<section className="w-full border-b border-border bg-bg-terminal">' over 'max-w-7xl mx-auto px-4 lg:px-8 py-8', a mono purple eyebrow, a
// white table of the bookings and a total row, the pitch and a flat gold button). It holds the guest's EVENTS as well as their bookings:
//   · the eyebrow, then — only while the trip holds an event — the summary ("3 events · Jan 17 – Mar 14, 2027", aria-live) and the gold
//     Search flights →, which opens Flights and brings the box into view and fills nothing: no airport, no date (Alex, 2026-11-09: "would be cool
//     if that populated destination but like user gonna wanna pick their own travel dates");
//   · the events, in src/lib/guestTripWords.ts's order — each with its dates, its name, "{city}, {country}", Stay near it → where the row can be
//     stayed near, and a round × that takes it out — and between two dated events in a row the days between them, or that they overlap (gold);
//   · then the bookings (BOOK-3's records: the kind, the name over the code, the amount) and the Total row or rows, one per currency, as before;
//   · then the pitch and Create free account (onRequireAuth), the quiet pill.
// Every word is a leaf's (src/lib/guestTripWords.ts — the four this file typed until now moved there; STAY_NEAR_WORDS, src/lib/experienceWords.ts).
// THE READ: useGuestTrip, below — in an effect, after mount, and again on the trip's update signal, so the server's HTML holds no trip and
// hydration stays safe; the box's Add buttons read the same read (LandingBookingSection.tsx). Null until read, and an empty trip: nothing drawn.
// FOCUS: a × hands the focus to the next event's ×, else the one before it; with no event left, to the box's open tab (onNoEventLeft).
// Q1 (ruled by Alex 2026-11-12: yes to "keep its row, say it is no longer listed, and give it its × to remove it"): an event the catalog no
// longer holds keeps its row — "No longer listed" where its dates go, its stored id where its name goes, no place, no Stay near it →, its ×.
// Q2 (ruled by Alex 2026-11-12: yes to "say so where they pressed, and add nothing"): a × the browser refuses to save leaves the trip as it was
// and says so under that row (the box's `notSaved`); the focus stays on the pressed ×. The press goes through the box (onRemove), which catches
// that one refusal and nothing else.

import { Fragment, useEffect, useRef, useState } from 'react';
import { GUEST_TRIP_EVENT, readGuestTripWhole, type GuestTripRecord } from '@/lib/guestTrip';
import type { Experience } from '@/lib/experiences';
import { STAY_NEAR_WORDS } from '@/lib/experienceWords';
import { CREATE_FREE_ACCOUNT, NOT_STATED, SEARCH_FLIGHTS, TOTAL, TRIP_EYEBROW, TRIP_PITCH, focusAfterRemove, removeWords, tripEventsView } from '@/lib/guestTripWords';

/** HOME-TRAVEL-01 (2026-11-12): the guest's trip, as read — its bookings and its events' catalog ids, each in the order added. */
export interface GuestTrip {
  bookings: GuestTripRecord[];
  events: string[];
}

/**
 * HOME-TRAVEL-01 (2026-11-12): THE ONE READ — in an effect, after mount (the server's HTML holds no trip), and again on every update signal
 * (GUEST_TRIP_EVENT: a guest booking, an event added or taken out). Null until the first read.
 */
export function useGuestTrip(): GuestTrip | null {
  const [trip, setTrip] = useState<GuestTrip | null>(null);
  useEffect(() => {
    const sync = () => setTrip(readGuestTripWhole());
    sync(); // effect-only read keeps hydration safe (server renders nothing)
    window.addEventListener(GUEST_TRIP_EVENT, sync);
    return () => window.removeEventListener(GUEST_TRIP_EVENT, sync);
  }, []);
  return trip;
}

/** A booking's amount, as BOOK-3 printed it: "USD 412.00". */
const money = (amount: number, currency: string): string => `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** HOME-TRAVEL-01: the three dots before a line between two events, as the reference draws them. */
function GapMark() {
  return <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.4" /><circle cx="5" cy="9" r="1.4" /><circle cx="5" cy="15" r="1.4" /></svg>;
}

/** HOME-TRAVEL-01: the round ×'s mark, as the reference draws it. */
function RemoveMark() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>;
}

export default function GuestTripStrip({ trip, today, onRequireAuth, onStayNear, onSearchFlights, onRemove, notSaved, onNoEventLeft }: {
  /** The one read (useGuestTrip) — null until it has been made. */
  trip: GuestTrip | null;
  /** The server's UTC day, 'YYYY-MM-DD' (src/app/page.tsx) — every event's words and dates are read from the catalog on it. */
  today: string;
  /** Create free account: the register opener. */
  onRequireAuth: () => void;
  /** Stay near it →: the panel row's own action — the box opens Hotels with the event's place. */
  onStayNear: (row: Experience) => void;
  /** Search flights →: the box opens Flights and comes into view. */
  onSearchFlights: () => void;
  /** A ×: the box takes the event out — true when it did; false when the browser refused to save it (Q2), and nothing changed. */
  onRemove: (id: string) => boolean;
  /** Q2: the line under the row whose × the browser refused to save — null when there is none. */
  notSaved: { id: string; words: string } | null;
  /** The last event was taken out: the box's open tab takes the focus. */
  onNoEventLeft: () => void;
}) {
  // FOCUS after a ×: undefined — nothing to move; an id — that event's ×; null — the box's open tab. Applied once the trip has been read again.
  const focusNext = useRef<string | null | undefined>(undefined);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const target = focusNext.current;
    if (target === undefined) return;
    focusNext.current = undefined;
    if (target === null) { onNoEventLeft(); return; }
    const button = removeButtons.current.get(target);
    if (button === undefined) throw new Error(`GuestTripStrip: the focus was to go to ${target}'s ×, and the card does not draw one`);
    button.focus();
  }, [trip, onNoEventLeft]);

  if (trip === null) return null;
  const view = tripEventsView(trip.events, today);
  if (view.events.length === 0 && trip.bookings.length === 0) return null;

  // A ×: the event leaves the trip; the focus then goes where focusAfterRemove says (the next ×, the one before, or the open tab). A refused save
  // (Q2) leaves it where it is, on the pressed ×, and the box says so under the row.
  const remove = (id: string) => {
    const next = focusAfterRemove(view.events.map((e) => e.id), id);
    if (onRemove(id)) focusNext.current = next;
  };

  // Per-currency totals over rows whose amount is known — a missing amount
  // renders a dash and is excluded from its total, never guessed.
  const totals = new Map<string, number>();
  for (const r of trip.bookings) {
    if (r.amountUsd !== null) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amountUsd);
  }

  return (
    <section className="ts-tm-trip" aria-label={TRIP_EYEBROW} data-trip>
      <div className="ts-tm-trip__head">
        <div className="ts-tm-trip__heading">
          <p className="ts-tm-trip__eyebrow">{TRIP_EYEBROW}</p>
          <p className="ts-tm-trip__summary" aria-live="polite" hidden={view.summary === null}>{view.summary ?? ''}</p>
        </div>
        <button className="ts-tm-cta" type="button" data-search-flights hidden={view.summary === null} onClick={onSearchFlights}>{SEARCH_FLIGHTS}</button>
      </div>
      <ul className="ts-tm-trip__list">
        {view.events.map((e) => (
          <Fragment key={e.id}>
            {e.gap !== null && <li className="ts-tm-gap" data-overlap={e.gap.overlap}><GapMark /><span>{e.gap.words}</span></li>}
            <li className="ts-tm-trip__row" data-trip-event={e.id} data-unlisted={e.row === null ? true : undefined}>
              <p className="ts-tm-trip__when">{e.when}</p>
              <div className="ts-tm-trip__event">
                <p className="ts-tm-trip__name">{e.name}</p>
                {e.place !== null && <p className="ts-tm-trip__place">{e.place}</p>}
              </div>
              <div className="ts-tm-trip__actions">
                {e.stay && e.row !== null && <button className="ts-tm-link" type="button" data-stay-near={e.id} onClick={() => { if (e.row !== null) onStayNear(e.row); }}>{STAY_NEAR_WORDS}</button>}
                <button
                  className="ts-tm-remove"
                  type="button"
                  aria-label={removeWords(e.name)}
                  data-remove={e.id}
                  onClick={() => remove(e.id)}
                  ref={(el) => { if (el === null) removeButtons.current.delete(e.id); else removeButtons.current.set(e.id, el); }}
                >
                  <RemoveMark />
                </button>
              </div>
              {notSaved !== null && notSaved.id === e.id && <p className="ts-tm-lookup__failure" role="alert" data-not-saved={e.id}>{notSaved.words}</p>}
            </li>
          </Fragment>
        ))}
        {trip.bookings.map((r) => (
          <li key={`${r.ts}-${r.confirmationCode ?? r.name}`} className="ts-tm-trip__row ts-tm-trip__row--booked" data-trip-booked>
            <p className="ts-tm-trip__kind">{r.type}</p>
            <div className="ts-tm-trip__event">
              <p className="ts-tm-trip__name">{r.name}</p>
              <p className="ts-tm-trip__code">{r.confirmationCode ?? NOT_STATED}</p>
            </div>
            <p className="ts-tm-trip__amount">{r.amountUsd !== null ? money(r.amountUsd, r.currency) : NOT_STATED}</p>
          </li>
        ))}
        {[...totals.entries()].map(([cur, sum]) => (
          <li key={cur} className="ts-tm-trip__total">
            <span className="ts-tm-trip__total-label">{TOTAL}{totals.size > 1 ? ` (${cur})` : ''}</span>
            <span className="ts-tm-trip__amount">{money(sum, cur)}</span>
          </li>
        ))}
      </ul>
      <div className="ts-tm-trip__foot">
        <p className="ts-tm-trip__pitch">{TRIP_PITCH}</p>
        <button className="ts-tm-quiet" type="button" onClick={onRequireAuth}>{CREATE_FREE_ACCOUNT}</button>
      </div>
    </section>
  );
}
