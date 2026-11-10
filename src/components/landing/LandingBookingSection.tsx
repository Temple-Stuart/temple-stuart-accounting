'use client';

// BOOK-1: the lobby books — the REAL travel search + booking components
// mounted directly on '/' (zero forks, zero duplicated search UIs; Alex's
// ruling). Guests type, search, see results, and complete flight + hotel
// bookings here without entering the app:
//   • flights book fully in-panel (LiteApiFlightCheckoutPanel — Nuitee-Stripe Elements);
//   • hotels ride the existing hosted-payment → /booking/confirm flow;
//   • BOOK-2: activities + ground transit (real Viator search; Book routes
//     to sign-up — no in-house booking exists) and the visa check (official
//     government link only — the never-affiliate rule, VisaResultView.tsx
//     :10-12) complete the five pillars. All five ride this section's single
//     lazy chunk (the BOOK-1 dynamic pattern).
// TOGGLE-1: the five stacked sections become ONE strip with a five-way
// toggle — the deleted teaser's form factor complete (container + toggle
// classes recovered verbatim from LandingSearchTeaser.tsx@840a053b, exactly
// as COMPACT-1 recovered its field vocabulary). One pillar's form is visible
// at a time; the rest are CSS-hidden but stay MOUNTED (the ModuleLauncher
// tab-panel precedent, ModuleLauncher.tsx:659 `'block' : 'hidden'`) so
// in-flight searches, results, and open checkouts SURVIVE toggling. The
// wrapper owns the ONLY toggle logic (one useState); the five components are
// untouched. The strip mounts where the teaser mounted — inside the hero,
// directly under the CTA row (Landing.tsx).
// Guest posture is passed EXPLICITLY: this section renders only on the
// verified-guest landing (FD-2 arrival branch), so authed={false} — save
// flows nudge sign-up (onRequireAuth = GuestLanding's real LoginBox opener,
// GuestLanding.tsx:31-39), no trips fetch ever fires, bookings are
// standalone. Cost posture is unchanged by mount location: every search
// route carries its own per-IP rateLimit + reserveTravelSearch daily cap
// server-side (e.g. flights/search/route.ts:26-49).

// DS-1: the toggle mechanism moved to the shared <ToggleStrip> (src/components/
// ui/ToggleStrip.tsx) — the SAME primitive the app travel tab now consumes.
// This wrapper just supplies the landing's five guest panels + the value blurb;
// container class (mt-8 + DS.STRIP), chip idiom, default (first = flights), and
// the mount-all/CSS-hide behavior are byte-identical to the pre-extraction
// TOGGLE-1 output.
// HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03): THE EVENTS INSIDE THE EVENTS TAB, FIRST AND OPEN. The experiences
// catalog left its full-width purple band under this box; Landing.tsx hands it in as `events`, and it is the panel of
// the builder's Events mode — whose key, label, icon and headline stay as the builder made them. That mode is moved to
// the FRONT of the list, and the strip opens on its first mode, so the box opens on Events ("first = flights" above
// is history; Flights is second). The other modes keep the builder's order and their own panels, untouched — the
// builder's file is frozen (src/lib/travelBookingFlow.ts) and is not edited: only the list it returns is re-ordered
// here. The builder's own Events panel (one sentence and a jump link to the band) is not rendered on this page: there
// is no band to jump to. No 'events' mode from the builder → this throws, by name — never a box without the catalog.
// HOME-BRIEF-05 (Alex, 2026-11-10 19:00: "start with events, and then once you select them, do flights, and hotels"):
// THE BOX HOLDS ITS OPEN TAB. Until now the strip kept the open tab to itself, so nothing outside the tab row could
// open one: with another tab open the catalog's section (id="events") is hidden, and the footer's "Events" link did
// nothing on this page. The open tab lives HERE now — React state only, no URL, no storage — starting on Events, and
// is handed to the strip (`activeKey` + `onActiveChange`); the list above and its order are unchanged.
// A LINK TO THE EVENTS opens the Events tab and then lands on the catalog. The mechanism is one effect with two
// listeners — a click anywhere on the page that is a plain click on a link to THIS page's events anchor (the footer's
// link is a client-side link: it changes the address without a hash-change event, and changes nothing at all when the
// address already ends in the anchor, which it does once a chip has been picked), and the window's hash change (Back
// and Forward) — each of which opens the tab and counts one landing; a second effect lands (landOnEvents, the
// catalog's own) after that render, when the panel is on the page again. No other hash is acted on.
// HOME-BRIEF-05, STAY NEAR IT (Alex, 2026-11-10 19:00; 2026-11-09 17:45: "would be cool if that populated destination
// but like user gonna wanna pick their own travel dates"): an event row's "Stay near it →" opens the Hotels tab with the
// event's place set. This file holds the pressed event's place in React state and does three things with it: it gives
// the catalog the press handler (StayNearContext, around the strip — the catalog is the Events panel); it WRAPS the
// builder's Hotels panel — the panel the builder returned, not the builder's file — in the starting place's provider
// (src/components/trips/startingPlace.ts), with one line over the form naming the event and its place; and on a press
// it opens Hotels and brings the top of the box into view. The Hotels form's file is frozen and is not edited: the
// place reaches the picker the form mounts through that context, and the picker reports it up as a click would.
// Never a date, and never a search — nothing reaches the hotel search until the visitor presses Search. No 'hotels'
// mode from the builder → a throw, by name, as for Events.
// HOME-FINISH-02 (Alex, 2026-11-10 20:56): THE DISCLOSURE, INSIDE THE BOX. "When you book here, I may earn a commission."
// (src/lib/disclosureWords.ts — its words unchanged) was one line under this box, in Landing.tsx; Alex: it "should no
// longer appear as a standalone marketing line beneath the booking interface … retain an appropriate concise disclosure
// in a compliant location". It is the LAST line of the four panels whose bookings can pay — Flights, Hotels, Getting
// around, Things to do (PAYING_KEYS; why these four, and why not Events, Visa or the two SOON tabs: that leaf) — beside
// the thing booked. On Hotels it stands after the form inside the starting place's provider, so the form keeps its seat
// among the provider's children and is never remounted; on the other three it is the builder's panel and then the
// sentence. The builder's file is not edited. A paying key the builder does not return → a throw, by name.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import ToggleStrip, { type ToggleMode } from '@/components/ui/ToggleStrip';
import { EVENTS_ANCHOR } from '@/lib/homeAnchors';
import type { Experience } from '@/lib/experiences';
import { stayNearLine } from '@/lib/experienceWords';
import { COMMISSION_LINE } from '@/lib/disclosureWords';
import { StartingPlaceContext, type StartingPlace } from '@/components/trips/startingPlace';
import { StayNearContext, landOnEvents } from './ExperiencesSection';
// PR-ELEV-1: the modes come from the ONE shared builder (8 chips — 5 live + 3
// "Soon"), so the guest landing and the app travel tab render the same strip
// and light up together as affiliate IDs land.
import { travelStripModes } from '@/components/trips/travelStripModes';

/** HOME-BRIEF-04 (2026-11-10): the builder's Events mode, by its key (travelStripModes.tsx). */
const EVENTS_KEY = 'events';
/** HOME-BRIEF-05 (2026-11-10): the builder's Hotels mode, by its key — the tab "Stay near it" opens. */
const HOTELS_KEY = 'hotels';
/** HOME-FINISH-02 (2026-11-10): the four modes whose bookings can pay a commission, by their keys (travelStripModes.tsx) — the disclosure is the last line of their panels. */
const PAYING_KEYS: readonly string[] = ['flights', 'hotels', 'transit', 'activities'];
/** HOME-BRIEF-05: the one line over the Hotels form — the house explainer's hairline (src/lib/ds.ts EXPLAINER), in primary ink at the form's size. */
const STAY_LINE = 'mt-4 border-l-2 border-brand-purple pl-3 text-sm text-text-primary';

/**
 * HOME-BRIEF-05 (2026-11-10): does this link go to THIS page's events block? `href` is the link's target and `here` the
 * page's own address; the link counts when it stays on this origin and this path and its hash is the events anchor —
 * whatever either address carries after the "?". Pure: two strings in, yes or no out.
 */
export function linksToEvents(href: string, here: string): boolean {
  const to = new URL(href, here);
  const at = new URL(here);
  return to.origin === at.origin && to.pathname === at.pathname && to.hash === `#${EVENTS_ANCHOR}`;
}

export default function LandingBookingSection({ onRequireAuth, events }: { onRequireAuth: () => void; events: ReactNode }) {
  // HOME-BRIEF-05 (2026-11-10): the open tab — held here, in React state only, starting on Events.
  const [open, setOpen] = useState<string>(EVENTS_KEY);
  // How many times a link or a hash change has asked for the catalog: each one lands once, after the render that opens the tab.
  const [landings, setLandings] = useState(0);
  useEffect(() => {
    const toEvents = () => {
      setOpen(EVENTS_KEY);
      setLandings((n) => n + 1);
    };
    // A plain click (primary button, no modifier key, same window) on a link to this page's events anchor.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target !== '' && link.target !== '_self')) return;
      if (linksToEvents(link.href, window.location.href)) toEvents();
    };
    // Back and Forward: the address's own hash became the events anchor.
    const onHashChange = () => {
      if (window.location.hash === `#${EVENTS_ANCHOR}`) toEvents();
    };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);
  useEffect(() => {
    if (landings === 0) return;
    landOnEvents(`#${EVENTS_ANCHOR}`, (id) => document.getElementById(id));
  }, [landings]);
  // HOME-BRIEF-05, STAY NEAR IT: the pressed event's place and its line — React state only. Each press makes a NEW place
  // object, so the same event pressed again is applied again by the picker.
  const [stay, setStay] = useState<{ place: StartingPlace; line: string } | null>(null);
  // How many presses have asked for the top of the box: each brings it into view once, after the render that opens Hotels.
  const [tops, setTops] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const stayNear = useCallback((row: Experience) => {
    setStay({ place: { countryCode: row.countryCode, country: row.country, city: row.city }, line: stayNearLine(row) });
    setOpen(HOTELS_KEY);
    setTops((n) => n + 1);
  }, []);
  useEffect(() => {
    if (tops === 0) return;
    if (box.current === null) throw new Error('LandingBookingSection: the box is not on the page — "Stay near it" has no top to bring into view');
    box.current.scrollIntoView();
  }, [tops]);
  // EVENTS-01b (2026-10-30): this strip sits in Landing.tsx, which mounts the experiences
  // section with id="events" directly under it — so the Events mode's jump link names it.
  // (experiences01.test.ts holds this literal equal to ExperiencesSection's EVENTS_ANCHOR.)
  // HOME-BRIEF-04 (2026-11-10): the section with id="events" is this strip's own Events panel now (`events`); the call
  // below is unchanged — the anchor still names where the experiences are on this surface.
  const modes: ToggleMode[] = travelStripModes({ onRequireAuth, authed: false, eventsAnchor: '#events' });
  const eventsMode = modes.find((m) => m.key === EVENTS_KEY);
  if (!eventsMode) throw new Error(`LandingBookingSection: travelStripModes returned no '${EVENTS_KEY}' mode (it returned ${modes.map((m) => m.key).join(', ') || 'none'}) — the experiences catalog has no tab to sit in`);
  // The Events mode first — the strip opens on its first mode — carrying the catalog as its panel; then the rest, in the builder's order.
  const ordered: ToggleMode[] = [{ ...eventsMode, panel: events }, ...modes.filter((m) => m.key !== EVENTS_KEY)];
  // HOME-BRIEF-05: the builder's Hotels panel, wrapped — the starting place around it, and the line over the form once an
  // event is pressed. The panel keeps its seat in the list and its place among the provider's children, so the form is
  // never remounted: its dates, its results and the picker's lists survive a press.
  if (!ordered.some((m) => m.key === HOTELS_KEY)) throw new Error(`LandingBookingSection: travelStripModes returned no '${HOTELS_KEY}' mode (it returned ${modes.map((m) => m.key).join(', ') || 'none'}) — "Stay near it" has no Hotels form to open`);
  // HOME-FINISH-02: the disclosure — the last line of each panel that can pay. Secondary ink: a disclosure has to be easy to read.
  for (const key of PAYING_KEYS) {
    if (!ordered.some((m) => m.key === key)) throw new Error(`LandingBookingSection: travelStripModes returned no '${key}' mode (it returned ${modes.map((m) => m.key).join(', ') || 'none'}) — the commission disclosure has no '${key}' panel to close`);
  }
  const disclosure = <p className="mt-3 text-xs text-text-secondary" data-commission-line>{COMMISSION_LINE}</p>;
  // Flights, Getting around, Things to do: the builder's panel, then the sentence. Every other mode but Hotels: as it came.
  const withDisclosure = (m: ToggleMode): ToggleMode => (PAYING_KEYS.includes(m.key) ? { ...m, panel: <>{m.panel}{disclosure}</> } : m);
  const shown: ToggleMode[] = ordered.map((m) => (m.key !== HOTELS_KEY ? withDisclosure(m) : {
    ...m,
    panel: (
      <StartingPlaceContext.Provider value={stay === null ? null : stay.place}>
        {stay !== null && <p role="status" className={STAY_LINE} data-stay-near-line>{stay.line}</p>}
        {m.panel}
        {disclosure}
      </StartingPlaceContext.Provider>
    ),
  }));

  return (
    // LANDING-V5 (Alex's ruling; spec :93-178): the demo section carries ZERO
    // purple — the PR-STRIP-DESIGN-2 band + floating-card straddle die on
    // this mount. The toggler survives, seated with its panels in ONE white
    // hairline card on the cream page (the spec's card chrome, house
    // rounded-lg idiom). The band headline died with the band (the section
    // h2 above already titles the demo, spec :99); TRAVEL_TRUST_CHIPS were
    // band furniture (white ink) — their facts survive in the spec caption
    // row ('SEARCHING IS ALWAYS FREE', FlightPickerView) and the spec footer
    // row Landing.tsx mounts under this strip. The app travel tab
    // (ModuleLauncher) keeps its band — this PR reseats the LANDING mount
    // only. Wiring untouched: same modes builder, same props.
    // HOME-BRIEF-05: the press handler reaches the catalog (the Events panel) through StayNearContext; the plain box
    // around the strip is what a press brings into view (scroll-mt-4: a little cream above the box's top edge).
    <StayNearContext.Provider value={stayNear}>
      <div ref={box} className="scroll-mt-4">
        <ToggleStrip
          className="mt-6 rounded-lg border border-border bg-white p-4"
          modes={shown}
          activeKey={open}
          onActiveChange={setOpen}
        />
      </div>
    </StayNearContext.Provider>
  );
}
