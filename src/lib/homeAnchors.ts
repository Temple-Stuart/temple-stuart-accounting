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
 *                                  (Landing.tsx, <section id={SERVICES_ANCHOR}); new with HOME-FINISH-02. HOME-SERVICES-01 (2026-11-12):
 *                                  the section is ServicesSection.tsx's now, which Landing.tsx mounts; the id stands there.
 * The footer reads three of them now — four since HERO-CREST-01, 2026-11-11, with MODULES_ANCHOR (below) — (src/lib/footerWords.ts): STOP_ZERO_ANCHOR (OUR STORY's Stop 0), SERVICES_ANCHOR
 * (Build Your Income) and DEMO_ANCHOR (Explore the World — it sits on that pillar's heading). THE BLOG left the footer,
 * and its links to /#events and /#my-trip with it; the two sections and the trip page still read those anchors.
 * HOME-PAGES-01 (Alex's brief, 2026-11-14; his answer to the audit the same day): the footer reads ONE of them now, DEMO_ANCHOR.
 * Its other three doors open the sections' own pages (src/lib/homePages.ts: /financial-software, /professional-services and
 * /about — with no fragment), so MODULES_ANCHOR is the bar's alone, SERVICES_ANCHOR the bar's and its section's (HOME-MENU-01, 2026-11-16: since then MODULES_ANCHOR is read by nothing under src but this file, and SERVICES_ANCHOR is its section's alone — the bar's names open its menu), and
 * STOP_ZERO_ANCHOR its section's alone: no link lands on #stop-0 now, and the id stays. HOME-TRIM-01 (2026-11-15): that section, Alex's letter, stands on /about alone now — the home page's About Us is one band with no id (AboutBand.tsx) — so of the anchors FOOTER-01 called the front door's, above, stop-0 is on no element of the front door: it is the letter's section's on /about, and still no link lands on it.
 *
 * ONE LITERAL REMAINS, NAMED: LandingBookingSection.tsx hands the strip `eventsAnchor: '#events'`, and
 * src/lib/__tests__/experiences01.test.ts T6 pins that call's text (its next line holds it equal to `#${EVENTS_ANCHOR}`).
 * Existing tests are not re-pinned in this PR, so it stays typed until a ruling moves that pin.
 *
 * PURE, NO DIRECTIVE: the footer renders as a server component on /pricing, /my-trip/[id] and /how-it-works (and, since
 * HOME-PAGES-01, on /financial-software, /professional-services and /about), and a
 * 'use client' module's exports reach a server component as client references, never strings — so the anchors cannot
 * live in the two 'use client' sections. The re-export brings src/lib/stopZeroWords.ts (and what it imports) along.
 *
 * HERO-CREST-01 (Alex, design canvas, 2026-11-11): a sixth name, and no new literal —
 *   · MODULES_ANCHOR   'modules' — the first pillar's section, the how-to (HowToSection.tsx, <section id="modules").
 * The top bar (LandingHeader.tsx) linked the three pillars — /#modules, /#services, /#demo — from every page that mounts
 * it until HOME-MENU-01 (2026-11-16: since then its names open the menu, and the menu's links read EVENTS_ANCHOR, DEMO_ANCHOR and MY_TRIP_ANCHOR here), and it may not retype an id. Until now this one had no home a second reader could import: the element's own literal
 * (HowToSection.tsx, guarded there by the plan law in scripts/assert-tool-registry.ts — which is why FOOTER-01 left it
 * "outside this ruling", above) and a PRIVATE copy for the footer's first link, src/lib/footerWords.ts
 * `const PLANS_SECTION_ID = 'modules'`. That copy MOVED here, under the name its neighbours wear; the footer and the
 * bar both read it, so it is typed once for both (HOME-PAGES-01, 2026-11-14: the bar alone reads it now; HOME-MENU-01, 2026-11-16: nothing under src reads it now but this file, and heroCrest01.test.ts still holds it equal to the how-to's id). (Not through footerWords.ts: that leaf imports tripPostWords.ts, which
 * imports experienceWords.ts, which imports src/lib/experiences.ts — 101 KB of source — and the bar is also mounted by
 * HomeClient.tsx, the cockpit, which imports none of them today.) The section's own literal stays where the plan law
 * holds it; src/lib/__tests__/heroCrest01.test.ts holds the two equal. WHAT THE BAR PAYS FOR READING IT HERE (its anchors since HOME-MENU-01, 2026-11-16: EVENTS_ANCHOR, DEMO_ANCHOR and MY_TRIP_ANCHOR — MODULES_ANCHOR, SERVICES_ANCHOR and DEMO_ANCHOR until then): the re-export below brings src/lib/stopZeroWords.ts into the bar's chunk — about 3 KB (1.3 to 1.4 KB gzipped, over two production builds) of Stop 0's words, on pages that never draw them.
 */

/** The first pillar's section — the how-to's `<section id="modules"` (HowToSection.tsx). HERO-CREST-01: moved here from src/lib/footerWords.ts, where it was the private PLANS_SECTION_ID. */
export const MODULES_ANCHOR = 'modules';

export const DEMO_ANCHOR = 'demo';

export const EVENTS_ANCHOR = 'events';

export const MY_TRIP_ANCHOR = 'my-trip';

export const SERVICES_ANCHOR = 'services';

// HOME-PAGES-01 (2026-11-14): no file outside the tests reads this re-export now — the footer was its one reader, and its Stop 0
// opens /about with no fragment. It stays: this is the anchors' one home. src/lib/stopZeroWords.ts said "the footer's link lands
// on it", twice (its header and the note over the constant): true until this brief, and re-said there by Alex's yes of 2026-11-15 — that leaf is
// held byte for byte (src/lib/__tests__/homeAbout01.test.ts), so the pin moved with the two notes; his words did not.
export { STOP_ZERO_ANCHOR } from './stopZeroWords';
