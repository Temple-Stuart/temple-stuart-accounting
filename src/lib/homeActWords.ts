/**
 * HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story") — THE HOME PAGE'S ACT HEADINGS, each
 * typed ONCE, here. Two with HOME-ORDER-01; the third, About Us, with HOME-BRIEF-02 (2026-11-10).
 *   · WHAT_WE_DO_HEADING — the first child of the travel block's section on the home page (Landing.tsx, the h2 that
 *                          carries data-act-heading): the heading over travel booking, the events, the guest's strip,
 *                          the plans and the professional services.
 *   · OUR_STORY_HEADING  — the trip log's h2 (WasHereSection.tsx, MY_TRIP_HEADLINE), over the trip cards.
 *   · ABOUT_US_HEADING   — the h2 of the act between them (StopZeroSection.tsx), over Alex's text; that text is its own
 *                          leaf's (src/lib/stopZeroWords.ts), not this file's.
 *
 * HOME-BRIEF-03 (Alex, 2026-11-10 18:09): one more line of the home page lived here —
 *   · SAVE_TRIPS_LINE    — in the travel block's foot row, right after "One trip holds everything — plans, bookings,
 *                          budget." (Landing.tsx): what an account adds to booking without one. HOME-FINISH-02
 *                          (2026-11-10): that row left the page, and the constant ("Create a free account to save
 *                          your trips.") left with its last reader.
 *
 * HOME-FINISH-02 (Alex's brief "HOME-FINISH | Temple Stuart Homepage Copy, Layout & Footer", 2026-11-10 20:56):
 *   · WHAT_WE_DO_HEADING stands ALONE now, in gold, directly above the three pillars (Landing.tsx — it was the travel
 *     section's first child until then); About Us and Our Story wear the same gold.
 *   · THE THREE PILLARS under it, in his order — PLAN → BUILD → EXPLORE — have their words here, word for word as he
 *     approved them. His rule for all three: "Purple title → Approved description → Existing functionality … No
 *     additional promotional headings or explanatory paragraphs between these elements." A pillar is its heading (an
 *     h2) and its paragraphs (one <p> each, in order); the component that draws it types neither.
 *       PLAN_PILLAR  — over the plans (HowToSection.tsx).
 *       BUILD_PILLAR — over the six service cards (Landing.tsx, the professional-services section). HOME-SERVICES-01 (2026-11-12): over
 *                      the six tiles now — ServicesSection.tsx, which Landing.tsx mounts.
 *       EXPLORE_PILLAR — over the booking box and the booking lookup (Landing.tsx, the travel section).
 *
 * PILLAR-NAMES-01 (Alex, 2026-11-11: "Financial Software | Professional Services | Travel Marketplace — these will
 * replace Plan your Escape / Build your Income / Explore the World, since honestly, its more clear to me with the new
 * ones."): THE THREE PILLARS' HEADINGS ARE THEIR NAMES NOW —
 *       PLAN_PILLAR    — "Financial Software"    ("Plan Your Escape." until then);
 *       BUILD_PILLAR   — "Professional Services" ("Build Your Income." until then);
 *       EXPLORE_PILLAR — "Travel Marketplace"    ("Explore the World." until then).
 *   · NO FULL STOP. The three they replace were sentences and ended in one; a name does not. Put to Alex in the audit
 *     before the build, and his answer was to drop it — so a pillar's heading reads as the page's other headings do
 *     (What We Do, About Us, Our Story), and the footer's link to it is the heading itself, letter for letter
 *     (src/lib/footerWords.ts FOOTER_SERVICES_LINKS).
 *   · UNCHANGED: every paragraph, the pillars' order, the sections' anchors, and the three constants' names — PLAN_,
 *     BUILD_ and EXPLORE_ still name the pillars in the code. "PLAN → BUILD → EXPLORE", above, is HOME-FINISH-02's
 *     own note of the order.
 *
 * HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila; the board approved on the design canvas at 14:30):
 *   · WHAT_WE_DO_HEADING keeps its element, its place and data-act-heading, and wears the EYEBROW now — small gold mono
 *     capitals over the first pillar's name (Landing.tsx, .ts-fs-heading / .ts-fs-eyebrow) — in place of HOME-FINISH-02's
 *     "in gold and one size up", for its look only. About Us and Our Story keep their gold headings.
 *   · AFTER THE BUILD (Alex's note on the built page, 2026-11-12: "i like how about us and What We do were the same.  About
 *     us is better size... IMO..."): WHAT_WE_DO_HEADING wears the act headings' type again — HOME-FINISH-02's "in gold and
 *     one size up", as About Us and Our Story do — in its HOME-PLANS-04 box (Landing.tsx, .ts-fs-heading). The eyebrow,
 *     above, is history.
 *   · PLAN_PILLAR: its heading is drawn, its paragraphs are not — one line stands where they stood (PLANS_SUBHEAD,
 *     src/lib/offer/plans.ts). KEPT, NOT DRAWN (2026-11-12), by the brief's ruling c: "WHAT LEAVES THE PAGE: the pillar's
 *     three paragraphs and the step lists in the cards. Both stay in their leaves, undrawn, with a dated note: the standing
 *     HOME-PLANS-03 gave the comparison." His three paragraphs stay here, word for word, read by no page.
 *
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12 15:16 Manila: "remove that text about and replace with like an image that SHOWS
 * what and why and how, rather than telling with words"; the board approved on the design canvas, 15:41 Manila):
 *   · BUILD_PILLAR: its heading stands; its paragraph is REPLACED by one line — the brief's ruling b, "THE PARAGRAPH IS
 *     REPLACED. BUILD_PILLAR.paragraphs holds the one new line, "Hands-on services, tailored to your needs."; his paragraph is
 *     quoted, dated, in the leaf's note. HOME-FINISH-02's "Approved description" is this line now." His paragraph, word for
 *     word as it stood from HOME-FINISH-02 (2026-11-10) until this brief: "Want to build your own system or something
 *     customized for your business? From full setup and custom development to integrations, ongoing maintenance, and
 *     bookkeeping, Temple Stuart offers hands-on services tailored to your needs." The section that draws the line is
 *     src/components/landing/ServicesSection.tsx now (Landing.tsx mounts it), and the pictures there show the rest.
 *
 * PURE, NO DIRECTIVE: no import, no state, no clock — one string each (a pillar: its heading and its paragraphs), so a
 * client component, a server component and a test all read the same words.
 */

export const WHAT_WE_DO_HEADING = 'What We Do';

export const ABOUT_US_HEADING = 'About Us';

export const OUR_STORY_HEADING = 'Our Story';

/** A pillar under "What We Do": its heading, then its paragraphs in order. */
export interface Pillar {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export const PLAN_PILLAR: Pillar = {
  heading: 'Financial Software',
  paragraphs: [
    'Get your bank data. Turn it into financial statements. See your income and expenses, what you own, what you owe, and what living at home actually costs.',
    'Plan ahead, budget for what you want to do, prepare for tax time, and compare your plans with what actually happened.',
    'Connect the dots across your personal, business, and trading finances to make better decisions about what comes next.',
  ],
};

export const BUILD_PILLAR: Pillar = {
  heading: 'Professional Services',
  paragraphs: [
    'Hands-on services, tailored to your needs.',
  ],
};

export const EXPLORE_PILLAR: Pillar = {
  heading: 'Travel Marketplace',
  paragraphs: [
    'Discover events and experiences worth traveling for, find flights and places to stay, and book the journey that gets you there.',
  ],
};
