/**
 * FOOTER-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 17) — ONE HOME FOR THE FRONT DOOR'S ANCHORS.
 *
 * The four front-door anchors THE BLOG links to, each typed ONCE — here, or (Stop 0) in its own pure leaf. (The home
 * page's fifth, PlansSection.tsx's headingId default 'modules', is outside this ruling: the checkout's cancel_url and
 * the /modules pages land on it, and the plan law in scripts/assert-tool-registry.ts guards its literal.)
 *   · DEMO_ANCHOR      'demo'    — the live demo's eyebrow row (Landing.tsx, id={DEMO_ANCHOR}); new with FOOTER-01.
 *   · EVENTS_ANCHOR    'events'  — the experiences band (ExperiencesSection.tsx); MOVED here from that file, which
 *                                  imports it back and still exports it, so every existing import keeps working.
 *   · STOP_ZERO_ANCHOR 'stop-0'  — Stop 0 (StopZeroSection.tsx); RE-EXPORTED from src/lib/stopZeroWords.ts, where the
 *                                  literal stays (stopZero01 pins its value and the two import lines that read it).
 *   · MY_TRIP_ANCHOR   'my-trip' — MY TRIP (WasHereSection.tsx); MOVED here, imported back and still exported there.
 * Who reads them: the sections' own ids; the events band's "Read my story" link (ExperiencesSection.tsx, STOP_ZERO_ANCHOR)
 * and its chips' URL (ExperiencesSection.tsx's router.replace, EVENTS_ANCHOR); the footer's THE BLOG links
 * (src/lib/footerWords.ts); and the trip page's two links back to the front door (TripPostView.tsx POST_BACK_HREF,
 * BOOK_HREF).
 *
 * HOME-FINISH-02 (Alex, 2026-11-10 20:56 — "a stable anchor so the footer can link directly to Build Your Income"): a fifth,
 *   · SERVICES_ANCHOR  'services' — the professional-services section, the second pillar under "What We Do"
 *                                  (Landing.tsx, <section id={SERVICES_ANCHOR}); new with HOME-FINISH-02.
 * The footer reads three of them now (src/lib/footerWords.ts): STOP_ZERO_ANCHOR (OUR STORY's Stop 0), SERVICES_ANCHOR
 * (Build Your Income) and DEMO_ANCHOR (Explore the World — it sits on that pillar's heading). THE BLOG left the footer,
 * and its links to /#events and /#my-trip with it; the two sections and the trip page still read those anchors.
 *
 * ONE LITERAL REMAINS, NAMED: LandingBookingSection.tsx hands the strip `eventsAnchor: '#events'`, and
 * src/lib/__tests__/experiences01.test.ts T6 pins that call's text (its next line holds it equal to `#${EVENTS_ANCHOR}`).
 * Existing tests are not re-pinned in this PR, so it stays typed until a ruling moves that pin.
 *
 * PURE, NO DIRECTIVE: the footer renders as a server component on /pricing, /my-trip/[id] and /how-it-works, and a
 * 'use client' module's exports reach a server component as client references, never strings — so the anchors cannot
 * live in the two 'use client' sections. The re-export brings src/lib/stopZeroWords.ts (and what it imports) along.
 */

export const DEMO_ANCHOR = 'demo';

export const EVENTS_ANCHOR = 'events';

export const MY_TRIP_ANCHOR = 'my-trip';

export const SERVICES_ANCHOR = 'services';

export { STOP_ZERO_ANCHOR } from './stopZeroWords';
